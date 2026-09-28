/**
 * BigSeller order store + shipping-label / QR scan → load pack lines
 */
(function () {
  'use strict';
  var KEY = 'sf_bs_orders_v1';
  var scanTimer = null;

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
    return n;
  }

  function extractCandidates(raw) {
    var out = [];
    var seen = {};
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

    if (/^https?:\/\//i.test(v) || v.indexOf('www.') === 0 || v.indexOf('spx.') >= 0 || v.indexOf('shopee') >= 0) {
      try {
        var urlStr = /^https?:\/\//i.test(v) ? v : ('https://' + v.replace(/^\/\//, ''));
        var u = new URL(urlStr);
        u.pathname.split('/').forEach(function (p) {
          try { add(decodeURIComponent(p)); } catch (e) { add(p); }
        });
        u.searchParams.forEach(function (val) { add(val); });
        if (u.hash) add(u.hash.replace(/^#/, ''));
      } catch (e) {}
    }

    var tokens = v.match(/[A-Za-z][A-Za-z0-9\-_]{5,}|[0-9]{8,}/g) || [];
    tokens.forEach(add);
    add(v.replace(/[^A-Za-z0-9]/g, ''));
    return out;
  }

  function findOrder(code) {
    var store = loadStore();
    var storeKeys = Object.keys(store);
    if (!storeKeys.length) return null;

    var candidates = extractCandidates(code);
    var i, j, cand, k, k2;

    for (i = 0; i < candidates.length; i++) {
      cand = candidates[i];
      k = norm(cand);
      if (store[k]) return store[k];
      k2 = k.replace(/[^A-Z0-9]/g, '');
      if (store[k2]) return store[k2];
    }

    for (i = 0; i < candidates.length; i++) {
      k = norm(candidates[i]).replace(/[^A-Z0-9]/g, '');
      if (k.length < 8) continue;
      for (j = 0; j < storeKeys.length; j++) {
        var sk = storeKeys[j];
        if (sk.length < 6) continue;
        if (sk.indexOf(k) >= 0 || k.indexOf(sk) >= 0) return store[sk];
      }
    }
    return null;
  }

  function activateOrder(order) {
    if (!order || !order.lines || !order.lines.length) {
      toast('\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e19\u0e35\u0e49\u0e44\u0e21\u0e48\u0e21\u0e35\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e17\u0e35\u0e48\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48');
      return false;
    }
    if (typeof window.__packLoadLines === 'function') {
      window.__packLoadLines(order);
      return true;
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
      fb.textContent = '\u2713 \u0e42\u0e2b\u0e25\u0e14\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c \u00b7 ' + (order.id || '') + ' \u00b7 ' + added + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23';
    }
    toast('\u0e42\u0e2b\u0e25\u0e14\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e41\u0e25\u0e49\u0e27 \u00b7 \u0e2a\u0e41\u0e01\u0e19\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e44\u0e14\u0e49');
    var scan = document.getElementById('pack-scan');
    if (scan) setTimeout(function () { try { scan.focus(); } catch (e) {} }, 150);
    return added > 0;
  }

  function tryFromScan(v, silent) {
    v = String(v || '').trim();
    if (!v) return false;
    var store = loadStore();
    if (!Object.keys(store).length) {
      if (!silent) toast('\u0e2d\u0e31\u0e1b\u0e44\u0e1f\u0e25\u0e4c BigSeller \u0e01\u0e48\u0e2d\u0e19 \u0e08\u0e36\u0e07\u0e08\u0e30\u0e2a\u0e41\u0e01\u0e19\u0e43\u0e1a\u0e1b\u0e30\u0e2b\u0e19\u0e49\u0e32\u0e44\u0e14\u0e49');
      return false;
    }
    var ord = findOrder(v);
    if (!ord) {
      if (!silent) {
        var short = v.length > 40 ? v.slice(0, 40) + '\u2026' : v;
        toast('\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c: ' + short);
      }
      return false;
    }
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
      else if (o && o.track) seen[String(o.track)] = 1;
    });
    return Object.keys(seen).length;
  };
  window.__bsClearOrders = function () { localStorage.removeItem(KEY); };

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
    }
  }, true);

  function bindScanInput() {
    var input = document.getElementById('pack-scan');
    if (!input || input.getAttribute('data-bs-bound')) return;
    input.setAttribute('data-bs-bound', '1');
    input.addEventListener('input', function () {
      if (scanTimer) clearTimeout(scanTimer);
      scanTimer = setTimeout(function () {
        var v = (input.value || '').trim();
        if (v.length >= 10 && (v.indexOf('http') >= 0 || (/[A-Za-z]{2,}/.test(v) && v.length >= 12))) {
          if (tryFromScan(v, true)) input.value = '';
        }
      }, 280);
    });
  }

  setInterval(bindScanInput, 1000);
  setTimeout(bindScanInput, 500);
})();
