# Changelog

All notable changes to museSpeak. Versions follow the project's standing rule: small fixes and refinements bump the minor number (0.1 → 0.2), redesigns bump the major (1.0, 2.0).

## [0.4] — 2026-10-11

Missing-toggle fix, from a console diagnosis.

- The v0.3 script was arming correctly (its log lines were present and there were no museSpeak errors), but it also injected into muse.ai's hidden marketing iframes, and the app could discard the injected toggle on re-render.
- Added `@noframes` plus a top-frame guard — museSpeak now runs only in the main page.
- The toggle button is self-healing: it checks every 2 seconds and re-attaches itself if the page threw it away.

## [0.3] — 2026-10-11

Performance and own-message fixes after live testing on a very long chat.

- Typing no longer triggers scans: mutations inside the composer or page chrome are ignored, and scans examine only the newest ~60 blocks instead of the whole page. v0.2's full-page re-scans after every typing pause caused the typing lag (and likely stressed the tab).
- Own-message filter now captures the composer Kip actually has focused (v0.2 took the longest text box on the page, which could be the wrong one) and matches fuzzily — letters/digits only, containment either way — so his sent messages are reliably recognized and never read back.

## [0.2] — 2026-10-11

Detection rewritten after the first live test: v0.1 spoke stray page labels and missed a real reply.

- Per-block diffing replaces the whole-page text diff. The page text jitters (labels, timestamps), which made v0.1's resync guard silently swallow real replies while tiny chrome text leaked through and got spoken.
- Watches innermost message-sized text blocks (25–4000 chars); code elements are stripped from a block before it is read.
- Header, nav, sidebar, and composer areas are excluded — page labels can never be spoken.
- A block must exist after arming and sit unchanged ~1.5s before it is read; already-accounted texts are never re-read, and growth speaks only the new tail.
- Own-message filter also captures the composer text on any button click, covering send-button sends.

## [0.1] — 2026-10-10

Initial release.

- Selector-free reply detection: snapshots the chat region's text and speaks only the new text that appears after ~1.2s of quiet. No dependency on Muse's page markup.
- Skips chat history present at page load (arms after a ~2.5s settle delay).
- Filters out the user's own sent messages (captures composer text on Enter).
- Speech cleanup: code blocks announced and skipped, links reduced to their text, URLs, widget tokens, and citation markers dropped.
- Sentence-chunked speech queue using Chrome's built-in voices (prefers "Google US English"). No API key, no network calls.
- On-page ON/OFF toggle button (bottom-right) that also stops speech in progress.
- Safety resync: if the page text changes too much at once (chat switch, big re-render), it silently re-baselines instead of reading a wall of old text.
- Project housed in this repo with README, HOWTO, and this changelog maintained alongside the script. Tampermonkey install/update URLs point at `musespeak.user.js` in this repo, so installs and updates come straight from GitHub.

### Known limits

- Speaks a reply only after it finishes streaming plus ~1.2s of quiet.
- The own-message filter relies on the Enter key; messages sent by clicking the send button may occasionally be read back.
- If an unrelated page label changes mid-reply (clocks, timestamps), a reply can occasionally be skipped by the resync guard.
