/**
 * pack-soft-complete.js
 * หลังตัดสต็อกสำเร็จ — ไม่ reload ทั้งหน้า (กันเด้งออก)
 * รีเซ็ตเฉพาะหน้าแพ็ก พร้อมรับออเดอร์ถัดไป
 */
(function () {
  'use strict';

  var blockReloadUntil = 0;
  var softResetting = false;

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

  function softResetPack() {
    if (softResetting) return;
    softResetting = true;
    try {
      var resetBtn = document.getElementById('pack-reset');
      if (resetBtn) {
        try { resetBtn.click(); } catch (e) {}
      }
      var orderEl = document.getElementById('pack-order');
      if (orderEl) {
        orderEl.value = '';
        setTimeout(function () {
          try { orderEl.focus(); } catch (e) {}
        }, 200);
      }
      var fb = document.getElementById('pack-fb');
      if (fb) {
        fb.style.background = '';
        fb.style.color = '';
        fb.textContent = '\u0e2a\u0e41\u0e01\u0e19\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e16\u0e31\u0e14\u0e44\u0e1b \u00b7 \u0e1e\u0e23\u0e49\u0e2d\u0e21\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e16\u0e31\u0e14\u0e44\u0e1b';
      }
      if (typeof window.__packQueueRefresh === 'function') {
        try { window.__packQueueRefresh(); } catch (e) {}
      }
    } finally {
      setTimeout(function () { softResetting = false; }, 800);
    }
  }

  try {
    var origReload = Location.prototype.reload;
    Location.prototype.reload = function () {
      if (Date.now() < blockReloadUntil) {
        console.log('[SF] blocked page reload after pack complete');
        softResetPack();
        toast('\u2713 \u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e41\u0e25\u0e49\u0e27 \u00b7 \u0e1e\u0e23\u0e49\u0e2d\u0e21\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e16\u0e31\u0e14\u0e44\u0e1b');
        return;
      }
      return origReload.apply(this, arguments);
    };
  } catch (e) {
    console.warn('[SF] could not patch location.reload', e);
  }

  function armBlock() {
    blockReloadUntil = Date.now() + 6000;
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t) return;
    if (t.id === 'pack-complete' || (t.closest && t.closest('#pack-complete'))) {
      armBlock();
    }
  }, true);

  function watchFb() {
    var fb = document.getElementById('pack-fb');
    if (!fb || fb._softObs) return;
    var obs = new MutationObserver(function () {
      var txt = fb.textContent || '';
      if (txt.indexOf('\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01') >= 0 || txt.indexOf('\u0e2a\u0e41\u0e01\u0e19\u0e04\u0e23\u0e1a') >= 0) {
        armBlock();
      }
    });
    obs.observe(fb, { childList: true, characterData: true, subtree: true });
    fb._softObs = true;
  }

  function watchCompleteBtn() {
    var btn = document.getElementById('pack-complete');
    if (!btn || btn._softObs) return;
    var obs = new MutationObserver(function () {
      var t = btn.textContent || '';
      if (t.indexOf('\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01') >= 0 || t.indexOf('\u0e01\u0e33\u0e25\u0e31\u0e07\u0e15\u0e31\u0e14') >= 0) {
        armBlock();
      }
    });
    obs.observe(btn, { childList: true, characterData: true, subtree: true, attributes: true });
    btn._softObs = true;
  }

  function wire() {
    watchFb();
    watchCompleteBtn();
  }

  setTimeout(wire, 800);
  setTimeout(wire, 2500);
  setInterval(wire, 4000);

  console.log('[SF] pack-soft-complete ready');
})();
