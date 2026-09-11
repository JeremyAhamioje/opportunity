const els = {
  endpoint: document.getElementById("endpoint"),
  token: document.getElementById("token"),
  save: document.getElementById("save"),
  error: document.getElementById("error"),
  ok: document.getElementById("ok"),
};

async function load() {
  const stored = await chrome.storage.local.get(["endpoint", "token"]);
  els.endpoint.value = stored.endpoint ?? "http://localhost:3000";
  els.token.value = stored.token ?? "";
}

function show(node, message) {
  els.error.hidden = true;
  els.ok.hidden = true;
  node.hidden = false;
  node.textContent = message;
}

els.save.addEventListener("click", async () => {
  const endpoint = els.endpoint.value.trim().replace(/\/+$/, "");
  const token = els.token.value.trim();

  let origin;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    origin = `${url.origin}/*`;
  } catch {
    show(els.error, "That address is not a valid http(s) URL.");
    return;
  }

  if (!token.startsWith("oc_")) {
    show(els.error, "That does not look like a device token — they start with oc_.");
    return;
  }

  /*
   * Host access is requested for the one address you entered, at the moment you
   * enter it, rather than being claimed up front in the manifest. The extension
   * therefore holds no standing permission to talk to anything else.
   */
  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) {
    show(els.error, "Permission denied, so the extension cannot reach that address.");
    return;
  }

  await chrome.storage.local.set({ endpoint, token });
  show(els.ok, "Saved. Open a conversation and click the extension icon.");
});

void load();
