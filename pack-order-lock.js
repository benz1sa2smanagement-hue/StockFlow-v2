/**
 * pack-order-lock.js
 * ห้ามสแกน/โหลดออเดอร์ใหม่ จนกว่าจะแพ็กครบจำนวนของออเดอร์ปัจจุบัน
 */
(function () {
  'use strict';

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

  function norm(v) {
    return String(v || '').trim().toUpperCase().replace(/\s+/g, '');
  }

  function currentOrderId() {
    var o = document.getElementById('pack-order');
    return norm(o && o.value || '');
  }

  function remainingSummary() {
    var box = document.getElementById('pack-lines');
    if (!box) return { count: 0, remain: 0, total: 0, done: true };
    var remain = 0;
    var total = 0;
    var count = 0;

    var plus = box.querySelectorAll('.plu');
    if (plus.length) {
      for (var i = 0; i < plus.length; i++) {
        count++;
        var q = parseInt(plus[i].getAttribute('data-qty'), 10) || 0;
        var sc = parseInt(plus[i].getAttribute('data-scanned'), 10) || 0;
        var rem = parseInt(plus[i].getAttribute('data-remain'), 10);
        if (isNaN(rem)) rem = Math.max(0, q - sc);
        total += q;
        remain += rem;
      }
      return { count: count, remain: remain, total: total, done: remain <= 0 && total > 0 };
    }

    var rows = box.querySelectorAll('.row-q');
    for (var j = 0; j < rows.length; j++) {
      count++;
      var parts = (rows[j].textContent || '').replace(/[^\d\/]/g, '').split('/');
      var a = parseInt(parts[0], 10) || 0;
      var b = parseInt(parts[1], 10) || 0;
      total += b;
      if (b > 0 && a < b) remain += (b - a);
    }
    return { count: count, remain: remain, total: total, done: remain <= 0 && (total > 0 || count === 0) };
  }

  function hasActiveIncompleteOrder() {
    var s = remainingSummary();
    if (s.count > 0 && s.remain > 0) return s;
    return null;
  }

  function sameOrder(code) {
    var cur = currentOrderId();
    var n = norm(code);
    if (!cur || !n) return false;
    if (cur === n) return true;
    if (cur.indexOf(n) >= 0 || n.indexOf(cur) >= 0) return true;
    return false;
  }

  function orderCodeFromArg(arg) {
    if (!arg) return '';
    if (typeof arg === 'string') return arg;
    if (typeof arg === 'object') {
      return arg.track || arg.packageId || arg.id || arg.platformOrder || arg.orderNo || '';
    }
    return '';
  }

  function blockMsg(s) {
    var cur = currentOrderId() || '\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e1b\u0e31\u0e08\u0e08\u0e38\u0e1a\u0e31\u0e19';
    return '\u26a0 \u0e2a\u0e41\u0e01\u0e19\u0e43\u0e2b\u0e49\u0e04\u0e23\u0e1a\u0e01\u0e48\u0e2d\u0e19 \u2014 \u0e40\u0e2b\u0e25\u0e37\u0e2d ' + s.remain + '/' + s.total +
      ' \u00b7 ' + cur;
  }

  function guardNewOrder(code, silent) {
    var s = hasActiveIncompleteOrder();
    if (!s) return true;
    if (sameOrder(code)) return true;
    if (!silent) {
      toast(blockMsg(s));
      if (typeof window.__packScanStatus === 'function') {
        window.__packScanStatus(blockMsg(s), 'bad');
      }
      try { if (navigator.vibrate) navigator.vibrate([60, 40, 60]); } catch (e) {}
    }
    setTimeout(function () {
      var scan = document.getElementById('pack-scan');
      if (scan) try { scan.focus(); } catch (e) {}
    }, 50);
    return false;
  }

  function wrap() {
    if (typeof window.__bsTryLoadOrder === 'function' && !window.__bsTryLoadOrder._orderLock) {
      var origTry = window.__bsTryLoadOrder;
      window.__bsTryLoadOrder = function (v, silent) {
        if (!guardNewOrder(v, silent)) return false;
        return origTry(v, silent);
      };
      window.__bsTryLoadOrder._orderLock = true;
    }

    if (typeof window.__packLoadLines === 'function' && !window.__packLoadLines._orderLock) {
      var origLoad = window.__packLoadLines;
      window.__packLoadLines = function (order) {
        var code = orderCodeFromArg(order);
        if (!guardNewOrder(code, false)) return 0;
        return origLoad(order);
      };
      window.__packLoadLines._orderLock = true;
    }
  }

  function bindOrderInputGuard() {
    var orderEl = document.getElementById('pack-order');
    if (!orderEl || orderEl._lockBound) return;
    orderEl._lockBound = true;

    orderEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var s = hasActiveIncompleteOrder();
        var v = (orderEl.value || '').trim();
        if (s && v && !sameOrder(v)) {
          e.preventDefault();
          e.stopPropagation();
          toast(blockMsg(s));
        }
      }
    }, true);
  }

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.pack-queue-item');
    if (!btn) return;
    var s = hasActiveIncompleteOrder();
    if (!s) return;
    var key = btn.getAttribute('data-key') || '';
    if (sameOrder(key)) return;
    e.preventDefault();
    e.stopPropagation();
    toast(blockMsg(s));
  }, true);

  function boot() {
    wrap();
    bindOrderInputGuard();
  }

  var tries = 0;
  function tryBoot() {
    boot();
    if ((!window.__bsTryLoadOrder || !window.__bsTryLoadOrder._orderLock) && ++tries < 50) {
      setTimeout(tryBoot, 200);
    }
  }
  tryBoot();
  setInterval(function () {
    wrap();
    bindOrderInputGuard();
  }, 2500);

  window.__packHasIncompleteOrder = hasActiveIncompleteOrder;
  window.__packGuardNewOrder = guardNewOrder;
  console.log('[SF] pack-order-lock ready');
})();
