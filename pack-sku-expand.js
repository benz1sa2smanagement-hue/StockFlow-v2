/**
 * Multi-pack expand + manual SKU mapping
 * - PULL3PACK in BigSeller = PULL1PACK in StockFlow × 3 (scan 3 times)
 * - Unmatched SKU/barcode → pick product from warehouse once, remember mapping
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
          if (c < 4 && (cands[c] === su ||
              cands[c].indexOf(su) === 0 ||
              su.indexOf(cands[c]) === 0 ||
              cands[c].indexOf(su + '-') === 0 ||
              su.indexOf(cands[c] + '-') === 0)) {
            return { id: id, s: s };
          }
        }
      }
    }

    for (t = 0; t < tries.length; t++) {
      var base = tries[t].replace(/\d+(PACK|BOX|PCS|PIECE|UNIT)S?$/i, '').replace(/[-_]/g, '');
      if (!base || base.length < 2) continue;
      for (i = 0; i < keys.length; i++) {
        id = keys[i];
        s = skus[id] || {};
        var us = norm(s.unitSku || s.sku || id).replace(/\d+(PACK|BOX|PCS|PIECE|UNIT)S?$/i, '').replace(/[-_]/g, '');
        if (us && us === base) return { id: id, s: s };
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
        unitSku: src,
        barcode: bar,
        matched: false,
        rawSku: src,
        needMap: true,
        mul: mul
      };
    }

    return {
      skuId: hit.id,
      name: hit.s.name || hit.id,
      qty: (parseInt(line.qty, 10) || 1) * mul,
      unitSku: hit.s.unitSku || parsed.tries[0] || src,
      barcode: hit.s.barcode || bar || '',
      matched: true,
      needMap: false,
      mul: mul,
      rawSku: src
    };
  }

  function expandOrder(order, skus) {
    if (!order || !order.lines) return order;
    var lines = order.lines.map(function (l) { return expandLine(l, skus); });
    var merged = [];
    lines.forEach(function (l) {
      if (l.matched) {
        var e = merged.find(function (x) { return x.matched && x.skuId === l.skuId; });
        if (e) { e.qty += l.qty; return; }
      }
      merged.push(Object.assign({}, l));
    });
    order.lines = merged;
    order._unmatched = merged.filter(function (l) { return !l.matched; });
    return order;
  }

  function skuOptionsHtml(skus) {
    var ents = Object.keys(skus || {}).map(function (id) {
      var s = skus[id] || {};
      return {
        id: id,
        label: (s.name || id) + (s.unitSku ? ' \u00b7 ' + s.unitSku : '') + (s.barcode ? ' \u00b7 BC ' + s.barcode : '')
      };
    }).sort(function (a, b) { return a.label.localeCompare(b.label, 'th'); });
    var html = '<option value="">\u2014 \u0e40\u0e25\u0e37\u0e2d\u0e01\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e43\u0e19\u0e04\u0e25\u0e31\u0e07 \u2014</option>';
    ents.forEach(function (e) {
      html += '<option value="' + e.id.replace(/"/g, '') + '">' + e.label.replace(/</g, '<') + '</option>';
    });
    return html;
  }

  function ensureMapUi() {
    if (document.getElementById('pack-map-ov')) return;
    var ov = document.createElement('div');
    ov.id = 'pack-map-ov';
    ov.style.cssText = 'display:none;position:fixed;inset:0;z-index:600;background:rgba(12,14,18,.55);align-items:flex-end;justify-content:center;padding:0;';
    ov.innerHTML =
      '<div id="pack-map-sheet" style="background:var(--paper,#fff);width:100%;max-width:520px;max-height:85vh;overflow:auto;' +
      'border-radius:18px 18px 0 0;padding:16px 16px 28px;margin:0 auto;box-shadow:0 -8px 40px rgba(0,0,0,.2)">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">' +
      '<div style="font-size:17px;font-weight:800">\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e17\u0e35\u0e48\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e43\u0e19\u0e04\u0e25\u0e31\u0e07</div>' +
      '<button type="button" id="pack-map-close" style="border:none;background:var(--bg,#f3f1eb);width:36px;height:36px;border-radius:10px;font-size:18px;cursor:pointer">\u00d7</button>' +
      '</div>' +
      '<div style="font-size:12px;color:var(--ink3,#8A8F99);margin-bottom:12px;line-height:1.45">' +
      '\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e43\u0e19 StockFlow \u0e17\u0e35\u0e48\u0e15\u0e23\u0e07\u0e01\u0e31\u0e1a SKU \u0e08\u0e32\u0e01 BigSeller \u2014 \u0e23\u0e30\u0e1a\u0e1a\u0e08\u0e30\u0e08\u0e33\u0e01\u0e32\u0e23\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48\u0e04\u0e23\u0e31\u0e49\u0e07\u0e16\u0e31\u0e14\u0e44\u0e1b\u0e2d\u0e31\u0e15\u0e42\u0e19\u0e21\u0e31\u0e15\u0e34<br>' +
      '<b>PACK \u0e2b\u0e25\u0e32\u0e22\u0e0a\u0e34\u0e49\u0e19:</b> \u0e40\u0e0a\u0e48\u0e19 PULL3PACK = \u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32 PULL1PACK \u00d7 3 (\u0e2a\u0e41\u0e01\u0e19 3 \u0e04\u0e23\u0e31\u0e49\u0e07)' +
      '</div>' +
      '<div id="pack-map-list"></div>' +
      '<button type="button" id="pack-map-apply" style="width:100%;margin-top:14px;padding:14px;border-radius:14px;' +
      'background:var(--ink,#0C0E12);color:#fff;font-size:15px;font-weight:700;border:none;cursor:pointer">\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e01\u0e32\u0e23\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48</button>' +
      '</div>';
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
    var unmatched = (order.lines || []).filter(function (l) { return !l.matched; });
    if (!unmatched.length) {
      hideMapUi();
      if (cb) cb(order);
      return;
    }
    var seen = {}, items = [];
    unmatched.forEach(function (l) {
      var k = normKey(l.rawSku || l.unitSku || l.skuId);
      if (seen[k]) return;
      seen[k] = 1;
      items.push(l);
    });

    list.innerHTML = items.map(function (l) {
      var raw = l.rawSku || l.unitSku || l.skuId || '';
      var mul = l.mul > 1 ? l.mul : 1;
      var hint = mul > 1
        ? ('\u0e08\u0e30\u0e04\u0e34\u0e14\u0e40\u0e1b\u0e47\u0e19 \u00d7 ' + mul + ' \u0e0a\u0e34\u0e49\u0e19\u0e15\u0e48\u0e2d 1 \u0e41\u0e16\u0e27\u0e43\u0e19\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c')
        : '\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e17\u0e35\u0e48\u0e15\u0e23\u0e07\u0e01\u0e31\u0e19\u0e43\u0e19\u0e04\u0e25\u0e31\u0e07';
      return '<div style="padding:12px;margin-bottom:10px;border:1px solid var(--line,#E6E1D8);border-radius:14px;background:var(--bg,#faf8f4)">' +
        '<div style="font-size:14px;font-weight:700;margin-bottom:4px;word-break:break-all">' + String(raw).replace(/</g, '<') + '</div>' +
        '<div style="font-size:11px;color:var(--ink3);margin-bottom:8px">' + hint + '</div>' +
        '<select class="pack-map-sel" data-raw="' + String(raw).replace(/"/g, '"') + '" ' +
        'style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--line2,#ddd);font-size:13px;background:#fff">' +
        skuOptionsHtml(skus) +
        '</select></div>';
    }).join('');

    var ov = document.getElementById('pack-map-ov');
    ov.style.display = 'flex';
  }

  function applyMapUi() {
    if (!pendingOrder) { hideMapUi(); return; }
    var sels = document.querySelectorAll('#pack-map-list .pack-map-sel');
    var mapped = 0;
    sels.forEach(function (sel) {
      var raw = sel.getAttribute('data-raw') || '';
      var id = sel.value;
      if (raw && id) {
        setMapping(raw, id);
        mapped++;
      }
    });
    getSkus().then(function (skus) {
      expandOrder(pendingOrder, skus);
      try {
        var store = JSON.parse(localStorage.getItem('sf_bs_orders_v1') || '{}');
        Object.keys(store).forEach(function (k) {
          var o = store[k];
          if (o && pendingOrder && (o.id === pendingOrder.id || o.track === pendingOrder.track || o.packageId === pendingOrder.packageId)) {
            store[k] = pendingOrder;
          }
        });
        localStorage.setItem('sf_bs_orders_v1', JSON.stringify(store));
      } catch (e) {}

      var still = (pendingOrder.lines || []).filter(function (l) { return !l.matched; });
      hideMapUi();
      if (mapped) toast('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48 ' + mapped + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23');
      if (still.length) toast('\u0e22\u0e31\u0e07\u0e21\u0e35 ' + still.length + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e17\u0e35\u0e48\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48');
      var cb = pendingCallback;
      pendingCallback = null;
      if (cb) cb(pendingOrder);
      else loadOrderIntoPack(pendingOrder);
    });
  }

  function loadOrderIntoPack(order) {
    if (typeof window.__packLoadLines === 'function') {
      window.__packLoadLines(order);
    }
    if (typeof window.__bsFocusScan === 'function') {
      setTimeout(window.__bsFocusScan, 100);
      setTimeout(window.__bsFocusScan, 400);
    }
  }

  function processOrder(order) {
    return getSkus().then(function (skus) {
      expandOrder(order, skus);
      var unmatched = (order.lines || []).filter(function (l) { return !l.matched; });
      if (unmatched.length) {
        return new Promise(function (resolve) {
          showUnmatchedMapper(order, skus, function (ord) { resolve(ord); });
        });
      }
      return order;
    });
  }

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
          (o.lines || []).forEach(function (l) { if (!l.matched) um++; });
        });
        if (um) {
          var statusEl = document.getElementById('pack-csv-status');
          if (statusEl) {
            statusEl.style.color = 'var(--bad, #b91c1c)';
            statusEl.textContent = '\u0e21\u0e35 ' + um + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e17\u0e35\u0e48\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48\u0e43\u0e19\u0e04\u0e25\u0e31\u0e07 \u2014 \u0e2a\u0e41\u0e01\u0e19\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e41\u0e25\u0e49\u0e27\u0e23\u0e30\u0e1a\u0e1a\u0e08\u0e30\u0e43\u0e2b\u0e49\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48';
          }
        }
      });
      return (orders || []).length;
    };
    window.__bsSaveOrders._mapExp = true;
    window.__bsSaveOrders._genExp = true;

    if (typeof window.__bsTryLoadOrder === 'function' && !window.__bsTryLoadOrder._mapExp) {
      window.__bsTryLoadOrder = function (v, silent) {
        var ord = typeof window.__bsFindOrder === 'function' ? window.__bsFindOrder(v) : null;
        if (!ord) {
          if (!silent) toast('\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c');
          return false;
        }
        processOrder(ord).then(function (o) {
          if (typeof window.__packLoadLines === 'function') {
            window.__packLoadLines(o);
          } else {
            try {
              var store = JSON.parse(localStorage.getItem('sf_bs_orders_v1') || '{}');
              Object.keys(store).forEach(function (k) {
                if (store[k] && (store[k].id === o.id || store[k].track === o.track)) store[k] = o;
              });
              localStorage.setItem('sf_bs_orders_v1', JSON.stringify(store));
            } catch (e) {}
            var resetBtn = document.getElementById('pack-reset');
            if (resetBtn) resetBtn.click();
            var orderEl = document.getElementById('pack-order');
            if (orderEl) orderEl.value = o.track || o.packageId || o.id || '';
            var sel = document.getElementById('pack-add-sku');
            var qtyEl = document.getElementById('pack-add-qty');
            var addBtn = document.getElementById('pack-add-btn');
            (o.lines || []).filter(function (l) { return l.matched; }).forEach(function (l) {
              if (!sel || !addBtn || !qtyEl) return;
              var has = false;
              for (var i = 0; i < sel.options.length; i++) if (sel.options[i].value === l.skuId) has = true;
              if (!has) {
                var opt = document.createElement('option');
                opt.value = l.skuId;
                opt.textContent = l.name || l.skuId;
                sel.appendChild(opt);
              }
              sel.value = l.skuId;
              qtyEl.value = String(l.qty || 1);
              addBtn.click();
            });
            var fb = document.getElementById('pack-fb');
            if (fb) {
              fb.style.background = 'var(--ok-soft)';
              fb.style.color = 'var(--ok)';
              fb.textContent = '\u2713 \u0e42\u0e2b\u0e25\u0e14\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c \u00b7 \u0e2a\u0e41\u0e01\u0e19\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e44\u0e14\u0e49';
            }
          }
          if (typeof window.__bsFocusScan === 'function') {
            setTimeout(window.__bsFocusScan, 100);
            setTimeout(window.__bsFocusScan, 400);
          }
        });
        return true;
      };
      window.__bsTryLoadOrder._mapExp = true;
      window.__bsTryLoadOrder._genExp = true;
    }

    window.__packExpandOrder = processOrder;
    window.__packShowSkuMapper = function (order) {
      return getSkus().then(function (skus) {
        expandOrder(order, skus);
        return new Promise(function (resolve) {
          showUnmatchedMapper(order, skus, resolve);
        });
      });
    };
    return true;
  }

  var n = 0;
  var iv = setInterval(function () {
    if (patch() || ++n > 80) clearInterval(iv);
  }, 200);
  setTimeout(function () { getSkus(); }, 1500);
})();
