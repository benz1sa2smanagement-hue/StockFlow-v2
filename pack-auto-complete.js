/**
 * Auto stock-cut when all pack lines are fully scanned
 */
(function () {
  'use strict';
  var firing = false;
  var lastOrder = '';
  var lastFireAt = 0;
  window.__packAutoCompleteEnabled = true;

  function toast(msg) {
    var w = document.getElementById('toast-wrap');
    if (!w) return;
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    w.innerHTML = '';
    w.appendChild(t);
    setTimeout(function () { t.remove(); }, 2800);
  }

  function currentOrder() {
    var o = document.getElementById('pack-order');
    return String(o && o.value || '').trim();
  }

  function allDone() {
    var box = document.getElementById('pack-lines');
    if (!box) return false;
    var rows = box.querySelectorAll('.row-q');
    if (!rows.length) return false;
    for (var i = 0; i < rows.length; i++) {
      var parts = (rows[i].textContent || '').split('/');
      var a = parseInt(parts[0], 10) || 0;
      var b = parseInt(parts[1], 10) || 0;
      if (b <= 0 || a < b) return false;
    }
    return true;
  }

  function tryAutoComplete() {
    if (!window.__packAutoCompleteEnabled) return;
    if (firing) return;
    if (!allDone()) return;

    var btn = document.getElementById('pack-complete');
    if (!btn || btn.disabled) return;
    var t = btn.textContent || '';
    if (t.indexOf('\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e41\u0e25\u0e49\u0e27') >= 0) return;
    if (t.indexOf('\u0e01\u0e33\u0e25\u0e31\u0e07\u0e15\u0e31\u0e14') >= 0) return;

    var ord = currentOrder();
    var now = Date.now();
    if (ord && ord === lastOrder && now - lastFireAt < 8000) return;

    firing = true;
    lastOrder = ord;
    lastFireAt = now;

    var fb = document.getElementById('pack-fb');
    if (fb) {
      fb.style.background = 'var(--ok-soft,#dcfce7)';
      fb.style.color = 'var(--ok,#15803d)';
      fb.textContent = '\u2713 \u0e2a\u0e41\u0e01\u0e19\u0e04\u0e23\u0e1a\u0e41\u0e25\u0e49\u0e27 \u2014 \u0e01\u0e33\u0e25\u0e31\u0e07\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e2d\u0e31\u0e15\u0e42\u0e19\u0e21\u0e31\u0e15\u0e34\u2026';
    }
    toast('\u0e2a\u0e41\u0e01\u0e19\u0e04\u0e23\u0e1a \u2014 \u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e2d\u0e31\u0e15\u0e42\u0e19\u0e21\u0e31\u0e15\u0e34');

    setTimeout(function () {
      try { btn.click(); } catch (e) {}
      setTimeout(function () {
        firing = false;
        if (typeof window.__packQueueRefresh === 'function') window.__packQueueRefresh();
      }, 2500);
    }, 400);
  }

  function watch() {
    var box = document.getElementById('pack-lines');
    if (box && !box._autoObs) {
      var obs = new MutationObserver(function () {
        clearTimeout(box._autoTimer);
        box._autoTimer = setTimeout(tryAutoComplete, 120);
      });
      obs.observe(box, { childList: true, subtree: true, characterData: true });
      box._autoObs = obs;
    }
    var fb = document.getElementById('pack-fb');
    if (fb && !fb._autoObs) {
      var obs2 = new MutationObserver(function () {
        clearTimeout(fb._autoTimer);
        fb._autoTimer = setTimeout(tryAutoComplete, 150);
      });
      obs2.observe(fb, { childList: true, characterData: true, subtree: true });
      fb._autoObs = obs2;
    }
  }

  function ensureToggle() {
    if (document.getElementById('pack-auto-toggle-wrap')) return;
    var complete = document.getElementById('pack-complete');
    if (!complete || !complete.parentNode) return;
    var wrap = document.createElement('label');
    wrap.id = 'pack-auto-toggle-wrap';
    wrap.style.cssText = 'display:flex;align-items:center;gap:8px;margin:8px 0 0;font-size:12px;color:var(--ink3);cursor:pointer;user-select:none';
    wrap.innerHTML =
      '<input type="checkbox" id="pack-auto-toggle" checked style="width:16px;height:16px">' +
      '<span>\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e2d\u0e31\u0e15\u0e42\u0e19\u0e21\u0e31\u0e15\u0e34\u0e40\u0e21\u0e37\u0e48\u0e2d\u0e2a\u0e41\u0e01\u0e19\u0e04\u0e23\u0e1a</span>';
    complete.parentNode.appendChild(wrap);
    document.getElementById('pack-auto-toggle').addEventListener('change', function (e) {
      window.__packAutoCompleteEnabled = !!e.target.checked;
      toast(e.target.checked
        ? '\u0e40\u0e1b\u0e34\u0e14\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e2d\u0e31\u0e15\u0e42\u0e19\u0e21\u0e31\u0e15\u0e34'
        : '\u0e1b\u0e34\u0e14\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e2d\u0e31\u0e15\u0e42\u0e19\u0e21\u0e31\u0e15\u0e34 \u2014 \u0e01\u0e14\u0e1b\u0e38\u0e48\u0e21\u0e40\u0e2d\u0e07');
    });
  }

  function wire() {
    watch();
    ensureToggle();
  }

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.ni[data-page="pack"]');
    if (btn) setTimeout(wire, 250);
  });

  setTimeout(wire, 1500);
  setTimeout(wire, 4000);
  setInterval(function () {
    var page = document.getElementById('page-pack');
    if (page && page.classList.contains('active')) wire();
  }, 3000);
})();
