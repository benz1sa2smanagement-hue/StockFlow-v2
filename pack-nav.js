/**
 * Pack desktop fix — force Pack tab to open and build UI
 * Load AFTER pack.js
 */
(function () {
  'use strict';

  function forcePackPage(btn) {
    var main = document.querySelector('#app .main');
    if (!main) return;

    var page = document.getElementById('page-pack');
    if (page && !page.querySelector('#pack-scan')) {
      try { page.remove(); } catch (e) {}
      page = null;
    }

    if (typeof window.__packShow === 'function') {
      try { window.__packShow(); } catch (err) { console.warn(err); }
    }

    page = document.getElementById('page-pack');
    if (page) {
      document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
      page.classList.add('active');
    }
    document.querySelectorAll('.ni[data-page]').forEach(function (b) { b.classList.remove('on'); });
    var target = btn || document.querySelector('.ni[data-page="pack"]');
    if (target) target.classList.add('on');

    function focusScan() {
      var scan = document.getElementById('pack-scan');
      if (!scan) return;
      try { scan.focus({ preventScroll: true }); } catch (e) { try { scan.focus(); } catch (e2) {} }
    }
    setTimeout(focusScan, 100);
    setTimeout(focusScan, 400);
    setTimeout(focusScan, 900);
  }

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.ni[data-page="pack"]');
    if (!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    try { forcePackPage(btn); } catch (err) { console.warn('pack-nav', err); }
  }, true);

  window.__forcePackPage = forcePackPage;

  setTimeout(function () {
    document.querySelectorAll('.ni[data-page="pack"]').forEach(function (btn) {
      btn.style.cursor = 'pointer';
      btn.style.pointerEvents = 'auto';
    });
  }, 500);
})();
