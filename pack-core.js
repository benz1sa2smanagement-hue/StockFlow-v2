/** pack-core fallback → known-good module */
(function () {
  if (window.__packShow) return;
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/gh/benz1sa2smanagement-hue/StockFlow-v2@fb26f2cd1810aa517fd0b781c5869e2156187c4e/pack.js';
  document.head.appendChild(s);
})();
