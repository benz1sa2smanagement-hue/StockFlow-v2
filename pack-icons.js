/**
 * Minimal line icons on Pack section headers
 */
(function () {
  'use strict';
  var STYLE = 'pack-icon-style';

  function svg(path) {
    return '<svg class="pack-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  }

  var ICONS = {
    upload: svg('<path d="M12 16V4M8 8l4-4 4 4"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>'),
    cloud: svg('<path d="M18 17a4 4 0 0 0-1-7.9A5 5 0 0 0 7 10a4 4 0 0 0 1 7"/><path d="M12 12v6M9 15l3 3 3-3"/>'),
    queue: svg('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
    history: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    map: svg('<path d="M4 7l6-3 6 3 4-2v14l-4 2-6-3-6 3V5z"/><path d="M10 4v14M16 7v14"/>'),
    scan: svg('<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M8 12h8"/>'),
    box: svg('<path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3.3 7.5 12 12l8.7-4.5M12 12v9"/>')
  };

  function ensureStyle() {
    if (document.getElementById(STYLE)) return;
    var s = document.createElement('style');
    s.id = STYLE;
    s.textContent = '.pack-ico{display:inline-block;vertical-align:-2px;margin-right:6px;opacity:.72;flex-shrink:0}';
    document.head.appendChild(s);
  }

  function prefix(el, iconHtml) {
    if (!el || el.getAttribute('data-ico')) return;
    el.setAttribute('data-ico', '1');
    el.innerHTML = iconHtml + el.innerHTML;
  }

  function apply() {
    ensureStyle();
    [
      ['#pack-csv-panel > div:first-child', 'upload'],
      ['#pack-bs-bridge > div:first-child', 'cloud'],
      ['#pack-queue-panel > div:first-child > div:first-child', 'queue'],
      ['#pack-history-panel > div:first-child', 'history'],
      ['#pack-map-panel > div:first-child > div:first-child', 'map']
    ].forEach(function (pair) {
      var el = document.querySelector(pair[0]);
      if (el) prefix(el, ICONS[pair[1]] || ICONS.box);
    });
    document.querySelectorAll('#page-pack label, #page-pack .card-h span, #page-pack .pt').forEach(function (el) {
      var t = (el.textContent || '').trim();
      if (el.getAttribute('data-ico')) return;
      if (t.indexOf('\u0e2a\u0e41\u0e01\u0e19\u0e43\u0e1a\u0e1b\u0e30\u0e2b\u0e19\u0e49\u0e32') >= 0 || t.indexOf('TRACKING') >= 0) prefix(el, ICONS.scan);
      if (t.indexOf('\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e41\u0e1e\u0e47\u0e01') >= 0) prefix(el, ICONS.box);
    });
  }

  function wire() {
    if (document.getElementById('page-pack')) apply();
  }
  setTimeout(wire, 1000);
  setTimeout(wire, 2500);
  setInterval(function () {
    var page = document.getElementById('page-pack');
    if (page && page.classList.contains('active')) apply();
  }, 3000);
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.ni[data-page="pack"]');
    if (btn) setTimeout(wire, 300);
  });
})();
