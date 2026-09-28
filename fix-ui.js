/**
 * Fix UI: buttons, pack/products nav, product list stability
 */
(function () {
  'use strict';

  function safeOn(id, event, handler) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(event, handler);
  }

  function rebindSheets() {
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

  function rebindNav() {
    document.querySelectorAll('.ni[data-page]').forEach(function (btn) {
      if (btn._navFixed) return;
      btn._navFixed = true;
      btn.addEventListener('click', function (e) {
        var name = btn.getAttribute('data-page');
        if (!name) return;
        if (name === 'pack') {
          if (typeof window.__packShow === 'function') {
            e.preventDefault();
            e.stopPropagation();
            window.__packShow();
          }
          return;
        }
        var page = document.getElementById('page-' + name);
        if (page && !page.classList.contains('active')) {
          document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
          page.classList.add('active');
          document.querySelectorAll('.ni[data-page]').forEach(function (b) { b.classList.remove('on'); });
          btn.classList.add('on');
        }
        if (name === 'products' && typeof window.__reloadProductsBarcode === 'function') {
          setTimeout(window.__reloadProductsBarcode, 100);
        }
      });
    });
  }

  function hookProdList() {
    var el = document.getElementById('prod-list');
    if (!el || el._innerHTMLHooked) return;
    var desc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (!desc || !desc.set) return;
    el._innerHTMLHooked = true;
    var rawSet = desc.set;
    var rawGet = desc.get;
    Object.defineProperty(el, 'innerHTML', {
      configurable: true,
      enumerable: true,
      get: function () { return rawGet.call(this); },
      set: function (v) {
        var page = document.getElementById('page-products');
        var html = String(v == null ? '' : v);
        var newHasId = html.indexOf('data-sku-id') >= 0;
        var oldHasId = !!(this.querySelector && this.querySelector('.row[data-sku-id]'));
        if (page && page.classList.contains('active') && oldHasId && !newHasId) return;
        rawSet.call(this, v);
      }
    });
  }

  function boot() {
    rebindSheets();
    rebindNav();
    hookProdList();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(boot, 300);
      setTimeout(boot, 1200);
    });
  } else {
    setTimeout(boot, 300);
    setTimeout(boot, 1200);
  }
  setTimeout(boot, 3000);
})();
