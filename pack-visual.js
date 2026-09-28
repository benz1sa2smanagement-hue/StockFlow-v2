/**
 * Pack visual feedback:
 * - Show product image × remaining qty (e.g. 3 packs → 3 images)
 * - Each successful scan removes one image
 * - Play OK / wrong scan sounds
 */
(function () {
  'use strict';
  var DB = 'https://kiyomi-b19d0-default-rtdb.asia-southeast1.firebasedatabase.app';
  var skus = {};
  var audioCtx = null;
  var lastFb = '';

  function wsKey() { return sessionStorage.getItem('sf_session_ws') || ''; }
  function roomId() { return localStorage.getItem('sf_room_' + wsKey()) || 'WH_A'; }

  function loadSkus() {
    if (!wsKey()) return Promise.resolve();
    return fetch(DB + '/ws_' + wsKey() + '/rooms/' + roomId() + '/skus.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) { skus = d || {}; })
      .catch(function () {});
  }

  function findImage(skuId, name) {
    if (skuId && skus[skuId] && skus[skuId].image) return skus[skuId].image;
    var keys = Object.keys(skus);
    var nu = String(name || '').trim().toUpperCase();
    var i, s;
    for (i = 0; i < keys.length; i++) {
      s = skus[keys[i]] || {};
      if (!s.image) continue;
      if (keys[i] === skuId) return s.image;
      if (nu && String(s.name || '').toUpperCase() === nu) return s.image;
      if (s.unitSku && String(s.unitSku).toUpperCase() === String(skuId || '').toUpperCase()) return s.image;
      if (s.barcode && String(s.barcode) === String(skuId)) return s.image;
    }
    if (nu) {
      for (i = 0; i < keys.length; i++) {
        s = skus[keys[i]] || {};
        if (s.image && String(s.name || '').toUpperCase().indexOf(nu) >= 0) return s.image;
      }
    }
    return '';
  }

  function getCtx() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    if (audioCtx.state === 'suspended') {
      try { audioCtx.resume(); } catch (e2) {}
    }
    return audioCtx;
  }

  function tone(freq, dur, type, vol, when) {
    var ctx = getCtx();
    if (!ctx) return;
    var t0 = ctx.currentTime + (when || 0);
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.25, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function playOk() {
    tone(880, 0.09, 'sine', 0.28, 0);
    tone(1175, 0.12, 'sine', 0.22, 0.1);
    try { if (navigator.vibrate) navigator.vibrate(40); } catch (e) {}
  }

  function playBad() {
    tone(220, 0.18, 'square', 0.35, 0);
    tone(165, 0.22, 'square', 0.3, 0.16);
    try { if (navigator.vibrate) navigator.vibrate([120, 60, 120]); } catch (e) {}
  }

  function parseRow(row) {
    var n = row.querySelector('.row-n');
    var m = row.querySelector('.row-m');
    var q = row.querySelector('.row-q');
    if (!q) return null;
    var parts = (q.textContent || '').split('/');
    var scanned = parseInt(parts[0], 10) || 0;
    var qty = parseInt(parts[1], 10) || 0;
    return {
      name: n ? n.textContent.trim() : '',
      skuId: m ? m.textContent.trim() : '',
      scanned: scanned,
      qty: qty,
      remain: Math.max(0, qty - scanned)
    };
  }

  function enhanceRow(row, info) {
    if (!info) return;
    var existing = row.querySelector('.pack-vis-slots');
    if (existing) existing.remove();

    var remain = info.remain;
    var imgUrl = findImage(info.skuId, info.name);

    var wrap = document.createElement('div');
    wrap.className = 'pack-vis-slots';
    wrap.style.cssText = 'grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px;padding:8px 12px 12px;width:100%;box-sizing:border-box';

    if (remain <= 0) {
      wrap.innerHTML =
        '<div style="width:100%;text-align:center;padding:10px;border-radius:12px;background:var(--ok-soft,#dcfce7);color:var(--ok,#15803d);font-weight:700;font-size:13px">' +
        '\u2713 \u0e04\u0e23\u0e1a\u0e41\u0e25\u0e49\u0e27 \u00b7 ' + (info.name || info.skuId) + ' \u00b7 ' + info.scanned + '/' + info.qty +
        '</div>';
    } else {
      var maxShow = Math.min(remain, 12);
      var i;
      for (i = 0; i < maxShow; i++) {
        var slot = document.createElement('div');
        slot.style.cssText =
          'width:72px;height:72px;border-radius:14px;border:2px solid var(--line,#e5e7eb);' +
          'background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;' +
          'box-shadow:0 1px 3px rgba(0,0,0,.06)';
        if (imgUrl) {
          var img = document.createElement('img');
          img.src = imgUrl;
          img.alt = info.name || '';
          img.style.cssText = 'width:100%;height:100%;object-fit:cover';
          img.onerror = function () { this.style.display = 'none'; };
          slot.appendChild(img);
        } else {
          slot.innerHTML = '<div style="font-size:11px;color:#9ca3af;text-align:center;padding:4px;line-height:1.2">' +
            (info.name || info.skuId || '?').slice(0, 18) + '</div>';
        }
        wrap.appendChild(slot);
      }
      if (remain > maxShow) {
        var more = document.createElement('div');
        more.style.cssText = 'width:72px;height:72px;border-radius:14px;background:var(--bg,#f3f1eb);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:var(--ink3)';
        more.textContent = '+' + (remain - maxShow);
        wrap.appendChild(more);
      }
      var label = document.createElement('div');
      label.style.cssText = 'width:100%;font-size:11px;color:var(--ink3);margin-top:2px';
      label.textContent = '\u0e40\u0e2b\u0e25\u0e37\u0e2d\u0e2a\u0e41\u0e01\u0e19\u0e2d\u0e35\u0e01 ' + remain + ' \u0e0a\u0e34\u0e49\u0e19 \u00b7 \u0e2a\u0e41\u0e01\u0e19\u0e16\u0e39\u0e01 1 \u0e04\u0e23\u0e31\u0e49\u0e07 = \u0e2b\u0e32\u0e22\u0e44\u0e1b 1 \u0e23\u0e39\u0e1b';
      wrap.appendChild(label);
    }

    if (row.style.display !== 'grid') {
      row.style.display = 'flex';
      row.style.flexWrap = 'wrap';
      row.style.alignItems = 'center';
    }
    row.appendChild(wrap);
  }

  function enhanceAll() {
    var box = document.getElementById('pack-lines');
    if (!box) return;
    var rows = box.querySelectorAll('.row');
    rows.forEach(function (row) {
      enhanceRow(row, parseRow(row));
    });
  }

  function watchLines() {
    var box = document.getElementById('pack-lines');
    if (!box || box._visObs) return;
    var obs = new MutationObserver(function () {
      clearTimeout(box._visTimer);
      box._visTimer = setTimeout(enhanceAll, 30);
    });
    obs.observe(box, { childList: true, subtree: true, characterData: true });
    box._visObs = obs;
    enhanceAll();
  }

  function watchFeedback() {
    var fb = document.getElementById('pack-fb');
    if (!fb || fb._visFbObs) return;
    var obs = new MutationObserver(function () {
      var t = (fb.textContent || '').trim();
      if (!t || t === lastFb) return;
      lastFb = t;
      if (t.indexOf('\u2713') === 0 || t.indexOf('\u0e16\u0e39\u0e01\u0e15\u0e49\u0e2d\u0e07') >= 0) {
        playOk();
        setTimeout(enhanceAll, 40);
        return;
      }
      if (t.indexOf('\u0e1c\u0e34\u0e14') >= 0 || t.indexOf('\u0e1a\u0e25\u0e47\u0e2d\u0e01') >= 0 ||
          t.indexOf('\u2715') >= 0 || t.indexOf('\u00d7') >= 0) {
        playBad();
      }
    });
    obs.observe(fb, { childList: true, characterData: true, subtree: true });
    fb._visFbObs = obs;
  }

  function unlockAudio() {
    var ctx = getCtx();
    if (!ctx) return;
    try {
      var b = ctx.createBuffer(1, 1, 22050);
      var s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(0);
    } catch (e) {}
  }
  document.addEventListener('click', unlockAudio, { once: true });
  document.addEventListener('keydown', unlockAudio, { once: true });

  function wire() {
    loadSkus().then(function () {
      watchLines();
      watchFeedback();
      enhanceAll();
    });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.ni[data-page="pack"]');
    if (btn) setTimeout(wire, 200);
  });

  setTimeout(wire, 1500);
  setTimeout(wire, 3500);
  setInterval(function () {
    var page = document.getElementById('page-pack');
    if (page && page.classList.contains('active')) {
      watchLines();
      watchFeedback();
    }
  }, 3000);

  window.__packPlayOk = playOk;
  window.__packPlayBad = playBad;
  window.__packEnhanceVisual = enhanceAll;
})();
