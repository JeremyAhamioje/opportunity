# Conversation Capture

Saves an AI conversation you are reading into your own Opportunity Command
Center, when you click Save. Manifest V3, no build step.

## Install

1. Open `chrome://extensions` and turn on **Developer mode**.
2. **Load unpacked** → select this `extension/` folder.
3. In the app, go to **Settings → Browser capture** and generate a token. It is
   shown once.
4. Open the extension's options page and paste your app address
   (`http://localhost:3000`) and the token, then **Save and grant access**.

   Three ways to reach that page, in case one is not where you expect:
   - Right-click the extension's toolbar icon → **Options**
   - `chrome://extensions` → the extension → **Details** → **Extension options**
   - Click the toolbar icon → **Open settings** (shown as the main button until
     a token is saved)

   If there is no icon in the toolbar, Chrome has it hidden behind the
   **puzzle-piece** button — click that and pin it.

## Use

Open a ChatGPT conversation, click the extension icon, check what it found, and
press **Save conversation**. It lands in the app under Conversations with the
status `pending`; press **Read** there to extract ideas from it.

Saving the same conversation again updates it rather than duplicating — useful
once a chat has grown.

## What it does and does not do

- Reads the conversation text rendered on the page, only when you click Save.
- Sends it to the address you configured, with your device token.
- **Never** reads cookies, passwords, or MFA codes.
- **Never** bypasses any site's authentication or uses a private API.
- Captures nothing on its own — there is no background sync, and the default is
  that nothing happens.

Host access is requested for the single address you enter, at the moment you
enter it, rather than claimed up front in the manifest. The extension holds no
standing permission to talk to anything else.

## Adding another source

`src/content.js` holds an `ADAPTERS` array. Each entry is
`{ id, label, detect(), extract() }` and returns the same shape:

```js
{
  source: "claude",
  sourceConversationId: "…",   // enables re-sync instead of duplication
  title: "…",
  url: location.href,
  messages: [{ role: "user" | "assistant", content: "…" }],
  capturedAt: new Date().toISOString(),
}
```

Add an object, add the host to `content_scripts.matches` and to the `source`
enum in `lib/domain/archaeology.ts`. Nothing else changes — the backend accepts
that shape from any source.

## Testing it against live ChatGPT

Two things can fail independently, so test them separately — otherwise a single
error message has two possible causes and you are guessing.

### 1. The scrape (needs your signed-in browser)

Open a ChatGPT conversation, press **F12 → Console**, paste the contents of
[`probe.js`](probe.js), and press Enter. Nothing is installed and nothing is
sent anywhere; it reports only what the adapter *would* find:

```
[probe] messages found: 24
[probe] roles: { user: 12, assistant: 12 }
[probe] conversation id: 68b2f4a1-…
```

- **0 messages** → the selector is stale. The probe prints candidate selectors
  present on the page; update `ADAPTERS[0].extract` in `src/content.js`.
- **Fewer messages than the conversation has** → see virtualisation below.

The probe also leaves the exact payload on `window.__probePayload`. Run
`copy(__probePayload)` and paste it into the app's **Conversations** screen to
test the whole backend with no extension installed at all.

### 2. The plumbing (no browser needed)

Generate a token in **Settings → Browser capture**, then:

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "content-type: application/json" \
  -H "authorization: Bearer oc_…" \
  --data '{"source":"chatgpt","title":"Test","messages":[{"role":"user","content":"I will build a test harness tomorrow."}]}'
```

`201` with `"created":true` means auth, CORS, validation and storage all work.
Posting the same `sourceConversationId` twice returns `200` with
`"created":false` — a re-sync, not a duplicate.

**This half is verified.** Create, re-sync, both 401 paths and the CORS preflight
were tested against a running server; a ChatGPT-shaped payload went in over HTTP
and came out as insights with relative dates resolved against the conversation's
own date.

### 3. End to end

Install, configure, open a conversation, click the icon, press **Save**. It
appears under Conversations as `pending`; press **Read** to extract. If the
popup reports a network error but the probe found messages, the problem is the
address or the host permission — reopen the extension's Settings and save again
to re-request it.

## Known fragility

The ChatGPT adapter reads `[data-message-author-role]`, which has been far more
stable than the generated class names on that page — but it is still someone
else's markup and can change without notice. When it does, the symptom is
"No messages found" in the popup, and the fix is one selector in
`src/content.js`.

This is inherent to DOM capture. If an official export or API becomes available,
the adapter is replaced and the rest of the product is untouched.

**Virtualised long threads are the failure that looks like success.** ChatGPT
only keeps turns near the viewport in the DOM, so a 200-message conversation can
capture as 20 with no error at all — the popup will cheerfully say "20 messages"
and you would never know the rest were missing. Scroll to the very top of a long
conversation before pressing Save, and use the probe to confirm the count stops
rising. Re-saving after scrolling updates the same conversation rather than
duplicating it, so a short capture is always recoverable.

**Paste still works.** The app's Conversations screen accepts a pasted
transcript or an uploaded export, so a broken selector never blocks capture
entirely.
