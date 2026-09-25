/**
 * Fix UI + stop product list flicker + keep row clicks working
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

  (function blockProdListRewrite() {
    function hook() {
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
          if (page && page.classList.contains('active') && oldHasId && !newHasId) {
            return;
          }
          rawSet.call(this, v);
        }
      });
    }
    setTimeout(hook, 500);
    setTimeout(hook, 1500);
    setTimeout(hook, 3000);
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.ni[data-page="products"]')) {
        setTimeout(hook, 50);
        setTimeout(function () {
          if (typeof window.__reloadProductsBarcode === 'function') {
            window.__reloadProductsBarcode();
          }
        }, 120);
      }
    });
  })();
})();
