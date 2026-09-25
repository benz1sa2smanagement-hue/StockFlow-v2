/**
 * Fix unresponsive buttons / unclosable sheets + freeze products list
 */
(function () {
  'use strict';

  function safeOn(id, event, handler) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(event, handler);
  }

  function rebind() {
    safeOn('rec-close', 'click', function (e) {
      e.preventDefault();
      var ov = document.getElementById('rec-ov');
      if (ov) ov.classList.remove('open');
    });
    var recOv = document.getElementById('rec-ov');
    if (recOv && !recOv._fixBound) {
      recOv._fixBound = true;
      recOv.addEventListener('click', function (e) {
        if (e.target === recOv) recOv.classList.remove('open');
      });
    }
    safeOn('od-close', 'click', function (e) {
      e.preventDefault();
      var ov = document.getElementById('od-overlay');
      if (ov) ov.classList.remove('open');
    });
    var od = document.getElementById('od-overlay');
    if (od && !od._fixBound) {
      od._fixBound = true;
      od.addEventListener('click', function (e) {
        if (e.target === od) od.classList.remove('open');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(rebind, 400); });
  } else {
    setTimeout(rebind, 400);
  }
  setTimeout(rebind, 1500);

  /* Products list: stop flicker while user is on products page */
  (function freezeProductsList() {
    var snap = '';
    var lock = false;
    function currentList() { return document.getElementById('prod-list'); }
    function onProducts() {
      var p = document.getElementById('page-products');
      return p && p.classList.contains('active');
    }
    function takeSnap() {
      var el = currentList();
      if (el && el.querySelector('.row[data-sku-id]')) snap = el.innerHTML;
    }
    function restoreIfNeeded() {
      if (lock || !onProducts()) return;
      var el = currentList();
      if (!el || !snap) return;
      if (el.querySelector('.row') && !el.querySelector('.row[data-sku-id]')) {
        lock = true;
        var page = document.getElementById('page-products');
        var y = page ? page.scrollTop : 0;
        el.innerHTML = snap;
        if (page) page.scrollTop = y;
        lock = false;
      } else if (el.querySelector('.row[data-sku-id]')) {
        snap = el.innerHTML;
      }
    }
    var obsTimer = null;
    function watch() {
      var el = currentList();
      if (!el || el._freezeObs) return;
      var obs = new MutationObserver(function () {
        if (lock) return;
        clearTimeout(obsTimer);
        obsTimer = setTimeout(restoreIfNeeded, 0);
      });
      obs.observe(el, { childList: true });
      el._freezeObs = obs;
    }
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('.ni[data-page="products"]');
      if (btn) setTimeout(function () { watch(); takeSnap(); }, 500);
    });
    setInterval(function () {
      if (onProducts()) { watch(); restoreIfNeeded(); }
      else snap = '';
    }, 2000);
    setTimeout(watch, 3000);
  })();
})();
