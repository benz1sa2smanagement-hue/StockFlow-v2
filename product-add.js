/**
 * Loader: load working product-add (gallery pick, no forced camera)
 * Source: commit ae323755 — visible file input, empty MIME OK
 */
(function () {
  var src = 'https://cdn.jsdelivr.net/gh/benz1sa2smanagement-hue/StockFlow-v2@ae32375574d529d1c5849ce620e08b3e6dc014e9/product-add.js';
  var s = document.createElement('script');
  s.src = src;
  s.async = false;
  s.onload = function () {
    console.log('[SF] product-add restored from ae323755');
    if (typeof window.__sfEnsureAddProduct === 'function') window.__sfEnsureAddProduct();
  };
  s.onerror = function () { console.warn('[SF] product-add load failed'); };
  document.head.appendChild(s);
})();
