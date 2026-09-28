/**
 * Generic multi-pack expand for ALL brands:
 * KLM-3PACK, PULL-2PACK, ANY-6BOX → single-unit product × N
 */
(function () {
  'use strict';
  var DB = 'https://kiyomi-b19d0-default-rtdb.asia-southeast1.firebasedatabase.app';

  function wsKey() { return sessionStorage.getItem('sf_session_ws') || ''; }
  function roomId() { return localStorage.getItem('sf_room_' + wsKey()) || 'WH_A'; }

  function getSkus() {
    return new Promise(function (resolve) {
      var ws = wsKey();
      if (!ws) { resolve({}); return; }
      fetch(DB + '/ws_' + ws + '/rooms/' + roomId() + '/skus.json', { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (d) { resolve(d || {}); })
        .catch(function () { resolve({}); });
    });
  }

  function norm(s) {
    return String(s || '').trim().toUpperCase().replace(/\s+/g, '').replace(/^-+/, '').replace(/^-?\d+-/, '');
  }

  function parseMulti(raw) {
    var su = norm(raw);
    var m = su.match(/^(.+?)-(\d+)(PACK|BOX|PCS|PIECE|UNIT)S?$/i);
    if (m) {
      return {
        mul: parseInt(m[2], 10) || 1,
        base: m[1],
        unit: m[3].toUpperCase(),
        tries: [m[1] + '-1' + m[3].toUpperCase(), m[1] + '-1PACK', m[1] + '-PACK', m[1] + '1PACK', m[1], su]
      };
    }
    m = su.match(/^([A-Z]+)(\d+)(PACK|BOX)S?$/i);
    if (m) {
      return {
        mul: parseInt(m[2], 10) || 1,
        base: m[1],
        unit: m[3].toUpperCase(),
        tries: [m[1] + '-1' + m[3].toUpperCase(), m[1] + '-1PACK', m[1], su]
      };
    }
    return { mul: 1, base: su, unit: 'PACK', tries: [su] };
  }

  function findProduct(tries, skus) {
    var keys = Object.keys(skus || {});
    for (var t = 0; t < tries.length; t++) {
      var su = tries[t];
      if (!su) continue;
      if (skus[su]) return { id: su, s: skus[su] };
      for (var i = 0; i < keys.length; i++) {
        var id = keys[i];
        var s = skus[id] || {};
        var cands = [s.unitSku, s.sku, id].map(norm);
        if (cands.indexOf(su) >= 0) return { id: id, s: s };
        for (var c = 0; c < cands.length; c++) {
          if (!cands[c] || cands[c].length < 2) continue;
          if (cands[c] === su || cands[c].indexOf(su + '-') === 0 || su.indexOf(cands[c] + '-') === 0) {
            return { id: id, s: s };
          }
        }
      }
    }
    return null;
  }

  function expandLine(line, skus) {
    if (!line) return line;
    var src = line.unitSku || line.name || line.skuId || '';
    var parsed = parseMulti(src);
    var hit = findProduct(parsed.tries, skus);
    if (!hit) return line;
    return {
      skuId: hit.id,
      name: hit.s.name || hit.id,
      qty: (parseInt(line.qty, 10) || 1) * (parsed.mul > 1 ? parsed.mul : 1),
      unitSku: hit.s.unitSku || parsed.tries[0],
      barcode: hit.s.barcode || line.barcode || ''
    };
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

  function patch() {
    if (typeof window.__bsSaveOrders !== 'function') return false;
    if (window.__bsSaveOrders._genExp) return true;
    var orig = window.__bsSaveOrders;
    window.__bsSaveOrders = function (orders) {
      getSkus().then(function (skus) {
        (orders || []).forEach(function (o) { expandOrder(o, skus); });
        orig(orders);
      });
      return (orders || []).length;
    };
    window.__bsSaveOrders._genExp = true;

    if (typeof window.__bsTryLoadOrder === 'function' && !window.__bsTryLoadOrder._genExp) {
      var origTry = window.__bsTryLoadOrder;
      window.__bsTryLoadOrder = function (v, silent) {
        var ord = typeof window.__bsFindOrder === 'function' ? window.__bsFindOrder(v) : null;
        if (!ord) return origTry(v, silent);
        getSkus().then(function (skus) {
          expandOrder(ord, skus);
          try {
            var store = JSON.parse(localStorage.getItem('sf_bs_orders_v1') || '{}');
            Object.keys(store).forEach(function (k) {
              if (store[k] && (store[k].id === ord.id || store[k].track === ord.track)) store[k] = ord;
            });
            localStorage.setItem('sf_bs_orders_v1', JSON.stringify(store));
          } catch (e) {}
          if (typeof window.__packLoadLines === 'function') window.__packLoadLines(ord);
          else origTry(v, silent);
        });
        return true;
      };
      window.__bsTryLoadOrder._genExp = true;
    }
    return true;
  }

  var n = 0;
  var iv = setInterval(function () {
    if (patch() || ++n > 60) clearInterval(iv);
  }, 200);
})();
