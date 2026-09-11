/**
 * Reads the conversation already rendered on the page you are signed into, and
 * only when you ask it to.
 *
 * It does not touch cookies, credentials, MFA, or any private API. It reads the
 * DOM, which is the same thing you could do by selecting the page and copying
 * it — just without losing the roles and the ordering. Nothing leaves the page
 * until you click Save in the popup.
 *
 * No bundler on purpose: this file is loaded directly as a content script, so
 * the extension can be installed unpacked with no build step. The adapter
 * registry below is the same abstraction a bundled version would have.
 */

/**
 * @typedef {{ role: "user"|"assistant", content: string }} RawMessage
 * @typedef {{
 *   source: string,
 *   sourceConversationId: string|null,
 *   title: string,
 *   url: string,
 *   messages: RawMessage[],
 *   capturedAt: string
 * }} RawConversation
 */

/**
 * A source adapter. `detect()` says whether this adapter understands the page;
 * `extract()` returns the normalized shape the backend accepts.
 *
 * Adding Claude or Gemini means adding an object to this array. Nothing else in
 * the extension — and nothing at all in the backend — needs to change.
 */
const ADAPTERS = [
  {
    id: "chatgpt",
    label: "ChatGPT",

    detect() {
      return /(^|\.)chatgpt\.com$/.test(location.hostname) ||
        /(^|\.)chat\.openai\.com$/.test(location.hostname);
    },

    /**
     * ChatGPT marks each turn with `data-message-author-role`. That attribute
     * has been stable far longer than any class name on the page, which are
     * generated and change without notice — so it is the only thing this
     * selector depends on.
     */
    extract() {
      const nodes = document.querySelectorAll("[data-message-author-role]");
      /** @type {RawMessage[]} */
      const messages = [];

      for (const node of nodes) {
        const role = node.getAttribute("data-message-author-role");
        if (role !== "user" && role !== "assistant") continue;

        const content = readText(node);
        if (content) messages.push({ role, content });
      }

      return {
        source: "chatgpt",
        sourceConversationId: conversationIdFromPath(),
        title: readTitle(),
        url: location.href,
        messages,
        capturedAt: new Date().toISOString(),
      };
    },
  },
];

/**
 * Pulls readable text out of a turn, keeping code blocks intact. `innerText`
 * alone collapses fenced code into unreadable runs, and code is often the part
 * of a conversation actually worth recovering.
 */
function readText(node) {
  const clone = node.cloneNode(true);

  // Strip the hover toolbars ChatGPT injects into each turn — otherwise every
  // captured message ends with "Copy Edit Regenerate".
  for (const junk of clone.querySelectorAll("button, [role='button'], svg")) {
    junk.remove();
  }

  for (const pre of clone.querySelectorAll("pre")) {
    const code = pre.innerText.trim();
    pre.replaceWith(document.createTextNode(`\n\`\`\`\n${code}\n\`\`\`\n`));
  }

  return (clone.innerText || clone.textContent || "").trim();
}

function conversationIdFromPath() {
  const match = location.pathname.match(/\/c\/([0-9a-f-]{16,})/i);
  return match ? match[1] : null;
}

function readTitle() {
  const active = document.querySelector("nav a[aria-current='page']");
  const fromNav = active?.textContent?.trim();
  if (fromNav) return fromNav;

  const title = document.title.replace(/\s*[|·-]\s*ChatGPT\s*$/i, "").trim();
  return title || "Untitled conversation";
}

function activeAdapter() {
  return ADAPTERS.find((adapter) => adapter.detect()) ?? null;
}

/* -------------------------------------------------------------------------- */
/*  Loading the whole conversation                                            */
/* -------------------------------------------------------------------------- */

/**
 * Finds the element that actually scrolls the transcript. ChatGPT does not
 * scroll the document — it scrolls an inner pane — so `window.scrollTo` does
 * nothing and the history never loads.
 */
function scrollPane() {
  const first = document.querySelector("[data-message-author-role]");
  let el = first?.parentElement;
  while (el && el !== document.body) {
    const overflow = getComputedStyle(el).overflowY;
    if ((overflow === "auto" || overflow === "scroll") && el.scrollHeight > el.clientHeight + 40) {
      return el;
    }
    el = el.parentElement;
  }
  return document.scrollingElement ?? document.documentElement;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Scrolls to the top until no more turns appear.
 *
 * Long threads are virtualised: only the turns near the viewport exist in the
 * DOM at all, so capturing what is on screen silently yields a fragment of a
 * long conversation — with no error, and a plausible-looking message count.
 * That is the worst kind of failure, because the result looks fine.
 *
 * Bounded by both time and iterations so a huge thread degrades to a partial
 * capture rather than hanging the popup forever.
 */
async function loadFullHistory({ budgetMs = 25_000 } = {}) {
  const pane = scrollPane();
  const startedAt = Date.now();
  const restore = pane.scrollTop;

  let previous = -1;
  let settled = 0;

  // Three consecutive passes with no new turns means the top is reached.
  while (settled < 3 && Date.now() - startedAt < budgetMs) {
    const count = document.querySelectorAll("[data-message-author-role]").length;
    settled = count === previous ? settled + 1 : 0;
    previous = count;

    pane.scrollTop = 0;
    await sleep(300);
  }

  // Put the view back where they left it; capture should not move their page.
  pane.scrollTop = restore;

  return {
    reachedTop: settled >= 3,
    elapsedMs: Date.now() - startedAt,
  };
}

async function readConversation() {
  const adapter = activeAdapter();
  if (!adapter) {
    return { ok: false, error: "This page is not a supported AI conversation." };
  }

  const scroll = await loadFullHistory();
  const conversation = adapter.extract();

  if (!conversation.messages.length) {
    return {
      ok: false,
      error: "No messages found. Open a conversation and let it finish loading.",
    };
  }

  /*
   * A complete conversation always opens with the person, never the assistant.
   * If it does not, we are still looking at a window into the middle of a long
   * thread — worth saying out loud, because the capture otherwise looks fine.
   */
  const partial = conversation.messages[0].role !== "user";

  return {
    ok: true,
    conversation,
    adapter: adapter.label,
    partial,
    reachedTop: scroll.reachedTop,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message?.type !== "READ_CONVERSATION") return false;

  // Scrolling the history in is async, so the channel is held open until it
  // resolves — hence the `true` below.
  readConversation()
    .then(respond)
    .catch((error) => respond({ ok: false, error: String(error?.message ?? error) }));

  return true;
});
