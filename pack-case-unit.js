/**
 * pack-case-unit.js
 * สินค้าเดียวรองรับแพ็ค + ลัง (ไม่ต้องแยก SKU)
 * - piecesPerCase: จำนวนแพ็คใน 1 ลัง (เช่น 4)
 * - caseBarcode: บาร์โค้ดลัง
 * - caseImage: รูปลัง
 * เมื่อออเดอร์เป็น "1 ลัง" → แปลงเป็น N แพ็คอัตโนมัติ
 */
(function () {
  'use strict';

  function isCaseText(t) {
    t = String(t || '').toLowerCase();
    return t.indexOf('\u0e25\u0e31\u0e07') >= 0 ||
      t.indexOf('\u0e22\u0e01\u0e25\u0e31\u0e07') >= 0 ||
      /\b(case|carton)\b/i.test(t);
  }

  function isCaseOrder(line) {
    if (!line) return false;
    return isCaseText(
      (line.name || '') + ' ' + (line.unitSku || '') + ' ' + (line.skuId || '') + ' ' +
      (line.rawSku || '') + ' ' + (line.option || '') + ' ' + (line.variation || '') + ' ' +
      (line.variationName || '')
    );
  }

  function applyCaseConversion(order, skus) {
    if (!order || !order.lines) return order;
    skus = skus || {};
    order.lines.forEach(function (l) {
      if (!l || !l.matched) return;
      var s = skus[l.skuId] || {};
      var ppc = parseInt(s.piecesPerCase, 10) || 1;
      if (ppc < 2) return;
      if (!isCaseOrder(l) && !isCaseText(l.name) && !isCaseText(l.rawSku)) return;
      if (l.packAsCase) return;
      var orderQty = parseInt(l.orderQty != null ? l.orderQty : l.qty, 10) || 1;
      l.orderQty = orderQty;
      l.qty = orderQty * ppc;
      l.packAsCase = true;
      l.piecesPerCase = ppc;
      l.orderUnit = '\u0e25\u0e31\u0e07';
      l.caseBarcode = s.caseBarcode || l.caseBarcode || '';
      l.caseImage = s.caseImage || '';
      if (s.caseImage) l.image = s.caseImage;
    });
    return order;
  }

  function wrap() {
    if (window.__packCaseUnitWrapped) return;

    function getSkusThen(fn) {
      var DB = 'https://kiyomi-b19d0-default-rtdb.asia-southeast1.firebasedatabase.app';
      var ws = sessionStorage.getItem('sf_session_ws') || '';
      var room = localStorage.getItem('sf_room_' + ws) || 'WH_A';
      if (!ws) { fn({}); return; }
      fetch(DB + '/ws_' + ws + '/rooms/' + room + '/skus.json', { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (d) { fn(d || {}); })
        .catch(function () { fn({}); });
    }

    var origSilent = window.__packExpandOrderSilent;
    if (typeof origSilent === 'function') {
      window.__packExpandOrderSilent = function (order) {
        return origSilent(order).then(function (o) {
          return new Promise(function (resolve) {
            getSkusThen(function (skus) {
              applyCaseConversion(o || order, skus);
              resolve(o || order);
            });
          });
        });
      };
    }

    var origExpand = window.__packExpandOrder;
    if (typeof origExpand === 'function') {
      window.__packExpandOrder = function (order) {
        return origExpand(order).then(function (o) {
          return new Promise(function (resolve) {
            getSkusThen(function (skus) {
              applyCaseConversion(o || order, skus);
              resolve(o || order);
            });
          });
        });
      };
    }

    var tries = 0;
    function wrapLoad() {
      if (typeof window.__packLoadLines === 'function' && !window.__packLoadLines._case) {
        var origLoad = window.__packLoadLines;
        window.__packLoadLines = function (order) {
          getSkusThen(function (skus) {
            applyCaseConversion(order, skus);
            origLoad(order);
          });
        };
        window.__packLoadLines._case = true;
        return true;
      }
      if (++tries < 40) setTimeout(wrapLoad, 200);
      return false;
    }
    wrapLoad();
    window.__packCaseUnitWrapped = true;
    console.log('[SF] pack-case-unit ready');
  }

  var n = 0;
  function boot() {
    if (typeof window.__packExpandOrderSilent === 'function' || typeof window.__packLoadLines === 'function') {
      wrap();
      return;
    }
    if (++n < 50) setTimeout(boot, 150);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 500);
  setTimeout(boot, 1500);

  window.__packApplyCaseConversion = applyCaseConversion;
  window.__packIsCaseOrder = isCaseOrder;
})();
