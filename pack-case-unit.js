/**
 * pack-case-unit.js v2
 * สินค้าเดียวรองรับแพ็ค + ลัง
 * เมื่อออเดอร์เป็นลัง → หน่วยแสดงลัง, qty ตามออเดอร์
 */
(function () {
  'use strict';

  function isCaseText(t) {
    t = String(t || '');
    var cleaned = t.replace(/\(\s*\d+\s*\/\s*\u0e25\u0e31\u0e07\s*\)/g, ' ');
    var low = cleaned.toLowerCase();
    if (/\d+\s*\u0e25\u0e31\u0e07/.test(cleaned)) return true;
    if (/(^|[\s\-\/])\u0e25\u0e31\u0e07([\s\-\/]|$)/.test(cleaned)) return true;
    if (/\b\u0e22\u0e01\u0e25\u0e31\u0e07\b/.test(cleaned)) return true;
    if (/\b(case|carton)\b/i.test(low)) return true;
    return false;
  }

  function isCaseOrder(line) {
    if (!line) return false;
    if (line.packAsCase || line.orderUnit === '\u0e25\u0e31\u0e07') return true;
    return isCaseText(
      (line.name || '') + ' ' + (line.unitSku || '') + ' ' + (line.skuId || '') + ' ' +
      (line.rawSku || '') + ' ' + (line.option || '') + ' ' + (line.variation || '') + ' ' +
      (line.variationName || '') + ' ' + (line.spec || '')
    );
  }

  function applyCaseConversion(order, skus) {
    if (!order || !order.lines) return order;
    skus = skus || {};
    order.lines.forEach(function (l) {
      if (!l) return;
      var s = skus[l.skuId] || skus[l.unitSku] || {};
      var asCase = isCaseOrder(l) || isCaseText(l.name) || isCaseText(l.rawSku) ||
        isCaseText(l.option) || isCaseText(l.variation) || isCaseText(l.variationName);
      if (!asCase) return;
      if (l.packAsCase && l._caseApplied) return;

      var orderQty = parseInt(l.orderQty != null ? l.orderQty : l.qty, 10) || 1;
      var ppc = parseInt(s.piecesPerCase, 10) || parseInt(l.piecesPerCase, 10) || 1;

      l.orderQty = orderQty;
      l.packAsCase = true;
      l.orderUnit = '\u0e25\u0e31\u0e07';
      l.piecesPerCase = ppc;
      l.caseBarcode = s.caseBarcode || l.caseBarcode || '';
      l.caseImage = s.caseImage || l.caseImage || '';
      if (l.caseImage) l.image = l.caseImage;
      l.stockQty = orderQty * (ppc >= 2 ? ppc : 1);
      // แสดงเป็นจำนวนลังบนหน้าจอ (ไม่คูณแพ็ค)
      l.qty = orderQty;

      var nm = String(l.name || '');
      if (nm.indexOf('\u0e25\u0e31\u0e07') < 0) {
        l.name = nm + (nm ? ' ' : '') + orderQty + ' \u0e25\u0e31\u0e07';
      }
      l._caseApplied = true;
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
    console.log('[SF] pack-case-unit v2 ready');
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
