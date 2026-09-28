/** pack-csv with generic N-PACK for all brands */
(function () {
  function run(code) {
    var el = document.createElement('script');
    el.textContent = code;
    document.head.appendChild(el);
  }
  function inflate(b64) {
    var bin = atob(b64);
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    function go() { run(pako.inflate(arr, { to: 'string' })); }
    if (window.pako) { go(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js';
    s.onload = go;
    document.head.appendChild(s);
  }
  Promise.all([
    fetch('pack-csv-a.txt?v=5').then(function (r) { return r.text(); }),
    fetch('pack-csv-b.txt?v=5').then(function (r) { return r.text(); })
  ]).then(function (p) {
    inflate(p[0] + p[1]);
  }).catch(function (e) { console.error('pack-csv load', e); });
})();
