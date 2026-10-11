// ==UserScript==
// @name museSpeak — Muse auto-speak
// @namespace kipkennedy.musespeak
// @version 0.1
// @description Speaks new Muse (Ibid) replies aloud automatically in the Muse web chat.
// @author Kip Kennedy / Ibid
// @match *://muse.ai/*
// @run-at document-idle
// @grant none
// @downloadURL https://raw.githubusercontent.com/Gostport/museSpeak/main/musespeak.user.js
// @updateURL https://raw.githubusercontent.com/Gostport/museSpeak/main/musespeak.user.js
// ==/UserScript==

/*
museSpeak v0.1 — Tampermonkey prototype
----------------------------------------
Changelog:
v0.1 (2026-10-10): First prototype.
- Selector-free detection: snapshots the chat region's text and speaks
only the NEW text that appears after things settle (~1.2s quiet).
No dependency on Muse's page markup, so it survives redesigns
better than class-based scraping.
- Skips chat history present at page load (arms after a settle delay).
- Filters out Kip's own sent messages (captures the composer text
when Enter is pressed).
- Markdown cleanup for speech: code blocks announced and skipped,
links reduced to their text, URLs/widget tokens/citations dropped.
- Sentence-chunked speech queue using Chrome's built-in voices
(prefers "Google US English"). No API key, no cost.
- On-page toggle button (bottom-right): ON/OFF, stops current speech.
- Safety resync: if the page text changes too much at once (chat
switch, big re-render), it silently re-baselines instead of
reading a wall of old text.

Known limits (by design, fix in later versions):
- Speaks a reply only after it finishes streaming + 1.2s of quiet.
- If an unrelated label in the page text changes mid-reply (clocks,
"2m ago" stamps), a reply can occasionally be skipped by the resync
guard. v0.2: pin to real message elements once we see the live DOM.
*/

