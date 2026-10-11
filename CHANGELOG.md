# Changelog

All notable changes to museSpeak. Versions follow the project's standing rule: small fixes and refinements bump the minor number (0.1 → 0.2), redesigns bump the major (1.0, 2.0).

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
