// ==UserScript==
// @name         PoB Injector
// @namespace    http://tampermonkey.net/
// @version      0.6.21
// @description  Inline PoB impact for trade/trade2 via local FastAPI HTTP server
// @author       rauldzmartin@gmail.com
// @match        *://*.pathofexile.com/trade*
// @grant        none
// @updateURL    https://github.com/rauldzmartin/PoB-Injector/releases/latest/download/pob-injector.user.js
// @downloadURL  https://github.com/rauldzmartin/PoB-Injector/releases/latest/download/pob-injector.user.js
// ==/UserScript==

(function() {
    'use strict';

    if (typeof chrome === 'undefined') {
        window.chrome = {
            runtime: {
                getURL: (path) => '',
                getManifest: () => ({ version: '0.6.21' }),
                sendMessage: () => {}
            }
        };
    }
    

    // Inject CSS
    const style = document.createElement('style');
    style.textContent = `:root {
  --control-panel-top: 0px;
  --primary-color: #3f51b5;
}

#pte-control-panel {
  transition: 0.2s;
  max-width: 337px;
  position: fixed;
  top: var(--control-panel-top);
  left: 0;
  z-index: 3;
  background-color: rgba(10, 10, 10, 0.8);
  padding: 4px;
  border-bottom-right-radius: 4px;
  transform: translateX(-110%);
  box-shadow: 5px 5px 10px rgb(0, 0, 0);
}

#pte-control-panel.visible {
  transform: translateX(0);
}

#pte-control-panel>* {
  margin: 4px;
}

.pte-section {
  padding: 10px;
  border-width: 1px;
  border-style: solid;
  border-color: rgb(138, 86, 9);
}

.pte-section-title {
  margin-bottom: 10px;
  font-family: FontinSmallcaps, serif;
  font-size: 20px;
  color: rgb(255, 255, 255);
}

.pte-button {
  background-color: rgb(15, 48, 77);
  border-color: rgb(76, 76, 125);
  display: inline-flex;
  justify-content: center;
  align-items: center;
  height: 32px;
  font-family: FontinSmallcaps, serif;
  font-size: 13px;
  line-height: 1;
  color: rgb(255, 255, 255);
  cursor: pointer;
  padding: 0px 10px;
  border-width: 1px;
  border-style: solid;
  outline: 0px;
  text-decoration: none;
  transition: background-color 0.2s ease 0s;
}

#toggle-panel-button {
  position: fixed;
  left: 0;
  top: var(--control-panel-top);
  width: 56px;
  height: 40px !important;
  z-index: 3;
  margin: 0;
  border-radius: 0;
  border-bottom-right-radius: 4px;
  font-size: 32px;
  font-weight: normal;
}

#toggle-panel-button img {
  height: 100%;
  width: auto;
}

#panel-title {
  padding: 0;
  margin: 0 0 8px 58px;
  height: 32px;
  line-height: 32px;
  font-size: 20px;
  font-family: FontinSmallcaps, serif;
  color: rgb(255, 255, 255);
}

#pob-iframe {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  border: none;
  opacity: 0;
  min-width: 1400px;
  min-height: 800px;
}

#pob-iframe.visible {
  z-index: 2;
  opacity: 1;
}

.pte-input {
  box-sizing: border-box;
  height: 32px;
  line-height: 28px;
  color: black;
  padding: 0;
  padding-left: 8px;
  padding-right: 8px;
  border: 2px solid white;
  border-radius: 4px;
}

.pte-input:active,
.pte-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.24);
}

.switch {
  transition: 0.2s;
  position: relative;
  width: 28px;
  height: 12px;
  border: none;
  border-radius: 8px;
  background-color: rgb(189 193 198);
  appearance: none;
  outline: none !important;
  cursor: pointer;
  display: inline-block;
  margin: 4px !important;
  vertical-align: middle;
}

.switch::after {
  transition: 0.2s;
  content: "";
  display: block;
  position: absolute;
  left: 0;
  top: -2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: white;
  box-shadow: 0 1px 3px 0 rgb(0, 0, 0, 40%);
}

.switch:checked {
  background-color: var(--primary-color);
}

.switch:checked::after {
  left: 16px;
}

#pte-message {
  margin: 4px;
}

#pte-message.error {
  color: #f44336;
}

#pte-control-panel a {
  display: inline-block;
  color: white;
  margin: 4px;
  height: 16px;
  line-height: 16px;
}

#github-link>svg {
  margin-right: 4px;
  vertical-align: bottom;
}

.trade-button {
  height: 18px;
  line-height: 14px !important;
  /* -2px for borders and -2 for padding */
  padding: 1px 5px !important;
  margin: 10px;
  color: #e9cf9f !important;
}
#statusBar,
.linkBack {
  margin-left: 36px;
}

.item_impact {
  display: inline-block;
  text-align: left;
  vertical-align: top;
  margin: 5px;
}

.pob-sortable-stat {
  cursor: pointer;
  transition: background 0.15s;
  border-radius: 3px;
}
.pob-sortable-stat:hover {
  background: rgba(255,255,255,0.08);
}
.pob-sortable-stat.sort-active {
  background: rgba(255,200,0,0.12);
  box-shadow: inset 2px 0 0 rgba(255,200,0,0.5);
}

.pob-sort-status {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: rgba(0,0,0,0.85);
  color: #fff;
  padding: 10px 18px;
  border-radius: 10px;
  font: 13px/1.4 system-ui, sans-serif;
  z-index: 999999;
  border: 1px solid #444;
  backdrop-filter: blur(4px);
}
`;
    document.head.appendChild(style);

    // Inject Main JS
(() => {
  // ---- single-instance + top-window guard ----
  if (window !== window.top) return;           // don't run in iframes
  if (window.__POB_HTTP_CS__) return;          // already installed
  window.__POB_HTTP_CS__ = true;

  // ---------- API ----------
  const API = {
    base: 'http://127.0.0.1:5000',
    async checkStatus() {
      try {
        const res = await fetch(`${this.base}/status`);
        if (!res.ok) return false;
        const data = await res.json();
        this.serverVersion = data.version;
        return true;
      } catch {
        return false;
      }
    },
    async loadPoB(buildPath) {
      const res = await fetch(`${this.base}/load_pob`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: buildPath || null }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    async itemImpact(itemText, maxQuality = false) {
      const res = await fetch(`${this.base}/item-impact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: itemText, maxQuality }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    async importItem(itemText, maxQuality = false) {
      const res = await fetch(`${this.base}/import-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: itemText, maxQuality }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    async listBuilds() {
      const res = await fetch(`${this.base}/builds`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    async triggerUpdate() {
      const branch = cfg.useDevBranch ? 'dev' : 'main';
      const res = await fetch(`${this.base}/update?branch=${branch}`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    async checkUpdate() {
      try {
        const branch = cfg.useDevBranch ? 'dev' : 'main';
        const res = await fetch(`${this.base}/check-update?branch=${branch}`);
        if (!res.ok) return false;
        const data = await res.json();
        return data.update_available;
      } catch {
        return false;
      }
    },
    async listRunes(slotsCsv = '') {
      const qs = slotsCsv && slotsCsv.trim() ? `?slot=${encodeURIComponent(slotsCsv)}` : '';
      const res = await fetch(`${this.base}/runes${qs}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    async listAmuletEnchants(q = '') {
      const qp = q && q.trim() ? `?q=${encodeURIComponent(q.trim())}&limit=1000` : '?limit=1000';
      const res = await fetch(`${this.base}/amulet-enchants${qp}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json(); // [{id,text}]
    }
  };

  // ---------- Config ----------
  const CFG_KEY = 'pobRuneCfg';
  const DEFAULT_CFG = {
    activeBuild: '',
    enabled: false,
    perSocketEnabled: false,
    runeLine: '',
    perSocket: ['', '', '', '', '', ''],
    addMissingSockets: false,
    lastSlotsCsv: '',
    uiCollapsed: false,
    enchantEnabled: false,
    enchantText: '',
    enchantId: '',
    enchantRecent: [],
    maxQuality: false,
    activeItemTypeLabel: ''
  };
  let cfg = { ...DEFAULT_CFG };

  function loadCfg() {
    return new Promise(resolve => {
      if (!chrome?.storage?.local) return resolve(cfg);
      chrome.storage.local.get([CFG_KEY], out => {
        if (out && out[CFG_KEY]) Object.assign(cfg, out[CFG_KEY]);
        resolve(cfg);
      });
    });
  }
  function saveCfg() {
    chrome?.storage?.local?.set({ [CFG_KEY]: cfg });
  }

  // ---------- Rune helpers ----------
  const RUNE_CACHE = new Map();
  function normSlotsCsv(slotsCsv) {
    return (slotsCsv || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean).sort().join(',');
  }
  async function ensureRunesFor(slotsCsv) {
    const key = normSlotsCsv(slotsCsv || '');
    if (RUNE_CACHE.has(key)) return RUNE_CACHE.get(key);
    const list = await API.listRunes(key);
    const out = Array.isArray(list) ? list : Object.values(list || {}).flat();
    const uniqueOut = [...new Set(out)];
    uniqueOut.sort((a,b) => a.localeCompare(b));
    RUNE_CACHE.set(key, uniqueOut);
    return uniqueOut;
  }
  function normRuneText(s) { return (s || '').replace(/\s*\(rune\)\s*$/i, '').trim().toLowerCase(); }
  function endsWithRune(s) { return /\(rune\)\s*$/i.test(s); }
  function toRuneLine(s) { return endsWithRune(s) ? s : `${s} (rune)`; }
  // ---------- Enchant helpers ----------
  const ENCHANT_CACHE = new Map(); // key: query -> [{id,text}]
  function debounce(fn, ms = 200) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
  async function ensureEnchants(q = '') {
    const key = (q || '').trim().toLowerCase();
    if (ENCHANT_CACHE.has(key)) return ENCHANT_CACHE.get(key);
    const list = await API.listAmuletEnchants(key);
    ENCHANT_CACHE.set(key, list);
    return list;
  }
  function isAmuletItemText(itemText) {
    if (/^Item Class:\s*Amulet/m.test(itemText)) return true;
    const lines = (itemText || '').split('\n');
    const typeLine = (lines.find(l => l && !/^Rarity:|^Item Level:|^Requirements:|^Sockets:|^-{2,}$|^Implicits?:|^Influences?:/i.test(l)) || '').trim();
    if (/amulet/i.test(typeLine)) return true;
    return false;
  }
  function extractExistingEnchantLines(lines) {
    const out = [];
    for (let i = 0; i < lines.length; i++) { if (/^Allocates\s+/i.test(lines[i])) out.push([lines[i], i]); }
    return out;
  }
  function setEnchantLine(lines, enchantText) {
    const sep = '--------';
    let iItem = lines.findIndex(l => /^Item Level:/i.test(l));
    let iReq = lines.findIndex(l => /^Requires:/i.test(l));
    let insertAt = -1;
    if (iItem >= 0) insertAt = Math.max(0, iItem - 1);
    else if (iReq >= 0) insertAt = Math.max(0, iReq - 1);
    else insertAt = Math.max(0, lines.findIndex(l => l === sep));
    if (insertAt < 0) insertAt = Math.max(0, lines.length - 1);
    if (insertAt > 0 && lines[insertAt - 1] !== sep) { lines.splice(insertAt, 0, sep); insertAt++; }
    lines.splice(insertAt, 0, enchantText); insertAt++;
    if (insertAt >= lines.length || lines[insertAt] !== sep) lines.splice(insertAt, 0, sep);
    return lines;
  }

  function applyManualRuneConversions(lines, usedRunes) {
    const transformRune = usedRunes.find(r => /Transforms all (Fire|Cold|Lightning) and (Fire|Cold|Lightning) modifiers.*equivalent (Fire|Cold|Lightning) modifiers/i.test(r));
    if (transformRune) {
      const match = transformRune.match(/Transforms all (Fire|Cold|Lightning) and (Fire|Cold|Lightning) modifiers.*equivalent (Fire|Cold|Lightning) modifiers/i);
      if (match) {
        const from1 = match[1], from2 = match[2], to = match[3];
        const firstSep = lines.findIndex(l => l.includes('--------'));
        const startIdx = firstSep >= 0 ? firstSep + 1 : 0;
        
        for (let j = startIdx; j < lines.length; j++) {
          if (!/Transforms all/i.test(lines[j])) {
            if (from1 === 'Fire' || from2 === 'Fire') {
              // Avoid replacing the verb "Fire" in "Fire an additional Projectile"
              lines[j] = lines[j].replace(/\bFire\b(?!\s+an\s+additional)/gi, to);
            } else {
              const regex1 = new RegExp(`\\b${from1}\\b`, 'gi');
              lines[j] = lines[j].replace(regex1, to);
            }
            if (from1 !== 'Cold' && from2 === 'Cold' || from1 === 'Cold') {
              lines[j] = lines[j].replace(/\bCold\b/gi, to);
            } else if (from1 !== 'Lightning' && from2 === 'Lightning' || from1 === 'Lightning') {
              lines[j] = lines[j].replace(/\bLightning\b/gi, to);
            }
          }
        }
      }
    }
  }

  /** Apply global enchant selection. Returns { text, appliedText, mode } */
  function applyEnchantOverride(itemText) {
    if (!cfg.enchantEnabled || !cfg.enchantText || !isAmuletItemText(itemText)) {
      return { text: itemText, appliedText: '', mode: '' };
    }
    if (currentItemIsCorrupted) {
      return { text: itemText, appliedText: '', mode: 'disabled_corrupted' };
    }
    const lines = itemText.split('\n');
    const existing = extractExistingEnchantLines(lines);
    for (const [, idx] of existing.reverse()) lines.splice(idx, 1);
    
    let textToApply = (cfg.enchantText || '').trim();
    if (textToApply && !/^Allocates\s+/i.test(textToApply)) {
      textToApply = 'Allocates ' + textToApply;
    }
    
    setEnchantLine(lines, textToApply);
    const mode = existing.length ? 'overridden' : 'added';
    return { text: lines.join('\n'), appliedText: textToApply, mode };
  }

  function extractSockets(itemText) {
    const m = itemText.split('\n').find(l => l.startsWith('Sockets: '));
    if (!m) return 0;
    const parts = m.replace(/^Sockets:\s*/, '').trim().split(/\s+/).filter(Boolean);
    return parts.length;
  }
  function extractExistingRuneLines(lines) { return lines.filter(endsWithRune); }

  function setSocketsLine(lines, targetCount) {
    const sep = '--------';
    const socketsLine = `Sockets: ${Array(targetCount).fill('S').join(' ')}`;
    let idx = lines.findIndex(l => l.startsWith('Sockets: '));
    if (idx >= 0) { lines[idx] = socketsLine; return lines; }
    let iItem = lines.findIndex(l => /^Item Level:/i.test(l));
    let iReq = lines.findIndex(l => /^Requires:/i.test(l));
    let insertAt = -1;
    if (iItem >= 0) insertAt = Math.max(0, iItem - 1);
    else if (iReq >= 0) insertAt = iReq + 1;
    else insertAt = lines.length;
    if (insertAt <= 0 || lines[insertAt - 1] !== sep) lines.splice(insertAt, 0, sep), insertAt++;
    lines.splice(insertAt, 0, socketsLine); insertAt++;
    if (insertAt >= lines.length || lines[insertAt] !== sep) lines.splice(insertAt, 0, sep);
    return lines;
  }

  // Apply overrides; returns { text, used: string[], userAddedRunes: string[], targetSockets }
  function applyRuneOverride(itemText, { sockets = 0, maxSockets = 0 } = {}) {
    const lines = itemText.split('\n');
    const existingRunes = extractExistingRuneLines(lines);
    const realSockets = sockets || extractSockets(itemText);
    const targetSockets = (cfg.addMissingSockets && maxSockets && maxSockets > realSockets) ? maxSockets : realSockets;
    if (targetSockets <= 0) { return { text: itemText, used: [], userAddedRunes: [], targetSockets: 0 }; }

    let replacements = [];
    let userAddedRunes = [];
    if (cfg.perSocketEnabled) {
      for (let i = 0; i < targetSockets; i++) {
        let pick = (cfg.perSocket[i] || '').trim();
        if (pick) {
          let runeLine = toRuneLine(pick);
          replacements.push(runeLine);
          if (runeLine !== existingRunes[i]) userAddedRunes.push(runeLine);
        } else {
          replacements.push(null);
        }
      }
    } else if (cfg.enabled) {
      const base = cfg.runeLine ? toRuneLine(cfg.runeLine.trim()) : null;
      for (let i = 0; i < targetSockets; i++) {
        replacements.push(base || null);
        if (base && base !== existingRunes[i]) userAddedRunes.push(base);
      }
    } else {
      return { text: itemText, used: [], userAddedRunes: [], targetSockets: realSockets };
    }

    if (targetSockets > realSockets) setSocketsLine(lines, targetSockets);
    replacements = replacements.slice(0, targetSockets);

    const sep = '--------';
    const runeIdxs = []; for (let i = 0; i < lines.length; i++) if (endsWithRune(lines[i])) runeIdxs.push(i);
    const used = replacements.filter(x => !!x);

    if (runeIdxs.length) {
      const first = runeIdxs[0], last = runeIdxs[runeIdxs.length - 1];
      const out = [];
      for (let i = 0; i < lines.length; i++) {
        if (i === first) { if (used.length) out.push(...used); i = last; }
        else out.push(lines[i]);
      }
      applyManualRuneConversions(out, used);
      return { text: out.join('\n'), used, userAddedRunes, targetSockets };
    } else {
      const out = [...lines];
      let insertAt = out.findIndex(l => /^Item Level:/i.test(l));
      if (insertAt < 0) insertAt = out.findIndex(l => /^Requires:/i.test(l));
      if (insertAt < 0) insertAt = out.findIndex(l => l === sep);
      if (insertAt < 0) insertAt = out.length - 1;
      if (used.length) out.splice(insertAt + 1, 0, sep, ...used);
      applyManualRuneConversions(out, used);
      return { text: out.join('\n'), used, userAddedRunes, targetSockets };
    }
  }

  // ---------- UI + injection ----------
  let script = null;
  let autoEnabled = true;
  let currentRuneList = [];
  let typeLbl = null;
  // Track current item capabilities to toggle UI sections
  let currentItemHasSockets = true;
  let currentItemIsAmulet = false;
  let currentItemCanHaveQuality = false;
  let currentItemIsCorrupted = false;

  function updateSectionVisibility() {
    const socketBlock = document.getElementById('pob-socket-block');
    if (socketBlock) socketBlock.style.display = currentItemHasSockets ? 'flex' : 'none';
    
    const otherStatsBlock = document.getElementById('pob-other-stats-block');
    if (otherStatsBlock) otherStatsBlock.style.display = currentItemCanHaveQuality ? 'flex' : 'none';

    const amuletBlock = document.getElementById('pob-amulet-block');
    if (amuletBlock) amuletBlock.style.display = currentItemIsAmulet ? 'flex' : 'none';

    let firstVisible = true;
    for (const block of [amuletBlock, socketBlock, otherStatsBlock]) {
      if (block && block.style.display !== 'none') {
        if (firstVisible) {
          block.style.borderTop = '';
          firstVisible = false;
        } else {
          block.style.borderTop = 'none';
        }
      }
    }
  }

  function injectCode() {
    if (document.documentElement.dataset.pobInjected === '1') {
      // already injected
    } else {
      script = document.createElement('script');
      script.textContent = "(() => {\n  if (document.documentElement.dataset.pobInjected === '1') return;\n  document.documentElement.dataset.pobInjected = '1';\n  let itemByDataId = {};\n  let enabled = document.currentScript.getAttribute('enabled') == 'true';\n  const disabledOverridesByItem = new Set();\n\n  const pobStyle = document.createElement('style');\n  pobStyle.textContent = '.pob-disabled .pob_wrapper, .pob-disabled .pob_import_wrap { display: none !important; }';\n  document.head.appendChild(pobStyle);\n  if (!enabled) document.documentElement.classList.add('pob-disabled');\n\n  // --- Sort state ---\n  let sortState = null; // { stat, loading, abort }\n  let sortStatusEl = null;\n  let sortingNow = false;\n  let currentSortStat = null;\n  let currentSortAsc = false;\n  const impactCache = {}; // dataId -> HTML string\n  const previewCache = {}; // dataId -> rune_preview HTML string\n\n  function textContent(el) { return el ? el.textContent.trim() : ''; }\n  function propLine(propNode) {\n    if (!propNode) return null;\n    const label = textContent(propNode.querySelector(':scope > span:first-child'));\n    const val = textContent(propNode.querySelector(':scope > span:nth-child(2)'));\n    if (!label) return null;\n    const isAug = !!propNode.querySelector('.colourAugmented');\n    const aug = isAug ? ' (augmented)' : '';\n    return val ? `${label} ${val}${aug}` : label;\n  }\n\n  // --- Item typing helpers (strict mapping from user) ---\n  const IC = {\n    HELMET: 'helmet', BOOTS: 'boots', GLOVES: 'gloves', BODY: 'body armour',\n    WEAPON: 'weapon', CASTER: 'caster', BOW: 'bow', SCEPTRE: 'sceptre',\n    ARMOUR: 'armour', FOCUS: 'focus', SHIELD: 'shield', CROSSBOW: 'crossbow'\n  };\n  // Which Item Class names imply which rune buckets\n  function runeBucketsForItemClass(itemClassSingle) {\n    const s = (itemClassSingle || '').toLowerCase();\n    const buckets = new Set();\n\n    // armour subtags\n    if (s === 'helmet') buckets.add(IC.HELMET), buckets.add(IC.ARMOUR);\n    if (s === 'boots') buckets.add(IC.BOOTS), buckets.add(IC.ARMOUR);\n    if (s === 'gloves') buckets.add(IC.GLOVES), buckets.add(IC.ARMOUR);\n    if (s === 'body armour' || s === 'body armor' || s === 'chest') buckets.add(IC.BODY), buckets.add(IC.ARMOUR);\n    if (s === 'shield') buckets.add(IC.SHIELD), buckets.add(IC.ARMOUR);\n    if (s === 'focus') buckets.add(IC.FOCUS), buckets.add(IC.ARMOUR);\n\n    // weapon & specialisations\n    if (s === 'bow') { buckets.add(IC.BOW); buckets.add(IC.WEAPON); }\n    if (s === 'crossbow') { buckets.add(IC.CROSSBOW); buckets.add(IC.WEAPON); }\n    if (s === 'wand') { buckets.add(IC.CASTER); }              // caster group\n    if (s === 'staff') { buckets.add(IC.CASTER); }              // caster group\n    if (s === 'sceptre') { buckets.add(IC.SCEPTRE); }             // sceptre-only group\n    if (s === 'one hand mace' || s === 'two hand mace' || s === 'quarterstaff' || s === 'spear') {\n      buckets.add(IC.WEAPON);\n    }\n\n    return Array.from(buckets).sort().join(',');\n  }\n\n  function deriveMaxSocketsFromItemClass(itemClassSingle, typeLine) {\n    const s = (itemClassSingle || '').toLowerCase();\n    const t = (typeLine || '').toLowerCase();\n\n    // Armour\n    if (s === 'body armour' || s === 'body armor' || /body armour|body armor|chest/.test(t)) return 2;\n    if (s === 'helmet' || /helm/.test(t)) return 1;\n    if (s === 'gloves' || /glove/.test(t)) return 1;\n    if (s === 'boots' || /boot/.test(t)) return 1;\n\n    // Weapons / Off-hands\n    if (s === 'bow') return 2;\n    if (s === 'crossbow') return 2;\n    if (s === 'staff' || s === 'quarterstaff') return 2;\n    if (s === 'spear') return 2;\n    if (s === 'two hand mace') return 2;\n\n    if (s === 'wand') return 1;\n    if (s === 'one hand mace') return 1;\n    if (s === 'shield') return 1;\n    if (s === 'focus') return 1;\n\n    // Jewellery / others\n    if (s === 'amulet' || s === 'ring' || s === 'belt' || s === 'quiver') return 0;\n\n    // Fallbacks by typeline keywords\n    if (/\\bbow\\b/.test(t)) return 2;\n    if (/\\bcrossbow\\b/.test(t)) return 2;\n    if (/\\bstaff|stave|staves\\b/.test(t)) return 2;\n    if (/\\bwand\\b/.test(t)) return 1;\n    if (/\\bshield\\b/.test(t)) return 1;\n    if (/\\bfocus\\b/.test(t)) return 1;\n    return 0;\n  }\n\n  function getItemTextFromDOM(node) {\n    const popup = node.querySelector('.item-popup');\n    if (!popup) return null;\n    const lines = [], sep = '--------';\n\n    let rarity = 'Normal';\n    const popupCls = popup.className;\n    if (/--rare\\b/.test(popupCls)) rarity = 'Rare';\n    else if (/--magic\\b/.test(popupCls)) rarity = 'Magic';\n    else if (/--unique\\b/.test(popupCls)) rarity = 'Unique';\n\n    const headerLines = [...popup.querySelectorAll('.item-popup__header-line')];\n    const isDouble = popup.querySelector('.item-popup__header--double');\n    const name = isDouble && headerLines[0] ? textContent(headerLines[0]) : (rarity === 'Unique' || rarity === 'Rare' ? (headerLines[0] ? textContent(headerLines[0]) : '') : '');\n    const typeLine = isDouble && headerLines[1] ? textContent(headerLines[1]) : (headerLines[0] ? textContent(headerLines[0]) : '');\n\n    const content = popup.querySelector('.item-popup__content');\n    const classEl = content ? content.querySelector('.item-property:first-child .lc > span') : null;\n    const itemClass = classEl ? textContent(classEl) : '';\n\n    function isAug(el) {\n      if (!el) return false;\n      return el.matches('[style*=\"colour-augmented\"], .colourAugmented') ||\n        (el.querySelector('[style*=\"colour-augmented\"], .colourAugmented') !== null);\n    }\n\n    function propText(el) {\n      if (!el) return null;\n      const label = el.querySelector(':scope > span:first-child');\n      const val = el.querySelector(':scope > span:nth-child(2)');\n      if (!label) return null;\n      const lt = textContent(label);\n      const vt = val ? textContent(val) : '';\n      const aug = isAug(val || el);\n      return vt ? `${lt}: ${vt}${aug ? ' (augmented)' : ''}` : lt;\n    }\n\n    const q = propText(content ? content.querySelector('[data-field=\"quality\"]') : null);\n    const pd = propText(content ? content.querySelector('[data-field=\"pdamage\"]') : null);\n    const chc = propText(content ? content.querySelector('[data-field=\"crit\"]') : null);\n    const aps = propText(content ? content.querySelector('[data-field=\"aps\"]') : null);\n    const rlt = propText(content ? content.querySelector('[data-field=\"reload_time\"]') : null);\n\n    const ilvlEl = content ? content.querySelector('[data-field=\"ilvl\"]') : null;\n    const ilvl = ilvlEl ? textContent(ilvlEl).replace(/^Item Level:\\s*/i, '').trim() : '';\n    const ilvlLine = ilvl ? `Item Level: ${ilvl}` : null;\n\n    const reqEl = content ? content.querySelector('.item-popup__property--requirements .lc') : null;\n    let req = reqEl ? textContent(reqEl).trim() : null;\n    if (req) req = req.replace(/^Requires:\\s*/i, '');\n\n    const socketCount = node.querySelectorAll('.left .socket, .left .sockets .socket').length;\n    const sockets = socketCount ? `Sockets: ${Array(socketCount).fill('S').join(' ')}` : null;\n\n    const noteEl = content ? content.querySelector('[style*=\"currency\"]') : null;\n    const noteLine = noteEl ? textContent(noteEl).trim() : null;\n\n    if (itemClass) lines.push(`Item Class: ${itemClass}`);\n    lines.push(`Rarity: ${rarity}`);\n    if (name) lines.push(name);\n    if (typeLine) lines.push(typeLine);\n\n    if (q || pd || chc || aps || rlt) {\n      lines.push(sep);\n      [q, pd, chc, aps, rlt].forEach(v => v && lines.push(v));\n    }\n\n    if (req || sockets || ilvlLine) {\n      lines.push(sep);\n      if (req) lines.push(`Requires: ${req}`);\n      if (sockets) { lines.push(sep); lines.push(sockets); }\n      if (ilvlLine) { lines.push(sep); lines.push(ilvlLine); }\n    }\n\n    const enchantMods = [];\n    const implicitMods = [];\n    const explicitGroup = [];\n\n    if (content) {\n      const allMods = content.querySelectorAll('.item-mod');\n      for (const modEl of allMods) {\n        const textEl = modEl.querySelector('[data-field^=\"stat.\"]');\n        if (!textEl) continue;\n        const text = textContent(textEl).trim();\n        if (!text) continue;\n\n        if (modEl.classList.contains('item-mod--enchant')) {\n          enchantMods.push(text);\n        } else if (modEl.classList.contains('item-mod--implicit')) {\n          implicitMods.push(text);\n        } else if (modEl.classList.contains('item-mod--fractured')) {\n          explicitGroup.push(`${text} (fractured)`);\n        } else if (modEl.classList.contains('item-mod--crafted')) {\n          explicitGroup.push(`${text} (crafted)`);\n        } else if (modEl.classList.contains('item-mod--rune')) {\n          explicitGroup.push(`${text} (rune)`);\n        } else if (modEl.classList.contains('item-mod--desecrated')) {\n          explicitGroup.push(`${text} (desecrated)`);\n        } else if (modEl.classList.contains('item-mod--explicit')) {\n          explicitGroup.push(text);\n        }\n      }\n    }\n\n    if (enchantMods.length || implicitMods.length) {\n      lines.push(sep);\n      if (enchantMods.length) lines.push(...enchantMods);\n      if (implicitMods.length) lines.push(...implicitMods);\n    }\n\n    if (explicitGroup.length) {\n      lines.push(sep);\n      lines.push(...explicitGroup);\n    }\n\n    // Corrupted check\n    const isCorrupted = content && (content.querySelector('[data-field=\"corrupted\"]') || content.querySelector('.colourCorrupted') || content.textContent.includes('Corrupted'));\n    if (isCorrupted) {\n      lines.push(sep);\n      lines.push('Corrupted');\n    }\n\n    if (noteLine) { lines.push(sep); lines.push(noteLine); }\n\n    const runeSlots = runeBucketsForItemClass(itemClass);\n    const maxSockets = deriveMaxSocketsFromItemClass(itemClass, typeLine);\n    let label = itemClass || 'Item';\n    if (maxSockets === 0 && !/^Amulet/i.test(label)) label += ' (no sockets)';\n\n    const canHaveQuality = itemClass ? /Bow|Crossbow|Sword|Mace|Wand|Sceptre|Quarterstaff|Focus|Armour|Helmet|Gloves|Boots|Shield|Flask/i.test(itemClass) : false;\n\n    return {\n      text: lines.join('\\n'),\n      sockets: socketCount,\n      maxSockets,\n      runeSlots,\n      itemTypeLabel: label,\n      isCorrupted: !!isCorrupted,\n      canHaveQuality\n    };\n  }\n\n  function getItemMetaAndText(node) {\n    const copyBtn = node.querySelector('button.copy');\n    if (copyBtn && copyBtn._v_clipboard && typeof copyBtn._v_clipboard.text === 'function') {\n      try {\n        const t = copyBtn._v_clipboard.text();\n        if (typeof t === 'string' && t.trim()) {\n          const meta = getItemTextFromDOM(node);\n          if (meta && typeof meta === 'object') return { ...meta, text: t };\n          return { text: t, sockets: 0, maxSockets: 0, runeSlots: '', itemTypeLabel: 'Item' };\n        }\n      } catch (e) { }\n    }\n    return getItemTextFromDOM(node);\n  }\n\n  function ensureContainers(node) {\n    const parent = node.querySelector('.details') || node.querySelector('.right');\n    if (!parent) return {};\n    let pobWrap = parent.querySelector('.pob_wrapper');\n    if (!pobWrap) {\n      pobWrap = document.createElement('div');\n      pobWrap.className = 'pob_wrapper';\n      pobWrap.style.position = 'relative';\n      parent.appendChild(pobWrap);\n\n      const toggleWrap = document.createElement('div');\n      toggleWrap.className = 'pob-override-toggle-wrap';\n      toggleWrap.style.cssText = 'position: absolute; top: 6px; right: 6px; display: none; z-index: 10;';\n      const btn = document.createElement('button');\n      btn.className = 'pob-override-toggle';\n      btn.style.cssText = 'background: rgba(0,0,0,0.85); border: 1px solid #c8b88a; color: #ebd592; padding: 2px 6px; font-size: 10px; cursor: pointer; border-radius: 2px; line-height: 14px; transition: opacity 0.2s;';\n\n      toggleWrap.appendChild(btn);\n      pobWrap.appendChild(toggleWrap);\n\n      pobWrap.addEventListener('mouseenter', () => {\n        const dataId = node.getAttribute('data-id');\n        const isDisabled = disabledOverridesByItem.has(dataId);\n        btn.textContent = isDisabled ? '\ud83e\ude84 OFF' : '\ud83e\ude84 ON';\n        btn.title = isDisabled ? 'Enable custom PoB Injector overrides for this item' : 'Disable custom PoB Injector overrides for this item';\n        btn.style.opacity = isDisabled ? '0.5' : '1';\n        toggleWrap.style.display = 'block';\n      });\n      pobWrap.addEventListener('mouseleave', () => toggleWrap.style.display = 'none');\n\n      btn.onclick = (ev) => {\n        ev.stopPropagation();\n        const dataId = node.getAttribute('data-id');\n        if (!dataId) return;\n        if (disabledOverridesByItem.has(dataId)) {\n          disabledOverridesByItem.delete(dataId);\n        } else {\n          disabledOverridesByItem.add(dataId);\n        }\n\n        const isDisabled = disabledOverridesByItem.has(dataId);\n        btn.textContent = isDisabled ? '\ud83e\ude84 OFF' : '\ud83e\ude84 ON';\n        btn.title = isDisabled ? 'Enable custom PoB Injector overrides for this item' : 'Disable custom PoB Injector overrides for this item';\n        btn.style.opacity = isDisabled ? '0.5' : '1';\n\n        const previewEl = pobWrap.querySelector('.rune_preview');\n        const impactEl = pobWrap.querySelector('.item_impact');\n        if (previewEl) previewEl.style.opacity = '0.3';\n        if (impactEl) impactEl.style.opacity = '0.3';\n\n        const meta = getItemMetaAndText(node);\n        window.top.postMessage({\n          message: 'get_item_impact',\n          item: meta.text,\n          dataId,\n          sockets: meta.sockets,\n          maxSockets: meta.maxSockets,\n          runeSlots: meta.runeSlots,\n          itemTypeLabel: meta.itemTypeLabel,\n          canHaveQuality: meta.canHaveQuality,\n          isCorrupted: meta.isCorrupted,\n          skipOverrides: disabledOverridesByItem.has(dataId)\n        }, '*');\n      };\n    }\n    let preview = pobWrap.querySelector('.rune_preview');\n    if (!preview) {\n      preview = document.createElement('div');\n      preview.className = 'rune_preview';\n      pobWrap.appendChild(preview);\n    }\n    let impact = pobWrap.querySelector('.item_impact');\n    if (!impact) {\n      impact = document.createElement('div');\n      impact.className = 'item_impact';\n      pobWrap.appendChild(impact);\n    }\n    if (preview.nextSibling !== impact) pobWrap.insertBefore(preview, impact);\n\n    let importWrap = parent.querySelector('.pob_import_wrap');\n    if (!importWrap) {\n      importWrap = document.createElement('div');\n      importWrap.className = 'pob_import_wrap';\n      importWrap.style.margin = '10px 0 0 0';\n      importWrap.style.textAlign = 'center';\n      const btn = document.createElement('button');\n      btn.className = 'btn btn-xs btn-default direct-btn';\n      btn.style.cssText = 'color: rgb(233, 207, 159); background-color: rgb(34, 34, 34); border: 1px solid rgb(68, 68, 68);';\n      btn.textContent = 'Add this item to your build as unused';\n      btn.onclick = () => {\n        const dataId = node.closest('.row[data-id]').getAttribute('data-id');\n        const itemObj = itemByDataId[dataId];\n        if (itemObj) {\n          btn.dataset.originalText = btn.textContent;\n          btn.textContent = 'Importing...';\n          btn.disabled = true;\n\n          const meta = getItemMetaAndText(node.closest('.row[data-id]'));\n          window.top.postMessage({\n            message: 'import_item_to_pob',\n            dataId,\n            item: itemObj.itemText,\n            sockets: meta.sockets,\n            maxSockets: meta.maxSockets,\n            canHaveQuality: meta.canHaveQuality,\n            isCorrupted: meta.isCorrupted\n          }, '*');\n        }\n      };\n      importWrap.appendChild(btn);\n\n      if (pobWrap.nextSibling) {\n        parent.insertBefore(importWrap, pobWrap.nextSibling);\n      } else {\n        parent.appendChild(importWrap);\n      }\n    }\n\n    return { preview, impact };\n  }\n\n  function askItemImpact(node) {\n    const dataId = node.getAttribute('data-id');\n    const { preview, impact } = ensureContainers(node);\n    const meta = getItemMetaAndText(node);\n    const rarityMatch = meta?.text?.match(/^Rarity: (.+)$/m);\n    const rarity = rarityMatch ? rarityMatch[1] : '';\n    itemByDataId[dataId] = { node, impact, preview, itemText: meta?.text || '', rarity };\n\n    if (impactCache[dataId]) {\n      impact.innerHTML = impactCache[dataId];\n      processStatLines(impact);\n      if (previewCache[dataId] !== undefined) {\n        const previewEl = itemByDataId[dataId]?.preview;\n        if (previewEl) previewEl.innerHTML = previewCache[dataId];\n      }\n      return;\n    }\n\n    if (!enabled) return;\n\n    if (!meta || !meta.text || typeof meta.text !== 'string' || !meta.text.trim() || meta.text.trim().toLowerCase() === 'null') {\n      if (impact) impact.innerHTML = '<span style=\"color:#f55\">No item text</span>';\n      return;\n    }\n    window.top.postMessage({\n      message: 'get_item_impact',\n      item: meta.text,\n      dataId,\n      sockets: meta.sockets,\n      maxSockets: meta.maxSockets,\n      runeSlots: meta.runeSlots,\n      itemTypeLabel: meta.itemTypeLabel,\n      canHaveQuality: meta.canHaveQuality,\n      isCorrupted: meta.isCorrupted,\n      skipOverrides: disabledOverridesByItem.has(dataId)\n    }, '*');\n  }\n\n  // --- Sort helpers ---\n  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }\n\n  let sortArrowCached = '';\n  function ensureSortStyles() {\n    if (!sortArrowCached) {\n      const sorted = document.querySelector('[data-field].sorted');\n      if (sorted) {\n        const after = getComputedStyle(sorted, '::after');\n        if (after.backgroundImage && after.backgroundImage !== 'none') {\n          sortArrowCached = `background:transparent ${after.backgroundImage} ${after.backgroundPosition || '-134px -230px'} no-repeat`;\n        }\n      }\n      if (!sortArrowCached) {\n        sortArrowCached = `background:transparent url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 18 18'%3E%3Cpath d='M9 12l-5-5h10z' fill='%23aaa'/%3E%3C/svg%3E\") 50% 50% no-repeat`;\n      }\n    }\n    const css = `.pob-sortable-stat{min-height:17px!important;line-height:17px!important;box-sizing:border-box!important;white-space:normal!important;word-break:break-word!important}.pob-sortable-stat.sorted{background:rgba(255,255,255,0.11)!important}.pob-sortable-stat.sorted::after{content:' '!important;display:inline-block!important;width:18px!important;height:18px!important;vertical-align:middle!important;margin-left:4px!important;margin-top:-3px!important;${sortArrowCached}!important;transform:scale(0.833)!important;transform-origin:center center!important} .pob-sortable-stat.sorted.sorted-asc::after{transform:scale(0.833) rotate(180deg)!important} .pob-inline-icon{display:inline-block!important;width:18px!important;height:18px!important;vertical-align:middle!important;margin-left:4px!important;margin-top:-5px!important;${sortArrowCached}!important;transform:scale(0.833)!important;transform-origin:center center!important} .pob-inline-icon.sorted-asc{transform:scale(0.833) rotate(180deg)!important;margin-top:-5px!important}`;\n    if (document.getElementById('pob-sort-styles')) {\n      document.getElementById('pob-sort-styles').textContent = css;\n    } else {\n      const style = document.createElement('style');\n      style.id = 'pob-sort-styles';\n      style.textContent = css;\n      document.head.appendChild(style);\n    }\n  }\n\n  function processStatLines(impactEl) {\n    if (!impactEl) return;\n    for (const div of impactEl.querySelectorAll('[data-stat]')) {\n      div.classList.add('pob-sortable-stat');\n      div.style.cursor = 'pointer';\n      div.style.transition = 'background 0.12s';\n      const statName = div.getAttribute('data-stat');\n      div.title = `Click to sort by ${statName}`;\n      div.addEventListener('mouseenter', () => { div.style.background = 'rgba(255,255,255,0.06)'; });\n      div.addEventListener('mouseleave', () => { div.style.background = ''; });\n      div.addEventListener('click', () => startSortBy(statName));\n    }\n  }\n\n  function showSortStatus(msg, glow = false) {\n    if (!sortStatusEl) {\n      sortStatusEl = document.createElement('div');\n      sortStatusEl.className = 'pob-body-panel';\n      sortStatusEl.style.cssText = `\n        height: 32px; padding: 0 16px; \n        display: flex; flex-direction: row !important; align-items: center; justify-content: center; box-sizing: border-box;\n        color: #c8b88a; \n        font-family: Verdana, Arial, Helvetica, sans-serif; font-size: 12px;\n        flex: 1; pointer-events: auto; margin: 0; text-align: center;\n        min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;\n      `;\n      const pobHead = document.getElementById('pob-head');\n      if (pobHead) {\n        pobHead.appendChild(sortStatusEl);\n      } else {\n        sortStatusEl.style.position = 'fixed';\n        sortStatusEl.style.bottom = '64px';\n        sortStatusEl.style.left = '64px';\n        sortStatusEl.style.zIndex = '999999';\n        document.body.appendChild(sortStatusEl);\n      }\n    }\n    if (glow) {\n      if (!sortStatusEl.classList.contains('pob-glow')) {\n        sortStatusEl.classList.add('pob-glow');\n      }\n    } else {\n      sortStatusEl.classList.remove('pob-glow');\n    }\n    sortStatusEl.innerHTML = msg;\n    sortStatusEl.style.display = 'flex';\n  }\n\n  function hideSortStatus() {\n    if (sortStatusEl) sortStatusEl.style.display = 'none';\n  }\n\n  function getStatValue(row, statName) {\n    const el = row.querySelector(`.item_impact [data-stat=\"${statName.replace(/\"/g, '\\\\\"')}\"]`);\n    if (!el) return -Infinity;\n    return parseFloat(el.getAttribute('data-value')) || -Infinity;\n  }\n\n  function performSort(statName) {\n    const container = document.querySelector('div.resultset');\n    if (!container) return;\n    const rows = [...container.querySelectorAll(':scope > div.row[data-id]')];\n    rows.sort((a, b) => {\n      const vA = getStatValue(a, statName);\n      const vB = getStatValue(b, statName);\n      return currentSortAsc ? vA - vB : vB - vA;\n    });\n    sortingNow = true;\n    const frag = document.createDocumentFragment();\n    for (const row of rows) frag.appendChild(row);\n    container.appendChild(frag);\n    if (resultObserver) resultObserver.takeRecords();\n    sortingNow = false;\n    ensureSortStyles();\n    document.getElementById('pob-sorting-target-style')?.remove();\n    document.querySelectorAll('.pob-sortable-stat.sorted, [data-field].sorted').forEach(el => {\n      el.classList.remove('sorted', 'sorted-asc', 'sorted-desc');\n      el.style.background = '';\n    });\n    document.querySelectorAll(`.item_impact [data-stat=\"${statName.replace(/\"/g, '\\\\\"')}\"]`).forEach(el => {\n      el.classList.add('sorted', currentSortAsc ? 'sorted-asc' : 'sorted-desc');\n    });\n  }\n\n  async function startSortBy(statName) {\n    if (currentSortStat === statName) {\n      currentSortAsc = !currentSortAsc;\n    } else {\n      currentSortStat = statName;\n      currentSortAsc = false;\n    }\n\n    if (sortState && sortState.loading) {\n      sortState.abort = true;\n      await sleep(100);\n    }\n    const mySortState = { stat: statName, loading: true, abort: false };\n    sortState = mySortState;\n\n    let targetStyle = document.getElementById('pob-sorting-target-style');\n    if (!targetStyle) {\n      targetStyle = document.createElement('style');\n      targetStyle.id = 'pob-sorting-target-style';\n      document.head.appendChild(targetStyle);\n    }\n    targetStyle.textContent = `\n      .item_impact [data-stat=\"${statName.replace(/\"/g, '\\\\\"')}\"] { \n        background:rgba(200,184,138,0.15)!important; \n        animation:pobSortGlow 1.2s infinite ease-in-out!important; \n        border-radius:3px!important; \n        position: relative!important;\n        padding-right: 65px!important;\n      }\n      .item_impact [data-stat=\"${statName.replace(/\"/g, '\\\\\"')}\"]::after {\n        content: 'Loading...' !important;\n        font-style: italic !important;\n        font-size: 0.9em !important;\n        opacity: 0.7 !important;\n        position: absolute !important;\n        right: 4px !important;\n        top: 50% !important;\n        transform: translateY(-50%) !important;\n      }\n    `;\n\n    const container = document.querySelector('div.resultset');\n    if (!container) { hideSortStatus(); sortState = null; return; }\n\n    const _matchedMatch = document.querySelector('h3')?.textContent?.match(/\\(([\\d,]+)\\s+matched\\)/i);\n    const totalMatched = _matchedMatch ? +_matchedMatch[1].replace(/,/g, '') : 0;\n    const loadBtn = document.querySelector('button.btn.load-more-btn');\n    if (loadBtn?.offsetParent) {\n      showSortStatus(`Loading items for ${statName}...`, true);\n      let pageCount = 0;\n      while (true) {\n        if (mySortState.abort) { if (sortState === mySortState) sortState = null; hideSortStatus(); return; }\n        const loadMore = document.querySelector('button.btn.load-more-btn');\n        if (!loadMore || !loadMore.offsetParent) break;\n        const beforeCount = container.querySelectorAll(':scope > div.row[data-id]').length;\n        if (totalMatched > 0 && beforeCount >= totalMatched) break;\n        loadMore.click();\n        pageCount++;\n        showSortStatus(`Loading items... (${beforeCount} / ${totalMatched || '?'})`, true);\n        const waitStart = Date.now();\n        while (Date.now() - waitStart < 5000) {\n          if (mySortState.abort) { if (sortState === mySortState) sortState = null; hideSortStatus(); return; }\n          await sleep(200);\n          if (container.querySelectorAll(':scope > div.row[data-id]').length > beforeCount) { await sleep(1500); break; }\n        }\n      }\n      if (mySortState.abort) { if (sortState === mySortState) sortState = null; hideSortStatus(); return; }\n      await sleep(2000);\n    }\n\n    if (mySortState.abort) return;\n    mySortState.loading = false;\n    performSort(statName);\n    const finalCount = container.querySelectorAll(':scope > div.row[data-id]').length;\n    const arrowHtml = `<span class=\"pob-inline-icon ${currentSortAsc ? 'sorted-asc' : ''}\"></span>`;\n    showSortStatus(`Sorted by ${statName} ${arrowHtml}`, false);\n    if (sortStatusEl) {\n      if (totalMatched > 0 && finalCount < totalMatched) {\n        sortStatusEl.title = `${totalMatched - finalCount} items were not loaded/sorted due to system limitations.`;\n      } else {\n        sortStatusEl.title = `All ${finalCount} items sorted successfully.`;\n      }\n    }\n  }\n\n  // --- Observer (skip rows that already have impact content) ---\n  const observer = new MutationObserver((mutations) => {\n    for (const mutation of mutations) {\n      for (const node of mutation.addedNodes) {\n        if (!(node instanceof HTMLElement)) continue;\n        if (node.matches && node.matches('div.row[data-id]')) {\n          if (!node.querySelector('.item_impact')?.innerHTML?.trim()) askItemImpact(node);\n        }\n        for (const card of node.querySelectorAll ? node.querySelectorAll('div.row[data-id]') : []) {\n          if (!card.querySelector('.item_impact')?.innerHTML?.trim()) askItemImpact(card);\n        }\n      }\n    }\n  });\n\n  function findOptionClose(html, start) {\n    let p = start + '<div class=\"option\">'.length, d = 1;\n    while (p < html.length && d > 0) {\n      const lt = html.indexOf('<', p);\n      if (lt === -1) break;\n      if (html.startsWith('</div>', lt)) { d--; if (d === 0) return lt + 6; p = lt + 6; }\n      else if (html.startsWith('<div', lt)) { d++; p = (html.indexOf('>', lt + 4) + 1) || lt + 5; }\n      else p = (html.indexOf('>', lt + 1) + 1) || (lt + 1);\n    }\n    return -1;\n  }\n\n  window.addEventListener('message', e => {\n    if (e.data.message == 'show_update_notification') {\n      showSortStatus('Update available! Click the update button in the extension panel', true);\n      return;\n    }\n    if (e.data.message == 're_eval') {\n      for (const k in impactCache) delete impactCache[k];\n      for (const k in previewCache) delete previewCache[k];\n      const rows = document.querySelectorAll('div.resultset div.row[data-id]');\n      rows.forEach(r => {\n        delete r.dataset.pobDone;\n        delete r.dataset.pobEvaling;\n        const wrap = r.querySelector('.pob_wrapper');\n        if (wrap) wrap.classList.add('pob-re-evaluating');\n        askItemImpact(r);\n      });\n      return;\n    }\n    if (e.data.message == 'set_item_impact') {\n      impactCache[e.data.dataId] = e.data.itemImpact;\n      const entry = itemByDataId[e.data.dataId];\n      if (entry && entry.node) {\n        const wrap = entry.node.querySelector('.pob_wrapper');\n        if (wrap) wrap.classList.remove('pob-re-evaluating');\n      }\n      const impact = entry?.impact;\n      if (impact) {\n        impact.style.opacity = '1';\n        let html = e.data.itemImpact;\n        if (entry.rarity === 'Unique' && html.indexOf('<div class=\"option\">') !== html.lastIndexOf('<div class=\"option\">')) {\n          const starts = [];\n          for (let p = 0; (p = html.indexOf('<div class=\"option\">', p)) !== -1; p += '<div class=\"option\">'.length) starts.push(p);\n          if (starts.length > 1) {\n            const keep = starts.findIndex(s => {\n              const end = findOptionClose(html, s);\n              return end > 0 && html.slice(s, end).includes('color:#AF6025');\n            });\n            if (keep >= 0) {\n              for (let i = starts.length - 1; i >= 0; i--) {\n                if (i !== keep) {\n                  const end = findOptionClose(html, starts[i]);\n                  if (end > 0) html = html.slice(0, starts[i]) + html.slice(end);\n                }\n              }\n            }\n          }\n        }\n        const _optStarts = [];\n        for (let _p = 0; (_p = html.indexOf('<div class=\"option\">', _p)) !== -1; _p += '<div class=\"option\">'.length) _optStarts.push(_p);\n        if (_optStarts.length > 1) {\n          const _opts = _optStarts.map(s => { const e = findOptionClose(html, s); return { h: html.slice(s, e), e }; });\n          const _numRe = /(?:Socket|Flask)\\s*#(\\d+)/;\n          _opts.sort((a, b) => { const ma = a.h.match(_numRe), mb = b.h.match(_numRe); return (ma ? +ma[1] : 0) - (mb ? +mb[1] : 0); });\n          html = html.slice(0, _optStarts[0]) + _opts.map(o => o.h).join('') + html.slice(Math.max(..._opts.map(o => o.e)));\n        }\n        impact.innerHTML = html;\n        processStatLines(impact);\n      }\n    } else if (e.data.message == 'set_rune_preview') {\n      previewCache[e.data.dataId] = e.data.html || '';\n      const preview = itemByDataId[e.data.dataId]?.preview;\n      if (preview) {\n        preview.innerHTML = e.data.html || '';\n        preview.style.opacity = '1';\n      }\n    } else if (e.data.message == 'toggle') {\n      enabled = e.data.enabled;\n      if (enabled) {\n        document.documentElement.classList.remove('pob-disabled');\n        const rows = document.querySelectorAll('div.resultset div.row[data-id]');\n        rows.forEach(r => {\n          if (!r.querySelector('.item_impact')?.innerHTML?.trim()) askItemImpact(r);\n        });\n      } else {\n        document.documentElement.classList.add('pob-disabled');\n      }\n    } else if (e.data.message == 'import_item_result') {\n      const entry = itemByDataId[e.data.dataId];\n      if (entry && entry.node) {\n        const btn = entry.node.querySelector('.pob_import_wrap button');\n        if (btn) {\n          if (e.data.success) {\n            btn.textContent = '\u2705 Item imported to your build';\n            btn.style.color = '#7bc67b';\n          } else {\n            btn.textContent = '\u274c Failed to import';\n            btn.style.color = '#c67b7b';\n            setTimeout(() => {\n              btn.textContent = btn.dataset.originalText || 'Add this item to your build as unused';\n              btn.style.color = 'rgb(233, 207, 159)';\n              btn.disabled = false;\n            }, 3000);\n          }\n        }\n      }\n    }\n  }, false);\n\n  observer.observe(document.body, { attributes: false, childList: true, subtree: true });\n\n  // Watch for resultset container to appear (Vue rendering)\n  let resultObserver = null;\n  let currentRc = null;\n  const rcObserver = new MutationObserver(() => {\n    const rc = document.querySelector('div.resultset');\n    if (rc && rc !== currentRc) {\n      if (currentRc) {\n        sortState = null;\n        currentSortStat = null;\n        currentSortAsc = false;\n        hideSortStatus();\n        itemByDataId = {};\n      }\n      if (resultObserver) resultObserver.disconnect();\n      currentRc = rc;\n      resultObserver = new MutationObserver((mutations) => {\n        if (sortingNow) return;\n        let rowsRemoved = false;\n        for (const m of mutations) {\n          for (const node of m.removedNodes) {\n            if (node instanceof HTMLElement) {\n              const rows = node.matches?.('div.row[data-id]') ? [node] : Array.from(node.querySelectorAll?.('div.row[data-id]') || []);\n              if (rows.length > 0) {\n                for (const r of rows) {\n                  const dataId = r.getAttribute('data-id');\n                  if (dataId) delete itemByDataId[dataId];\n                }\n                rowsRemoved = true;\n              }\n            }\n          }\n        }\n        if (rowsRemoved) {\n          sortState = null;\n          currentSortStat = null;\n          currentSortAsc = false;\n          hideSortStatus();\n        }\n      });\n      resultObserver.observe(rc, { childList: true, subtree: true });\n    }\n  });\n  rcObserver.observe(document.body, { childList: true, subtree: true });\n})();\n";
      script.setAttribute('enabled', String(autoEnabled));
      document.documentElement.appendChild(script);
    }
  }

  function injectStyles() {
    let style = document.getElementById('pob-custom-styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'pob-custom-styles';
      document.head.appendChild(style);
    }
    style.textContent = `
    .pob-container {
      position: fixed; z-index: 99999; bottom: 16px; left: 16px; top: auto; right: auto;
      font-family: Verdana, Arial, Helvetica, sans-serif;
      color: #c8b88a; display: flex; flex-direction: column-reverse; gap: 8px; align-items: stretch;
      font-size: 12px; line-height: 1.4; pointer-events: none;
    }
    .pob-container > * { pointer-events: auto; }
    #pob-http-bar *, #pob-http-bar *::before, #pob-http-bar *::after {
      margin: 0; box-sizing: border-box;
    }
    .pob_wrapper {
      background: #000000; border: 1px solid #333; border-radius: 0;
      margin-top: 8px; padding: 8px;
      display: none;
      transition: opacity 0.3s ease;
    }
    .pob_wrapper.pob-re-evaluating {
      opacity: 0.5;
      pointer-events: none;
    }
    .pob_wrapper:has(.option) {
      display: flex; flex-direction: column; gap: 0;
    }
    .pob_wrapper .option {
      background: transparent !important; border: none !important;
      padding: 0 !important; margin: 0 !important; box-shadow: none !important;
    }
    .pob_wrapper .option > .hdr1 {
      padding-top: 0 !important; margin-top: 0 !important;
    }
    .pob_wrapper .option > .hdr2 {
      margin-bottom: 0 !important;
    }
    .pob_wrapper .rune_preview_box {
      text-align: left;
    }
    .pob_wrapper .rune_preview:has(.option) {
      border-bottom: 1px solid #333 !important;
      padding-bottom: 8px !important; margin-bottom: 4px !important;
    }
    .pob-body-panel {
      background: linear-gradient(145deg, rgba(18,16,14,0.97), rgba(10,9,8,0.97));
      backdrop-filter: blur(6px);
      padding: 0; border: 1px solid #5a4d3a; border-radius: 3px;
      box-shadow: 0 0 20px rgba(0,0,0,0.9), inset 0 1px 0 rgba(200,184,138,0.06);
      display: flex; flex-direction: column; margin-bottom: 2px; overflow: hidden;
      min-width: 360px;
    }
    @keyframes pobSortGlow {
      0% { box-shadow: 0 0 8px rgba(200, 184, 138, 0.1), inset 0 1px 0 rgba(200,184,138,0.06); }
      50% { box-shadow: 0 0 16px rgba(200, 184, 138, 0.5), inset 0 1px 0 rgba(200,184,138,0.06); }
      100% { box-shadow: 0 0 8px rgba(200, 184, 138, 0.1), inset 0 1px 0 rgba(200,184,138,0.06); }
    }
    .pob-glow {
      animation: pobSortGlow 1.2s infinite ease-in-out !important;
      border-color: #c8b88a !important;
      color: #fff !important;
      text-shadow: 0 0 4px rgba(200,184,138,0.5);
    }
    .pob-navbar {
      display: flex; gap: 6px; align-items: center; padding: 8px 12px;
      background: rgba(200,184,138,0.04); border-bottom: 1px solid #3a3225;
    }
    .pob-content { display: flex; flex-direction: column; gap: 7px; padding: 10px 12px; }
    .pob-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .pob-btn {
      padding: 5px 10px; border: 1px solid #5a4d3a; background: linear-gradient(180deg, #1e1c18, #141210);
      color: #c8b88a; cursor: pointer; border-radius: 2px; font-family: inherit; font-size: 10px;
      transition: all 0.2s ease; letter-spacing: 0.3px; text-transform: uppercase; flex-shrink: 0;
    }
    .pob-btn:hover:not(:disabled) {
      background: linear-gradient(180deg, #2a2620, #1a1816);
      border-color: #c8b88a; color: #ebd592;
      box-shadow: 0 0 8px rgba(200,184,138,0.15);
    }
    .pob-btn-on.active {
      border-color: #4caf50; color: #81c784;
      background: linear-gradient(180deg, #162416, #0e160e);
      box-shadow: 0 0 8px rgba(76,175,80,0.3);
    }
    .pob-btn-off.active {
      border-color: #f44336; color: #e57373;
      background: linear-gradient(180deg, #241616, #160e0e);
      box-shadow: 0 0 8px rgba(244,67,54,0.3);
    }
    .pob-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .pob-icon-btn {
      width: 26px; height: 26px; padding: 0; display: flex; align-items: center; justify-content: center;
      border: 1px solid #5a4d3a; background: linear-gradient(180deg, #1e1c18, #141210);
      color: #c8b88a; cursor: pointer; border-radius: 2px; font-size: 14px;
      transition: all 0.2s ease; flex-shrink: 0;
    }
    .pob-icon-btn:hover { border-color: #c8b88a; color: #ebd592; box-shadow: 0 0 8px rgba(200,184,138,0.15); }
    .pob-combo { display: inline-flex; align-items: center; position: relative; flex: 1; min-width: 0; }
    .pob-combo input::-webkit-calendar-picker-indicator,
    .pob-combo input::-webkit-list-button { display: none !important; }
    .pob-combo::after {
      content: ""; position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
      border-width: 5px 5px 0px; border-style: solid; border-color: rgb(153, 153, 153) transparent transparent;
      pointer-events: none;
    }
    .pob-combo input, .pob-combo select {
      width: 100%; background: #080706; border: 1px solid #3a3225; border-radius: 2px;
      padding: 5px 40px 5px 8px; color: #ddd; font-family: Verdana, sans-serif; font-size: 11px;
      transition: border-color 0.2s; outline: none; box-sizing: border-box; height: 26px;
    }
    .pob-combo select { padding: 0 8px; appearance: none; }
    .pob-combo input:focus, .pob-combo select:focus { border-color: #7a6a4f; }
    .pob-combo-clear {
      position: absolute; right: 20px; top: 50%; transform: translateY(-50%);
      width: 18px; height: 18px; padding: 0; margin: 0;
      background: transparent; border: none; cursor: pointer;
      color: #5a4d3a; font-size: 16px;
      display: flex; align-items: center; justify-content: center;
      transition: color 0.15s; line-height: 1;
    }
    .pob-combo-clear:hover { color: #ebd592; }
    .pob-label {
      display: inline-flex; gap: 6px; align-items: center; color: #bbb; cursor: pointer;
      font-size: 11px; transition: color 0.15s; white-space: nowrap; height: 26px;
    }
    .pob-label:hover { color: #ebd592; }
    .pob-switch { position: relative; width: 28px; height: 14px; flex-shrink: 0; margin: 0 4px 0 0 !important; }
    .pob-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
    .pob-switch-track {
      position: absolute; inset: 0; background: #1a1816; border: 1px solid #3a3225;
      border-radius: 7px; cursor: pointer; transition: all 0.2s ease;
    }
    .pob-switch-track::after {
      content: ''; position: absolute; top: 2px; left: 2px; width: 8px; height: 8px;
      background: #5a4d3a; border-radius: 50%; transition: all 0.2s ease;
    }
    .pob-switch input:checked + .pob-switch-track { border-color: #7a6a4f; background: #2a2620; }
    .pob-switch input:checked + .pob-switch-track::after { left: 16px; background: #ebd592; }
    .pob-type { color: #7a6a4f; font-size: 10px; letter-spacing: 0.4px; text-transform: uppercase; }
    .pob-toggle-btn {
      height: 32px; padding: 0 12px; display: flex; align-items: center; justify-content: center; gap: 8px;
      background: linear-gradient(180deg, #1e1c18, #141210) !important; 
      border: 1px solid #5a4d3a !important; border-radius: 3px !important;
      box-shadow: 0 2px 10px rgba(0,0,0,0.8) !important;
      color: #c8b88a; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s ease;
    }
    .pob-toggle-icon {
      width: 24px; height: 24px; object-fit: contain; pointer-events: none;
    }
    .pob-toggle-btn:hover { 
      background: linear-gradient(180deg, #2a2620, #1a1816) !important;
      border-color: #c8b88a !important; color: #ebd592 !important; 
      box-shadow: 0 0 12px rgba(200,184,138,0.2) !important;
    }
    .pob-sep { width: 100%; height: 1px; background: #3a3225; margin: 2px 0; }
    .pob-socket-lbl { color: #7a6a4f; font-size: 11px; min-width: 14px; text-align: left; }
    .pob-col { display: flex; flex-direction: column; gap: 4px; }
    .pob-power-btn {
      width: 28px; height: 28px; padding: 0; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(180deg, #1a1714, #0e0d0b);
      border: 1px solid #3a3225; border-radius: 3px;
      cursor: pointer; transition: border-color 0.2s ease, background 0.2s ease;
      box-shadow: none; outline: 2px solid transparent; outline-offset: 0;
    }
    .pob-power-btn svg { display: block; transition: all 0.2s ease; }
    .pob-power-btn:not(.pob-power-on):hover { border-color: #5a4d3a; }
    .pob-power-btn.pob-power-on {
      border-color: #c8a84a;
      background: linear-gradient(180deg, #221e10, #151108);
      outline-color: rgba(200,168,74,0.35);
    }
    .pob-power-btn.pob-power-on:hover { outline-color: rgba(200,168,74,0.6); }
    .pob-section { margin: 0; border: 1px solid #332d26; padding: 8px; background: rgba(0, 0, 0, 0.2); display: flex; flex-direction: column; gap: 6px; }
    .pob-section-title { font-size: 11px; color: #7a6a4f; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px; font-weight: bold; }
  `;
  }

  function makeCombo(opts) {
    const wrap = document.createElement('div');
    wrap.className = 'pob-combo';
    const inp = document.createElement('input');
    inp.type = 'text';
    if (opts.list) inp.setAttribute('list', opts.list);
    if (opts.placeholder) inp.placeholder = opts.placeholder;
    if (opts.value) inp.value = opts.value;
    if (opts.title) inp.title = opts.title;
    const clr = document.createElement('button');
    clr.className = 'pob-combo-clear';
    clr.innerHTML = '\u00d7';
    clr.title = 'Clear';
    clr.type = 'button';
    clr.tabIndex = -1;
    clr.onclick = () => { inp.value = ''; inp.dispatchEvent(new Event('input')); inp.focus(); };
    wrap.append(inp, clr);
    return { wrap, inp };
  }

  function makeControl() {
    injectStyles();
    for (const old of document.querySelectorAll('#pob-http-bar')) old.remove();

    const bar = document.createElement('div');
    bar.id = 'pob-http-bar';
    bar.className = 'pob-container';

    const head = document.createElement('div');
    head.id = 'pob-head';
    head.style.cssText = 'display:flex;align-items:center;gap:8px;min-width:0;';
    const toggleBtn = document.createElement('button');
    toggleBtn.title = cfg.uiCollapsed ? 'Expand panel' : 'Collapse panel';

    const iconUrl = 'data:image/png;base64,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';
    const getToggleHtml = (collapsed) => `<img src="${iconUrl}" class="pob-toggle-icon"> ${collapsed ? '\u25b2' : '\u25bc'}`;

    toggleBtn.innerHTML = getToggleHtml(cfg.uiCollapsed);
    toggleBtn.className = 'pob-toggle-btn';
    head.append(toggleBtn);

    const body = document.createElement('div');
    body.id = 'pob-body-panel-id';
    body.className = 'pob-body-panel';
    body.style.display = 'none'; // start hidden until items load

    toggleBtn.onclick = () => {
      cfg.uiCollapsed = !cfg.uiCollapsed;
      body.style.display = cfg.uiCollapsed ? 'none' : 'flex';
      toggleBtn.innerHTML = getToggleHtml(cfg.uiCollapsed);
      toggleBtn.title = cfg.uiCollapsed ? 'Expand panel' : 'Collapse panel';
      saveCfg(true);
    };

    // === NAVBAR: ON/OFF ===
    const navbar = document.createElement('div');
    navbar.className = 'pob-navbar';

    const onBtn = document.createElement('button');
    onBtn.textContent = 'ON';
    onBtn.title = 'Activar evaluación automática';
    onBtn.className = 'pob-btn' + (autoEnabled ? ' pob-btn-on active' : '');

    const offBtn = document.createElement('button');
    offBtn.textContent = 'OFF';
    offBtn.title = 'Desactivar evaluación automática';
    offBtn.className = 'pob-btn' + (!autoEnabled ? ' pob-btn-off active' : '');

    const statusMsg = document.createElement('span');
    statusMsg.style.cssText = 'color: #e57373; font-size: 11px; margin-left: auto; display: none; font-weight: bold; padding-right: 4px;';
    statusMsg.textContent = 'Server Offline';

    let serverOnline = true;
    let isSettingsOpen = false;
    let settingsContent;

    const updateBtns = () => {
      if (!serverOnline) {
        if (autoEnabled) {
          autoEnabled = false;
          window.top.postMessage({ message: 'toggle', enabled: false }, '*');
        }
        autoEnabled = false;
        onBtn.disabled = true;
        onBtn.title = 'Start the local server (start.bat) and refresh the page to enable.';
        if (typeof innerContent !== 'undefined') innerContent.style.display = 'none';
        if (settingsContent) settingsContent.style.display = isSettingsOpen ? 'flex' : 'none';
        if (typeof offlineOverlay !== 'undefined') offlineOverlay.style.display = isSettingsOpen ? 'none' : 'flex';
      } else {
        onBtn.disabled = false;
        onBtn.title = 'Activar evaluación automática';
        if (typeof innerContent !== 'undefined') innerContent.style.display = isSettingsOpen ? 'none' : 'flex';
        if (settingsContent) settingsContent.style.display = isSettingsOpen ? 'flex' : 'none';
        if (typeof offlineOverlay !== 'undefined') offlineOverlay.style.display = 'none';
      }
      onBtn.className = 'pob-btn' + (autoEnabled ? ' pob-btn-on active' : '');
      offBtn.className = 'pob-btn' + (!autoEnabled ? ' pob-btn-off active' : '');
    };

    onBtn.onclick = () => {
      if (autoEnabled || !serverOnline) return;
      autoEnabled = true;
      window.top.postMessage({ message: 'toggle', enabled: autoEnabled }, '*');
      updateBtns();
    };

    offBtn.onclick = () => {
      if (!autoEnabled) return;
      autoEnabled = false;
      window.top.postMessage({ message: 'toggle', enabled: autoEnabled }, '*');
      updateBtns();
    };

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'APPLY';
    applyBtn.title = 'Apply socket changes to loaded items';
    applyBtn.className = 'pob-btn pob-glow';
    applyBtn.style.cssText = 'display:none; margin-left: 8px; border-color: #c8a84a; color: #ebd592; font-weight: bold; padding: 4px 12px;';
    applyBtn.onclick = () => {
      applyBtn.style.display = 'none';
      window.top.postMessage({ message: 're_eval' }, '*');
    };
    const showApply = () => { applyBtn.style.display = 'block'; };

    const spacer = document.createElement('div');
    spacer.style.marginLeft = 'auto';

    const updateBtn = document.createElement('button');
    updateBtn.textContent = 'UPDATE';
    updateBtn.title = 'A new version is available! Click to update.';
    updateBtn.className = 'pob-btn pob-glow';
    updateBtn.style.cssText = 'display:none; margin-left: 8px; border-color: #4caf50 !important; color: #81c784 !important; font-weight: bold; padding: 4px 12px;';
    updateBtn.onclick = async () => {
      const isUserscript = typeof GM_info !== 'undefined';
      if (isUserscript) {
        window.open('https://github.com/rauldzmartin/PoB-Injector/releases/latest/download/pob-injector.user.js', '_blank');
        updateBtn.style.display = 'none';
        return;
      }

      updateBtn.textContent = 'UPDATING...';
      updateBtn.disabled = true;
      updateBtn.classList.remove('pob-glow');
      try {
        await API.triggerUpdate();
      } catch (e) {
        console.error("Trigger update failed:", e);
      }
      
      const pollOnline = async () => {
        let wasOffline = false;
        while (true) {
          const isOnline = await API.checkStatus();
          if (!isOnline) wasOffline = true;
          if (wasOffline && isOnline) {
            window.location.reload();
            return;
          }
          await new Promise(r => setTimeout(r, 1000));
        }
      };
      pollOnline();
    };

    const settingsBtn = document.createElement('button');
    settingsBtn.innerHTML = '⚙️';
    settingsBtn.title = 'Settings';
    settingsBtn.className = 'pob-btn';
    settingsBtn.style.cssText = 'margin-left: 8px; font-size: 14px; padding: 2px 6px;';
    
    settingsBtn.onclick = (e) => {
      isSettingsOpen = !isSettingsOpen;
      updateBtns();
      if (isSettingsOpen) {
        settingsBtn.classList.add('pob-glow');
        settingsBtn.style.borderColor = '#c8a84a';
      } else {
        settingsBtn.classList.remove('pob-glow');
        settingsBtn.style.borderColor = '';
      }
      e.stopPropagation();
    };

    navbar.append(onBtn, offBtn, spacer, statusMsg, applyBtn, updateBtn, settingsBtn);

    const checkUpdateVisibility = async () => {
      const hasUpdate = await API.checkUpdate();
      const manifest = ({ version: '0.6.21' });
      const extVersion = manifest.version_name || manifest.version;
      
      const serverIsNewer = API.serverVersion && extVersion && API.serverVersion !== extVersion;
      
      if ((hasUpdate || serverIsNewer) && updateBtn.style.display === 'none') {
        updateBtn.style.display = 'block';
        window.top.postMessage({ message: 'show_update_notification' }, '*');
      }
    };

    setInterval(async () => {
      if (serverOnline) {
        await checkUpdateVisibility();
      }
    }, 3 * 60 * 1000);

    // Auto-load default build in background
    setTimeout(async () => {
      serverOnline = await API.checkStatus();
      updateBtns();
      if (serverOnline) {
        try {
          const builds = await API.listBuilds();
          buildSelect.innerHTML = '';
          for (const b of builds) {
            const opt = document.createElement('option');
            opt.value = b.path;
            opt.textContent = b.name;
            if (cfg.activeBuild === b.path) opt.selected = true;
            buildSelect.appendChild(opt);
          }
          await API.loadPoB(cfg.activeBuild || null);
          injectCode();
          if (typeof loadEnchantsToUI === 'function') loadEnchantsToUI();
          await checkUpdateVisibility();
        } catch (e) {
          console.error(e);
        }
      } else {
        buildSelect.style.display = 'none';
      }
    }, 100);

    // === CONTENT ===
    const content = document.createElement('div');
    content.className = 'pob-content';
    content.style.position = 'relative';

    const innerContent = document.createElement('div');
    innerContent.style.cssText = 'display: flex; flex-direction: column; gap: 0;';

    const offlineOverlay = document.createElement('div');
    offlineOverlay.style.cssText = 'display: none; flex-direction: column; align-items: center; justify-content: center; padding: 32px 12px; text-align: center; color: #e57373; min-height: 100px; box-sizing: border-box; width: 100%;';
    offlineOverlay.innerHTML = `
    <div style="font-size: 14px; font-weight: bold; margin-bottom: 8px; letter-spacing: 0.5px;">Server Offline</div>
    <div style="font-size: 12px; color: #a99c82; line-height: 1.5;">Run <code style="background: #110e0b; border: 1px solid #3a3225; padding: 2px 4px; border-radius: 2px; color: #c8b88a; font-family: monospace;">start.bat</code> to connect</div>
  `;
    content.append(innerContent, offlineOverlay);

    const typeLbl = document.createElement('div');
    typeLbl.id = 'pob-type-label';
    typeLbl.className = 'pob-section-title';
    typeLbl.style.display = 'none';
    typeLbl.style.marginTop = '4px';
    typeLbl.style.marginBottom = '8px';
    typeLbl.textContent = '';

    const buildSelect = document.createElement('select');
    buildSelect.title = 'Select active build';

    let isDropdownOpen = false;
    let isReloadingBuild = false;
    const reloadActiveBuild = async () => {
      if (isReloadingBuild) return;
      if (buildSelect.value === cfg.activeBuild || (!cfg.activeBuild && buildSelect.value === buildSelect.options[0]?.value)) {
        isDropdownOpen = false;
        return;
      }
      isReloadingBuild = true;
      isDropdownOpen = false;
      cfg.activeBuild = buildSelect.value;
      saveCfg();
      const prevBg = buildSelect.style.background;
      buildSelect.style.background = '#2a2620';
      try {
        await API.loadPoB(cfg.activeBuild || null);
        location.reload();
      } catch (e) {
        console.error(e);
        setTimeout(() => { buildSelect.style.background = prevBg; }, 300);
        isReloadingBuild = false;
      }
    };

    buildSelect.onchange = reloadActiveBuild;
    buildSelect.onclick = () => {
      if (isDropdownOpen) {
        reloadActiveBuild();
      } else {
        isDropdownOpen = true;
      }
    };
    buildSelect.onblur = () => {
      isDropdownOpen = false;
    };

    const buildRow = document.createElement('div');
    buildRow.className = 'pob-row';
    buildRow.style.marginBottom = '6px';
    const buildLbl = document.createElement('label');
    buildLbl.className = 'pob-label';
    buildLbl.textContent = 'Build:';
    buildLbl.style.minWidth = '45px';
    const buildCombo = document.createElement('div');
    buildCombo.className = 'pob-combo';
    buildCombo.append(buildSelect);
    buildRow.append(buildLbl, buildCombo);

    // Helper: create toggle switch for a config flag
    function makeSwitch(id, checked, label, tooltip, onChange) {
      const row = document.createElement('div');
      row.className = 'pob-row';
      const sw = document.createElement('label');
      sw.className = 'pob-switch'; sw.title = tooltip;
      const inp = document.createElement('input');
      inp.type = 'checkbox'; inp.checked = checked; inp.id = id;
      inp.onchange = () => onChange(inp.checked);
      const track = document.createElement('span');
      track.className = 'pob-switch-track';
      sw.append(inp, track);
      const lbl = document.createElement('label');
      lbl.className = 'pob-label'; lbl.htmlFor = id; lbl.title = tooltip;
      lbl.textContent = label;
      row.append(sw, lbl);
      return { row, inp };
    }

    // Other stats section
    const otherStatsSection = document.createElement('div');
    otherStatsSection.id = 'pob-max-quality-section';
    otherStatsSection.style.cssText = 'display:flex; flex-direction:column; gap:6px;';
    
    const mqSw = makeSwitch('pob-max-quality', cfg.maxQuality, 'Max quality', 'Normalize item quality to 20%', v => {
      cfg.maxQuality = v; saveCfg(); 
      window.top.postMessage({ message: 're_eval' }, '*');
    });
    otherStatsSection.append(mqSw.row);

    let socketBackup = null;

    const clearSocketsBtn = document.createElement('button');
    clearSocketsBtn.className = 'pob-btn';
    clearSocketsBtn.textContent = 'CLEAR';
    clearSocketsBtn.title = 'Clear socket configurations';
    clearSocketsBtn.style.cssText = 'font-size: 9px; padding: 2px 6px; letter-spacing: 0.5px; border-color: #8c7355; color: #d0b894;';
    
    function updateClearBtnVisibility() {
      if (socketBackup) {
        clearSocketsBtn.textContent = 'UNDO';
        clearSocketsBtn.title = 'Restore previous socket configurations';
        clearSocketsBtn.style.visibility = 'visible';
        clearSocketsBtn.style.borderColor = '#c8a84a';
        clearSocketsBtn.style.color = '#ebd592';
      } else {
        const hasConfig = cfg.enabled || !!cfg.runeLine || cfg.perSocketEnabled || cfg.perSocket.some(x => !!x) || cfg.addMissingSockets;
        clearSocketsBtn.textContent = 'CLEAR';
        clearSocketsBtn.title = 'Clear socket configurations';
        clearSocketsBtn.style.visibility = hasConfig ? 'visible' : 'hidden';
        clearSocketsBtn.style.borderColor = '#8c7355';
        clearSocketsBtn.style.color = '#d0b894';
      }
    }

    const allSocketsExt = document.createElement('div');
    allSocketsExt.id = 'pob-rune-all-wrap';
    allSocketsExt.style.cssText = 'display:flex; align-items:center; gap:8px; margin-left:6px; margin-bottom:12px;';
    allSocketsExt.style.display = cfg.enabled ? 'flex' : 'none';

    // Global rune
    const m1 = makeSwitch('pob-rune-all', cfg.enabled, 'All sockets', 'Override/fill all sockets with chosen rune', v => {
      cfg.enabled = v;
      allSocketsExt.style.display = v ? 'flex' : 'none';
      if (v) {
        cfg.perSocketEnabled = false; ps.inp.checked = false;
        if (typeof psPanel !== 'undefined') psPanel.style.display = 'none';
      }
      socketBackup = null;
      saveCfg();
      showApply();
      updateClearBtnVisibility();
    });

    const runeDatalist = document.createElement('datalist');
    runeDatalist.id = 'pob-runes-list';
    if (currentRuneList && currentRuneList.length > 0) {
      for (const m of currentRuneList) { const o = document.createElement('option'); o.value = m; runeDatalist.append(o); }
    }

    const runeCombo = makeCombo({ list: 'pob-runes-list', placeholder: 'Rune\u2026', title: 'Search or type a rune modifier' });
    runeCombo.inp.value = cfg.runeLine;
    const updateRuneFn = () => { socketBackup = null; cfg.runeLine = runeCombo.inp.value; saveCfg(); showApply(); updateClearBtnVisibility(); };
    runeCombo.inp.addEventListener('input', updateRuneFn);
    runeCombo.inp.addEventListener('change', updateRuneFn);

    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'pob-icon-btn'; refreshBtn.innerHTML = '\u21bb'; refreshBtn.title = 'Reload runes for current item type';
    refreshBtn.onclick = async () => {
      refreshBtn.disabled = true;
      runeDatalist.innerHTML = '<option disabled>Loading\u2026</option>';
      try {
        currentRuneList = await ensureRunesFor(cfg.lastSlotsCsv || '');
        runeDatalist.innerHTML = '';
        for (const m of currentRuneList) { const o = document.createElement('option'); o.value = m; runeDatalist.append(o); }
      } catch {
        currentRuneList = [];
        runeDatalist.innerHTML = '<option disabled style="color:#c66">\u26a0 Server unreachable</option>';
      } finally { refreshBtn.disabled = false; }
    };

    allSocketsExt.append(runeCombo.wrap, refreshBtn, runeDatalist);

    // Wrapper for all socket-related controls
    const socketSection = document.createElement('div');
    socketSection.className = 'pob-socket-section';

    // Per-socket
    const ps = makeSwitch('pob-rune-per', cfg.perSocketEnabled, 'Per socket', 'Override each socket individually', v => {
      cfg.perSocketEnabled = v;
      psPanel.style.display = v ? 'flex' : 'none';
      if (v) {
        cfg.enabled = false; m1.inp.checked = false;
        allSocketsExt.style.display = 'none';
      }
      socketBackup = null;
      saveCfg();
      showApply();
      updateClearBtnVisibility();
    });

    const psPanel = document.createElement('div');
    psPanel.className = 'pob-col'; psPanel.style.marginTop = '6px'; psPanel.style.marginLeft = '6px'; psPanel.style.marginBottom = '12px';
    psPanel.style.display = cfg.perSocketEnabled ? 'flex' : 'none';
    function addSocketRow(idx) {
      const r = document.createElement('div'); r.className = 'pob-row';
      const lbl = document.createElement('span'); lbl.className = 'pob-socket-lbl'; lbl.textContent = `${idx + 1}`;
      const c = makeCombo({ list: 'pob-runes-list', placeholder: 'Rune\u2026' });
      c.inp.value = cfg.perSocket[idx] || '';
      const updateFn = () => { socketBackup = null; cfg.perSocket[idx] = c.inp.value; saveCfg(); showApply(); updateClearBtnVisibility(); };
      c.inp.addEventListener('input', updateFn);
      c.inp.addEventListener('change', updateFn);
      r.append(lbl, c.wrap);
      psPanel.append(r);
    }
    for (let i = 0; i < 6; i++) addSocketRow(i);

    // Fill sockets
    const fillSw = makeSwitch('pob-fill-sockets', cfg.addMissingSockets, 'Fill sockets', 'Add missing sockets up to the standard maximum', v => {
      socketBackup = null; cfg.addMissingSockets = v; saveCfg(); showApply(); updateClearBtnVisibility();
    });

    socketSection.append(m1.row, allSocketsExt, ps.row, psPanel, fillSw.row);

    function makeSection(titleText, rightEl, ...children) {
      const sec = document.createElement('div');
      sec.className = 'pob-section';
      
      const header = document.createElement('div');
      header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;';
      
      const title = document.createElement('div');
      title.className = 'pob-section-title';
      title.style.marginBottom = '0';
      title.textContent = titleText;
      
      header.append(title);
      if (rightEl) header.append(rightEl);
      
      sec.append(header, ...children);
      return sec;
    }

    clearSocketsBtn.onclick = () => {
      if (socketBackup) {
        // Restore from backup
        cfg.enabled = socketBackup.enabled;
        cfg.runeLine = socketBackup.runeLine;
        cfg.perSocketEnabled = socketBackup.perSocketEnabled;
        cfg.perSocket = [...socketBackup.perSocket];
        cfg.addMissingSockets = socketBackup.addMissingSockets;
        socketBackup = null;
        
        m1.inp.checked = cfg.enabled;
        allSocketsExt.style.display = cfg.enabled ? 'flex' : 'none';
        runeCombo.inp.value = cfg.runeLine;
        
        ps.inp.checked = cfg.perSocketEnabled;
        psPanel.style.display = cfg.perSocketEnabled ? 'flex' : 'none';
        const inps = document.querySelectorAll('.pob-col .pob-combo input');
        inps.forEach((inp, idx) => { inp.value = cfg.perSocket[idx] || ''; });
        
        fillSw.inp.checked = cfg.addMissingSockets;
      } else {
        // Backup and clear
        socketBackup = {
          enabled: cfg.enabled,
          runeLine: cfg.runeLine,
          perSocketEnabled: cfg.perSocketEnabled,
          perSocket: [...cfg.perSocket],
          addMissingSockets: cfg.addMissingSockets
        };
        
        cfg.enabled = false;
        m1.inp.checked = false;
        allSocketsExt.style.display = 'none';
        
        cfg.runeLine = '';
        runeCombo.inp.value = '';
        
        cfg.perSocketEnabled = false;
        ps.inp.checked = false;
        psPanel.style.display = 'none';
        const inps = document.querySelectorAll('.pob-col .pob-combo input');
        inps.forEach(inp => { inp.value = ''; });
        cfg.perSocket = Array(6).fill('');
        
        cfg.addMissingSockets = false;
        fillSw.inp.checked = false;
      }
      
      saveCfg();
      showApply();
      updateClearBtnVisibility();
    };
    updateClearBtnVisibility();

    const amuletSection = document.createElement('div');
    amuletSection.className = 'pob-amulet-section';

    const enchSw = makeSwitch('pob-ench-en', cfg.enchantEnabled, 'Override enchant', 'Apply specific anointment', v => {
      cfg.enchantEnabled = v; saveCfg(); 
      window.top.postMessage({ message: 're_eval' }, '*');
    });

    const enchDatalist = document.createElement('datalist');
    enchDatalist.id = 'pob-ench-list';

    const enchCombo = makeCombo({ list: 'pob-ench-list', placeholder: 'Enchant\u2026', title: 'Search for an anointment' });
    enchCombo.inp.value = cfg.enchantText || '';
    const updateEnchFn = () => { 
      cfg.enchantText = enchCombo.inp.value; saveCfg(); 
      window.top.postMessage({ message: 're_eval' }, '*'); 
    };
    enchCombo.inp.addEventListener('input', updateEnchFn);
    enchCombo.inp.addEventListener('change', updateEnchFn);

    const loadEnchantsToUI = async () => {
      try {
        const list = await ensureEnchants('');
        enchDatalist.innerHTML = '';
        for (const m of list) { 
          const o = document.createElement('option'); 
          o.value = m.text.replace(/^Allocates\s+/i, ''); 
          o.textContent = o.value;
          enchDatalist.append(o); 
        }
      } catch (e) {}
    };

    enchCombo.inp.addEventListener('focus', () => {
      if (!enchDatalist.children.length) loadEnchantsToUI();
    });
    
    // Auto-load enchants initially
    loadEnchantsToUI();

    const enchRow = document.createElement('div');
    enchRow.style.cssText = 'display:flex; align-items:center; gap:8px; margin-left:6px; margin-top:4px;';
    enchRow.append(enchCombo.wrap, enchDatalist);

    amuletSection.append(enchSw.row, enchRow);

    const amuletBlock = makeSection('Amulets', null, amuletSection);
    amuletBlock.id = 'pob-amulet-block';

    const otherStatsBlock = makeSection('Other adjustments', null, otherStatsSection);
    otherStatsBlock.id = 'pob-other-stats-block';
    
    const socketBlock = makeSection('Sockets', clearSocketsBtn, socketSection);
    socketBlock.id = 'pob-socket-block';

    innerContent.append(buildRow, typeLbl, amuletBlock, socketBlock, otherStatsBlock);
    updateSectionVisibility();
    
    settingsContent = document.createElement('div');
    settingsContent.style.cssText = 'display:none; flex-direction: column; gap: 0;';
    
    const devOptIn = makeSwitch('pob-dev-branch', cfg.useDevBranch, 'Developer Releases', 'Opt-in to dev branch updates', v => {
      cfg.useDevBranch = v;
      saveCfg();
    });

    const checkUpdateBtnRow = document.createElement('div');
    checkUpdateBtnRow.style.cssText = 'display:flex; margin-top: 4px;';
    const forceUpdateBtn = document.createElement('button');
    forceUpdateBtn.textContent = 'Check for Updates';
    forceUpdateBtn.className = 'pob-btn';
    forceUpdateBtn.style.cssText = 'width: 100%;';
    
    forceUpdateBtn.onclick = async () => {
      const originalText = forceUpdateBtn.textContent;
      forceUpdateBtn.textContent = 'Checking...';
      forceUpdateBtn.disabled = true;
      try {
        const hasUpdate = await API.checkUpdate();
        if (hasUpdate) {
          forceUpdateBtn.textContent = 'Update Available!';
          forceUpdateBtn.style.borderColor = '#4caf50';
          forceUpdateBtn.style.color = '#81c784';
          if (typeof updateBtn !== 'undefined') updateBtn.style.display = 'block';
          window.top.postMessage({ message: 'show_update_notification' }, '*');
        } else {
          forceUpdateBtn.textContent = 'Up to date';
        }
      } catch (e) {
        forceUpdateBtn.textContent = 'Error checking';
      }
      setTimeout(() => {
        forceUpdateBtn.textContent = originalText;
        forceUpdateBtn.disabled = false;
        forceUpdateBtn.style.borderColor = '';
        forceUpdateBtn.style.color = '';
      }, 3000);
    };
    checkUpdateBtnRow.append(forceUpdateBtn);
    
    const settingsInner = document.createElement('div');
    settingsInner.style.cssText = 'display:flex; flex-direction:column; gap:6px; margin-top:4px; margin-left:6px; margin-bottom: 12px;';
    settingsInner.append(devOptIn.row, checkUpdateBtnRow);
    
    const settingsBlock = makeSection('Updates', null, settingsInner);
    settingsBlock.id = 'pob-settings-block';
    
    const versionLbl = document.createElement('div');
    versionLbl.style.cssText = 'font-size: 10px; color: #5a4d3a; text-align: right; margin-top: 4px; padding-right: 4px;';
    const manifest = ({ version: '0.6.21' });
    versionLbl.textContent = 'v' + (manifest.version_name || manifest.version);
    
    settingsContent.append(settingsBlock, versionLbl);
    
    content.append(innerContent, settingsContent, offlineOverlay);
    body.append(navbar, content);

    const rightCol = document.createElement('div');
    rightCol.id = 'pob-right-col';
    rightCol.style.cssText = 'display:flex; flex-direction:column-reverse; gap:8px; align-items:flex-start; pointer-events:none;';
    body.style.pointerEvents = 'auto';
    rightCol.append(body);

    bar.append(head, rightCol);
    document.body.appendChild(bar);
  }

  // Listen for messages; apply overrides per item, preview + send
  window.addEventListener('message', async e => {
    if (!e || !e.data || e.source !== window) return;
    if (e.data.message === 'get_item_impact') {
      if (!autoEnabled) return;
      try {
        const sockets = Number(e.data.sockets || 0) || 0;
        const maxSockets = Number(e.data.maxSockets || 0) || 0;
        const runeslots = (e.data.runeSlots || '');
        const typeLabel = e.data.itemTypeLabel || (runeslots || '—');

        // Update section visibility based on item capabilities
        currentItemHasSockets = maxSockets > 0;
        currentItemIsAmulet = /^Amulet/i.test(e.data.itemTypeLabel || '');
        currentItemCanHaveQuality = !!e.data.canHaveQuality;
        currentItemIsCorrupted = !!e.data.isCorrupted;
        updateSectionVisibility();

        const t = document.getElementById('pob-type-label');
        if (t) {
          t.textContent = 'Settings for: ' + typeLabel;
          t.style.display = 'block';
        }

        if (cfg.activeItemTypeLabel !== typeLabel) {
          if (!cfg.savedRunes) cfg.savedRunes = {};
          if (cfg.activeItemTypeLabel) {
            cfg.savedRunes[cfg.activeItemTypeLabel] = {
              enabled: cfg.enabled,
              perSocketEnabled: cfg.perSocketEnabled,
              perSocket: [...cfg.perSocket],
              runeLine: cfg.runeLine
            };
          }

          const saved = cfg.savedRunes[typeLabel];
          if (saved) {
            cfg.enabled = saved.enabled;
            cfg.perSocketEnabled = saved.perSocketEnabled;
            cfg.perSocket = [...saved.perSocket];
            cfg.runeLine = saved.runeLine;
          } else {
            cfg.enabled = false;
            cfg.perSocketEnabled = false;
            cfg.perSocket = ['', '', '', '', '', ''];
            cfg.runeLine = '';
          }
          cfg.activeItemTypeLabel = typeLabel;
          saveCfg();

          const psInp = document.getElementById('pob-rune-per'); if (psInp) psInp.checked = cfg.perSocketEnabled;
          const allInp = document.getElementById('pob-rune-all'); if (allInp) allInp.checked = cfg.enabled;
          
          const globalCombo = document.querySelector('#pob-rune-all-wrap .pob-combo input');
          if (globalCombo) globalCombo.value = cfg.runeLine;

          const psCombos = document.querySelectorAll('.pob-col .pob-combo input');
          psCombos.forEach((inp, idx) => inp.value = cfg.perSocket[idx] || '');
          
          const psPanel = document.querySelector('.pob-col'); 
          if (psPanel) psPanel.style.display = cfg.perSocketEnabled ? 'flex' : 'none';
          
          if (typeof updateClearBtnVisibility === 'function') updateClearBtnVisibility();

          const allSocketsExt = document.getElementById('pob-rune-all-wrap');
          if (allSocketsExt) allSocketsExt.style.display = cfg.enabled ? 'flex' : 'none';
        }
        window.lastPobItemTypeLabel = typeLabel;

        if (cfg.lastSlotsCsv !== runeslots || !document.getElementById('pob-runes-list')?.children.length) {
          cfg.lastSlotsCsv = runeslots;
          const dl = document.getElementById('pob-runes-list');
          if (dl) dl.innerHTML = '<option disabled>Loading\u2026</option>';
          try {
            currentRuneList = await ensureRunesFor(runeslots);
            if (dl) {
              dl.innerHTML = '';
              for (const m of currentRuneList) {
                const o = document.createElement('option'); o.value = m; o.textContent = m;
                dl.append(o);
              }
            }
          } catch {
            currentRuneList = [];
            if (dl) dl.innerHTML = '<option disabled style="color:#c66">\u26a0 Server unreachable</option>';
          }
        }

        let itemTextAfter = e.data.item;
        let used = [], userAddedRunes = [], targetSockets = 0;
        let incompatible = false;
        let __enchRes = null;
        let isMaxQualityWanted = false;

        const resOverride = applyRuneOverride(e.data.item, { sockets, maxSockets });
        let UIitemTextAfter = resOverride.text;
        used = resOverride.used;
        userAddedRunes = resOverride.userAddedRunes;
        targetSockets = resOverride.targetSockets;

        if (userAddedRunes && userAddedRunes.length) {
          if (!Array.isArray(currentRuneList) || currentRuneList.length === 0) {
            incompatible = true;
          } else {
            const allowed = new Set(currentRuneList.map(normRuneText));
            for (const u of userAddedRunes) { if (!allowed.has(normRuneText(u))) { incompatible = true; break; } }
          }
        }

        if (incompatible) {
          UIitemTextAfter = e.data.item;
        }

        __enchRes = applyEnchantOverride(UIitemTextAfter);
        UIitemTextAfter = __enchRes.text;

        isMaxQualityWanted = cfg.maxQuality && e.data.canHaveQuality;
        if (isMaxQualityWanted && !e.data.isCorrupted) {
          if (!/^Quality:/m.test(UIitemTextAfter)) {
            UIitemTextAfter = UIitemTextAfter.replace(/^(Rarity:.*(?:\r?\n.*)*?)\r?\n--------/m, '$1\n--------\nQuality: +20%');
          } else {
            UIitemTextAfter = UIitemTextAfter.replace(/^Quality:.*\r?\n?/gm, 'Quality: +20%\n');
          }
          UIitemTextAfter = UIitemTextAfter
            .replace(/^Physical Damage:.*\r?\n?/gm, '')
            .replace(/^Elemental Damage:.*\r?\n?/gm, '')
            .replace(/^Chaos Damage:.*\r?\n?/gm, '')
            .replace(/^Armour:.*\r?\n?/gm, '')
            .replace(/^Evasion Rating:.*\r?\n?/gm, '')
            .replace(/^Energy Shield:.*\r?\n?/gm, '')
            .replace(/^Ward:.*\r?\n?/gm, '');
        }

        if (e.data.skipOverrides) {
          itemTextAfter = e.data.item;
        } else {
          itemTextAfter = UIitemTextAfter;
        }

        let __enchantPreviewHtml = '';
        if (__enchRes) {
          if (__enchRes.mode === 'disabled_corrupted') {
            __enchantPreviewHtml = `<div class="rune_preview_box option">
            <div style="opacity:.8;margin-bottom:4px;font-weight:bold;">Amulet enchant</div>
            <div style="color:#ff6666;font-weight:bold;">Override disabled (Item is Corrupted)</div>
            </div>`;
          } else if (__enchRes.appliedText) {
            const __modeLabel = __enchRes.mode === 'overridden' ? '(replaced existing)' : '(added)';
            __enchantPreviewHtml = `<div class="rune_preview_box option">
            <div style="opacity:.8;margin-bottom:4px;font-weight:bold;">Amulet enchant ${__modeLabel}</div>
            <div style="white-space:pre-wrap;color:rgb(180, 180, 255);">${__enchRes.appliedText}</div>
          </div>`;
          }
        }

        const previewMeta = [];
        if (cfg.addMissingSockets && maxSockets > sockets) previewMeta.push(`(+${maxSockets - sockets} sockets)`);
        const metaStr = previewMeta.length ? ` <span style="opacity:.7">${previewMeta.join(' ')}</span>` : '';

        let warn = '';
        if (incompatible) {
          warn = `<div style="color:#ff6666;margin:0 0 6px 0;font-weight:600;">wrong item type — please click “Reload runes” and search again</div>`;
        }

        let otherStatsHtml = '';
        // isMaxQualityWanted already defined above
        if (isMaxQualityWanted) {
          const qMatch = e.data.item.match(/^Quality:\s*\+?(\d+)%/m);
          const currentQ = qMatch ? parseInt(qMatch[1], 10) : 0;
          let qText = e.data.isCorrupted 
            ? `Quality maxed (${currentQ}% - <span style="color:#ff6666">Corrupted</span>)`
            : `Quality maxed (${currentQ}% to 20%)`;
          otherStatsHtml = `
          <div style="opacity:.8;margin-bottom:4px;font-weight:bold;">Other stats</div>
          <div style="color:rgb(180, 180, 255);margin-bottom:8px;">${qText}</div>`;
        }

        const wrapDisabled = (html) => e.data.skipOverrides && html ? `<div style="opacity:0.45; filter:grayscale(1); pointer-events:none;">${html}</div>` : html;

        if ((used && used.length) || isMaxQualityWanted) {
          const runesHtml = (used && used.length) ? `
          <div style="opacity:.8;margin-bottom:4px;font-weight:bold;">Runes applied (${used.length}/${targetSockets})${metaStr}</div>
          <div>${used.map(s => `<div style="white-space:pre-wrap;color:rgb(180, 180, 255);">${s.replace(/\s*\(rune\)\s*$/i, '')}</div>`).join('')}</div>` : '';

          const baseHtml = `<div class="rune_preview_box option">
          ${warn}
          ${otherStatsHtml}
          ${runesHtml}
        </div>`;
          window.top.postMessage({ message: 'set_rune_preview', dataId: e.data.dataId, html: wrapDisabled(baseHtml + __enchantPreviewHtml) }, '*');
        } else {
          window.top.postMessage({ message: 'set_rune_preview', dataId: e.data.dataId, html: incompatible ? wrapDisabled(`<div class="rune_preview_box option">${warn}</div>`) : '' }, '*');
          if (__enchantPreviewHtml && !incompatible) { window.top.postMessage({ message: 'set_rune_preview', dataId: e.data.dataId, html: wrapDisabled(__enchantPreviewHtml) }, '*'); }
        }

        const res = await API.itemImpact(itemTextAfter, isMaxQualityWanted);
        console.log("PoB itemImpact res:", res);
        console.log("Used runes:", used);
        
        if (res.unsupported && res.unsupported.length && used && used.length) {
          let unsupportedRunes = used.map(u => u.replace(/\s*\(rune\)\s*$/i, '')).filter(r => res.unsupported.some(u => u.includes(r)));
          
          const simulatedRunes = [];
          unsupportedRunes = unsupportedRunes.filter(r => {
            if (/Transforms all (Fire|Cold|Lightning) and (Fire|Cold|Lightning) modifiers.*equivalent (Fire|Cold|Lightning) modifiers/i.test(r)) {
              simulatedRunes.push(r);
              return false;
            }
            return true;
          });

          if (unsupportedRunes.length || simulatedRunes.length) {
            const updatedRunesHtml = `
            <div style="opacity:.8;margin-bottom:4px;font-weight:bold;">Runes applied (${used.length}/${targetSockets})${metaStr}</div>
            <div>${used.map(s => {
              const clean = s.replace(/\s*\(rune\)\s*$/i, '');
              const isUnsupp = unsupportedRunes.includes(clean);
              const isSim = simulatedRunes.includes(clean);
              const extraWarn = isUnsupp ? ' <span title="Not supported in PoB yet" style="cursor:help">⚠️</span>' : (isSim ? ' <span title="Not natively supported in PoB (Simulated by extension)" style="cursor:help">⚠️</span>' : '');
              return `<div style="white-space:pre-wrap;color:${isUnsupp ? '#ff6666' : 'rgb(180, 180, 255)'};${isUnsupp ? 'text-decoration:line-through;' : ''}">${clean}${extraWarn}</div>`;
            }).join('')}</div>`;
            
            const updatedHtml = `<div class="rune_preview_box option">
            ${warn}
            ${otherStatsHtml}
            ${updatedRunesHtml}
          </div>`;
            window.top.postMessage({ message: 'set_rune_preview', dataId: e.data.dataId, html: wrapDisabled(updatedHtml + __enchantPreviewHtml) }, '*');
          }
        }

        window.top.postMessage({ message: 'set_item_impact', dataId: e.data.dataId, itemImpact: res.html }, '*');
      } catch (err) {
        window.top.postMessage({ message: 'set_item_impact', dataId: e.data.dataId, itemImpact: '<span style="color:#f55" title="Failed to connect to local server (start.bat)">Server offline</span>' }, '*');
      }
    } else if (e.data.message === 'import_item_to_pob') {
      try {
        const sockets = Number(e.data.sockets || 0) || 0;
        const maxSockets = Number(e.data.maxSockets || 0) || 0;
        let { text: itemTextAfter } = applyRuneOverride(e.data.item, { sockets, maxSockets });
        let __enchRes = applyEnchantOverride(itemTextAfter);
        itemTextAfter = __enchRes.text;

        // Strip trade note lines like ~b/o 140 divine before importing to PoB
        itemTextAfter = itemTextAfter.split('\n').filter(line => !line.trim().startsWith('~')).join('\n');

        await API.importItem(itemTextAfter, cfg.maxQuality && !e.data.isCorrupted);
        window.top.postMessage({ message: 'import_item_result', dataId: e.data.dataId, success: true }, '*');
      } catch (err) {
        window.top.postMessage({ message: 'import_item_result', dataId: e.data.dataId, success: false }, '*');
      }
    }
  }, false);

  // init
  function initWhenReady() {
    loadCfg().then(async () => {
      try { await ensureRunesFor(cfg.lastSlotsCsv || ''); } catch { }
      makeControl();
      injectCode();

      const showBody = () => {
        const b = document.getElementById('pob-body-panel-id');
        if (b) b.style.display = cfg.uiCollapsed ? 'none' : 'flex';
      };
      const t = setTimeout(showBody, 2000);
      const rc = new MutationObserver(() => {
        if (document.querySelector('div.resultset div.row[data-id]')) {
          clearTimeout(t); rc.disconnect(); setTimeout(showBody, 150);
        }
      });
      rc.observe(document.body, { childList: true, subtree: true });
    });
  }

  if (document.getElementById('trade')) {
    initWhenReady();
  } else {
    const appObs = new MutationObserver((mutations, obs) => {
      if (document.getElementById('trade')) {
        obs.disconnect();
        initWhenReady();
      }
    });
    appObs.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
})();
