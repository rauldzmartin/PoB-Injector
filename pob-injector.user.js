// ==UserScript==
// @name         PoB Injector
// @namespace    http://tampermonkey.net/
// @version      0.6.13
// @description  Inline PoB impact for trade/trade2 via local FastAPI HTTP server
// @author       rauldzmartin@gmail.com
// @match        *://*.pathofexile.com/trade*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/rauldzmartin/PoB-Injector/main/pob-injector.user.js
// @downloadURL  https://raw.githubusercontent.com/rauldzmartin/PoB-Injector/main/pob-injector.user.js
// ==/UserScript==

(function () {
  'use strict';

  if (typeof chrome === 'undefined') {
    window.chrome = {
      runtime: {
        getURL: (path) => '',
        getManifest: () => ({ version: '0.6.13' }),
        sendMessage: () => { }
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
          return res.ok;
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
        if (!slotsCsv || !slotsCsv.trim()) return []; // no runes for this type
        const res = await fetch(`${this.base}/runes?slot=${encodeURIComponent(slotsCsv)}`);
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
      if (!key) { RUNE_CACHE.set('', []); return []; }
      if (RUNE_CACHE.has(key)) return RUNE_CACHE.get(key);
      const list = await API.listRunes(key);
      const out = Array.isArray(list) ? list : Object.values(list || {}).flat();
      RUNE_CACHE.set(key, out);
      return out;
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
        script.textContent = `(() => {
  if (document.documentElement.dataset.pobInjected === '1') return;
  document.documentElement.dataset.pobInjected = '1';
  let itemByDataId = {};
  let enabled = document.currentScript.getAttribute('enabled') == 'true';
  const disabledOverridesByItem = new Set();

  const pobStyle = document.createElement('style');
  pobStyle.textContent = '.pob-disabled .pob_wrapper, .pob-disabled .pob_import_wrap { display: none !important; }';
  document.head.appendChild(pobStyle);
  if (!enabled) document.documentElement.classList.add('pob-disabled');

  // --- Sort state ---
  let sortState = null; // { stat, loading, abort }
  let sortStatusEl = null;
  let sortingNow = false;
  let currentSortStat = null;
  let currentSortAsc = false;
  const impactCache = {}; // dataId -> HTML string
  const previewCache = {}; // dataId -> rune_preview HTML string

  function textContent(el) { return el ? el.textContent.trim() : ''; }
  function propLine(propNode) {
    if (!propNode) return null;
    const label = textContent(propNode.querySelector(':scope > span:first-child'));
    const val = textContent(propNode.querySelector(':scope > span:nth-child(2)'));
    if (!label) return null;
    const isAug = !!propNode.querySelector('.colourAugmented');
    const aug = isAug ? ' (augmented)' : '';
    return val ? \`\${label} \${val}\${aug}\` : label;
  }

  // --- Item typing helpers (strict mapping from user) ---
  const IC = {
    HELMET: 'helmet', BOOTS: 'boots', GLOVES: 'gloves', BODY: 'body armour',
    WEAPON: 'weapon', CASTER: 'caster', BOW: 'bow', SCEPTRE: 'sceptre',
    ARMOUR: 'armour', FOCUS: 'focus', SHIELD: 'shield', CROSSBOW: 'crossbow'
  };
  // Which Item Class names imply which rune buckets
  function runeBucketsForItemClass(itemClassSingle) {
    const s = (itemClassSingle || '').toLowerCase();
    const buckets = new Set();

    // armour subtags
    if (s === 'helmet') buckets.add(IC.HELMET), buckets.add(IC.ARMOUR);
    if (s === 'boots') buckets.add(IC.BOOTS), buckets.add(IC.ARMOUR);
    if (s === 'gloves') buckets.add(IC.GLOVES), buckets.add(IC.ARMOUR);
    if (s === 'body armour' || s === 'body armor' || s === 'chest') buckets.add(IC.BODY), buckets.add(IC.ARMOUR);
    if (s === 'shield') buckets.add(IC.SHIELD), buckets.add(IC.ARMOUR);
    if (s === 'focus') buckets.add(IC.FOCUS), buckets.add(IC.ARMOUR);

    // weapon & specialisations
    if (s === 'bow') { buckets.add(IC.BOW); buckets.add(IC.WEAPON); }
    if (s === 'crossbow') { buckets.add(IC.CROSSBOW); buckets.add(IC.WEAPON); }
    if (s === 'wand') { buckets.add(IC.CASTER); }              // caster group
    if (s === 'staff') { buckets.add(IC.CASTER); }              // caster group
    if (s === 'sceptre') { buckets.add(IC.SCEPTRE); }             // sceptre-only group
    if (s === 'one hand mace' || s === 'two hand mace' || s === 'quarterstaff' || s === 'spear') {
      buckets.add(IC.WEAPON);
    }

    return Array.from(buckets).sort().join(',');
  }

  function deriveMaxSocketsFromItemClass(itemClassSingle, typeLine) {
    const s = (itemClassSingle || '').toLowerCase();
    const t = (typeLine || '').toLowerCase();

    // Armour
    if (s === 'body armour' || s === 'body armor' || /body armour|body armor|chest/.test(t)) return 2;
    if (s === 'helmet' || /helm/.test(t)) return 1;
    if (s === 'gloves' || /glove/.test(t)) return 1;
    if (s === 'boots' || /boot/.test(t)) return 1;

    // Weapons / Off-hands
    if (s === 'bow') return 2;
    if (s === 'crossbow') return 2;
    if (s === 'staff' || s === 'quarterstaff') return 2;
    if (s === 'spear') return 2;
    if (s === 'two hand mace') return 2;

    if (s === 'wand') return 1;
    if (s === 'one hand mace') return 1;
    if (s === 'shield') return 1;
    if (s === 'focus') return 1;

    // Jewellery / others
    if (s === 'amulet' || s === 'ring' || s === 'belt' || s === 'quiver') return 0;

    // Fallbacks by typeline keywords
    if (/\bbow\b/.test(t)) return 2;
    if (/\bcrossbow\b/.test(t)) return 2;
    if (/\bstaff|stave|staves\b/.test(t)) return 2;
    if (/\bwand\b/.test(t)) return 1;
    if (/\bshield\b/.test(t)) return 1;
    if (/\bfocus\b/.test(t)) return 1;
    return 0;
  }

  function getItemTextFromDOM(node) {
    const popup = node.querySelector('.item-popup');
    if (!popup) return null;
    const lines = [], sep = '--------';

    let rarity = 'Normal';
    const popupCls = popup.className;
    if (/--rare\b/.test(popupCls)) rarity = 'Rare';
    else if (/--magic\b/.test(popupCls)) rarity = 'Magic';
    else if (/--unique\b/.test(popupCls)) rarity = 'Unique';

    const headerLines = [...popup.querySelectorAll('.item-popup__header-line')];
    const isDouble = popup.querySelector('.item-popup__header--double');
    const name = isDouble && headerLines[0] ? textContent(headerLines[0]) : (rarity === 'Unique' || rarity === 'Rare' ? (headerLines[0] ? textContent(headerLines[0]) : '') : '');
    const typeLine = isDouble && headerLines[1] ? textContent(headerLines[1]) : (headerLines[0] ? textContent(headerLines[0]) : '');

    const content = popup.querySelector('.item-popup__content');
    const classEl = content ? content.querySelector('.item-property:first-child .lc > span') : null;
    const itemClass = classEl ? textContent(classEl) : '';

    function isAug(el) {
      if (!el) return false;
      return el.matches('[style*="colour-augmented"], .colourAugmented') ||
        (el.querySelector('[style*="colour-augmented"], .colourAugmented') !== null);
    }

    function propText(el) {
      if (!el) return null;
      const label = el.querySelector(':scope > span:first-child');
      const val = el.querySelector(':scope > span:nth-child(2)');
      if (!label) return null;
      const lt = textContent(label);
      const vt = val ? textContent(val) : '';
      const aug = isAug(val || el);
      return vt ? \`\${lt}: \${vt}\${aug ? ' (augmented)' : ''}\` : lt;
    }

    const q = propText(content ? content.querySelector('[data-field="quality"]') : null);
    const pd = propText(content ? content.querySelector('[data-field="pdamage"]') : null);
    const chc = propText(content ? content.querySelector('[data-field="crit"]') : null);
    const aps = propText(content ? content.querySelector('[data-field="aps"]') : null);
    const rlt = propText(content ? content.querySelector('[data-field="reload_time"]') : null);

    const ilvlEl = content ? content.querySelector('[data-field="ilvl"]') : null;
    const ilvl = ilvlEl ? textContent(ilvlEl).replace(/^Item Level:\s*/i, '').trim() : '';
    const ilvlLine = ilvl ? \`Item Level: \${ilvl}\` : null;

    const reqEl = content ? content.querySelector('.item-popup__property--requirements .lc') : null;
    let req = reqEl ? textContent(reqEl).trim() : null;
    if (req) req = req.replace(/^Requires:\s*/i, '');

    const socketCount = node.querySelectorAll('.left .socket, .left .sockets .socket').length;
    const sockets = socketCount ? \`Sockets: \${Array(socketCount).fill('S').join(' ')}\` : null;

    const noteEl = content ? content.querySelector('[style*="currency"]') : null;
    const noteLine = noteEl ? textContent(noteEl).trim() : null;

    if (itemClass) lines.push(\`Item Class: \${itemClass}\`);
    lines.push(\`Rarity: \${rarity}\`);
    if (name) lines.push(name);
    if (typeLine) lines.push(typeLine);

    if (q || pd || chc || aps || rlt) {
      lines.push(sep);
      [q, pd, chc, aps, rlt].forEach(v => v && lines.push(v));
    }

    if (req || sockets || ilvlLine) {
      lines.push(sep);
      if (req) lines.push(\`Requires: \${req}\`);
      if (sockets) { lines.push(sep); lines.push(sockets); }
      if (ilvlLine) { lines.push(sep); lines.push(ilvlLine); }
    }

    const enchantMods = [];
    const implicitMods = [];
    const explicitGroup = [];

    if (content) {
      const allMods = content.querySelectorAll('.item-mod');
      for (const modEl of allMods) {
        const textEl = modEl.querySelector('[data-field^="stat."]');
        if (!textEl) continue;
        const text = textContent(textEl).trim();
        if (!text) continue;

        if (modEl.classList.contains('item-mod--enchant')) {
          enchantMods.push(text);
        } else if (modEl.classList.contains('item-mod--implicit')) {
          implicitMods.push(text);
        } else if (modEl.classList.contains('item-mod--fractured')) {
          explicitGroup.push(\`\${text} (fractured)\`);
        } else if (modEl.classList.contains('item-mod--crafted')) {
          explicitGroup.push(\`\${text} (crafted)\`);
        } else if (modEl.classList.contains('item-mod--rune')) {
          explicitGroup.push(\`\${text} (rune)\`);
        } else if (modEl.classList.contains('item-mod--desecrated')) {
          explicitGroup.push(\`\${text} (desecrated)\`);
        } else if (modEl.classList.contains('item-mod--explicit')) {
          explicitGroup.push(text);
        }
      }
    }

    if (enchantMods.length || implicitMods.length) {
      lines.push(sep);
      if (enchantMods.length) lines.push(...enchantMods);
      if (implicitMods.length) lines.push(...implicitMods);
    }

    if (explicitGroup.length) {
      lines.push(sep);
      lines.push(...explicitGroup);
    }

    // Corrupted check
    const isCorrupted = content && (content.querySelector('[data-field="corrupted"]') || content.querySelector('.colourCorrupted') || content.textContent.includes('Corrupted'));
    if (isCorrupted) {
      lines.push(sep);
      lines.push('Corrupted');
    }

    if (noteLine) { lines.push(sep); lines.push(noteLine); }

    const runeSlots = runeBucketsForItemClass(itemClass);
    const maxSockets = deriveMaxSocketsFromItemClass(itemClass, typeLine);
    let label = itemClass || 'Item';
    if (maxSockets === 0 && !/^Amulet/i.test(label)) label += ' (no sockets)';

    const canHaveQuality = itemClass ? /Bow|Crossbow|Sword|Mace|Wand|Sceptre|Quarterstaff|Focus|Armour|Helmet|Gloves|Boots|Shield|Flask/i.test(itemClass) : false;

    return {
      text: lines.join('\n'),
      sockets: socketCount,
      maxSockets,
      runeSlots,
      itemTypeLabel: label,
      isCorrupted: !!isCorrupted,
      canHaveQuality
    };
  }

  function getItemMetaAndText(node) {
    const copyBtn = node.querySelector('button.copy');
    if (copyBtn && copyBtn._v_clipboard && typeof copyBtn._v_clipboard.text === 'function') {
      try {
        const t = copyBtn._v_clipboard.text();
        if (typeof t === 'string' && t.trim()) {
          const meta = getItemTextFromDOM(node);
          if (meta && typeof meta === 'object') return { ...meta, text: t };
          return { text: t, sockets: 0, maxSockets: 0, runeSlots: '', itemTypeLabel: 'Item' };
        }
      } catch (e) { }
    }
    return getItemTextFromDOM(node);
  }

  function ensureContainers(node) {
    const parent = node.querySelector('.details') || node.querySelector('.right');
    if (!parent) return {};
    let pobWrap = parent.querySelector('.pob_wrapper');
    if (!pobWrap) {
      pobWrap = document.createElement('div');
      pobWrap.className = 'pob_wrapper';
      pobWrap.style.position = 'relative';
      parent.appendChild(pobWrap);

      const toggleWrap = document.createElement('div');
      toggleWrap.className = 'pob-override-toggle-wrap';
      toggleWrap.style.cssText = 'position: absolute; top: 6px; right: 6px; display: none; z-index: 10;';
      const btn = document.createElement('button');
      btn.className = 'pob-override-toggle';
      btn.style.cssText = 'background: rgba(0,0,0,0.85); border: 1px solid #c8b88a; color: #ebd592; padding: 2px 6px; font-size: 10px; cursor: pointer; border-radius: 2px; line-height: 14px; transition: opacity 0.2s;';

      toggleWrap.appendChild(btn);
      pobWrap.appendChild(toggleWrap);

      pobWrap.addEventListener('mouseenter', () => {
        const dataId = node.getAttribute('data-id');
        const isDisabled = disabledOverridesByItem.has(dataId);
        btn.textContent = isDisabled ? '🪄 OFF' : '🪄 ON';
        btn.title = isDisabled ? 'Enable custom PoB Injector overrides for this item' : 'Disable custom PoB Injector overrides for this item';
        btn.style.opacity = isDisabled ? '0.5' : '1';
        toggleWrap.style.display = 'block';
      });
      pobWrap.addEventListener('mouseleave', () => toggleWrap.style.display = 'none');

      btn.onclick = (ev) => {
        ev.stopPropagation();
        const dataId = node.getAttribute('data-id');
        if (!dataId) return;
        if (disabledOverridesByItem.has(dataId)) {
          disabledOverridesByItem.delete(dataId);
        } else {
          disabledOverridesByItem.add(dataId);
        }

        const isDisabled = disabledOverridesByItem.has(dataId);
        btn.textContent = isDisabled ? '🪄 OFF' : '🪄 ON';
        btn.title = isDisabled ? 'Enable custom PoB Injector overrides for this item' : 'Disable custom PoB Injector overrides for this item';
        btn.style.opacity = isDisabled ? '0.5' : '1';

        const previewEl = pobWrap.querySelector('.rune_preview');
        const impactEl = pobWrap.querySelector('.item_impact');
        if (previewEl) previewEl.style.opacity = '0.3';
        if (impactEl) impactEl.style.opacity = '0.3';

        const meta = getItemMetaAndText(node);
        window.top.postMessage({
          message: 'get_item_impact',
          item: meta.text,
          dataId,
          sockets: meta.sockets,
          maxSockets: meta.maxSockets,
          runeSlots: meta.runeSlots,
          itemTypeLabel: meta.itemTypeLabel,
          canHaveQuality: meta.canHaveQuality,
          isCorrupted: meta.isCorrupted,
          skipOverrides: disabledOverridesByItem.has(dataId)
        }, '*');
      };
    }
    let preview = pobWrap.querySelector('.rune_preview');
    if (!preview) {
      preview = document.createElement('div');
      preview.className = 'rune_preview';
      pobWrap.appendChild(preview);
    }
    let impact = pobWrap.querySelector('.item_impact');
    if (!impact) {
      impact = document.createElement('div');
      impact.className = 'item_impact';
      pobWrap.appendChild(impact);
    }
    if (preview.nextSibling !== impact) pobWrap.insertBefore(preview, impact);

    let importWrap = parent.querySelector('.pob_import_wrap');
    if (!importWrap) {
      importWrap = document.createElement('div');
      importWrap.className = 'pob_import_wrap';
      importWrap.style.margin = '10px 0 0 0';
      importWrap.style.textAlign = 'center';
      const btn = document.createElement('button');
      btn.className = 'btn btn-xs btn-default direct-btn';
      btn.style.cssText = 'color: rgb(233, 207, 159); background-color: rgb(34, 34, 34); border: 1px solid rgb(68, 68, 68);';
      btn.textContent = 'Add this item to your build as unused';
      btn.onclick = () => {
        const dataId = node.closest('.row[data-id]').getAttribute('data-id');
        const itemObj = itemByDataId[dataId];
        if (itemObj) {
          btn.dataset.originalText = btn.textContent;
          btn.textContent = 'Importing...';
          btn.disabled = true;

          const meta = getItemMetaAndText(node.closest('.row[data-id]'));
          window.top.postMessage({
            message: 'import_item_to_pob',
            dataId,
            item: itemObj.itemText,
            sockets: meta.sockets,
            maxSockets: meta.maxSockets,
            canHaveQuality: meta.canHaveQuality,
            isCorrupted: meta.isCorrupted
          }, '*');
        }
      };
      importWrap.appendChild(btn);

      if (pobWrap.nextSibling) {
        parent.insertBefore(importWrap, pobWrap.nextSibling);
      } else {
        parent.appendChild(importWrap);
      }
    }

    return { preview, impact };
  }

  function askItemImpact(node) {
    const dataId = node.getAttribute('data-id');
    const { preview, impact } = ensureContainers(node);
    const meta = getItemMetaAndText(node);
    const rarityMatch = meta?.text?.match(/^Rarity: (.+)$/m);
    const rarity = rarityMatch ? rarityMatch[1] : '';
    itemByDataId[dataId] = { node, impact, preview, itemText: meta?.text || '', rarity };

    if (impactCache[dataId]) {
      impact.innerHTML = impactCache[dataId];
      processStatLines(impact);
      if (previewCache[dataId] !== undefined) {
        const previewEl = itemByDataId[dataId]?.preview;
        if (previewEl) previewEl.innerHTML = previewCache[dataId];
      }
      return;
    }

    if (!enabled) return;

    if (!meta || !meta.text || typeof meta.text !== 'string' || !meta.text.trim() || meta.text.trim().toLowerCase() === 'null') {
      if (impact) impact.innerHTML = '<span style="color:#f55">No item text</span>';
      return;
    }
    window.top.postMessage({
      message: 'get_item_impact',
      item: meta.text,
      dataId,
      sockets: meta.sockets,
      maxSockets: meta.maxSockets,
      runeSlots: meta.runeSlots,
      itemTypeLabel: meta.itemTypeLabel,
      canHaveQuality: meta.canHaveQuality,
      isCorrupted: meta.isCorrupted,
      skipOverrides: disabledOverridesByItem.has(dataId)
    }, '*');
  }

  // --- Sort helpers ---
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  let sortArrowCached = '';
  function ensureSortStyles() {
    if (!sortArrowCached) {
      const sorted = document.querySelector('[data-field].sorted');
      if (sorted) {
        const after = getComputedStyle(sorted, '::after');
        if (after.backgroundImage && after.backgroundImage !== 'none') {
          sortArrowCached = \`background:transparent \${after.backgroundImage} \${after.backgroundPosition || '-134px -230px'} no-repeat\`;
        }
      }
      if (!sortArrowCached) {
        sortArrowCached = \`background:transparent url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 18 18'%3E%3Cpath d='M9 12l-5-5h10z' fill='%23aaa'/%3E%3C/svg%3E") 50% 50% no-repeat\`;
      }
    }
    const css = \`.pob-sortable-stat{min-height:17px!important;line-height:17px!important;box-sizing:border-box!important;white-space:normal!important;word-break:break-word!important}.pob-sortable-stat.sorted{background:rgba(255,255,255,0.11)!important}.pob-sortable-stat.sorted::after{content:' '!important;display:inline-block!important;width:18px!important;height:18px!important;vertical-align:middle!important;margin-left:4px!important;margin-top:-3px!important;\${sortArrowCached}!important;transform:scale(0.833)!important;transform-origin:center center!important} .pob-sortable-stat.sorted.sorted-asc::after{transform:scale(0.833) rotate(180deg)!important} .pob-inline-icon{display:inline-block!important;width:18px!important;height:18px!important;vertical-align:middle!important;margin-left:4px!important;margin-top:-5px!important;\${sortArrowCached}!important;transform:scale(0.833)!important;transform-origin:center center!important} .pob-inline-icon.sorted-asc{transform:scale(0.833) rotate(180deg)!important;margin-top:-5px!important}\`;
    if (document.getElementById('pob-sort-styles')) {
      document.getElementById('pob-sort-styles').textContent = css;
    } else {
      const style = document.createElement('style');
      style.id = 'pob-sort-styles';
      style.textContent = css;
      document.head.appendChild(style);
    }
  }

  function processStatLines(impactEl) {
    if (!impactEl) return;
    for (const div of impactEl.querySelectorAll('[data-stat]')) {
      div.classList.add('pob-sortable-stat');
      div.style.cursor = 'pointer';
      div.style.transition = 'background 0.12s';
      const statName = div.getAttribute('data-stat');
      div.title = \`Click to sort by \${statName}\`;
      div.addEventListener('mouseenter', () => { div.style.background = 'rgba(255,255,255,0.06)'; });
      div.addEventListener('mouseleave', () => { div.style.background = ''; });
      div.addEventListener('click', () => startSortBy(statName));
    }
  }

  function showSortStatus(msg, glow = false) {
    if (!sortStatusEl) {
      sortStatusEl = document.createElement('div');
      sortStatusEl.className = 'pob-body-panel';
      sortStatusEl.style.cssText = \`
        height: 32px; padding: 0 16px; 
        display: flex; flex-direction: row !important; align-items: center; justify-content: center; box-sizing: border-box;
        color: #c8b88a; 
        font-family: Verdana, Arial, Helvetica, sans-serif; font-size: 12px;
        flex: 1; pointer-events: auto; margin: 0; text-align: center;
        min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
      \`;
      const pobHead = document.getElementById('pob-head');
      if (pobHead) {
        pobHead.appendChild(sortStatusEl);
      } else {
        sortStatusEl.style.position = 'fixed';
        sortStatusEl.style.bottom = '64px';
        sortStatusEl.style.left = '64px';
        sortStatusEl.style.zIndex = '999999';
        document.body.appendChild(sortStatusEl);
      }
    }
    if (glow) {
      if (!sortStatusEl.classList.contains('pob-glow')) {
        sortStatusEl.classList.add('pob-glow');
      }
    } else {
      sortStatusEl.classList.remove('pob-glow');
    }
    sortStatusEl.innerHTML = msg;
    sortStatusEl.style.display = 'flex';
  }

  function hideSortStatus() {
    if (sortStatusEl) sortStatusEl.style.display = 'none';
  }

  function getStatValue(row, statName) {
    const el = row.querySelector(\`.item_impact [data-stat="\${statName.replace(/"/g, '\\"')}"]\`);
    if (!el) return -Infinity;
    return parseFloat(el.getAttribute('data-value')) || -Infinity;
  }

  function performSort(statName) {
    const container = document.querySelector('div.resultset');
    if (!container) return;
    const rows = [...container.querySelectorAll(':scope > div.row[data-id]')];
    rows.sort((a, b) => {
      const vA = getStatValue(a, statName);
      const vB = getStatValue(b, statName);
      return currentSortAsc ? vA - vB : vB - vA;
    });
    sortingNow = true;
    const frag = document.createDocumentFragment();
    for (const row of rows) frag.appendChild(row);
    container.appendChild(frag);
    if (resultObserver) resultObserver.takeRecords();
    sortingNow = false;
    ensureSortStyles();
    document.getElementById('pob-sorting-target-style')?.remove();
    document.querySelectorAll('.pob-sortable-stat.sorted, [data-field].sorted').forEach(el => {
      el.classList.remove('sorted', 'sorted-asc', 'sorted-desc');
      el.style.background = '';
    });
    document.querySelectorAll(\`.item_impact [data-stat="\${statName.replace(/"/g, '\\"')}"]\`).forEach(el => {
      el.classList.add('sorted', currentSortAsc ? 'sorted-asc' : 'sorted-desc');
    });
  }

  async function startSortBy(statName) {
    if (currentSortStat === statName) {
      currentSortAsc = !currentSortAsc;
    } else {
      currentSortStat = statName;
      currentSortAsc = false;
    }

    if (sortState && sortState.loading) {
      sortState.abort = true;
      await sleep(100);
    }
    const mySortState = { stat: statName, loading: true, abort: false };
    sortState = mySortState;

    let targetStyle = document.getElementById('pob-sorting-target-style');
    if (!targetStyle) {
      targetStyle = document.createElement('style');
      targetStyle.id = 'pob-sorting-target-style';
      document.head.appendChild(targetStyle);
    }
    targetStyle.textContent = \`
      .item_impact [data-stat="\${statName.replace(/"/g, '\\"')}"] { 
        background:rgba(200,184,138,0.15)!important; 
        animation:pobSortGlow 1.2s infinite ease-in-out!important; 
        border-radius:3px!important; 
        position: relative!important;
        padding-right: 65px!important;
      }
      .item_impact [data-stat="\${statName.replace(/"/g, '\\"')}"]::after {
        content: 'Loading...' !important;
        font-style: italic !important;
        font-size: 0.9em !important;
        opacity: 0.7 !important;
        position: absolute !important;
        right: 4px !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
      }
    \`;

    const container = document.querySelector('div.resultset');
    if (!container) { hideSortStatus(); sortState = null; return; }

    const _matchedMatch = document.querySelector('h3')?.textContent?.match(/\(([\d,]+)\s+matched\)/i);
    const totalMatched = _matchedMatch ? +_matchedMatch[1].replace(/,/g, '') : 0;
    const loadBtn = document.querySelector('button.btn.load-more-btn');
    if (loadBtn?.offsetParent) {
      showSortStatus(\`Loading items for \${statName}...\`, true);
      let pageCount = 0;
      while (true) {
        if (mySortState.abort) { if (sortState === mySortState) sortState = null; hideSortStatus(); return; }
        const loadMore = document.querySelector('button.btn.load-more-btn');
        if (!loadMore || !loadMore.offsetParent) break;
        const beforeCount = container.querySelectorAll(':scope > div.row[data-id]').length;
        if (totalMatched > 0 && beforeCount >= totalMatched) break;
        loadMore.click();
        pageCount++;
        showSortStatus(\`Loading items... (\${beforeCount} / \${totalMatched || '?'})\`, true);
        const waitStart = Date.now();
        while (Date.now() - waitStart < 5000) {
          if (mySortState.abort) { if (sortState === mySortState) sortState = null; hideSortStatus(); return; }
          await sleep(200);
          if (container.querySelectorAll(':scope > div.row[data-id]').length > beforeCount) { await sleep(1500); break; }
        }
      }
      if (mySortState.abort) { if (sortState === mySortState) sortState = null; hideSortStatus(); return; }
      await sleep(2000);
    }

    if (mySortState.abort) return;
    mySortState.loading = false;
    performSort(statName);
    const finalCount = container.querySelectorAll(':scope > div.row[data-id]').length;
    const arrowHtml = \`<span class="pob-inline-icon \${currentSortAsc ? 'sorted-asc' : ''}"></span>\`;
    showSortStatus(\`Sorted by \${statName} \${arrowHtml}\`, false);
    if (sortStatusEl) {
      if (totalMatched > 0 && finalCount < totalMatched) {
        sortStatusEl.title = \`\${totalMatched - finalCount} items were not loaded/sorted due to system limitations.\`;
      } else {
        sortStatusEl.title = \`All \${finalCount} items sorted successfully.\`;
      }
    }
  }

  // --- Observer (skip rows that already have impact content) ---
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches && node.matches('div.row[data-id]')) {
          if (!node.querySelector('.item_impact')?.innerHTML?.trim()) askItemImpact(node);
        }
        for (const card of node.querySelectorAll ? node.querySelectorAll('div.row[data-id]') : []) {
          if (!card.querySelector('.item_impact')?.innerHTML?.trim()) askItemImpact(card);
        }
      }
    }
  });

  function findOptionClose(html, start) {
    let p = start + '<div class="option">'.length, d = 1;
    while (p < html.length && d > 0) {
      const lt = html.indexOf('<', p);
      if (lt === -1) break;
      if (html.startsWith('</div>', lt)) { d--; if (d === 0) return lt + 6; p = lt + 6; }
      else if (html.startsWith('<div', lt)) { d++; p = (html.indexOf('>', lt + 4) + 1) || lt + 5; }
      else p = (html.indexOf('>', lt + 1) + 1) || (lt + 1);
    }
    return -1;
  }

  window.addEventListener('message', e => {
    if (e.data.message == 'show_update_notification') {
      showSortStatus('Update available! Click the update button in the extension panel', true);
      return;
    }
    if (e.data.message == 're_eval') {
      for (const k in impactCache) delete impactCache[k];
      for (const k in previewCache) delete previewCache[k];
      const rows = document.querySelectorAll('div.resultset div.row[data-id]');
      rows.forEach(r => {
        delete r.dataset.pobDone;
        delete r.dataset.pobEvaling;
        const wrap = r.querySelector('.pob_wrapper');
        if (wrap) wrap.classList.add('pob-re-evaluating');
        askItemImpact(r);
      });
      return;
    }
    if (e.data.message == 'set_item_impact') {
      impactCache[e.data.dataId] = e.data.itemImpact;
      const entry = itemByDataId[e.data.dataId];
      if (entry && entry.node) {
        const wrap = entry.node.querySelector('.pob_wrapper');
        if (wrap) wrap.classList.remove('pob-re-evaluating');
      }
      const impact = entry?.impact;
      if (impact) {
        impact.style.opacity = '1';
        let html = e.data.itemImpact;
        if (entry.rarity === 'Unique' && html.indexOf('<div class="option">') !== html.lastIndexOf('<div class="option">')) {
          const starts = [];
          for (let p = 0; (p = html.indexOf('<div class="option">', p)) !== -1; p += '<div class="option">'.length) starts.push(p);
          if (starts.length > 1) {
            const keep = starts.findIndex(s => {
              const end = findOptionClose(html, s);
              return end > 0 && html.slice(s, end).includes('color:#AF6025');
            });
            if (keep >= 0) {
              for (let i = starts.length - 1; i >= 0; i--) {
                if (i !== keep) {
                  const end = findOptionClose(html, starts[i]);
                  if (end > 0) html = html.slice(0, starts[i]) + html.slice(end);
                }
              }
            }
          }
        }
        const _optStarts = [];
        for (let _p = 0; (_p = html.indexOf('<div class="option">', _p)) !== -1; _p += '<div class="option">'.length) _optStarts.push(_p);
        if (_optStarts.length > 1) {
          const _opts = _optStarts.map(s => { const e = findOptionClose(html, s); return { h: html.slice(s, e), e }; });
          const _numRe = /(?:Socket|Flask)\s*#(\d+)/;
          _opts.sort((a, b) => { const ma = a.h.match(_numRe), mb = b.h.match(_numRe); return (ma ? +ma[1] : 0) - (mb ? +mb[1] : 0); });
          html = html.slice(0, _optStarts[0]) + _opts.map(o => o.h).join('') + html.slice(Math.max(..._opts.map(o => o.e)));
        }
        impact.innerHTML = html;
        processStatLines(impact);
      }
    } else if (e.data.message == 'set_rune_preview') {
      previewCache[e.data.dataId] = e.data.html || '';
      const preview = itemByDataId[e.data.dataId]?.preview;
      if (preview) {
        preview.innerHTML = e.data.html || '';
        preview.style.opacity = '1';
      }
    } else if (e.data.message == 'toggle') {
      enabled = e.data.enabled;
      if (enabled) {
        document.documentElement.classList.remove('pob-disabled');
        const rows = document.querySelectorAll('div.resultset div.row[data-id]');
        rows.forEach(r => {
          if (!r.querySelector('.item_impact')?.innerHTML?.trim()) askItemImpact(r);
        });
      } else {
        document.documentElement.classList.add('pob-disabled');
      }
    } else if (e.data.message == 'import_item_result') {
      const entry = itemByDataId[e.data.dataId];
      if (entry && entry.node) {
        const btn = entry.node.querySelector('.pob_import_wrap button');
        if (btn) {
          if (e.data.success) {
            btn.textContent = '✅ Item imported to your build';
            btn.style.color = '#7bc67b';
          } else {
            btn.textContent = '❌ Failed to import';
            btn.style.color = '#c67b7b';
            setTimeout(() => {
              btn.textContent = btn.dataset.originalText || 'Add this item to your build as unused';
              btn.style.color = 'rgb(233, 207, 159)';
              btn.disabled = false;
            }, 3000);
          }
        }
      }
    }
  }, false);

  observer.observe(document.body, { attributes: false, childList: true, subtree: true });

  // Watch for resultset container to appear (Vue rendering)
  let resultObserver = null;
  let currentRc = null;
  const rcObserver = new MutationObserver(() => {
    const rc = document.querySelector('div.resultset');
    if (rc && rc !== currentRc) {
      if (currentRc) {
        sortState = null;
        currentSortStat = null;
        currentSortAsc = false;
        hideSortStatus();
        itemByDataId = {};
      }
      if (resultObserver) resultObserver.disconnect();
      currentRc = rc;
      resultObserver = new MutationObserver((mutations) => {
        if (sortingNow) return;
        let rowsRemoved = false;
        for (const m of mutations) {
          for (const node of m.removedNodes) {
            if (node instanceof HTMLElement) {
              const rows = node.matches?.('div.row[data-id]') ? [node] : Array.from(node.querySelectorAll?.('div.row[data-id]') || []);
              if (rows.length > 0) {
                for (const r of rows) {
                  const dataId = r.getAttribute('data-id');
                  if (dataId) delete itemByDataId[dataId];
                }
                rowsRemoved = true;
              }
            }
          }
        }
        if (rowsRemoved) {
          sortState = null;
          currentSortStat = null;
          currentSortAsc = false;
          hideSortStatus();
        }
      });
      resultObserver.observe(rc, { childList: true, subtree: true });
    }
  });
  rcObserver.observe(document.body, { childList: true, subtree: true });
})();
`;
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

      setInterval(async () => {
        if (serverOnline) {
          const hasUpdate = await API.checkUpdate();
          if (hasUpdate && updateBtn.style.display === 'none') {
            updateBtn.style.display = 'block';
            window.top.postMessage({ message: 'show_update_notification' }, '*');
          }
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
            const hasUpdate = await API.checkUpdate();
            if (hasUpdate) {
              updateBtn.style.display = 'block';
              window.top.postMessage({ message: 'show_update_notification' }, '*');
            }
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
      typeLbl.className = 'pob-type';
      typeLbl.style.marginBottom = '8px';
      typeLbl.textContent = '\u2014';

      const buildSelect = document.createElement('select');
      buildSelect.title = 'Select active build';

      let isDropdownOpen = false;
      let isReloadingBuild = false;
      const reloadActiveBuild = async () => {
        if (isReloadingBuild) return;
        if (buildSelect.value === cfg.activeBuild) {
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
            enchDatalist.append(o);
          }
        } catch (e) { }
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
      const manifest = ({ version: '0.6.12' });
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
          if (t) t.textContent = 'Current item type: ' + typeLabel;

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
