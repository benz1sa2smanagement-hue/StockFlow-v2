/**
 * Pack order scan flow (restored):
 * 1) Always ready for scanner
 * 2) Scan order barcode → load lines immediately
 * 3) Focus product scan
 * 4) When done → next order scan closes & auto stock-cut
 * Status bar shows what is happening / what failed
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
    } else {
      page.insertBefore(el, page.firstChild);
    }
    refreshIdleStatus();
  }

  function orderCount() {
    var store = loadStore();
    var seen = {}, n = 0;
    Object.keys(store).forEach(function (k) {
      var o = store[k];
      if (!o || !o.lines || !o.lines.length) return;
      var id = norm(o.id || o.track || o.packageId || k);
      if (!id || seen[id]) return;
      seen[id] = 1;
      n++;
    });
    return n;
  }

  function refreshIdleStatus() {
    var box = document.getElementById('pack-lines');
    var nLines = box ? box.querySelectorAll('.row-q, .plu').length : 0;
    var nOrd = orderCount();
    if (nLines > 0) {
      setStatus('\u0e1e\u0e23\u0e49\u0e2d\u0e21\u0e2a\u0e41\u0e01\u0e19\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32 \u00b7 \u0e2a\u0e41\u0e01\u0e19 barcode \u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e44\u0e14\u0e49\u0e40\u0e25\u0e22 \u00b7 \u0e04\u0e23\u0e1a\u0e41\u0e25\u0e49\u0e27\u0e08\u0e30\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e2d\u0e31\u0e15\u0e42\u0e19\u0e21\u0e31\u0e15\u0e34', 'info');
    } else if (nOrd > 0) {
      setStatus('\u0e1e\u0e23\u0e49\u0e2d\u0e21\u0e2a\u0e41\u0e01\u0e19\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c \u00b7 \u0e21\u0e35 ' + nOrd + ' \u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e43\u0e19\u0e04\u0e34\u0e27 \u00b7 \u0e2a\u0e41\u0e01\u0e19\u0e43\u0e1a\u0e1b\u0e30\u0e2b\u0e19\u0e49\u0e32 / Tracking', 'ok');
    } else {
      setStatus('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e43\u0e19\u0e04\u0e34\u0e27 \u2014 \u0e01\u0e14\u00ab\u0e14\u0e36\u0e07\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e15\u0e2d\u0e19\u0e19\u0e35\u0e49\u00bb \u0e08\u0e32\u0e01 BigSeller \u0e01\u0e48\u0e2d\u0e19', 'warn');
    }
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
    [order.id, order.track, order.packageId].forEach(function (k) {
      k = norm(k);
      if (k) d[k] = now;
    });
    try { localStorage.setItem(DONE_KEY, JSON.stringify(d)); } catch (e) {}
  }

  function norm(v) {
    return String(v || '').trim().toUpperCase().replace(/\s+/g, '');
  }

  function focusEl(id) {
    var page = document.getElementById('page-pack');
    if (!page || !page.classList.contains('active')) return;
    var el = document.getElementById(id);
    if (!el) return;
    try {
      el.setAttribute('lang', 'en');
      el.setAttribute('spellcheck', 'false');
      el.setAttribute('autocomplete', 'off');
      el.removeAttribute('readonly');
      el.focus({ preventScroll: true });
      try { el.select(); } catch (e) {}
    } catch (e2) {
      try { el.focus(); } catch (e3) {}
    }
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
    else {
      [0, 80, 200, 500].forEach(function (ms) { setTimeout(focusOrder, ms); });
    }
  }

  function indexOrder(store, order) {
    if (!order || !order.lines || !order.lines.length) return;
    var keys = [];
    [order.id, order.track, order.packageId].forEach(function (k) {
      k = norm(k);
      if (k && keys.indexOf(k) < 0) keys.push(k);
    });
    keys.slice().forEach(function (k) {
      var k2 = k.replace(/[^A-Z0-9]/g, '');
      if (k2 && keys.indexOf(k2) < 0) keys.push(k2);
      if (k2.length > 10) {
        var tail = k2.slice(-12);
        if (keys.indexOf(tail) < 0) keys.push(tail);
      }
    });
    keys.forEach(function (k) { store[k] = order; });
  }

  function saveOrdersFromImport(orders) {
    var store = loadStore();
    var n = 0;
    (orders || []).forEach(function (o) {
      if (o && o.lines && o.lines.length) {
        indexOrder(store, o);
        n++;
      }
    });
    saveStore(store);
    setStatus('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01 ' + n + ' \u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c \u2014 \u0e1e\u0e23\u0e49\u0e2d\u0e21\u0e2a\u0e41\u0e01\u0e19\u0e43\u0e1a\u0e1b\u0e30\u0e2b\u0e19\u0e49\u0e32', 'ok');
    focusReady();
    return n;
  }

  function extractCandidates(raw) {
    var out = [], seen = {};
    function add(x) {
      x = String(x || '').trim();
      if (!x || x.length < 3) return;
      var k = norm(x);
      if (seen[k]) return;
      seen[k] = 1;
      out.push(x);
    }
    var v = String(raw || '').trim();
    if (!v) return out;
    add(v);
    if (/^https?:\/\//i.test(v) || /spx\.|shopee|lazada|tiktok/i.test(v)) {
      try {
        var u = new URL(/^https?:\/\//i.test(v) ? v : 'https://' + v);
        u.pathname.split('/').forEach(function (p) {
          try { add(decodeURIComponent(p)); } catch (e) { add(p); }
        });
        u.searchParams.forEach(function (val) { add(val); });
      } catch (e) {}
    }
    (v.match(/[A-Za-z0-9][A-Za-z0-9\-_]{4,}|[0-9]{6,}/g) || []).forEach(add);
    add(v.replace(/[^A-Za-z0-9]/g, ''));
    return out;
  }

  function findOrder(code) {
    var store = loadStore();
    var storeKeys = Object.keys(store);
    if (!storeKeys.length) return null;
    var candidates = extractCandidates(code);
    var i, j, k, k2, sk;
    for (i = 0; i < candidates.length; i++) {
      k = norm(candidates[i]);
      if (store[k]) return store[k];
      k2 = k.replace(/[^A-Z0-9]/g, '');
      if (store[k2]) return store[k2];
    }
    for (i = 0; i < candidates.length; i++) {
      k = norm(candidates[i]).replace(/[^A-Z0-9]/g, '');
      if (k.length < 5) continue;
      for (j = 0; j < storeKeys.length; j++) {
        sk = storeKeys[j];
        if (sk.length < 5) continue;
        if (sk === k || sk.indexOf(k) >= 0 || k.indexOf(sk) >= 0) return store[sk];
      }
    }
    return null;
  }

  function loadLinesIntoPack(order) {
    if (!order || !order.lines || !order.lines.length) {
      setStatus('\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e44\u0e21\u0e48\u0e21\u0e35\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32', 'bad');
      return 0;
    }

    var resetBtn = document.getElementById('pack-reset');
    if (resetBtn) { try { resetBtn.click(); } catch (e) {} }

    var orderEl = document.getElementById('pack-order');
    if (orderEl) orderEl.value = order.track || order.packageId || order.id || '';

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
    var unmatchedN = 0;
    var missingUi = !(sel && addBtn && qtyEl);

    if (missingUi) {
      setStatus('\u0e44\u0e21\u0e48\u0e1e\u0e1a UI \u0e40\u0e1e\u0e34\u0e48\u0e21\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32 (pack-add-sku) \u2014 \u0e23\u0e35\u0e40\u0e1f\u0e23\u0e0a\u0e2b\u0e19\u0e49\u0e32', 'bad');
      toast('\u0e42\u0e2b\u0e25\u0e14 UI \u0e41\u0e1e\u0e47\u0e01\u0e44\u0e21\u0e48\u0e04\u0e23\u0e1a \u2014 \u0e23\u0e35\u0e40\u0e1f\u0e23\u0e0a\u0e2b\u0e19\u0e49\u0e32');
    }

    (order.lines || []).forEach(function (l) {
      if (!l) return;
      var skuId = l.skuId || l.unitSku || l.rawSku || '';
      var qty = parseInt(l.qty, 10) || 1;
      var name = l.name || skuId || '\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32';
      if (!skuId) skuId = 'UNMATCHED_' + String(name).slice(0, 20);
      if (l.matched === false || l.needMap) unmatchedN++;

      if (sel && addBtn && qtyEl) {
        var has = false;
        for (var i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value === skuId) { has = true; break; }
        }
        if (!has) {
          var opt = document.createElement('option');
          opt.value = skuId;
          opt.textContent = (l.matched === false ? '[?] ' : '') + name + (l.unitSku && l.unitSku !== name ? ' \u00b7 ' + l.unitSku : '');
          sel.appendChild(opt);
        }
        sel.value = skuId;
        qtyEl.value = String(qty);
        try { addBtn.click(); added++; names.push(name + ' \u00d7' + qty); } catch (e) {}
      }
    });

    var label = order.track || order.packageId || order.id || '';
    var fb = document.getElementById('pack-fb');
    if (fb) {
      if (added > 0) {
        fb.style.background = unmatchedN ? '#fef3c7' : 'var(--ok-soft, #dcfce7)';
        fb.style.color = unmatchedN ? '#92400e' : 'var(--ok, #15803d)';
        fb.textContent = unmatchedN
          ? ('\u26a0 \u0e42\u0e2b\u0e25\u0e14 ' + label + ' \u00b7 ' + added + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23 \u00b7 \u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48 ' + unmatchedN + ' \u2014 \u0e01\u0e14\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48')
          : ('\u2713 \u0e42\u0e2b\u0e25\u0e14 ' + label + ' \u00b7 ' + added + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23 \u2014 \u0e2a\u0e41\u0e01\u0e19\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e44\u0e14\u0e49');
        fb.style.cursor = unmatchedN ? 'pointer' : 'default';
        fb.onclick = unmatchedN ? function () {
          if (typeof window.__packShowSkuMapper === 'function') window.__packShowSkuMapper(order);
        } : null;
      } else {
        fb.style.background = 'var(--bad-soft, #fee2e2)';
        fb.style.color = 'var(--bad, #b91c1c)';
        fb.textContent = '\u0e42\u0e2b\u0e25\u0e14\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 \u2014 \u0e15\u0e23\u0e27\u0e08 SKU / UI';
      }
    }

    if (added > 0) {
      setStatus('\u0e42\u0e2b\u0e25\u0e14\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c ' + label + ' \u00b7 ' + added + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23 \u2014 \u0e1e\u0e23\u0e49\u0e2d\u0e21\u0e2a\u0e41\u0e01\u0e19\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32', unmatchedN ? 'warn' : 'ok');
      toast('\u0e42\u0e2b\u0e25\u0e14 ' + added + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23: ' + names.slice(0, 2).join(', ') + (names.length > 2 ? '\u2026' : ''));
      if (unmatchedN > 0 && typeof window.__packShowSkuMapper === 'function') {
        setTimeout(function () {
          try { window.__packShowSkuMapper(order); } catch (eM) {}
        }, 400);
      }
    } else {
      setStatus('\u0e2a\u0e41\u0e01\u0e19\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e41\u0e25\u0e49\u0e27 \u0e41\u0e15\u0e48\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e44\u0e14\u0e49', 'bad');
      toast('\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e42\u0e2b\u0e25\u0e14\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32');
    }

    focusScanSoon();
    return added;
  }

  function activateOrder(order) {
    if (!order || !order.lines || !order.lines.length) {
      setStatus('\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e44\u0e21\u0e48\u0e21\u0e35\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23', 'bad');
      toast('\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e44\u0e21\u0e48\u0e21\u0e35\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32');
      return false;
    }
    lastTry = { v: norm(order.id || order.track || ''), t: Date.now() };
    setStatus('\u0e01\u0e33\u0e25\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u2026', 'info');

    if (typeof window.__packExpandOrderSilent === 'function') {
      window.__packExpandOrderSilent(order).then(function (o) {
        loadLinesIntoPack(o || order);
      }).catch(function () {
        loadLinesIntoPack(order);
      });
      return true;
    }
    if (typeof window.__packExpandLinesOnly === 'function') {
      try { window.__packExpandLinesOnly(order); } catch (e) {}
    }
    loadLinesIntoPack(order);
    return true;
  }

  function tryFromScan(v, silent) {
    v = String(v || '').trim();
    if (!v) return false;
    var now = Date.now();
    if (lastTry.v === norm(v) && now - lastTry.t < 500) return true;

    var store = loadStore();
    var nKeys = Object.keys(store).length;
    if (!nKeys) {
      setStatus('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e43\u0e19\u0e04\u0e34\u0e27 \u2014 \u0e01\u0e14\u0e14\u0e36\u0e07\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e08\u0e32\u0e01 BigSeller \u0e01\u0e48\u0e2d\u0e19', 'bad');
      if (!silent) toast('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c \u2014 \u0e14\u0e36\u0e07\u0e08\u0e32\u0e01 BigSeller \u0e01\u0e48\u0e2d\u0e19');
      return false;
    }

    var ord = findOrder(v);
    if (!ord) {
      var short = v.length > 36 ? v.slice(0, 36) + '\u2026' : v;
      setStatus('\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c: ' + short + ' \u00b7 \u0e43\u0e19\u0e04\u0e34\u0e27 ' + orderCount() + ' \u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c', 'bad');
      if (!silent) toast('\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c: ' + short);
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
    if (n) return n;
    return box.querySelectorAll('.plu').length;
  }

  function handleScanValue(v, silent) {
    v = String(v || '').trim();
    if (!v || v.length < 4) return false;
    var ord = findOrder(v);
    if (!ord) return false;

    var cur = currentOrderId();
    var oid = norm(ord.id || ord.track || ord.packageId || '');
    var same = cur && oid && (cur === oid || cur.indexOf(oid) >= 0 || oid.indexOf(cur) >= 0);

    if (same && lineCount() > 0 && !linesAllDone()) {
      return false;
    }

    if (cur && !same && lineCount() > 0 && linesAllDone()) {
      markDone({ id: cur, track: cur, packageId: cur });
    }

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
    orderEl.setAttribute('lang', 'en');
    orderEl.setAttribute('spellcheck', 'false');
    orderEl.setAttribute('autocomplete', 'off');
    orderEl.setAttribute('placeholder', '\u0e2a\u0e41\u0e01\u0e19\u0e43\u0e1a\u0e1b\u0e30\u0e2b\u0e19\u0e49\u0e32 / Order ID / Tracking');

    orderEl.addEventListener('input', function () {
      if (orderTimer) clearTimeout(orderTimer);
      orderTimer = setTimeout(function () {
        onOrderValue(orderEl.value, false);
      }, 80);
    });

    orderEl.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      e.stopPropagation();
      onOrderValue(orderEl.value, true);
    });
  }

  function bindScanInput() {
    var input = document.getElementById('pack-scan');
    if (!input || input.getAttribute('data-bs-bound-v5')) return;
    input.setAttribute('data-bs-bound-v5', '1');
    input.setAttribute('lang', 'en');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('autocomplete', 'off');

    input.addEventListener('input', function () {
      if (scanTimer) clearTimeout(scanTimer);
      scanTimer = setTimeout(function () {
        var v = (input.value || '').trim();
        if (v.length < 4) return;
        if (handleScanValue(v, false)) {
          input.value = '';
          setTimeout(focusScan, 60);
        }
      }, 80);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var v = (input.value || '').trim();
      if (!v) return;
      if (handleScanValue(v, false)) {
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
    if (input.id === 'pack-order') {
      e.preventDefault();
      onOrderValue(input.value, true);
      return;
    }
    if (input.id === 'pack-scan') {
      var v = (input.value || '').trim();
      if (v && handleScanValue(v, false)) {
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
    if (ae && (ae.id === 'pack-scan' || ae.id === 'pack-order' || ae.id === 'pack-csv-file' ||
               ae.id === 'pack-add-sku' || ae.id === 'pack-add-qty' || ae.id === 'pack-session-id' ||
               ae.id === 'pack-map-search')) return;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'SELECT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'BUTTON')) return;
    focusReady();
    if (!lastStatus || lastStatus.indexOf('\u0e1e\u0e23\u0e49\u0e2d\u0e21') === 0 || lastStatus.indexOf('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35') === 0) {
      refreshIdleStatus();
    }
  }, 600);

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.ni[data-page="pack"]');
    if (!btn) return;
    setTimeout(wireAll, 100);
    setTimeout(focusReady, 250);
    setTimeout(refreshIdleStatus, 400);
  }, true);

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('#pack-complete');
    if (!t) return;
    var ord = currentOrderId();
    if (ord) markDone({ id: ord, track: ord });
    setTimeout(function () {
      setStatus('\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e41\u0e25\u0e49\u0e27 \u2014 \u0e1e\u0e23\u0e49\u0e2d\u0e21\u0e2a\u0e41\u0e01\u0e19\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e16\u0e31\u0e14\u0e44\u0e1b', 'ok');
      focusOrder();
      if (typeof window.__packQueueRefresh === 'function') window.__packQueueRefresh();
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
