/**
 * Selector probe — paste this into the DevTools console on a ChatGPT
 * conversation page (F12 → Console). Nothing is installed and nothing is sent
 * anywhere; it only reports what the extension's adapter *would* find.
 *
 * This exists because the extension has two independent failure modes, and
 * telling them apart from an error message is slow:
 *
 *   1. The DOM selectors no longer match  → this probe finds 0 messages.
 *   2. Token / permission / endpoint      → this probe is fine, the popup errors.
 *
 * Run this first. If it reports messages, the scrape works and any problem is
 * in the plumbing.
 */

(() => {
  const out = (...args) => console.log("%c[probe]", "color:#2383e2;font-weight:600", ...args);

  const nodes = document.querySelectorAll("[data-message-author-role]");
  if (!nodes.length) {
    console.error(
      "[probe] Found 0 messages.\n" +
        "The `data-message-author-role` attribute is not on this page.\n" +
        "Either this is not a conversation view, or ChatGPT changed its markup —\n" +
        "in which case update the selector in extension/src/content.js.",
    );
    // A hint at what replaced it, so the fix is not a guessing game.
    const guesses = new Set();
    for (const el of document.querySelectorAll("[data-testid], [class*='message']")) {
      const testid = el.getAttribute("data-testid");
      if (testid) guesses.add(`[data-testid="${testid}"]`);
    }
    if (guesses.size) {
      console.warn("[probe] Candidate selectors present on this page:", [...guesses].slice(0, 12));
    }
    return;
  }

  const readText = (node) => {
    const clone = node.cloneNode(true);
    for (const junk of clone.querySelectorAll("button, [role='button'], svg")) junk.remove();
    for (const pre of clone.querySelectorAll("pre")) {
      pre.replaceWith(document.createTextNode(`\n\`\`\`\n${pre.innerText.trim()}\n\`\`\`\n`));
    }
    return (clone.innerText || clone.textContent || "").trim();
  };

  const messages = [];
  for (const node of nodes) {
    const role = node.getAttribute("data-message-author-role");
    if (role !== "user" && role !== "assistant") continue;
    const content = readText(node);
    if (content) messages.push({ role, content });
  }

  const idMatch = location.pathname.match(/\/c\/([0-9a-f-]{16,})/i);
  const active = document.querySelector("nav a[aria-current='page']");
  const title =
    active?.textContent?.trim() ||
    document.title.replace(/\s*[|·-]\s*ChatGPT\s*$/i, "").trim() ||
    "Untitled conversation";

  out("messages found:", messages.length);
  out("roles:", {
    user: messages.filter((m) => m.role === "user").length,
    assistant: messages.filter((m) => m.role === "assistant").length,
  });
  out("title:", title);
  out("conversation id:", idMatch ? idMatch[1] : "(none — re-syncing will duplicate)");
  out("total characters:", messages.reduce((sum, m) => sum + m.content.length, 0).toLocaleString());

  if (messages.length) {
    out("first message:", messages[0].content.slice(0, 160));
    out("last message:", messages.at(-1).content.slice(0, 160));
  }

  /*
   * The one failure that looks like success. ChatGPT virtualises long threads:
   * only the turns near the viewport exist in the DOM at all, so a 200-message
   * conversation can silently capture as 20. Scroll to the very top and re-run
   * before trusting the count on any long chat.
   */
  console.warn(
    "[probe] Scroll to the TOP of the conversation and run this again.\n" +
      "If the count goes up, the page is virtualised and only rendered turns can be captured.\n" +
      "For long threads, scroll fully up before pressing Save in the extension.",
  );

  // Handy for a round-trip test without the extension — see extension/README.md.
  const payload = {
    source: "chatgpt",
    sourceConversationId: idMatch ? idMatch[1] : null,
    title,
    url: location.href,
    messages,
    capturedAt: new Date().toISOString(),
  };
  window.__probePayload = payload;
  out("payload on `window.__probePayload` — `copy(__probePayload)` to copy it.");

  return payload;
})();
