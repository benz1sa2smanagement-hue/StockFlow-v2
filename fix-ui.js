/**
 * Fix unresponsive buttons / unclosable sheets
 * Runs after app.js — safe re-bind even if app.js bindUI threw midway
 */
(function () {
  'use strict';

  function closeRec() {
    var el = document.getElementById('rec-ov');
    if (el) el.classList.remove('open');
  }
  function closeOd() {
    var el = document.getElementById('od-overlay');
    if (el) el.classList.remove('open');
  }

  function bindOnce(el, type, fn, key) {
    if (!el) return;
    var mark = 'data-fix-' + key;
    if (el.getAttribute(mark)) return;
    el.setAttribute(mark, '1');
    el.addEventListener(type, fn);
  }

  function wire() {
    bindOnce(document.getElementById('rec-close'), 'click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      closeRec();
    }, 'rec-close');

    bindOnce(document.getElementById('rec-ov'), 'click', function (e) {
      if (e.target === this) closeRec();
    }, 'rec-ov');

    bindOnce(document.getElementById('od-close'), 'click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      closeOd();
    }, 'od-close');

    bindOnce(document.getElementById('od-overlay'), 'click', function (e) {
      if (e.target === this) closeOd();
    }, 'od-ov');

    document.querySelectorAll('.ni[data-page]').forEach(function (btn) {
      bindOnce(btn, 'click', function () {
        var name = btn.getAttribute('data-page');
        document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
        var page = document.getElementById('page-' + name);
        if (page) page.classList.add('active');
        document.querySelectorAll('.ni[data-page]').forEach(function (b) { b.classList.remove('on'); });
        btn.classList.add('on');
        if (name === 'pack' && typeof window.__packShow === 'function') {
          setTimeout(window.__packShow, 30);
        }
      }, 'nav-' + btn.getAttribute('data-page'));
    });

    bindOnce(document, 'keydown', function (e) {
      if (e.key !== 'Escape') return;
      closeRec();
      closeOd();
    }, 'esc');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
  setTimeout(wire, 400);
  setTimeout(wire, 1200);
})();
