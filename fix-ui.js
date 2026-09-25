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

  function ensureOdOverlay() {
    if (document.getElementById('od-overlay')) return;
    var div = document.createElement('div');
    div.className = 'ov';
    div.id = 'od-overlay';
    div.innerHTML = '<div class="sheet" style="max-height:92vh">' +
      '<div class="sheet-h"><div class="sheet-t">\u0e08\u0e48\u0e32\u0e22\u0e2d\u0e2d\u0e01 \u00b7 \u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14</div>' +
      '<button type="button" class="sheet-x" id="od-close">\u2715</button></div>' +
      '<div class="od-date">' +
      '<button type="button" class="od-db" id="od-prev">\u2039</button>' +
      '<div class="od-dl" id="od-date-label">\u2014</div>' +
      '<button type="button" class="od-db" id="od-next">\u203a</button>' +
      '<button type="button" class="od-today" id="od-today">\u0e27\u0e31\u0e19\u0e19\u0e35\u0e49</button></div>' +
      '<div class="od-kpi">' +
      '<div class="od-k bad"><div class="od-kv" id="od-total">0</div><div class="od-kl">\u0e0a\u0e34\u0e49\u0e19\u0e17\u0e35\u0e48\u0e08\u0e48\u0e32\u0e22</div></div>' +
      '<div class="od-k"><div class="od-kv" id="od-skucount">0</div><div class="od-kl">SKU</div></div></div>' +
      '<div class="od-sec">\u0e15\u0e32\u0e21\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32</div><div class="od-ch"><canvas id="ch-out-bar"></canvas></div>' +
      '<div class="od-sec">\u0e2a\u0e31\u0e14\u0e2a\u0e48\u0e27\u0e19</div><div class="od-ch" style="height:180px"><canvas id="ch-out-pie"></canvas></div>' +
      '<div class="od-sec">\u0e15\u0e32\u0e21\u0e41\u0e1e\u0e25\u0e15\u0e1f\u0e2d\u0e23\u0e4c\u0e21</div><div class="od-ch" style="height:180px"><canvas id="ch-out-plat"></canvas></div>' +
      '<div class="od-sec">\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23</div><div id="od-list"><div class="empty">\u0e01\u0e33\u0e25\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14\u2026</div></div></div>';
    document.body.appendChild(div);
  }

  function bindOnce(el, type, fn, key) {
    if (!el) return;
    var mark = 'data-fix-' + key;
    if (el.getAttribute(mark)) return;
    el.setAttribute(mark, '1');
    el.addEventListener(type, fn);
  }

  function wire() {
    ensureOdOverlay();

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
