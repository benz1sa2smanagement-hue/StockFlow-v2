/**
 * Loader: pack-visual without capture=environment (allow gallery)
 */
(function () {
  var src = 'https://cdn.jsdelivr.net/gh/benz1sa2smanagement-hue/StockFlow-v2@ae32375574d529d1c5849ce620e08b3e6dc014e9/pack-visual.js';
  var s = document.createElement('script');
  s.src = src;
  s.async = false;
  s.onload = function () {
    console.log('[SF] pack-visual loaded');
    // ลบ capture ออกจาก input ที่สร้างตอน runtime
    var _origCreate = document.createElement;
    // patch pickAndUpload path: remove capture when inputs are created
    setInterval(function () {
      document.querySelectorAll('input[type=file][capture]').forEach(function (el) {
        el.removeAttribute('capture');
      });
    }, 1000);
  };
  document.head.appendChild(s);
})();
