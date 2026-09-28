/** PackGuard - load last known-good module */
(function () {
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/gh/benz1sa2smanagement-hue/StockFlow-v2@fb26f2cd1810aa517fd0b781c5869e2156187c4e/pack.js';
  s.onerror = function () {
    console.error('pack.js CDN load failed');
  };
  document.head.appendChild(s);
})();
