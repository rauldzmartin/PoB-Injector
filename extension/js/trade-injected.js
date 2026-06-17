(() => {
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
    return val ? `${label} ${val}${aug}` : label;
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
      return vt ? `${lt}: ${vt}${aug ? ' (augmented)' : ''}` : lt;
    }

    const q = propText(content ? content.querySelector('[data-field="quality"]') : null);
    const pd = propText(content ? content.querySelector('[data-field="pdamage"]') : null);
    const chc = propText(content ? content.querySelector('[data-field="crit"]') : null);
    const aps = propText(content ? content.querySelector('[data-field="aps"]') : null);
    const rlt = propText(content ? content.querySelector('[data-field="reload_time"]') : null);

    const ilvlEl = content ? content.querySelector('[data-field="ilvl"]') : null;
    const ilvl = ilvlEl ? textContent(ilvlEl).replace(/^Item Level:\s*/i, '').trim() : '';
    const ilvlLine = ilvl ? `Item Level: ${ilvl}` : null;

    const reqEl = content ? content.querySelector('.item-popup__property--requirements .lc') : null;
    let req = reqEl ? textContent(reqEl).trim() : null;
    if (req) req = req.replace(/^Requires:\s*/i, '');

    const socketCount = node.querySelectorAll('.left .socket, .left .sockets .socket').length;
    const sockets = socketCount ? `Sockets: ${Array(socketCount).fill('S').join(' ')}` : null;

    const noteEl = content ? content.querySelector('[style*="currency"]') : null;
    const noteLine = noteEl ? textContent(noteEl).trim() : null;

    if (itemClass) lines.push(`Item Class: ${itemClass}`);
    lines.push(`Rarity: ${rarity}`);
    if (name) lines.push(name);
    if (typeLine) lines.push(typeLine);

    if (q || pd || chc || aps || rlt) {
      lines.push(sep);
      [q, pd, chc, aps, rlt].forEach(v => v && lines.push(v));
    }

    if (req || sockets || ilvlLine) {
      lines.push(sep);
      if (req) lines.push(`Requires: ${req}`);
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
          explicitGroup.push(`${text} (fractured)`);
        } else if (modEl.classList.contains('item-mod--crafted')) {
          explicitGroup.push(`${text} (crafted)`);
        } else if (modEl.classList.contains('item-mod--rune')) {
          explicitGroup.push(`${text} (rune)`);
        } else if (modEl.classList.contains('item-mod--desecrated')) {
          explicitGroup.push(`${text} (desecrated)`);
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
          sortArrowCached = `background:transparent ${after.backgroundImage} ${after.backgroundPosition || '-134px -230px'} no-repeat`;
        }
      }
      if (!sortArrowCached) {
        sortArrowCached = `background:transparent url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 18 18'%3E%3Cpath d='M9 12l-5-5h10z' fill='%23aaa'/%3E%3C/svg%3E") 50% 50% no-repeat`;
      }
    }
    const css = `.pob-sortable-stat{min-height:17px!important;line-height:17px!important;box-sizing:border-box!important;white-space:normal!important;word-break:break-word!important}.pob-sortable-stat.sorted{background:rgba(255,255,255,0.11)!important}.pob-sortable-stat.sorted::after{content:' '!important;display:inline-block!important;width:18px!important;height:18px!important;vertical-align:middle!important;margin-left:4px!important;margin-top:-3px!important;${sortArrowCached}!important;transform:scale(0.833)!important;transform-origin:center center!important} .pob-sortable-stat.sorted.sorted-asc::after{transform:scale(0.833) rotate(180deg)!important} .pob-inline-icon{display:inline-block!important;width:18px!important;height:18px!important;vertical-align:middle!important;margin-left:4px!important;margin-top:-5px!important;${sortArrowCached}!important;transform:scale(0.833)!important;transform-origin:center center!important} .pob-inline-icon.sorted-asc{transform:scale(0.833) rotate(180deg)!important;margin-top:-5px!important}`;
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
      div.title = `Click to sort by ${statName}`;
      div.addEventListener('mouseenter', () => { div.style.background = 'rgba(255,255,255,0.06)'; });
      div.addEventListener('mouseleave', () => { div.style.background = ''; });
      div.addEventListener('click', () => startSortBy(statName));
    }
  }

  function showSortStatus(msg, glow = false) {
    if (!sortStatusEl) {
      sortStatusEl = document.createElement('div');
      sortStatusEl.className = 'pob-body-panel';
      sortStatusEl.style.cssText = `
        height: 32px; padding: 0 16px; 
        display: flex; flex-direction: row !important; align-items: center; justify-content: center; box-sizing: border-box;
        color: #c8b88a; 
        font-family: Verdana, Arial, Helvetica, sans-serif; font-size: 12px;
        flex: 1; pointer-events: auto; margin: 0; text-align: center;
        min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
      `;
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
    const el = row.querySelector(`.item_impact [data-stat="${statName.replace(/"/g, '\\"')}"]`);
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
    document.querySelectorAll(`.item_impact [data-stat="${statName.replace(/"/g, '\\"')}"]`).forEach(el => {
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
    targetStyle.textContent = `
      .item_impact [data-stat="${statName.replace(/"/g, '\\"')}"] { 
        background:rgba(200,184,138,0.15)!important; 
        animation:pobSortGlow 1.2s infinite ease-in-out!important; 
        border-radius:3px!important; 
        position: relative!important;
        padding-right: 65px!important;
      }
      .item_impact [data-stat="${statName.replace(/"/g, '\\"')}"]::after {
        content: 'Loading...' !important;
        font-style: italic !important;
        font-size: 0.9em !important;
        opacity: 0.7 !important;
        position: absolute !important;
        right: 4px !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
      }
    `;

    const container = document.querySelector('div.resultset');
    if (!container) { hideSortStatus(); sortState = null; return; }

    const _matchedMatch = document.querySelector('h3')?.textContent?.match(/\(([\d,]+)\s+matched\)/i);
    const totalMatched = _matchedMatch ? +_matchedMatch[1].replace(/,/g, '') : 0;
    const loadBtn = document.querySelector('button.btn.load-more-btn');
    if (loadBtn?.offsetParent) {
      showSortStatus(`Loading items for ${statName}...`, true);
      let pageCount = 0;
      while (true) {
        if (mySortState.abort) { if (sortState === mySortState) sortState = null; hideSortStatus(); return; }
        const loadMore = document.querySelector('button.btn.load-more-btn');
        if (!loadMore || !loadMore.offsetParent) break;
        const beforeCount = container.querySelectorAll(':scope > div.row[data-id]').length;
        if (totalMatched > 0 && beforeCount >= totalMatched) break;
        loadMore.click();
        pageCount++;
        showSortStatus(`Loading items... (${beforeCount} / ${totalMatched || '?'})`, true);
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
    const arrowHtml = `<span class="pob-inline-icon ${currentSortAsc ? 'sorted-asc' : ''}"></span>`;
    showSortStatus(`Sorted by ${statName} ${arrowHtml}`, false);
    if (sortStatusEl) {
      if (totalMatched > 0 && finalCount < totalMatched) {
        sortStatusEl.title = `${totalMatched - finalCount} items were not loaded/sorted due to system limitations.`;
      } else {
        sortStatusEl.title = `All ${finalCount} items sorted successfully.`;
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
