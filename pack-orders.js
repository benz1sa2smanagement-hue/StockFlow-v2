/**
 * BigSeller order store + label scan → load pack product lines
 * - Scan into pack-order OR pack-scan loads order items automatically
 * - After packing (or when all done), scan next order barcode to switch without button
 */
(function () {
  'use strict';
  var KEY = 'sf_bs_orders_v1';
  var scanTimer = null;
  var orderTimer = null;
  var lastTry = { v: '', t: 0 };

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

  function loadStore() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveStore(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
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
    [0, 50, 150, 300, 600, 1000].forEach(function (ms) { setTimeout(focusScan, ms); });
  }
  function focusOrderSoon() {
    [0, 50, 150, 300, 600, 1000, 1600].forEach(function (ms) { setTimeout(focusOrder, ms); });
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
      if (k2.length > 12) {
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
    focusOrderSoon();
    return n;
  }

  function extractCandidates(raw) {
    var out = [], seen = {};
    function add(x) {
      x = String(x || '').trim();
      if (!x || x.length < 4) return;
      var k = norm(x);
      if (seen[k]) return;
      seen[k] = 1;
      out.push(x);
    }
    var v = String(raw || '').trim();
    if (!v) return out;
    add(v);
    if (/^https?:\/\//i.test(v) || /spx\.|shopee/i.test(v)) {
      try {
        var u = new URL(/^https?:\/\//i.test(v) ? v : 'https://' + v);
        u.pathname.split('/').forEach(function (p) {
          try { add(decodeURIComponent(p)); } catch (e) { add(p); }
        });
        u.searchParams.forEach(function (val) { add(val); });
      } catch (e) {}
    }
    (v.match(/[A-Za-z0-9][A-Za-z0-9\-_]{5,}|[0-9]{8,}/g) || []).forEach(add);
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
      if (k.length < 6) continue;
      for (j = 0; j < storeKeys.length; j++) {
        sk = storeKeys[j];
        if (sk.length < 6) continue;
        if (sk === k || sk.indexOf(k) >= 0 || k.indexOf(sk) >= 0) return store[sk];
      }
    }
    return null;
  }

  function loadLinesIntoPack(order) {
    if (!order || !order.lines || !order.lines.length) return 0;

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

    (order.lines || []).forEach(function (l) {
      if (!l) return;
      var skuId = l.skuId || l.unitSku || '';
      var qty = parseInt(l.qty, 10) || 1;
      var name = l.name || skuId || '\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32';
      if (!skuId) return;

      if (sel && addBtn && qtyEl) {
        var has = false;
        for (var i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value === skuId) { has = true; break; }
        }
        if (!has) {
          var opt = document.createElement('option');
          opt.value = skuId;
          opt.textContent = name + (l.unitSku && l.unitSku !== name ? ' \u00b7 ' + l.unitSku : '');
          sel.appendChild(opt);
        }
        sel.value = skuId;
        qtyEl.value = String(qty);
        try { addBtn.click(); added++; names.push(name + ' \u00d7' + qty); } catch (e) {}
      }
    });

    var fb = document.getElementById('pack-fb');
    if (fb) {
      if (added > 0) {
        fb.style.background = 'var(--ok-soft, #dcfce7)';
        fb.style.color = 'var(--ok, #15803d)';
        fb.textContent = '\u2713 \u0e42\u0e2b\u0e25\u0e14\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e41\u0e25\u0e49\u0e27 \u00b7 ' + added + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23 \u2014 \u0e2a\u0e41\u0e01\u0e19\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e44\u0e14\u0e49\u0e40\u0e25\u0e22';
      } else {
        fb.style.background = 'var(--bad-soft, #fee2e2)';
        fb.style.color = 'var(--bad, #b91c1c)';
        fb.textContent = '\u0e1e\u0e1a\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e41\u0e15\u0e48\u0e42\u0e2b\u0e25\u0e14\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49 \u2014 \u0e15\u0e23\u0e27\u0e08 SKU \u0e43\u0e19\u0e04\u0e25\u0e31\u0e07';
      }
    }

    if (added > 0) {
      toast('\u0e42\u0e2b\u0e25\u0e14 ' + added + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23: ' + names.slice(0, 2).join(', ') + (names.length > 2 ? '\u2026' : ''));
    } else {
      toast('\u0e1e\u0e1a\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e41\u0e15\u0e48\u0e44\u0e21\u0e48\u0e21\u0e35\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e17\u0e35\u0e48\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48\u0e44\u0e14\u0e49');
    }

    focusScanSoon();
    return added;
  }

  function activateOrder(order) {
    if (!order || !order.lines || !order.lines.length) {
      toast('\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e44\u0e21\u0e48\u0e21\u0e35\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32');
      return false;
    }
    lastTry = { v: norm(order.id || order.track || ''), t: Date.now() };
    if (typeof window.__packExpandOrder === 'function') {
      window.__packExpandOrder(order).then(function (o) {
        loadLinesIntoPack(o || order);
      }).catch(function () {
        loadLinesIntoPack(order);
      });
      return true;
    }
    return loadLinesIntoPack(order) > 0;
  }

  function tryFromScan(v, silent) {
    v = String(v || '').trim();
    if (!v) return false;
    var now = Date.now();
    if (lastTry.v === norm(v) && now - lastTry.t < 600) return true;

    var store = loadStore();
    var nKeys = Object.keys(store).length;
    if (!nKeys) {
      if (!silent) toast('\u0e2d\u0e31\u0e1b\u0e42\u0e2b\u0e25\u0e14\u0e44\u0e1f\u0e25\u0e4c BigSeller \u0e01\u0e48\u0e2d\u0e19');
      return false;
    }

    var ord = findOrder(v);
    if (!ord) {
      if (!silent) {
        var short = v.length > 40 ? v.slice(0, 40) + '\u2026' : v;
        toast('\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e43\u0e19\u0e44\u0e1f\u0e25\u0e4c: ' + short);
      }
      return false;
    }
    lastTry = { v: norm(v), t: now };
    return activateOrder(ord);
  }

  window.__bsSaveOrders = saveOrdersFromImport;
  window.__bsFindOrder = findOrder;
  window.__bsTryLoadOrder = tryFromScan;
  window.__packLoadLines = loadLinesIntoPack;
  window.__bsOrderCount = function () {
    var store = loadStore();
    var seen = {};
    Object.keys(store).forEach(function (k) {
      var o = store[k];
      if (o && o.id) seen[o.id] = 1;
      else if (o && o.track) seen[o.track] = 1;
    });
    return Object.keys(seen).length;
  };
  window.__bsClearOrders = function () { localStorage.removeItem(KEY); };
  window.__bsFocusScan = focusScan;
  window.__bsFocusOrder = focusOrder;

  function currentOrderId() {
    var o = document.getElementById('pack-order');
    return norm(o && o.value || '');
  }

  function linesAllDone() {
    var box = document.getElementById('pack-lines');
    if (!box || !box.children.length) return true;
    var rows = box.querySelectorAll('.row-q');
    if (!rows.length) return !box.children.length;
    for (var i = 0; i < rows.length; i++) {
      var parts = (rows[i].textContent || '').split('/');
      var a = parseInt(parts[0], 10) || 0;
      var b = parseInt(parts[1], 10) || 0;
      if (b > 0 && a < b) return false;
    }
    return true;
  }

  function lineCount() {
    var box = document.getElementById('pack-lines');
    return box ? box.children.length : 0;
  }

  /** Auto-switch order when scanning order barcode (no button needed) */
  function handleScanValue(v, silent) {
    v = String(v || '').trim();
    if (!v || v.length < 6) return false;
    var ord = findOrder(v);
    if (!ord) return false;

    var cur = currentOrderId();
    var oid = norm(ord.id || ord.track || ord.packageId || '');
    var same = cur && oid && (cur === oid || cur.indexOf(oid) >= 0 || oid.indexOf(cur) >= 0);

    // Same order still packing → leave for product barcode verify
    if (same && lineCount() > 0 && !linesAllDone()) {
      return false;
    }

    return activateOrder(ord);
  }

  function onOrderValue(v, fromEnter) {
    v = String(v || '').trim();
    if (v.length < 6) return;
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
      }, 100);
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
    if (!input || input.getAttribute('data-bs-bound-v4')) return;
    input.setAttribute('data-bs-bound-v4', '1');
    input.setAttribute('lang', 'en');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('autocomplete', 'off');

    input.addEventListener('input', function () {
      if (scanTimer) clearTimeout(scanTimer);
      scanTimer = setTimeout(function () {
        var v = (input.value || '').trim();
        if (v.length < 6) return;
        if (handleScanValue(v, true)) {
          input.value = '';
          setTimeout(focusScan, 80);
        }
      }, 100);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var v = (input.value || '').trim();
      if (!v) return;
      if (handleScanValue(v, false)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        input.value = '';
        setTimeout(focusScan, 80);
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
        setTimeout(focusScan, 80);
      }
    }
  }, true);

  function wireAll() {
    bindOrderInput();
    bindScanInput();
  }

  setInterval(function () {
    wireAll();
    var page = document.getElementById('page-pack');
    if (!page || !page.classList.contains('active')) return;
    var ae = document.activeElement;
    if (ae && (ae.id === 'pack-scan' || ae.id === 'pack-order' || ae.id === 'pack-csv-file' ||
               ae.id === 'pack-add-sku' || ae.id === 'pack-add-qty' || ae.id === 'pack-session-id')) return;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'SELECT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'BUTTON')) return;
    var box = document.getElementById('pack-lines');
    var n = box ? box.children.length : 0;
    if (n === 0) focusOrder();
    else focusScan();
  }, 500);

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.ni[data-page="pack"]');
    if (!btn) return;
    setTimeout(wireAll, 100);
    setTimeout(focusOrder, 250);
    setTimeout(focusOrder, 600);
  }, true);

  var mo = new MutationObserver(function () {
    if (document.getElementById('pack-order') || document.getElementById('pack-scan')) wireAll();
  });
  if (document.body) mo.observe(document.body, { childList: true, subtree: true });
  else document.addEventListener('DOMContentLoaded', function () {
    mo.observe(document.body, { childList: true, subtree: true });
  });

  setTimeout(wireAll, 600);
  setTimeout(wireAll, 1500);
  setTimeout(focusOrder, 1200);
})();
