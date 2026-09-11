/**
 * The popup is the only place a conversation is ever sent. It reads the page,
 * shows you exactly what it found, and waits — the default is that nothing
 * happens, which is the point of a manual capture layer.
 */

const els = {
  status: document.getElementById("status"),
  preview: document.getElementById("preview"),
  title: document.getElementById("title"),
  meta: document.getElementById("meta"),
  error: document.getElementById("error"),
  save: document.getElementById("save"),
  openSettings: document.getElementById("open-settings"),
  settings: document.getElementById("settings"),
};

let conversation = null;

const openOptions = (event) => {
  event.preventDefault();
  chrome.runtime.openOptionsPage();
};

els.settings.addEventListener("click", openOptions);
els.openSettings.addEventListener("click", openOptions);

/**
 * `showSettings` promotes the options page to the primary button. Used when the
 * extension cannot possibly work until it is configured — at that point Save is
 * not a choice the user has, so offering it is just a dead control.
 */
function fail(message, { showSettings = false } = {}) {
  els.status.hidden = true;
  els.error.hidden = false;
  els.error.textContent = message;
  els.save.disabled = true;
  if (showSettings) {
    els.save.hidden = true;
    els.openSettings.hidden = false;
    els.settings.classList.add("pulse");
  }
}

async function settings() {
  const stored = await chrome.storage.local.get(["endpoint", "token"]);
  return {
    endpoint: (stored.endpoint || "http://localhost:3000").replace(/\/+$/, ""),
    token: stored.token || "",
  };
}

async function init() {
  const { token } = await settings();
  if (!token) {
    fail(
      "Not set up yet. You need your app address and a device token — generate one in the app under Settings → Browser capture.",
      { showSettings: true },
    );
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    fail("No active tab.");
    return;
  }

  // Loading a long thread's history takes seconds, so say what is happening
  // rather than showing a popup that looks hung.
  els.status.textContent = "Loading the whole conversation…";

  const ask = () => chrome.tabs.sendMessage(tab.id, { type: "READ_CONVERSATION" });

  let response;
  try {
    response = await ask();
  } catch {
    /*
     * No receiver in the tab. Almost always because content scripts are only
     * auto-injected into pages loaded AFTER the extension was installed or
     * reloaded — so any tab that was already open has none, which looks
     * identical to "this page is not supported".
     *
     * Injecting on demand fixes it without making the user reload the page.
     * `activeTab` grants access to this tab because they just clicked the icon.
     */
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["src/content.js"],
      });
      response = await ask();
    } catch {
      fail(
        "Could not read this tab. Open a ChatGPT conversation and click the icon again — " +
          "if it is already open, reload the page first.",
      );
      return;
    }
  }

  if (!response?.ok) {
    fail(response?.error ?? "Could not read this page.");
    return;
  }

  conversation = response.conversation;
  const words = conversation.messages.reduce(
    (sum, message) => sum + message.content.split(/\s+/).length,
    0,
  );

  els.status.hidden = true;
  els.preview.hidden = false;
  els.title.textContent = conversation.title;
  els.meta.textContent = `${response.adapter} · ${conversation.messages.length} messages · ~${words.toLocaleString()} words`;
  els.save.disabled = false;

  /*
   * Saying so is the whole point. A partial capture looks completely successful
   * — a plausible title and a plausible message count — and the only tell is
   * that the transcript starts mid-thread. Left unsaid, it silently degrades
   * everything downstream.
   */
  if (response.partial) {
    els.error.hidden = false;
    els.error.textContent = response.reachedTop
      ? "Heads up: this starts with a reply, not your message — the top of the thread may not have loaded. Scroll up in the page and click the icon again."
      : "Heads up: this is a very long thread and not all of it loaded. Scroll up in the page and click the icon again to get more.";
  }
}

els.save.addEventListener("click", async () => {
  if (!conversation) return;

  const { endpoint, token } = await settings();
  els.save.disabled = true;
  els.save.textContent = "Saving…";
  els.error.hidden = true;

  try {
    const response = await fetch(`${endpoint}/api/ingest`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(conversation),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      fail(payload.error ?? `The server returned ${response.status}.`);
      els.save.textContent = "Save conversation";
      return;
    }

    els.save.textContent = payload.created ? "Saved" : "Updated";
    els.preview.hidden = true;
    els.status.hidden = false;
    els.status.textContent = `${payload.messages} messages ${payload.created ? "saved" : "re-synced"} — ${payload.status}.`;
  } catch {
    // Almost always the host permission, or the app not running.
    fail(
      `Could not reach ${endpoint}. Check the app is running, and that you granted permission for that address in Settings.`,
      { showSettings: true },
    );
    els.save.textContent = "Save conversation";
  }
});

void init();
