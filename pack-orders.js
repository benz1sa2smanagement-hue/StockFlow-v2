/**
 * Pack order scan — match QR / tracking barcode / order SN from label
 */
(function () {
  'use strict';
  var KEY = 'sf_bs_orders_v1';
  var DONE_KEY = 'sf_bs_orders_done_v1';
  var scanTimer = null;
  var orderTimer = null;
  var lastTry = { v: '', t: 0 };
  var lastStatus = '';

  function toast(msg) {
    var w = document.getElementById('toast-wrap');
    if (!w) return;
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    w.innerHTML = '';
    w.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  }

  function setStatus(msg, kind) {
    lastStatus = msg || '';
    var el = document.getElementById('pack-scan-status');
    if (!el) return;
    var bg = '#f3f4f6', fg = '#374151', border = '#e5e7eb';
    if (kind === 'ok') { bg = '#dcfce7'; fg = '#166534'; border = '#86efac'; }
    else if (kind === 'warn') { bg = '#fef3c7'; fg = '#92400e'; border = '#fcd34d'; }
    else if (kind === 'bad') { bg = '#fee2e2'; fg = '#b91c1c'; border = '#fca5a5'; }
    else if (kind === 'info') { bg = '#eff6ff'; fg = '#1e40af'; border = '#93c5fd'; }
    el.style.cssText = 'margin:8px 0 10px;padding:10px 12px;border-radius:12px;font-size:13px;font-weight:700;line-height:1.4;border:1px solid ' + border + ';background:' + bg + ';color:' + fg;
    el.textContent = msg;
  }

  function ensureStatusBar() {
    if (document.getElementById('pack-scan-status')) return;
    var page = document.getElementById('page-pack');
    if (!page) return;
    var el = document.createElement('div');
    el.id = 'pack-scan-status';
    el.textContent = '\u0e01\u0e33\u0e25\u0e31\u0e07\u0e40\u0e15\u0e23\u0e35\u0e22\u0e21\u2026';
    var anchor = document.getElementById('pack-order') || document.getElementById('pack-scan');
    if (anchor && anchor.parentNode) {
      var host = anchor.closest('.card') || anchor.parentNode;
      host.insertBefore(el, host.firstChild);
    } else page.insertBefore(el, page.firstChild);
    refreshIdleStatus();
  }

  function orderCount() {
    var store = loadStore();
    var seen = {}, n = 0;
    Object.keys(store).forEach(function (k) {
      var o = store[k];
      if (!o || !o.lines || !o.lines.length) return;
      var id = norm(o.id || o.track || o.packageId || o.platformOrder || o.orderNo || k);
      if (!id || seen[id]) return;
      seen[id] = 1; n++;
    });
    return n;
  }

  function refreshIdleStatus() {
    var box = document.getElementById('pack-lines');
    var nLines = box ? box.querySelectorAll('.row-q, .plu').length : 0;
    var nOrd = orderCount();
    if (nLines > 0) setStatus('\u0e1e\u0e23\u0e49\u0e2d\u0e21\u0e2a\u0e41\u0e01\u0e19\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32 \u00b7 \u0e2a\u0e41\u0e01\u0e19 barcode \u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32', 'info');
    else if (nOrd > 0) setStatus('\u0e1e\u0e23\u0e49\u0e2d\u0e21\u0e2a\u0e41\u0e01\u0e19\u0e43\u0e1a\u0e1b\u0e30\u0e2b\u0e19\u0e49\u0e32 \u00b7 QR / Tracking / Order ID \u00b7 \u0e04\u0e34\u0e27 ' + nOrd + ' \u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c', 'ok');
    else setStatus('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c \u2014 \u0e01\u0e14\u0e14\u0e36\u0e07\u0e08\u0e32\u0e01 BigSeller \u0e01\u0e48\u0e2d\u0e19', 'warn');
  }

  function loadStore() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveStore(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }
  function loadDone() {
    try { return JSON.parse(localStorage.getItem(DONE_KEY) || '{}'); } catch (e) { return {}; }
  }
  function markDone(order) {
    if (!order) return;
    var d = loadDone();
    var now = Date.now();
    [order.id, order.track, order.packageId, order.platformOrder, order.orderNo].forEach(function (k) {
      k = norm(k); if (k) d[k] = now;
    });
    try { localStorage.setItem(DONE_KEY, JSON.stringify(d)); } catch (e) {}
  }

  function thaiLayoutToEn(s) {
    var th2en = {
      '\u0e46':'q','\u0e44':'w','\u0e32':'e','\u0e2a':'r','\u0e27':'t','\u0e38':'y','\u0e37':'u','\u0e17':'i','\u0e22':'o','\u0e1a':'p',
      '\u0e31':'a','\u0e14':'s','\u0e1f':'d','\u0e1e':'f','\u0e2b':'g','\u0e01':'h','\u0e48':'j','\u0e32':'k','\u0e2a':'l',
      '\u0e1c':'z','\u0e1b':'x','\u0e41':'c','\u0e2d':'v','\u0e34':'b','\u0e37':'n','\u0e17':'m'
    };
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (/[A-Za-z0-9\-_]/.test(ch)) out += ch;
      else if (th2en[ch]) out += th2en[ch];
      else out += ch;
    }
    return out;
  }
  function norm(v) {
    return thaiLayoutToEn(String(v || '')).trim().toUpperCase().replace(/\s+/g, '');
  }

  function focusEl(id) {
    var page = document.getElementById('page-pack');
    if (!page || !page.classList.contains('active')) return;
    var el = document.getElementById(id);
    if (!el) return;
    try {
      el.removeAttribute('readonly');
      el.focus({ preventScroll: true });
      try { el.select(); } catch (e) {}
    } catch (e2) { try { el.focus(); } catch (e3) {} }
  }
  function focusOrder() { focusEl('pack-order'); }
  function focusScan() { focusEl('pack-scan'); }
  function focusScanSoon() {
    [0, 40, 120, 280, 500, 900].forEach(function (ms) { setTimeout(focusScan, ms); });
  }
  function focusReady() {
    var box = document.getElementById('pack-lines');
    var n = box ? box.querySelectorAll('.row-q, .plu').length : 0;
    if (n > 0) focusScanSoon();
    else [0, 80, 200, 500].forEach(function (ms) { setTimeout(focusOrder, ms); });
  }

  function indexOrder(store, order) {
    if (!order || !order.lines || !order.lines.length) return;
    var keys = [];
    [order.id, order.track, order.packageId, order.orderNo, order.platformOrder,
     order.orderSn, order.platformOrderId, order.orderNumber].forEach(function (k) {
      k = norm(k); if (k && keys.indexOf(k) < 0) keys.push(k);
    });
    keys.slice().forEach(function (k) {
      var k2 = k.replace(/[^A-Z0-9]/g, '');
      if (k2 && keys.indexOf(k2) < 0) keys.push(k2);
      if (k2.length > 8) {
        var tail = k2.slice(-12);
        if (keys.indexOf(tail) < 0) keys.push(tail);
        if (/^[0-9]{6}[A-Z0-9]{6,}$/.test(k2)) {
          var rest = k2.slice(6);
          if (rest.length >= 6 && keys.indexOf(rest) < 0) keys.push(rest);
        }
        [10, 12, 14].forEach(function (n) {
          if (k2.length >= n) {
            var t = k2.slice(-n);
            if (keys.indexOf(t) < 0) keys.push(t);
          }
        });
        var stripped = k2.replace(/^(SPX|TH|LEX|JT|JNT|FLASH|KER|ECOM|BEST|NJV)/, '');
        if (stripped.length >= 8 && keys.indexOf(stripped) < 0) keys.push(stripped);
      }
    });
    keys.forEach(function (k) { store[k] = order; });
  }

  function saveOrdersFromImport(orders) {
    var store = loadStore();
    var n = 0;
    (orders || []).forEach(function (o) {
      if (o && o.lines && o.lines.length) { indexOrder(store, o); n++; }
    });
    saveStore(store);
    setStatus('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01 ' + n + ' \u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c \u2014 \u0e1e\u0e23\u0e49\u0e2d\u0e21\u0e2a\u0e41\u0e01\u0e19 QR / Tracking / Order', 'ok');
    focusReady();
    return n;
  }

  function extractCandidates(raw) {
    var out = [], seen = {};
    function add(x) {
      x = String(x || '').trim();
      if (!x || x.length < 3) return;
      x = x.replace(/^[#\*\s]+|[#\*\s]+$/g, '');
      if (!x || x.length < 3) return;
      var k = norm(x);
      if (!k || seen[k]) return;
      seen[k] = 1;
      out.push(x);
    }
    function addAlnum(x) {
      x = String(x || '').replace(/[^A-Za-z0-9]/g, '');
      if (x.length >= 5) add(x);
    }
    var v = String(raw || '').trim();
    if (!v) return out;
    add(v);
    add(thaiLayoutToEn(v));

    var urlish = v;
    if (!/^https?:\/\//i.test(urlish) && /(?:spx\.|shopee|lazada|tiktok|flash|jtexpress|kerry|bigseller|parcel|tracking)/i.test(urlish)) {
      urlish = 'https://' + urlish.replace(/^\/+/, '');
    }
    if (/^https?:\/\//i.test(urlish) || /[?&](order|track|tn|sn|id)=/i.test(v)) {
      try {
        var u = new URL(/^https?:\/\//i.test(urlish) ? urlish : 'https://dummy.local/?' + v.replace(/^\?/, ''));
        u.pathname.split('/').forEach(function (p) {
          try { add(decodeURIComponent(p)); } catch (e) { add(p); }
          addAlnum(p);
        });
        u.searchParams.forEach(function (val, key) {
          add(val);
          addAlnum(val);
          if (/order|track|tn|sn|bill|waybill|package|code/i.test(key)) add(val);
        });
        if (u.hash) {
          add(u.hash.replace(/^#/, ''));
          addAlnum(u.hash);
        }
      } catch (e) {}
    }

    if (v.charAt(0) === '{' || v.charAt(0) === '[') {
      try {
        var j = JSON.parse(v);
        function walk(o, d) {
          if (d > 4 || o == null) return;
          if (typeof o === 'string' || typeof o === 'number') { add(String(o)); addAlnum(String(o)); return; }
          if (Array.isArray(o)) { o.forEach(function (x) { walk(x, d + 1); }); return; }
          if (typeof o === 'object') {
            Object.keys(o).forEach(function (k) {
              if (/order|track|tn|sn|bill|waybill|package|code|id/i.test(k)) add(String(o[k] == null ? '' : o[k]));
              walk(o[k], d + 1);
            });
          }
        }
        walk(j, 0);
      } catch (eJ) {}
    }

    v.split(/[\s\|\,\;\/\\\n\r\t]+/).forEach(function (p) {
      if (p.length >= 5) add(p);
      addAlnum(p);
    });

    (v.match(/[A-Za-z0-9][A-Za-z0-9\-_]{4,}/g) || []).forEach(function (m) {
      add(m);
      addAlnum(m);
    });
    (v.match(/[0-9]{8,}/g) || []).forEach(add);
    (v.match(/[0-9]{6}[A-Za-z0-9]{6,}/g) || []).forEach(function (m) {
      add(m);
      add(m.slice(6));
    });
    (v.match(/(?:SPX|TH|LEX|JT|JNT|FLASH|KER|ECOM|BEST|DHL|NJV)[A-Za-z0-9]{6,}/gi) || []).forEach(add);
    (v.match(/TH[0-9]{8,}/gi) || []).forEach(add);

    addAlnum(v);
    add(v.replace(/[^A-Za-z0-9\-]/g, ''));
    return out;
  }

  function findOrder(code) {
    var store = loadStore();
    var storeKeys = Object.keys(store);
    if (!storeKeys.length) return null;
    var candidates = extractCandidates(code);
    var i, j, k, k2, sk, best = null, bestScore = 0;

    function scoreKey(cand, key) {
      if (!cand || !key) return 0;
      if (cand === key) return 100;
      if (key.indexOf(cand) >= 0) return 60 + Math.min(30, cand.length);
      if (cand.indexOf(key) >= 0) return 50 + Math.min(30, key.length);
      if (cand.length >= 8 && key.length >= 8) {
        if (cand.slice(-12) === key.slice(-12)) return 70;
        if (key.slice(-10) === cand.slice(-10)) return 65;
      }
      return 0;
    }

    for (i = 0; i < candidates.length; i++) {
      k = norm(candidates[i]);
      if (store[k]) return store[k];
      k2 = k.replace(/[^A-Z0-9]/g, '');
      if (k2 && store[k2]) return store[k2];
    }

    for (i = 0; i < candidates.length; i++) {
      k = norm(candidates[i]).replace(/[^A-Z0-9]/g, '');
      if (k.length < 5) continue;
      for (j = 0; j < storeKeys.length; j++) {
        sk = storeKeys[j];
        if (sk.length < 5) continue;
        var sc = scoreKey(k, sk.replace(/[^A-Z0-9]/g, ''));
        if (sc > bestScore) {
          bestScore = sc;
          best = store[sk];
        }
      }
    }
    if (bestScore >= 50) return best;
    return null;
  }

  function countUnmatched(order) {
    if (!order || !order.lines) return 0;
    var n = 0;
    order.lines.forEach(function (l) {
      if (!l) return;
      if (l.matched !== true || l.needMap) n++;
    });
    return n;
  }

  function openMapperSoon(order) {
    var tries = 0;
    function go() {
      tries++;
      if (typeof window.__packShowSkuMapper === 'function') {
        try {
          var ret = window.__packShowSkuMapper(order);
          if (ret && typeof ret.then === 'function') {
            ret.then(function (o) { if (o) loadLinesIntoPack(o); }).catch(function () {});
          }
        } catch (e) {}
        setStatus('\u0e21\u0e35 SKU \u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48 \u2014 \u0e40\u0e25\u0e37\u0e2d\u0e01\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e43\u0e19\u0e04\u0e25\u0e31\u0e07\u0e41\u0e25\u0e49\u0e27\u0e01\u0e14\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01', 'warn');
        return;
      }
      if (tries < 30) setTimeout(go, 150);
    }
    setTimeout(go, 100);
  }

  function loadLinesIntoPack(order) {
    if (!order || !order.lines || !order.lines.length) {
      setStatus('\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e44\u0e21\u0e48\u0e21\u0e35\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32', 'bad');
      return 0;
    }

    var resetBtn = document.getElementById('pack-reset');
    if (resetBtn) { try { resetBtn.click(); } catch (e) {} }

    var orderEl = document.getElementById('pack-order');
    if (orderEl) orderEl.value = order.track || order.platformOrder || order.orderNo || order.packageId || order.id || '';

    if (order.platform) {
      var p = String(order.platform).toLowerCase();
      document.querySelectorAll('#pack-plat button').forEach(function (b) {
        var pp = (b.getAttribute('data-pplat') || '').toLowerCase();
        if (pp && p.indexOf(pp) >= 0) { try { b.click(); } catch (e) {} }
      });
    }

    var sel = document.getElementById('pack-add-sku');
    var qtyEl = document.getElementById('pack-add-qty');
    var addBtn = document.getElementById('pack-add-btn');
    var added = 0;
    var names = [];
    var unmatchedN = countUnmatched(order);

    (order.lines || []).forEach(function (l) {
      if (!l) return;
      var skuId = l.skuId || l.unitSku || l.rawSku || '';
      var qty = parseInt(l.qty, 10) || 1;
      var name = l.name || skuId || '\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32';
      if (!skuId) skuId = 'UNMATCHED_' + String(name).slice(0, 20);

      if (sel && addBtn && qtyEl) {
        var has = false;
        for (var i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value === skuId) { has = true; break; }
        }
        if (!has) {
          var opt = document.createElement('option');
          opt.value = skuId;
          opt.textContent = (l.matched !== true ? '[?] ' : '') + name + (l.unitSku && l.unitSku !== name ? ' \u00b7 ' + l.unitSku : '');
          sel.appendChild(opt);
        }
        sel.value = skuId;
        qtyEl.value = String(qty);
        try { addBtn.click(); added++; names.push(name + ' \u00d7' + qty); } catch (e) {}
      }
    });

    var label = order.track || order.platformOrder || order.orderNo || order.packageId || order.id || '';
    var fb = document.getElementById('pack-fb');
    if (fb) {
      if (added > 0) {
        fb.style.background = unmatchedN ? '#fef3c7' : 'var(--ok-soft, #dcfce7)';
        fb.style.color = unmatchedN ? '#92400e' : 'var(--ok, #15803d)';
        fb.textContent = unmatchedN
          ? ('\u26a0 \u0e42\u0e2b\u0e25\u0e14 ' + label + ' \u00b7 ' + added + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23 \u00b7 \u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48 ' + unmatchedN)
          : ('\u2713 \u0e42\u0e2b\u0e25\u0e14 ' + label + ' \u00b7 ' + added + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23');
        fb.style.cursor = unmatchedN ? 'pointer' : 'default';
        fb.onclick = unmatchedN ? function () { openMapperSoon(order); } : null;
      }
    }

    if (added > 0) {
      setStatus('\u0e42\u0e2b\u0e25\u0e14 ' + label + ' \u00b7 ' + added + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23' + (unmatchedN ? ' \u00b7 \u0e15\u0e49\u0e2d\u0e07\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48 ' + unmatchedN + ' SKU' : ''), unmatchedN ? 'warn' : 'ok');
      toast('\u0e42\u0e2b\u0e25\u0e14 ' + added + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23');
      if (unmatchedN > 0) openMapperSoon(order);
    } else {
      setStatus('\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e44\u0e14\u0e49', 'bad');
    }

    focusScanSoon();
    return added;
  }

  function activateOrder(order) {
    if (!order || !order.lines || !order.lines.length) {
      setStatus('\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e44\u0e21\u0e48\u0e21\u0e35\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23', 'bad');
      return false;
    }
    lastTry = { v: norm(order.id || order.track || order.platformOrder || ''), t: Date.now() };
    setStatus('\u0e01\u0e33\u0e25\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u2026', 'info');

    function afterExpand(o) { loadLinesIntoPack(o || order); }

    if (typeof window.__packExpandOrderSilent === 'function') {
      window.__packExpandOrderSilent(order).then(afterExpand).catch(function () { afterExpand(order); });
      return true;
    }
    afterExpand(order);
    return true;
  }

  function tryFromScan(v, silent) {
    v = String(v || '').trim();
    if (!v) return false;
    var now = Date.now();
    if (lastTry.v === norm(v) && now - lastTry.t < 500) return true;

    if (!Object.keys(loadStore()).length) {
      setStatus('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c \u2014 \u0e14\u0e36\u0e07\u0e08\u0e32\u0e01 BigSeller \u0e01\u0e48\u0e2d\u0e19', 'bad');
      if (!silent) toast('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c');
      return false;
    }

    var ord = findOrder(v);
    if (!ord) {
      var short = v.length > 36 ? v.slice(0, 36) + '\u2026' : v;
      var n = orderCount();
      setStatus('\u0e44\u0e21\u0e48\u0e1e\u0e1a: ' + short + ' \u00b7 \u0e04\u0e34\u0e27 ' + n + ' \u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c \u2014 \u0e25\u0e2d\u0e07\u0e14\u0e36\u0e07\u0e43\u0e2b\u0e21\u0e48 \u0e2b\u0e23\u0e37\u0e2d\u0e2a\u0e41\u0e01\u0e19 Tracking', 'bad');
      if (!silent) toast('\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c: ' + short + ' (\u0e04\u0e34\u0e27 ' + n + ')');
      return false;
    }
    lastTry = { v: norm(v), t: now };
    return activateOrder(ord);
  }

  window.__bsSaveOrders = saveOrdersFromImport;
  window.__bsFindOrder = findOrder;
  window.__bsTryLoadOrder = tryFromScan;
  window.__packLoadLines = loadLinesIntoPack;
  window.__bsOrderCount = orderCount;
  window.__bsClearOrders = function () { localStorage.removeItem(KEY); refreshIdleStatus(); };
  window.__bsFocusScan = focusScan;
  window.__bsFocusOrder = focusOrder;
  window.__packMarkOrderDone = markDone;
  window.__packScanStatus = setStatus;

  function currentOrderId() {
    var o = document.getElementById('pack-order');
    return norm(o && o.value || '');
  }
  function linesAllDone() {
    var box = document.getElementById('pack-lines');
    if (!box) return true;
    var rows = box.querySelectorAll('.row-q');
    if (!rows.length) {
      var plus = box.querySelectorAll('.plu');
      if (!plus.length) return true;
      for (var i = 0; i < plus.length; i++) {
        var rem = parseInt(plus[i].getAttribute('data-remain'), 10);
        if (!isNaN(rem) && rem > 0) return false;
      }
      return true;
    }
    for (var j = 0; j < rows.length; j++) {
      var parts = (rows[j].textContent || '').split('/');
      var a = parseInt(parts[0], 10) || 0;
      var b = parseInt(parts[1], 10) || 0;
      if (b > 0 && a < b) return false;
    }
    return true;
  }
  function lineCount() {
    var box = document.getElementById('pack-lines');
    if (!box) return 0;
    var n = box.querySelectorAll('.row-q').length;
    return n || box.querySelectorAll('.plu').length;
  }

  function handleScanValue(v) {
    v = String(v || '').trim();
    if (!v || v.length < 4) return false;
    var ord = findOrder(v);
    if (!ord) return false;
    var cur = currentOrderId();
    var oid = norm(ord.id || ord.track || ord.packageId || ord.platformOrder || '');
    var same = cur && oid && (cur === oid || cur.indexOf(oid) >= 0 || oid.indexOf(cur) >= 0);
    if (same && lineCount() > 0 && !linesAllDone()) return false;
    if (cur && !same && lineCount() > 0 && linesAllDone()) markDone({ id: cur, track: cur });
    return activateOrder(ord);
  }

  function onOrderValue(v, fromEnter) {
    v = String(v || '').trim();
    if (v.length < 4) return;
    if (tryFromScan(v, !fromEnter)) {
      var scan = document.getElementById('pack-scan');
      if (scan) scan.value = '';
    }
  }

  function bindOrderInput() {
    var orderEl = document.getElementById('pack-order');
    if (!orderEl || orderEl.getAttribute('data-bs-order-bound')) return;
    orderEl.setAttribute('data-bs-order-bound', '1');
    orderEl.setAttribute('placeholder', '\u0e2a\u0e41\u0e01\u0e19\u0e43\u0e1a\u0e1b\u0e30\u0e2b\u0e19\u0e49\u0e32 / QR / Tracking / Order ID');
    orderEl.addEventListener('input', function () {
      if (orderTimer) clearTimeout(orderTimer);
      orderTimer = setTimeout(function () { onOrderValue(orderEl.value, false); }, 80);
    });
    orderEl.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      onOrderValue(orderEl.value, true);
    });
  }

  function bindScanInput() {
    var input = document.getElementById('pack-scan');
    if (!input || input.getAttribute('data-bs-bound-v5')) return;
    input.setAttribute('data-bs-bound-v5', '1');
    input.addEventListener('input', function () {
      if (scanTimer) clearTimeout(scanTimer);
      scanTimer = setTimeout(function () {
        var v = (input.value || '').trim();
        if (v.length < 4) return;
        if (handleScanValue(v)) { input.value = ''; setTimeout(focusScan, 60); }
      }, 80);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var v = (input.value || '').trim();
      if (!v) return;
      if (handleScanValue(v)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        input.value = '';
        setTimeout(focusScan, 60);
      }
    }, true);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var input = e.target;
    if (!input) return;
    if (input.id === 'pack-order') { e.preventDefault(); onOrderValue(input.value, true); }
    if (input.id === 'pack-scan') {
      var v = (input.value || '').trim();
      if (v && handleScanValue(v)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        input.value = '';
        setTimeout(focusScan, 60);
      }
    }
  }, true);

  function wireAll() {
    ensureStatusBar();
    bindOrderInput();
    bindScanInput();
  }

  setInterval(function () {
    wireAll();
    var page = document.getElementById('page-pack');
    if (!page || !page.classList.contains('active')) return;
    var ae = document.activeElement;
    if (ae && (ae.id === 'pack-scan' || ae.id === 'pack-order' || ae.tagName === 'SELECT' || ae.tagName === 'INPUT' || ae.tagName === 'BUTTON')) return;
    focusReady();
  }, 600);

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.ni[data-page="pack"]');
    if (btn) { setTimeout(wireAll, 100); setTimeout(focusReady, 250); }
  }, true);

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('#pack-complete');
    if (!t) return;
    var ord = currentOrderId();
    if (ord) markDone({ id: ord, track: ord });
    setTimeout(function () {
      setStatus('\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e41\u0e25\u0e49\u0e27 \u2014 \u0e1e\u0e23\u0e49\u0e2d\u0e21\u0e2a\u0e41\u0e01\u0e19\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e16\u0e31\u0e14\u0e44\u0e1b', 'ok');
      focusOrder();
    }, 800);
  }, true);

  var mo = new MutationObserver(function () {
    if (document.getElementById('pack-order') || document.getElementById('pack-scan')) wireAll();
  });
  if (document.body) mo.observe(document.body, { childList: true, subtree: true });
  else document.addEventListener('DOMContentLoaded', function () {
    mo.observe(document.body, { childList: true, subtree: true });
  });

  setTimeout(wireAll, 400);
  setTimeout(wireAll, 1200);
  setTimeout(refreshIdleStatus, 1500);
})();
