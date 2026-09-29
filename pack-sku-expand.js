/**
 * Multi-pack expand + manual SKU mapping — skips non-product lines
 */
(function () {
  'use strict';
  var DB = 'https://kiyomi-b19d0-default-rtdb.asia-southeast1.firebasedatabase.app';
  var MAP_KEY = 'sf_sku_map_v1';
  var skusCache = {};

  function wsKey() { return sessionStorage.getItem('sf_session_ws') || ''; }
  function roomId() { return localStorage.getItem('sf_room_' + wsKey()) || 'WH_A'; }

  function toast(msg) {
    var w = document.getElementById('toast-wrap');
    if (!w) return;
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    w.innerHTML = '';
    w.appendChild(t);
    setTimeout(function () { t.remove(); }, 2800);
  }

  function getSkus() {
    return new Promise(function (resolve) {
      var ws = wsKey();
      if (!ws) { resolve(skusCache || {}); return; }
      fetch(DB + '/ws_' + ws + '/rooms/' + roomId() + '/skus.json', { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (d) { skusCache = d || {}; resolve(skusCache); })
        .catch(function () { resolve(skusCache || {}); });
    });
  }

  function loadMap() {
    try { return JSON.parse(localStorage.getItem(MAP_KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveMap(m) {
    try { localStorage.setItem(MAP_KEY, JSON.stringify(m)); } catch (e) {}
  }
  function setMapping(rawKey, skuId) {
    var m = loadMap();
    var k = normKey(rawKey);
    if (!k || !skuId) return;
    m[k] = skuId;
    var k2 = k.replace(/[^A-Z0-9]/g, '');
    if (k2) m[k2] = skuId;
    saveMap(m);
  }

  function norm(s) {
    return String(s || '').trim().toUpperCase().replace(/\s+/g, '');
  }
  function normKey(s) {
    return norm(s).replace(/^-+/, '');
  }

  function isNonProductLine(name, sku) {
    var t = String((name || '') + ' ' + (sku || '')).toLowerCase();
    t = t.replace(/\s+/g, ' ').trim();
    if (!t) return true;
    if (t.indexOf('\u0e44\u0e21\u0e48\u0e43\u0e0a\u0e48\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32') >= 0) return true;
    if (t.indexOf('\u0e04\u0e33\u0e2a\u0e31\u0e48\u0e07\u0e0b\u0e37\u0e49\u0e2d\u0e01\u0e32\u0e23\u0e15\u0e25\u0e32\u0e14') >= 0) return true;
    if (t.indexOf('\u0e1b\u0e23\u0e30\u0e01\u0e32\u0e28\u0e2a\u0e33\u0e04\u0e31\u0e0d') >= 0) return true;
    if (t.indexOf('\u0e2d\u0e31\u0e1e\u0e40\u0e14\u0e17 deadline') >= 0 || t.indexOf('\u0e2d\u0e31\u0e1b\u0e40\u0e14\u0e15 deadline') >= 0 || t.indexOf('update deadline') >= 0) return true;
    if (/\bdeadline\b/.test(t) && (t.indexOf('\u0e2d\u0e31\u0e1e\u0e40\u0e14\u0e17') >= 0 || t.indexOf('\u0e2d\u0e31\u0e1b\u0e40\u0e14\u0e15') >= 0 || t.indexOf('update') >= 0 || t.indexOf('\u0e1b\u0e23\u0e30\u0e01\u0e32\u0e28') >= 0)) return true;
    if (t === '\u0e04\u0e33\u0e2a\u0e31\u0e48\u0e07\u0e0b\u0e37\u0e49\u0e2d' || t === '\u0e1b\u0e23\u0e30\u0e01\u0e32\u0e28' || t === '\u0e1b\u0e23\u0e30\u0e01\u0e32\u0e28\u0e2a\u0e33\u0e04\u0e31\u0e0d') return true;
    if (t.indexOf('\u0e42\u0e1b\u0e23\u0e14\u0e2d\u0e48\u0e32\u0e19') >= 0 || t.indexOf('\u0e42\u0e1b\u0e23\u0e14\u0e17\u0e23\u0e32\u0e1a') >= 0) return true;
    if (t.indexOf('important notice') >= 0 || t.indexOf('announcement') >= 0) return true;
    if (t.indexOf('\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21\u0e23\u0e30\u0e1a\u0e1a') >= 0 || t.indexOf('system message') >= 0) return true;
    if (t.indexOf('\u0e04\u0e48\u0e32\u0e08\u0e31\u0e14\u0e2a\u0e48\u0e07') >= 0 || t.indexOf('\u0e04\u0e48\u0e32\u0e2a\u0e48\u0e07') === 0) return true;
    if (t.indexOf('shipping fee') >= 0 || t.indexOf('service fee') >= 0) return true;
    if (t.indexOf('\u0e04\u0e48\u0e32\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23') >= 0 || t.indexOf('\u0e04\u0e48\u0e32\u0e18\u0e23\u0e23\u0e21\u0e40\u0e19\u0e35\u0e22\u0e21') >= 0) return true;
    if (/^[\-\_\.\*\s]+$/.test(t)) return true;
    if (/^(n\/a|null|undefined|none|-)$/i.test(t)) return true;
    return false;
  }

  function parseMulti(raw) {
    var su = norm(raw);
    if (!su) return { mul: 1, base: '', unit: 'PACK', tries: [] };
    var m, mul = 1, base = su, unit = 'PACK';
    m = su.match(/^(.+?)[-_]?(\d+)[-_]?(PACK|BOX|PCS|PIECE|UNIT)S?$/i);
    if (m && m[1] && parseInt(m[2], 10) >= 1) {
      base = m[1].replace(/[-_]+$/, '');
      mul = parseInt(m[2], 10) || 1;
      unit = m[3].toUpperCase();
    } else {
      m = su.match(/^([A-Z]+?)(\d+)(PACK|BOX|PCS|PIECE|UNIT)S?$/i);
      if (m) {
        base = m[1];
        mul = parseInt(m[2], 10) || 1;
        unit = m[3].toUpperCase();
      }
    }
    var tries = [];
    function add(x) {
      x = norm(x);
      if (x && tries.indexOf(x) < 0) tries.push(x);
    }
    add(base + '1' + unit);
    add(base + '-1' + unit);
    add(base + '_1' + unit);
    add(base + '1PACK');
    add(base + '-1PACK');
    add(base + '-PACK');
    add(base + 'PACK');
    add(base);
    add(su);
    add(base + mul + unit);
    add(base + '-' + mul + unit);
    return { mul: mul, base: base, unit: unit, tries: tries };
  }

  function findByManualMap(raw, skus) {
    var map = loadMap();
    var keys = [normKey(raw), normKey(raw).replace(/[^A-Z0-9]/g, '')];
    for (var i = 0; i < keys.length; i++) {
      var id = map[keys[i]];
      if (id && skus[id]) return { id: id, s: skus[id] };
    }
    return null;
  }

  function findProduct(tries, skus) {
    var keys = Object.keys(skus || {});
    var t, i, id, s, cands, c;
    for (t = 0; t < tries.length; t++) {
      var su = tries[t];
      if (!su) continue;
      if (skus[su]) return { id: su, s: skus[su] };
      for (i = 0; i < keys.length; i++) {
        id = keys[i];
        s = skus[id] || {};
        cands = [s.unitSku, s.sku, s.barcode, id, s.name].map(norm);
        if (cands.indexOf(su) >= 0) return { id: id, s: s };
        for (c = 0; c < cands.length; c++) {
          if (!cands[c] || cands[c].length < 2) continue;
          if (c < 4 && (cands[c] === su || cands[c].indexOf(su) === 0 || su.indexOf(cands[c]) === 0 ||
              cands[c].indexOf(su + '-') === 0 || su.indexOf(cands[c] + '-') === 0)) {
            return { id: id, s: s };
          }
        }
      }
    }
    return null;
  }

  function expandLine(line, skus) {
    if (!line) return line;
    var src = line.unitSku || line.skuId || line.name || '';
    var bar = line.barcode || '';
    var parsed = parseMulti(src);
    var barParsed = bar ? parseMulti(bar) : null;
    var hit = findByManualMap(src, skus) || (bar ? findByManualMap(bar, skus) : null);
    if (!hit) {
      var tries = parsed.tries.slice();
      if (barParsed) barParsed.tries.forEach(function (x) { if (tries.indexOf(x) < 0) tries.push(x); });
      if (bar) {
        var bn = norm(bar);
        if (tries.indexOf(bn) < 0) tries.push(bn);
      }
      hit = findProduct(tries, skus);
    }
    var mul = parsed.mul > 1 ? parsed.mul : 1;
    if (mul === 1 && barParsed && barParsed.mul > 1) mul = barParsed.mul;
    if (!hit) {
      return {
        skuId: line.skuId || src || 'UNKNOWN',
        name: line.name || src || '\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e43\u0e19\u0e04\u0e25\u0e31\u0e07',
        qty: (parseInt(line.qty, 10) || 1) * mul,
        unitSku: src, barcode: bar, matched: false, rawSku: src, needMap: true, mul: mul
      };
    }
    return {
      skuId: hit.id, name: hit.s.name || hit.id,
      qty: (parseInt(line.qty, 10) || 1) * mul,
      unitSku: hit.s.unitSku || parsed.tries[0] || src,
      barcode: hit.s.barcode || bar || '', matched: true, needMap: false, mul: mul, rawSku: src
    };
  }

  function expandOrder(order, skus) {
    if (!order || !order.lines) return order;
    var lines = order.lines
      .filter(function (l) {
        if (!l) return false;
        return !isNonProductLine(l.name || '', l.unitSku || l.skuId || l.rawSku || '');
      })
      .map(function (l) { return expandLine(l, skus); });
    var merged = [];
    lines.forEach(function (l) {
      if (l.matched) {
        var e = merged.find(function (x) { return x.matched && x.skuId === l.skuId; });
        if (e) { e.qty += l.qty; return; }
      }
      merged.push(Object.assign({}, l));
    });
    order.lines = merged;
    order._unmatched = merged.filter(function (l) { return l.matched !== true; });
    return order;
  }

  function skuOptionsHtml(skus) {
    var ents = Object.keys(skus || {}).map(function (id) {
      var s = skus[id] || {};
      return { id: id, label: (s.name || id) + (s.unitSku ? ' \u00b7 ' + s.unitSku : '') + (s.barcode ? ' \u00b7 BC ' + s.barcode : '') };
    }).sort(function (a, b) { return a.label.localeCompare(b.label, 'th'); });
    var html = '<option value="">\u2014 \u0e40\u0e25\u0e37\u0e2d\u0e01\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e43\u0e19\u0e04\u0e25\u0e31\u0e07 \u2014</option>';
    ents.forEach(function (e) {
      html += '<option value="' + e.id.replace(/"/g, '') + '">' + e.label.replace(/</g, '') + '</option>';
    });
    return html;
  }

  function ensureMapUi() {
    if (document.getElementById('pack-map-ov')) return;
    var ov = document.createElement('div');
    ov.id = 'pack-map-ov';
    ov.style.cssText = 'display:none;position:fixed;inset:0;z-index:600;background:rgba(12,14,18,.55);align-items:flex-end;justify-content:center;padding:0;';
    ov.innerHTML =
      '<div id="pack-map-sheet" style="background:var(--paper,#fff);width:100%;max-width:520px;max-height:85vh;overflow:auto;border-radius:18px 18px 0 0;padding:16px 16px 28px;margin:0 auto;box-shadow:0 -8px 40px rgba(0,0,0,.2)">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">' +
      '<div style="font-size:17px;font-weight:800">\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e17\u0e35\u0e48\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e43\u0e19\u0e04\u0e25\u0e31\u0e07</div>' +
      '<button type="button" id="pack-map-close" style="border:none;background:var(--bg,#f3f1eb);width:36px;height:36px;border-radius:10px;font-size:18px;cursor:pointer">\u00d7</button></div>' +
      '<div style="font-size:12px;color:var(--ink3);margin-bottom:12px">\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e43\u0e19 StockFlow (\u0e02\u0e49\u0e32\u0e21\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e17\u0e35\u0e48\u0e44\u0e21\u0e48\u0e43\u0e0a\u0e48\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e41\u0e25\u0e49\u0e27)</div>' +
      '<div id="pack-map-list"></div>' +
      '<button type="button" id="pack-map-apply" style="width:100%;margin-top:14px;padding:14px;border-radius:14px;background:var(--ink,#0C0E12);color:#fff;font-size:15px;font-weight:700;border:none;cursor:pointer">\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e01\u0e32\u0e23\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48</button></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) hideMapUi(); });
    document.getElementById('pack-map-close').addEventListener('click', hideMapUi);
    document.getElementById('pack-map-apply').addEventListener('click', applyMapUi);
  }

  var pendingOrder = null;
  var pendingCallback = null;
  function hideMapUi() {
    var ov = document.getElementById('pack-map-ov');
    if (ov) ov.style.display = 'none';
  }

  function showUnmatchedMapper(order, skus, cb) {
    ensureMapUi();
    pendingOrder = order;
    pendingCallback = cb || null;
    var list = document.getElementById('pack-map-list');
    var unmatched = (order.lines || []).filter(function (l) {
      if (!l || l.matched === true) return false;
      return !isNonProductLine(l.name || '', l.rawSku || l.unitSku || l.skuId || '');
    });
    if (!unmatched.length) { hideMapUi(); if (cb) cb(order); return; }
    var seen = {}, items = [];
    unmatched.forEach(function (l) {
      var k = normKey(l.rawSku || l.unitSku || l.skuId);
      if (seen[k]) return;
      seen[k] = 1;
      items.push(l);
    });
    list.innerHTML = items.map(function (l) {
      var raw = l.rawSku || l.unitSku || l.skuId || '';
      return '<div style="padding:12px;margin-bottom:10px;border:1px solid var(--line);border-radius:14px;background:var(--bg,#faf8f4)">' +
        '<div style="font-size:14px;font-weight:700;margin-bottom:8px;word-break:break-all">' + String(raw).replace(/</g, '') + '</div>' +
        '<select class="pack-map-sel" data-raw="' + String(raw).replace(/"/g, '') + '" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--line2);font-size:13px;background:#fff">' +
        skuOptionsHtml(skus) + '</select></div>';
    }).join('');
    document.getElementById('pack-map-ov').style.display = 'flex';
  }

  function applyMapUi() {
    if (!pendingOrder) { hideMapUi(); return; }
    var sels = document.querySelectorAll('#pack-map-list .pack-map-sel');
    var mapped = 0;
    sels.forEach(function (sel) {
      var raw = sel.getAttribute('data-raw') || '';
      var id = sel.value;
      if (raw && id) { setMapping(raw, id); mapped++; }
    });
    getSkus().then(function (skus) {
      expandOrder(pendingOrder, skus);
      try {
        var store = JSON.parse(localStorage.getItem('sf_bs_orders_v1') || '{}');
        Object.keys(store).forEach(function (k) {
          var o = store[k];
          if (!o) return;
          if (pendingOrder.id === '_ALL_UNMATCHED_') expandOrder(o, skus);
          else if (o.id === pendingOrder.id || o.track === pendingOrder.track || o.packageId === pendingOrder.packageId) store[k] = pendingOrder;
        });
        localStorage.setItem('sf_bs_orders_v1', JSON.stringify(store));
      } catch (e) {}
      hideMapUi();
      if (mapped) toast('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48 ' + mapped + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23');
      var cb = pendingCallback; pendingCallback = null;
      if (cb) cb(pendingOrder);
      if (typeof window.__packLoadLines === 'function' && pendingOrder && pendingOrder.id !== '_ALL_UNMATCHED_') {
        try { window.__packLoadLines(pendingOrder); } catch (eL) {}
      }
    });
  }

  function expandOrderSilent(order) {
    return getSkus().then(function (skus) {
      expandOrder(order, skus);
      return order;
    });
  }
  window.__packExpandOrderSilent = expandOrderSilent;
  window.__packExpandLinesOnly = function (order) {
    getSkus().then(function (skus) { expandOrder(order, skus); });
  };

  window.__packShowSkuMapper = function (order) {
    return getSkus().then(function (skus) {
      expandOrder(order, skus);
      var um = (order.lines || []).filter(function (l) {
        return l && l.matched !== true && !isNonProductLine(l.name || '', l.rawSku || l.unitSku || l.skuId || '');
      });
      if (!um.length) return order;
      return new Promise(function (resolve) {
        showUnmatchedMapper(order, skus, function (ord) { resolve(ord || order); });
      });
    });
  };

  window.__packExpandOrder = function (order) {
    return window.__packShowSkuMapper(order).then(function (o) { return o || order; });
  };

  function processOrder(order) {
    return expandOrderSilent(order);
  }

  function ensureMapAllBtn(um) {
    var page = document.getElementById('page-pack');
    if (!page) return;
    var btn = document.getElementById('pack-map-all-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'pack-map-all-btn';
      btn.type = 'button';
      btn.style.cssText = 'width:100%;margin:8px 0 12px;padding:12px 14px;border-radius:12px;border:2px solid #f59e0b;background:#fef3c7;color:#92400e;font-weight:800;font-size:14px;cursor:pointer';
      var anchor = document.getElementById('pack-csv-status') || document.getElementById('pack-csv-panel') || document.getElementById('pack-queue-panel');
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(btn, anchor.nextSibling || anchor);
      else page.insertBefore(btn, page.firstChild);
      btn.addEventListener('click', function () {
        if (typeof window.__packMapAllUnmatched === 'function') window.__packMapAllUnmatched();
      });
    }
    btn.style.display = um > 0 ? 'block' : 'none';
    btn.textContent = '\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48 SKU \u0e17\u0e35\u0e48\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48 (' + um + ') \u2014 \u0e01\u0e14\u0e17\u0e35\u0e48\u0e19\u0e35\u0e48';
  }

  function collectAllUnmatchedOrder() {
    var store = {};
    try { store = JSON.parse(localStorage.getItem('sf_bs_orders_v1') || '{}'); } catch (e) {}
    var seen = {}, lines = [];
    Object.keys(store).forEach(function (k) {
      var o = store[k];
      if (!o || !o.lines) return;
      o.lines.forEach(function (l) {
        if (!l || l.matched === true) return;
        if (isNonProductLine(l.name || '', l.rawSku || l.unitSku || l.skuId || '')) return;
        var raw = normKey(l.rawSku || l.unitSku || l.skuId || l.name || '');
        if (!raw || seen[raw]) return;
        seen[raw] = 1;
        lines.push(Object.assign({}, l, { matched: false, needMap: true, rawSku: raw }));
      });
    });
    return { id: '_ALL_UNMATCHED_', track: '', packageId: '', lines: lines };
  }

  window.__packMapAllUnmatched = function () {
    getSkus().then(function (skus) {
      var ord = collectAllUnmatchedOrder();
      if (!ord.lines.length) { toast('\u0e44\u0e21\u0e48\u0e21\u0e35\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48'); ensureMapAllBtn(0); return; }
      showUnmatchedMapper(ord, skus, function () {
        try {
          var store = JSON.parse(localStorage.getItem('sf_bs_orders_v1') || '{}');
          Object.keys(store).forEach(function (k) { if (store[k] && store[k].lines) expandOrder(store[k], skus); });
          localStorage.setItem('sf_bs_orders_v1', JSON.stringify(store));
        } catch (e) {}
        ensureMapAllBtn(0);
        toast('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e01\u0e32\u0e23\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48\u0e41\u0e25\u0e49\u0e27');
        if (typeof window.__packQueueRefresh === 'function') window.__packQueueRefresh();
      });
    });
  };

  function patch() {
    if (typeof window.__bsSaveOrders !== 'function') return false;
    if (window.__bsSaveOrders._mapExp) return true;

    var origSave = window.__bsSaveOrders;
    window.__bsSaveOrders = function (orders) {
      getSkus().then(function (skus) {
        (orders || []).forEach(function (o) { expandOrder(o, skus); });
        origSave(orders);
        var um = 0;
        (orders || []).forEach(function (o) {
          (o.lines || []).forEach(function (l) {
            if (l && l.matched !== true && !isNonProductLine(l.name || '', l.rawSku || l.unitSku || l.skuId || '')) um++;
          });
        });
        if (um) {
          var statusEl = document.getElementById('pack-csv-status');
          if (statusEl) {
            statusEl.style.color = 'var(--bad, #b91c1c)';
            statusEl.style.cursor = 'pointer';
            statusEl.style.textDecoration = 'underline';
            statusEl.textContent = '\u0e21\u0e35 ' + um + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48 \u2014 \u0e01\u0e14\u0e17\u0e35\u0e48\u0e19\u0e35\u0e48';
            statusEl.onclick = function () { window.__packMapAllUnmatched(); };
          }
          ensureMapAllBtn(um);
        } else {
          ensureMapAllBtn(0);
        }
      });
      return (orders || []).length;
    };
    window.__bsSaveOrders._mapExp = true;

    window.__packExpandOrder = processOrder;
    return true;
  }

  var n = 0;
  var iv = setInterval(function () {
    if (patch() || ++n > 80) clearInterval(iv);
  }, 200);
  setTimeout(function () { getSkus(); }, 1500);
  setInterval(function () {
    var page = document.getElementById('page-pack');
    if (!page || !page.classList.contains('active')) return;
    try {
      var store = JSON.parse(localStorage.getItem('sf_bs_orders_v1') || '{}');
      var um = 0, seen = {};
      Object.keys(store).forEach(function (k) {
        (store[k] && store[k].lines || []).forEach(function (l) {
          if (!l || l.matched === true) return;
          if (isNonProductLine(l.name || '', l.rawSku || l.unitSku || l.skuId || '')) return;
          var raw = normKey(l.rawSku || l.unitSku || l.skuId || '');
          if (!raw || seen[raw]) return;
          seen[raw] = 1; um++;
        });
      });
      ensureMapAllBtn(um);
    } catch (e) {}
  }, 3000);
})();
