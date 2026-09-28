/** pack-csv entry */
(function () {
  function load(src, cb) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = cb || function () {};
    s.onerror = function () { console.error('load fail', src); };
    document.head.appendChild(s);
  }
  load('https://cdn.jsdelivr.net/gh/benz1sa2smanagement-hue/StockFlow-v2@de359b3b8751c301e815a439278ac9afc4470f6d/pack-csv.js', function () {
    load('pack-sku-expand.js?v=3');
  });
})();
