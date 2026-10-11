# museSpeak — How To

## Requirements

- Google Chrome (desktop)
- The [Tampermonkey](https://www.tampermonkey.net/) extension
- A muse.ai account (it runs on the chat page)

## Install

1. **Install Tampermonkey** from the Chrome Web Store, if you haven't already.
2. **Open the script link:**
   https://raw.githubusercontent.com/Gostport/museSpeak/main/musespeak.user.js
   Tampermonkey intercepts the page and shows an install screen with the script's details.
3. Click **Install**.
4. **Open (or reload) your muse.ai chat tab.**
5. Look for the **🔊 button at the bottom-right** of the page. If it's there, museSpeak is running.
6. **Send a test message.** When the reply finishes, it is read aloud automatically.

> Tip: Chrome sometimes won't play any sound from a page until you've clicked or typed in it once. Normal chatting satisfies this — no special step needed.

## Using it

- **It speaks automatically.** New replies are read once they finish streaming, after about a second of quiet.
- **It never reads:** messages that were already on the page when it loaded, or messages you sent yourself.
- **The bottom-right button is the on/off switch.** Click it to mute; clicking again also stops any speech already in progress, instantly.
- **Code blocks are skipped** (you'll hear "code block skipped"), links are read as their visible text, and formatting marks are stripped.

## Updating

Tampermonkey checks for script updates automatically (the script points at this repo). To update manually:

1. Click the Tampermonkey icon → **Dashboard**.
2. Find **museSpeak** in the list.
3. Click the **"Check for updates"** option (or wait — automatic checks happen on their own).

## Troubleshooting

### The script page says "Not found" (404)

You're opening a stale or wrong link. Always install from the link in this file or the README — the **raw** GitHub URL. If GitHub shows the code as a plain web page instead of Tampermonkey's install screen, Tampermonkey is disabled or not installed; fix that first, then reopen the link.

### No button on the chat page

1. Click the Tampermonkey icon while on the muse.ai tab — museSpeak should be listed as active for the page.
2. If it's not listed: Tampermonkey icon → **Dashboard** → confirm **museSpeak** is in the script list and its toggle is **on**.
3. **Reload the chat tab** (F5) after installing or enabling.
4. Confirm you're on a `muse.ai` address — the script only runs there.

### The button is there, but nothing is spoken

1. Click anywhere in the page once, then send another test message (Chrome's sound policy).
2. Check the tab isn't muted (right-click the tab → "Unmute site") and your system volume is up.
3. Send a test that produces a *longer* reply — very short replies that render instantly are the hardest case for v0.1.
4. Open the browser console (F12 → **Console**) and look for lines starting with `[museSpeak]`. "armed" means it's watching; "speaking:" lines mean it tried to read something. Those lines are the best thing to report when asking for a fix.

### It read one of my own messages

Known v0.1 quirk: the filter catches your message when you send it with **Enter**. If you send by clicking the send button, the filter can miss it. Use Enter where possible; a stricter filter is planned.

### It read old messages after loading

It waits ~2.5 seconds after page load before it starts listening, specifically to avoid this. If a chat is still rendering when that window passes (very long chats), reload once and let the page fully settle.

## Uninstall

Tampermonkey icon → **Dashboard** → click the trash-can icon next to **museSpeak**.
