/**
 * Expand BigSeller multi-pack SKUs (KLM-3PACK → single pack × 3)
 */
(function () {
  'use strict';

  function expandLine(line, skus) {
    if (!line) return line;
    var raw = String(line.unitSku || '').toUpperCase().replace(/\s+/g, '');
    if (!raw) raw = String(line.name || '').toUpperCase().replace(/\s+/g, '');
    raw = raw.replace(/^-+/, '').replace(/^-?\d+-/, '');
    var m = raw.match(/^(.+?)-(\d+)(PACK|BOX)S?$/i);
    if (!m) return line;
    var mul = parseInt(m[2], 10) || 1;
    if (mul <= 1) return line;
    var base = m[1];
    var unit = m[3].toUpperCase();
    var tries = [base + '-1' + unit, base + '-1PACK', base + '-PACK', base];
    var keys = Object.keys(skus || {});
    for (var t = 0; t < tries.length; t++) {
      var su = tries[t];
      for (var i = 0; i < keys.length; i++) {
        var id = keys[i];
        var s = skus[id] || {};
        var cands = [s.unitSku, s.sku, id].map(function (x) {
          return String(x || '').toUpperCase().replace(/\s+/g, '');
        });
        if (cands.indexOf(su) >= 0 || skus[su]) {
          var sid = skus[su] ? su : id;
          var ss = skus[sid] || s;
          return {
            skuId: sid,
            name: ss.name || sid,
            qty: (parseInt(line.qty, 10) || 1) * mul,
            unitSku: su,
            barcode: ss.barcode || line.barcode || ''
          };
        }
      }
    }
    return line;
  }

  function expandOrder(order, skus) {
    if (!order || !order.lines) return order;
    var lines = order.lines.map(function (l) { return expandLine(l, skus); });
    var merged = [];
    lines.forEach(function (l) {
      var e = merged.find(function (x) { return x.skuId === l.skuId; });
      if (e) e.qty += l.qty;
      else merged.push(Object.assign({}, l));
    });
    order.lines = merged;
    return order;
  }

  function getSkus() {
    return new Promise(function (resolve) {
      var ws = sessionStorage.getItem('sf_session_ws') || '';
      var room = localStorage.getItem('sf_room_' + ws) || 'WH_A';
      if (!ws) { resolve({}); return; }
      var url = 'https://kiyomi-b19d0-default-rtdb.asia-southeast1.firebasedatabase.app/ws_' +
        ws + '/rooms/' + room + '/skus.json';
      fetch(url, { cache: 'no-store' }).then(function (r) { return r.json(); })
        .then(function (d) { resolve(d || {}); })
        .catch(function () { resolve({}); });
    });
  }

  function patch() {
    if (typeof window.__bsSaveOrders !== 'function') return false;
    if (window.__bsSaveOrders._exp) return true;
    var origSave = window.__bsSaveOrders;
    window.__bsSaveOrders = function (orders) {
      getSkus().then(function (skus) {
        (orders || []).forEach(function (o) { expandOrder(o, skus); });
        origSave(orders);
      });
      return (orders || []).length;
    };
    window.__bsSaveOrders._exp = true;

    if (typeof window.__bsFindOrder === 'function' && !window.__bsFindOrder._exp) {
      var origFind = window.__bsFindOrder;
      window.__bsFindOrder = function (code) {
        var ord = origFind(code);
        return ord;
      };
      window.__bsFindOrder._exp = true;
    }
    return true;
  }

  var n = 0;
  var iv = setInterval(function () {
    if (patch() || ++n > 50) clearInterval(iv);
  }, 200);
})();
