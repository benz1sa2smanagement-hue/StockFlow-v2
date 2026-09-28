/**
 * Mobile convenience + watch-only mode + bottom nav scroll clearance
 */
(function () {
  'use strict';
  var STYLE_ID = 'pack-mobile-style';
  var PAD_STYLE_ID = 'pack-scroll-pad-style';
  var WATCH_KEY = 'sf_pack_watch_only';

  function navHeight() {
    var nav = document.querySelector('.nav') || document.querySelector('nav') || document.getElementById('nav');
    if (nav) {
      var h = nav.getBoundingClientRect().height;
      if (h > 40) return Math.ceil(h);
    }
    // fallback: CSS var --nav (76) + safe area
    var cs = getComputedStyle(document.documentElement);
    var base = parseInt(cs.getPropertyValue('--nav'), 10) || 76;
    var sb = 0;
    try {
      var probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;visibility:hidden;padding-bottom:env(safe-area-inset-bottom,0px)';
      document.body.appendChild(probe);
      sb = parseInt(getComputedStyle(probe).paddingBottom, 10) || 0;
      probe.remove();
    } catch (e) {}
    return base + sb;
  }

  function ensureScrollPad() {
    var pad = navHeight() + 48; // nav + breathing room
    var s = document.getElementById(PAD_STYLE_ID);
    if (!s) {
      s = document.createElement('style');
      s.id = PAD_STYLE_ID;
      document.head.appendChild(s);
    }
    s.textContent =
      '.page,.page.active,#page-pack{' +
      'padding-bottom:' + pad + 'px !important;' +
      'scroll-padding-bottom:' + pad + 'px !important;' +
      '}' +
      '#page-pack > *:last-child{margin-bottom:24px !important;}' +
      '#pack-history-panel,#pack-map-panel,#pack-queue-panel,' +
      '#page-pack .card:last-of-type{margin-bottom:20px !important;}';

    // also set inline on active pack page for stubborn browsers
    var page = document.getElementById('page-pack');
    if (page) {
      page.style.paddingBottom = pad + 'px';
      page.style.scrollPaddingBottom = pad + 'px';
    }
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent =
      '@media (max-width:720px){' +
      '#page-pack input[type=text],#page-pack input[type=search],#pack-order,#pack-scan{font-size:16px!important;min-height:48px;}' +
      '#page-pack .btn,#page-pack button.btn,#pack-complete,#pack-bs-pull{min-height:48px!important;font-size:15px!important;}' +
      '#pack-queue-list button{min-height:52px;}' +
      '#pack-csv-panel label{min-height:52px;}' +
      '}';
    document.head.appendChild(s);
  }

  function ensureWatchToggle() {
    var page = document.getElementById('page-pack');
    if (!page || document.getElementById('pack-watch-wrap')) return;
    var wrap = document.createElement('label');
    wrap.id = 'pack-watch-wrap';
    wrap.style.cssText = 'display:flex;align-items:center;gap:8px;margin:0 0 12px;padding:10px 12px;border-radius:12px;background:#f8fafc;border:1px solid var(--line,#e5e7eb);font-size:13px;cursor:pointer';
    var checked = localStorage.getItem(WATCH_KEY) === '1';
    wrap.innerHTML =
      '<input type="checkbox" id="pack-watch-only" ' + (checked ? 'checked' : '') + ' style="width:18px;height:18px">' +
      '<span><b>\u0e42\u0e2b\u0e21\u0e14\u0e08\u0e2d\u0e14\u0e39\u0e2d\u0e22\u0e48\u0e32\u0e07\u0e40\u0e14\u0e35\u0e22\u0e27</b> \u2014 \u0e21\u0e37\u0e2d\u0e16\u0e37\u0e2d\u0e14\u0e39\u0e16\u0e39\u0e01/\u0e1c\u0e34\u0e14 \u0e44\u0e21\u0e48\u0e41\u0e22\u0e48\u0e07\u0e42\u0e1f\u0e01\u0e31\u0e2a\u0e2a\u0e41\u0e01\u0e19</span>';
    var title = page.querySelector('.pt');
    if (title && title.nextSibling) page.insertBefore(wrap, title.nextSibling);
    else page.insertBefore(wrap, page.firstChild);
    document.getElementById('pack-watch-only').addEventListener('change', function (e) {
      localStorage.setItem(WATCH_KEY, e.target.checked ? '1' : '0');
      applyWatch(e.target.checked);
    });
    applyWatch(checked);
  }

  function applyWatch(on) {
    window.__packWatchOnly = !!on;
    if (on) {
      window.__packFocusScan = function () {};
      window.__packAfterCsvImport = function () {};
    }
    var oe = document.getElementById('pack-order');
    var sc = document.getElementById('pack-scan');
    if (oe) oe.readOnly = !!on;
    if (sc) sc.readOnly = !!on;
  }

  function wire() {
    ensureStyle();
    ensureScrollPad();
    var page = document.getElementById('page-pack');
    if (!page) return;
    ensureWatchToggle();
  }

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.ni[data-page="pack"]');
    if (btn) setTimeout(wire, 200);
  });

  window.addEventListener('resize', function () {
    ensureScrollPad();
  });
  window.addEventListener('orientationchange', function () {
    setTimeout(ensureScrollPad, 200);
  });

  setTimeout(wire, 400);
  setTimeout(wire, 1200);
  setTimeout(wire, 3000);
  // re-apply after late panels inject
  setInterval(function () {
    var page = document.getElementById('page-pack');
    if (page && (page.classList.contains('active') || page.offsetParent !== null)) {
      ensureScrollPad();
    }
  }, 2500);
})();
