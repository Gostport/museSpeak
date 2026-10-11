// ==UserScript==
// @name museSpeak — Muse auto-speak
// @namespace kipkennedy.musespeak
// @version 0.4
// @description Speaks new Muse (Ibid) replies aloud automatically in the Muse web chat.
// @author Kip Kennedy / Ibid
// @match *://muse.ai/*
// @run-at document-idle
// @grant none
// @noframes
// @downloadURL https://raw.githubusercontent.com/Gostport/museSpeak/main/musespeak.user.js
// @updateURL https://raw.githubusercontent.com/Gostport/museSpeak/main/musespeak.user.js
// ==/UserScript==

/*
  museSpeak v0.4 — Tampermonkey userscript
  ----------------------------------------
  Changelog:
    v0.4 (2026-10-11): Missing-toggle fix.
      Console diagnosis: v0.3 armed fine (log lines present, no
      museSpeak errors), but it also injected into muse.ai's hidden
      marketing iframes (the @match covered every frame), and the
      app can discard the injected toggle when it re-renders. Now:
        - @noframes + top-frame guard: runs only in the main page.
        - The toggle is self-healing: it checks every 2s and
          re-attaches itself if the page threw it away.
    v0.3 (2026-10-11): Performance + own-message fixes.
    v0.3 (2026-10-11): Performance + own-message fixes.
      - v0.2 re-scanned and cloned blocks across the whole page after
        nearly every typing pause — on a long chat that janked the
        page (typing felt intercepted) and stressed the tab. Now:
        mutations inside the composer/header/nav never trigger a
        scan, and scans only examine the newest ~60 blocks.
      - Own-message filter: captures the composer Kip actually has
        focused (v0.2 took the longest text box on the page, which
        could be the wrong one) and matches fuzzily (letters/digits
        only, containment either way), so a sent message is reliably
        recognized and never read back.
    v0.2 (2026-10-11): Detection rewritten — per-block diffing.
      v0.1 diffed the whole page's text; the page jitters (labels,
      timestamps), so the resync guard silently swallowed real replies
      while tiny chrome text (an "Ibid" label) leaked through and got
      spoken. Now museSpeak watches individual message-sized text
      blocks instead:
        - Innermost text blocks only (25–4000 chars); code elements
          are stripped from a block before it is read.
        - Header / nav / sidebar / composer areas are excluded, so
          page labels can never be spoken.
        - A block must exist after arming and sit unchanged ~1.5s
          before it is read; texts already accounted for are never
          re-read — growth speaks only the new tail.
        - Own-message filter also captured composer text on any
          button click (send-button sends), not just Enter.
    v0.1 (2026-10-10): First prototype — whole-page text diff,
      own-message filter via Enter capture, markdown cleanup,
      sentence-chunked speech queue, on-page toggle.

  Known limits:
    - Speaks a reply only after it finishes streaming and settles.
    - A block that is edited in place (not appended to) after being
      read is not re-read.
*/

