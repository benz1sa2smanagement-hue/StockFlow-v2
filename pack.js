/** PackGuard bootstrap - loads pack-core.js */
(function () {
  var s = document.createElement('script');
  s.src = 'pack-core.js?v=0928e';
  s.onerror = function () { console.error('pack-core.js failed to load'); };
  document.head.appendChild(s);
})();
