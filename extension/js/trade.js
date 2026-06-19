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
    activeItemTypeLabel: '',
    useDevBranch: false
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
      script.src = chrome.runtime.getURL('js/trade-injected.js');
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

    const iconUrl = chrome.runtime.getURL('img/icon.png');
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
    updateBtn.style.cssText = 'display:none; margin-left: 8px; border-color: #4caf50; color: #81c784; font-weight: bold; padding: 4px 12px;';
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
            chrome.runtime.sendMessage({action: 'reload_extension'});
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
      try {
        currentRuneList = await ensureRunesFor(cfg.lastSlotsCsv || '');
        runeDatalist.innerHTML = '';
        for (const m of currentRuneList) { const o = document.createElement('option'); o.value = m; runeDatalist.append(o); }
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
    
    const settingsInner = document.createElement('div');
    settingsInner.style.cssText = 'display:flex; flex-direction:column; gap:6px; margin-top:4px; margin-left:6px; margin-bottom: 12px;';
    settingsInner.append(devOptIn.row);
    
    const settingsBlock = makeSection('Updates', null, settingsInner);
    settingsBlock.id = 'pob-settings-block';
    settingsContent.append(settingsBlock);
    
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
        cfg.lastSlotsCsv = runeslots;

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

        try {
          currentRuneList = await ensureRunesFor(runeslots);
          const dl = document.getElementById('pob-runes-list');
          if (dl) {
            dl.innerHTML = '';
            for (const m of currentRuneList) {
              const o = document.createElement('option'); o.value = m; o.textContent = m;
              dl.append(o);
            }
          }
        } catch {
          currentRuneList = [];
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