(() => {
  'use strict';

  if (window.top !== window.self) return; // top frame only (see @noframes)

  const VERSION = '0.4';
  const CFG = {
    armDelayMs: 2500,   // wait after load before speaking anything
    scanDebounceMs: 1200,
    windowSize: 60,     // only the newest ~60 candidate blocks are scanned
    settleMs: 1500,     // block must be unchanged this long before speaking
    minAgeMs: 1200,     // block must exist at least this long before speaking
    minChars: 25,       // shorter blocks are labels, never speech
    maxChars: 4000,
    rate: 1.02,
    voiceNameHints: ['Google US English', 'Microsoft Aria', 'Samantha'],
  };

  let armed = false;
  let muted = false;
  let timer = null;
  const ownMessages = [];           // Kip's sent texts, filtered out of speech
  const seen = new Map();           // block key -> { text, firstSeen, lastChange, spoken }
  const spokenList = [];            // full texts already accounted for (delta base)

  const normalize = s => (s || '').replace(/\s+/g, ' ').trim();

  // ---------- block collection ----------
  const BLOCK_SEL = 'div, article, section, li, blockquote';
  const SKIP_CTX = 'header, nav, aside, [role="navigation"], [role="banner"], ' +
                   '[role="complementary"], #musespeak-ui';
  const COMPOSER_CTX = 'textarea, [contenteditable="true"], [role="textbox"]';

  function blockText(el) {
    const c = el.cloneNode(true);
    c.querySelectorAll('pre, code, script, style').forEach(n => n.remove());
    return normalize(c.textContent || '');
  }

  function collectBlocks() {
    const scope = document.querySelector('main') || document.body;
    if (!scope) return [];
    const all = scope.querySelectorAll(BLOCK_SEL);
    const windowed = [...all].slice(-CFG.windowSize); // newest blocks only
    const kept = [];
    const elSet = new Set();
    for (const el of windowed) {
      if (el.closest(SKIP_CTX) || el.closest(COMPOSER_CTX)) continue;
      const t = blockText(el);
      if (t.length < CFG.minChars || t.length > CFG.maxChars) continue;
      kept.push({ el, t });
      elSet.add(el);
    }
    // innermost only: drop any block that contains another kept block
    return kept.filter(b => {
      for (const d of b.el.querySelectorAll(BLOCK_SEL)) {
        if (elSet.has(d)) return false;
      }
      return true;
    });
  }

  // ---------- speech cleanup ----------
  function cleanForSpeech(text) {
    let t = ' ' + text + ' ';
    t = t.replace(/```[\s\S]*?```/g, ' (code block skipped) ');
    t = t.replace(/`([^`]+)`/g, '$1');
    t = t.replace(/!\[([^\]]*)\]\([^)]*\)/g, ' $1 ');
    t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
    t = t.replace(/https?:\/\/\S+/g, ' link ');
    t = t.replace(/【[^】]*】/g, ' ');
    t = t.replace(/\[\[hatch_widget:[^\]]*\]\]/g, ' ');
    t = t.replace(/[#>*_~|]/g, ' ');
    return t.replace(/\s+/g, ' ').trim();
  }

  function splitSentences(text) {
    const parts = text.match(/[^.!?…]+[.!?…]+["')\]]*\s*|[^.!?…]+$/g) || [text];
    const chunks = [];
    let cur = '';
    for (const p of parts) {
      if (cur && (cur + p).length > 240) { chunks.push(cur.trim()); cur = p; }
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
    u.onend = u.onerror = () => { speaking = false; pump(); };
    speechSynthesis.speak(u);
  }

  function speak(text) {
    const chunks = splitSentences(text);
    if (!chunks.length) return;
    console.log('[museSpeak] speaking:', text.slice(0, 120) + (text.length > 120 ? '…' : ''));
    chunks.forEach(c => queue.push(c));
    pump();
  }

  function stopAll() {
    queue.length = 0;
    speaking = false;
    try { speechSynthesis.cancel(); } catch (e) {}
  }

  // ---------- own-message filter ----------
  const alnum = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  function isOwn(t) {
    const ft = alnum(t);
    if (!ft) return false;
    return ownMessages.some(o => {
      const fo = alnum(o);
      if (!fo) return false;
      if (ft === fo) return true;
      if (fo.length >= 15 && ft.includes(fo)) return true;  // block wraps his text
      if (ft.length >= 15 && fo.includes(ft)) return true;  // his text wraps the block
      return false;
    });
  }

  let composerEl = null; // the composer Kip actually has focused
  document.addEventListener('focusin', (e) => {
    if (e.target && e.target.matches && e.target.matches(COMPOSER_CTX)) {
      composerEl = e.target;
    }
  }, true);

  function captureComposer() {
    const read = (c) => normalize(c.value !== undefined ? c.value : (c.innerText || c.textContent));
    let best = '';
    if (composerEl && document.contains(composerEl)) {
      best = read(composerEl);
    }
    if (!best) { // fallback: longest composer-like box on the page
      document.querySelectorAll(COMPOSER_CTX).forEach(c => {
        const t = read(c);
        if (t.length > best.length) best = t;
      });
    }
    if (best) {
      ownMessages.push(best);
      if (ownMessages.length > 30) ownMessages.shift();
    }
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) captureComposer();
  }, true);
  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('button')) captureComposer();
  }, true);

  // ---------- detection ----------
  function speakDelta(t) {
    // Never re-read: if this text extends something already accounted
    // for, speak only the new tail.
    let base = '';
    for (const s of spokenList) {
      if (s && t.startsWith(s) && s.length > base.length) base = s;
    }
    const delta = t.slice(base.length).trim();
    spokenList.push(t);
    if (spokenList.length > 100) spokenList.shift();
    if (delta.length < 2 || isOwn(t) || isOwn(delta)) return;
    const clean = cleanForSpeech(delta);
    if (clean.length >= 2) speak(clean);
  }

  function scan() {
    const now = Date.now();
    for (const { t } of collectBlocks()) {
      const key = t.slice(0, 80);
      let e = seen.get(key);
      if (!e) {
        e = { text: t, firstSeen: now, lastChange: now, spoken: !armed };
        if (!armed) { spokenList.push(t); }
        seen.set(key, e);
        continue;
      }
      if (e.text !== t) { e.text = t; e.lastChange = now; }
      if (armed && !e.spoken &&
          now - e.firstSeen >= CFG.minAgeMs &&
          now - e.lastChange >= CFG.settleMs) {
        e.spoken = true;
        speakDelta(t);
      }
    }
    if (seen.size > 500) { // keep the map from growing forever
      const drop = [...seen.keys()].slice(0, seen.size - 400);
      drop.forEach(k => seen.delete(k));
    }
  }

  // ---------- on-page toggle ----------
  const ui = document.createElement('div');
  ui.id = 'musespeak-ui';
  ui.style.cssText =
    'position:fixed;right:16px;bottom:16px;z-index:2147483647;font-family:system-ui,sans-serif;';
  const btn = document.createElement('button');
  btn.textContent = '🔊 museSpeak: ON';
  btn.style.cssText =
    'background:#123332;color:#e8f0ee;border:1px solid #2f6f6a;border-radius:20px;' +
    'padding:8px 16px;font-size:13px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.35);';
  btn.addEventListener('click', () => {
    muted = !muted;
    if (muted) stopAll();
    btn.textContent = muted ? '🔇 museSpeak: OFF' : '🔊 museSpeak: ON';
    if (!muted) pump();
  });
  ui.appendChild(btn);

  // Self-healing: if the app re-renders and discards the toggle,
  // re-attach the same element (its ON/OFF state survives).
  function ensureUI() {
    if (!ui.isConnected) {
      (document.body || document.documentElement).appendChild(ui);
    }
  }
  ensureUI();
  setInterval(ensureUI, 2000);

  // ---------- go ----------
  const obs = new MutationObserver((muts) => {
    // Ignore changes that happen entirely inside the composer or page
    // chrome (typing, labels) — they can never contain a new reply,
    // and skipping them keeps typing smooth on long chats.
    const relevant = muts.some(m => {
      const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      return el && !el.closest(SKIP_CTX) && !el.closest(COMPOSER_CTX);
    });
    if (!relevant) return;
    clearTimeout(timer);
    timer = setTimeout(scan, CFG.scanDebounceMs);
  });

  function start() {
    scan(); // baseline: everything on the page now counts as already-seen
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    setTimeout(() => {
      scan(); // re-baseline after late renders
      armed = true;
      console.log('[museSpeak v' + VERSION + '] armed. New replies will be spoken.');
    }, CFG.armDelayMs);
  }

  if (document.body) start();
  else window.addEventListener('DOMContentLoaded', start);
})();
