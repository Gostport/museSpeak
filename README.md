# museSpeak

A Tampermonkey userscript that **speaks Muse's replies aloud automatically** in the Muse web chat (muse.ai). When a new reply from Ibid finishes arriving, museSpeak reads it out loud — hands-free, no clicking, no API key, no cost.

Built by Kip Kennedy with Ibid (Muse).

## What it does

- Watches the chat and speaks **only the new text** in each reply, once the reply finishes streaming (~1.2 seconds of quiet).
- **Skips chat history** — nothing already on the page when it loads gets read.
- **Skips your own messages** — what you typed is never read back to you.
- **Cleans up the text for speech** — code blocks are announced and skipped, links are read as their text, raw URLs and markup are dropped.
- Uses **Chrome's built-in voices** (prefers "Google US English"). Nothing is sent anywhere; all speech happens locally in the browser.
- **On-page toggle button** (bottom-right of the chat): one click mutes and stops current speech.

## Install

See **[HOWTO.md](HOWTO.md)** for step-by-step instructions. The short version:

1. Install the [Tampermonkey](https://www.tampermonkey.net/) extension in Chrome.
2. Open the script's raw link — Tampermonkey will offer to install it:
   https://raw.githubusercontent.com/Gostport/museSpeak/main/musespeak.user.js
3. Reload your muse.ai chat tab and look for the **🔊 museSpeak** button at bottom-right.

## Files

| File | What it is |
|---|---|
| `musespeak.user.js` | The userscript itself |
| `HOWTO.md` | Install, usage, updating, and troubleshooting |
| `CHANGELOG.md` | Version history — what changed in each release |

## Privacy

museSpeak reads the text of the chat page it runs on and hands it to your browser's built-in speech engine. It makes **no network calls** and sends nothing anywhere.

## Status

v0.1 — working prototype. Detection is deliberately selector-free (it diffs the page text instead of depending on Muse's markup), so it should survive page redesigns. See the CHANGELOG for what's planned next.
