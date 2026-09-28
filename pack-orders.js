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

  function orderCount() {
    var store = loadStore();
    var seen = {};
    Object.keys(store).forEach(function (k) {
      var o = store[k];
      if (o && o.id) seen[String(o.id)] = 1;
      else if (o && o.track) seen[String(o.track)] = 1;
    });
    return Object.keys(seen).length;
  }

  function activateOrder(order) {
    if (!order || !order.lines || !order.lines.length) {
      toast('\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e19\u0e35\u0e49\u0e44\u0e21\u0e48\u0e21\u0e35\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e17\u0e35\u0e48\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e44\u0e14\u0e49');
      return false;
    }
    if (typeof window.__packLoadLines === 'function') {
      window.__packLoadLines(order);
      return true;
    }
    toast('\u0e42\u0e21\u0e14\u0e39\u0e25\u0e41\u0e1e\u0e47\u0e01\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e1e\u0e23\u0e49\u0e2d\u0e21 \u0e23\u0e35\u0e40\u0e1f\u0e23\u0e40\u0e0a\u0e2b\u0e19\u0e49\u0e32');
    return false;
  }

  window.__bsSaveOrders = saveOrdersFromImport;
  window.__bsFindOrder = findOrder;
  window.__bsTryLoadOrder = function (code) {
    var order = findOrder(code);
    if (!order) return false;
    return activateOrder(order);
  };
  window.__bsOrderCount = orderCount;
  window.__bsClearOrders = function () { localStorage.removeItem(KEY); };
})();
