/**
 * pack-visual: load original then patch file picker to allow gallery (no capture)
 */
(function () {
  var src = 'https://cdn.jsdelivr.net/gh/benz1sa2smanagement-hue/StockFlow-v2@ae32375574d529d1c5849ce620e08b3e6dc014e9/pack-visual.js';
  var s = document.createElement('script');
  s.src = src;
  s.async = false;
  s.onload = function () {
    console.log('[SF] pack-visual base loaded');
    // Patch: intercept createElement for file inputs
    var orig = document.createElement.bind(document);
    document.createElement = function (tag) {
      var el = orig(tag);
      if (String(tag).toLowerCase() === 'input') {
        var _set = el.setAttribute.bind(el);
        el.setAttribute = function (name, val) {
          if (String(name).toLowerCase() === 'capture') return; // block capture
          return _set(name, val);
        };
      }
      return el;
    };
    // Also strip any existing
    setInterval(function () {
      document.querySelectorAll('input[type=file][capture]').forEach(function (el) {
        el.removeAttribute('capture');
      });
    }, 500);
  };
  document.head.appendChild(s);
})();
