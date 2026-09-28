/**
 * BigSeller order store + label scan → load pack lines + keep scan focused
 * Fixed: after CSV upload, scan works immediately without mouse click.
 */
(function () {
  'use strict';
  var KEY = 'sf_bs_orders_v1';
  var scanTimer = null;
  var lastTry = { v: '', t: 0 };

  function toast(msg) {
    var w = document.getElementById('toast-wrap');
    if (!w) return;
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    w.innerHTML = '';
    w.appendChild(t);
    setTimeout(function () { t.remove(); }, 3000);
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

  function focusScan() {
    var page = document.getElementById('page-pack');
    if (!page || !page.classList.contains('active')) return;
    var scan = document.getElementById('pack-scan');
    if (!scan) return;
    try {
      scan.setAttribute('lang', 'en');
      scan.setAttribute('spellcheck', 'false');
      scan.setAttribute('autocomplete', 'off');
      scan.setAttribute('inputmode', 'text');
      if (document.activeElement && document.activeElement !== scan &&
          document.activeElement.id !== 'pack-order' &&
          document.activeElement.id !== 'pack-csv-file' &&
          document.activeElement.id !== 'pack-add-sku' &&
          document.activeElement.id !== 'pack-add-qty' &&
          document.activeElement.id !== 'pack-session-id') {
        try { document.activeElement.blur(); } catch (e0) {}
      }
      scan.focus({ preventScroll: true });
    } catch (e) {
      try { scan.focus(); } catch (e2) {}
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
    setTimeout(focusScan, 50);
    setTimeout(focusScan, 200);
    setTimeout(focusScan, 500);
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
    (v.match(/[A-Za-z][A-Za-z0-9\-_]{5,}|[0-9]{8,}/g) || []).forEach(add);
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
      if (k.length < 8) continue;
      for (j = 0; j < storeKeys.length; j++) {
        sk = storeKeys[j];
        if (sk.length < 6) continue;
        if (sk.indexOf(k) >= 0 || k.indexOf(sk) >= 0) return store[sk];
      }
    }
    return null;
  }

  function activateOrder(order) {
    if (!order || !order.lines || !order.lines.length) {
      toast('\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e44\u0e21\u0e48\u0e21\u0e35\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32');
      return false;
    }
    if (typeof window.__packLoadLines === 'function') {
      var ok = window.__packLoadLines(order);
      setTimeout(focusScan, 80);
      setTimeout(focusScan, 300);
      setTimeout(focusScan, 700);
      return !!ok;
    }
    var resetBtn = document.getElementById('pack-reset');
    if (resetBtn) resetBtn.click();
    var o = document.getElementById('pack-order');
    if (o) o.value = order.track || order.packageId || order.id || '';
    if (order.platform) {
      var p = String(order.platform).toLowerCase();
      document.querySelectorAll('#pack-plat button').forEach(function (b) {
        var pp = (b.getAttribute('data-pplat') || '').toLowerCase();
        if (pp && p.indexOf(pp) >= 0) b.click();
      });
    }
    var sel = document.getElementById('pack-add-sku');
    var qtyEl = document.getElementById('pack-add-qty');
    var addBtn = document.getElementById('pack-add-btn');
    var added = 0;
    (order.lines || []).forEach(function (l) {
      if (!sel || !addBtn || !qtyEl) return;
      var has = false;
      for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === l.skuId) has = true;
      }
      if (!has) {
        var opt = document.createElement('option');
        opt.value = l.skuId;
        opt.textContent = l.name || l.skuId;
        sel.appendChild(opt);
      }
      sel.value = l.skuId;
      qtyEl.value = String(l.qty || 1);
      addBtn.click();
      added++;
    });
    var fb = document.getElementById('pack-fb');
    if (fb) {
      fb.style.background = 'var(--ok-soft)';
      fb.style.color = 'var(--ok)';
      fb.textContent = '\u2713 \u0e42\u0e2b\u0e25\u0e14\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c \u00b7 ' + (order.id || '') + ' \u00b7 ' + added + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23 \u2014 \u0e2a\u0e41\u0e01\u0e19\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e44\u0e14\u0e49';
    }
    toast('\u0e42\u0e2b\u0e25\u0e14\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e41\u0e25\u0e49\u0e27 \u00b7 ' + added + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23');
    setTimeout(focusScan, 80);
    setTimeout(focusScan, 300);
    setTimeout(focusScan, 700);
    return added > 0;
  }

  function tryFromScan(v, silent) {
    v = String(v || '').trim();
    if (!v) return false;
    var now = Date.now();
    if (lastTry.v === v && now - lastTry.t < 800) return true;
    var store = loadStore();
    if (!Object.keys(store).length) {
      if (!silent) toast('\u0e2d\u0e31\u0e1b\u0e44\u0e1f\u0e25\u0e4c BigSeller \u0e01\u0e48\u0e2d\u0e19');
      return false;
    }
    var ord = findOrder(v);
    if (!ord) {
      if (!silent) {
        var short = v.length > 36 ? v.slice(0, 36) + '\u2026' : v;
        toast('\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c: ' + short);
      }
      return false;
    }
    lastTry = { v: v, t: now };
    return activateOrder(ord);
  }

  window.__bsSaveOrders = saveOrdersFromImport;
  window.__bsFindOrder = findOrder;
  window.__bsTryLoadOrder = tryFromScan;
  window.__bsOrderCount = function () {
    var store = loadStore();
    var seen = {};
    Object.keys(store).forEach(function (k) {
      var o = store[k];
      if (o && o.id) seen[String(o.id)] = 1;
    });
    return Object.keys(seen).length;
  };
  window.__bsClearOrders = function () { localStorage.removeItem(KEY); };
  window.__bsFocusScan = focusScan;

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var input = e.target;
    if (!input || (input.id !== 'pack-scan' && input.id !== 'pack-order')) return;
    var v = (input.value || '').trim();
    if (!v) return;
    if (tryFromScan(v, false)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      input.value = '';
      setTimeout(focusScan, 40);
      setTimeout(focusScan, 200);
    }
  }, true);

  function bindScanInput() {
    var input = document.getElementById('pack-scan');
    if (!input) return;
    if (!input.getAttribute('data-bs-bound-v2')) {
      input.setAttribute('data-bs-bound-v2', '1');
      input.setAttribute('lang', 'en');
      input.addEventListener('input', function () {
        if (scanTimer) clearTimeout(scanTimer);
        scanTimer = setTimeout(function () {
          var v = (input.value || '').trim();
          if (v.length >= 8) {
            if (tryFromScan(v, true)) {
              input.value = '';
              setTimeout(focusScan, 40);
            }
          }
        }, 120);
      });
      input.addEventListener('blur', function () {
        setTimeout(function () {
          var page = document.getElementById('page-pack');
          if (!page || !page.classList.contains('active')) return;
          var ae = document.activeElement;
          if (!ae) { focusScan(); return; }
          if (ae.id === 'pack-scan' || ae.id === 'pack-order' || ae.id === 'pack-csv-file' ||
              ae.id === 'pack-add-sku' || ae.id === 'pack-add-qty' || ae.id === 'pack-session-id') return;
          if (ae.tagName === 'INPUT' || ae.tagName === 'SELECT' || ae.tagName === 'TEXTAREA') return;
          focusScan();
        }, 80);
      });
    }
  }

  setInterval(function () {
    bindScanInput();
    var page = document.getElementById('page-pack');
    if (!page || !page.classList.contains('active')) return;
    var ae = document.activeElement;
    if (ae && ae.id === 'pack-scan') return;
    if (ae && (ae.id === 'pack-csv-file' || ae.id === 'pack-add-sku' || ae.id === 'pack-add-qty' ||
               ae.id === 'pack-order' || ae.id === 'pack-session-id')) return;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'SELECT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'BUTTON')) return;
    focusScan();
  }, 450);

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.ni[data-page="pack"]');
    if (!btn) return;
    setTimeout(focusScan, 200);
    setTimeout(focusScan, 500);
    setTimeout(focusScan, 1000);
  }, true);

  var mo = new MutationObserver(function () {
    if (document.getElementById('pack-scan')) {
      bindScanInput();
      var page = document.getElementById('page-pack');
      if (page && page.classList.contains('active')) focusScan();
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });

  setTimeout(focusScan, 800);
  setTimeout(bindScanInput, 1000);
})();