(() => {
'use strict';

const VERSION = '0.1';
const CFG = {
stabilizeMs: 1200, // quiet period after last page change before speaking
armDelayMs: 2500, // wait after load before speaking anything (history settle)
maxDeltaChars: 4000, // bigger jumps = view change, not speech
rate: 1.02,
voiceNameHints: ['Google US English', 'Microsoft Aria', 'Samantha'],
};

let armed = false;
let muted = false;
let baseline = ''; // normalized region text already accounted for
let timer = null;
const ownMessages = []; // Kip's sent texts, filtered out of speech

const normalize = s => (s || '').replace(/\s+/g, ' ').trim();

// ---------- region text (chat area, minus composer and our own UI) ----------
function regionText() {
const el = document.querySelector('main') || document.body;
if (!el) return '';
const clone = el.cloneNode(true);
clone.querySelectorAll(
'textarea, [contenteditable="true"], [role="textbox"], script, style, noscript, #ibid-reader-ui'
).forEach(n => n.remove());
return normalize(clone.textContent || '');
}

// ---------- speech cleanup ----------
function cleanForSpeech(text) {
let t = ' ' + text + ' ';
t = t.replace(/```[\s\S]*?```/g, ' (code block skipped) ');
t = t.replace(/`([^`]+)`/g, '$1');
t = t.replace(/!\[([^\]]*)\]\([^)]*\)/g, ' $1 ');
t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
t = t.replace(/https?:\/\/\S+/g, ' link ');
t = t.replace(/]*】/g, ' ');
t = t.replace(/\[\[hatch_widget:[^\]]*\]\]/g, ' ');
t = t.replace(/[#>*_~|]/g, ' ');
return t.replace(/\s+/g, ' ').trim();
}

function splitSentences(text) {
const parts = text.match(/[^.!?…]+[.!?…]+["')\]]*\s*|[^.!?…]+$/g) || [text];
const chunks = [];
let cur = '';
for (const p of parts) {
if (cur && (cur + p).length > 240) { chunks.push(cur.trim()); cur = p;}
else cur += p;
}
if (cur.trim()) chunks.push(cur.trim());
return chunks.filter(Boolean);
}

// ---------- speech engine ----------
const queue = [];
let speaking = false;

function pickVoice() {
const vs = speechSynthesis.getVoices().filter(v => /^en([-_]|$)/i.test(v.lang));
for (const hint of CFG.voiceNameHints) {
const hit = vs.find(v => v.name.includes(hint));
if (hit) return hit;
}
return vs[0] || null;
}

function pump() {
if (speaking || muted) return;
const next = queue.shift();
if (!next) return;
speaking = true;
const u = new SpeechSynthesisUtterance(next);
u.rate = CFG.rate;
const v = pickVoice();
if (v) u.voice = v;
u.onend = u.onerror = () => { speaking = false; pump();};
speechSynthesis.speak(u);
}

function speak(text) {
const chunks = splitSentences(text);
if (!chunks.length) return;
console.log('[Ibid Reader] speaking:', text.slice(0, 120) + (text.length > 120? '…': ''));
chunks.forEach(c => queue.push(c));
pump();
}

function stopAll() {
queue.length = 0;
speaking = false;
try { speechSynthesis.cancel();} catch (e) {}
}

// ---------- detection ----------
function commonPrefixLen(a, b) {
const n = Math.min(a.length, b.length);
let i = 0;
while (i < n && a[i] === b[i]) i++;
return i;
}

function checkAndSpeak() {
const now = regionText();
if (!now || now === baseline) { baseline = now; return;}
const p = commonPrefixLen(baseline, now);
let delta = now.slice(p);
// Big divergence = chat switch / re-render: re-baseline silently.
if (!armed || p < baseline.length * 0.5 || delta.length > CFG.maxDeltaChars) {
baseline = now;
return;
}
for (const own of ownMessages) {
if (own && delta.includes(own)) delta = delta.split(own).join(' ');
}
baseline = now;
const clean = cleanForSpeech(delta);
if (clean.length >= 2) speak(clean);
}

// Capture Kip's own message text when he sends with Enter.
document.addEventListener('keydown', (e) => {
if (e.key!== 'Enter' || e.shiftKey) return;
let best = '';
document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"]')
.forEach(c => {
const t = normalize(c.value!== undefined? c.value: (c.innerText || c.textContent));
if (t.length > best.length) best = t;
});
if (best) {
ownMessages.push(best);
if (ownMessages.length > 30) ownMessages.shift();
}
}, true);

// ---------- on-page toggle ----------
const ui = document.createElement('div');
ui.id = 'ibid-reader-ui';
ui.style.cssText =
'position:fixed;right:16px;bottom:16px;z-index:2147483647;font-family:system-ui,sans-serif;';
const btn = document.createElement('button');
btn.textContent = '🔊 Ibid Reader: ON';
btn.style.cssText =
'background:#123332;color:#e8f0ee;border:1px solid #2f6f6a;border-radius:20px;' +
'padding:8px 16px;font-size:13px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.35);';
btn.addEventListener('click', () => {
muted =!muted;
if (muted) stopAll();
btn.textContent = muted? '🔇 Ibid Reader: OFF': '🔊 Ibid Reader: ON';
if (!muted) pump();
});
ui.appendChild(btn);
(document.body || document.documentElement).appendChild(ui);

// ---------- go ----------
const obs = new MutationObserver(() => {
clearTimeout(timer);
timer = setTimeout(checkAndSpeak, CFG.stabilizeMs);
});

function start() {
baseline = regionText();
obs.observe(document.body, { childList: true, subtree: true, characterData: true});
setTimeout(() => {
baseline = regionText(); // re-baseline after history finishes rendering
armed = true;
console.log('[Ibid Reader v' + VERSION + '] armed. New replies will be spoken.');
}, CFG.armDelayMs);
}

if (document.body) start();
else window.addEventListener('DOMContentLoaded', start);
})();
