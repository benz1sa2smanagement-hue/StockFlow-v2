/**
 * BigSeller order store + shipping-label scan → load pack lines
 */
(function () {
  'use strict';
  var KEY = 'sf_bs_orders_v1';

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

  function findOrder(code) {
    var store = loadStore();
    var k = norm(code);
    if (!k) return null;
    if (store[k]) return store[k];
    var k2 = k.replace(/[^A-Z0-9]/g, '');
    if (store[k2]) return store[k2];
    if (k.length >= 8) {
      var keys = Object.keys(store);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].indexOf(k) >= 0 || k.indexOf(keys[i]) >= 0) {
          if (keys[i].length >= 6) return store[keys[i]];
        }
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

  function tryFromScan(v) {
    var ord = findOrder(v);
    if (!ord) return false;
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
    if (!input || input.id !== 'pack-scan') return;
    var v = (input.value || '').trim();
    if (!v) return;
    if (tryFromScan(v)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      input.value = '';
    }
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var input = e.target;
    if (!input || input.id !== 'pack-order') return;
    var v = (input.value || '').trim();
    if (!v) return;
    if (tryFromScan(v)) {
      e.preventDefault();
      toast('\u0e40\u0e1b\u0e34\u0e14\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e08\u0e32\u0e01\u0e43\u0e1a\u0e1b\u0e30\u0e2b\u0e19\u0e49\u0e32\u0e41\u0e25\u0e49\u0e27');
    }
  }, true);
})();
