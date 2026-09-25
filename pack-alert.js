/**
 * Wrong-scan alert: loud beep + strong vibrate + sticky red ERROR until correct scan
 */
(function () {
  'use strict';
  var audioCtx = null;
  var volume = parseFloat(localStorage.getItem('sf_alert_vol') || '0.85');
  var errorActive = false;
  var beepTimer = null;

  function ensureOverlay() {
    if (document.getElementById('pack-err-ov')) return;
    var ov = document.createElement('div');
    ov.id = 'pack-err-ov';
    ov.style.cssText = 'display:none;position:fixed;inset:0;z-index:500;background:rgba(180,20,20,0.92);' +
      'flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;';
    ov.innerHTML =
      '<div style="font-size:72px;line-height:1;margin-bottom:12px">\u2715</div>' +
      '<div style="font-size:28px;font-weight:700;color:#fff;letter-spacing:.04em;margin-bottom:8px">ERROR</div>' +
      '<div style="font-size:18px;font-weight:600;color:#fecaca;margin-bottom:16px" id="pack-err-msg">\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e1c\u0e34\u0e14\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c</div>' +
      '<div style="font-size:14px;color:rgba(255,255,255,.85);max-width:320px;line-height:1.5;white-space:pre-line" id="pack-err-detail">\u0e2a\u0e41\u0e01\u0e19\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e43\u0e19\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e19\u0e35\u0e49\u0e40\u0e17\u0e48\u0e32\u0e19\u0e31\u0e49\u0e19 \u00b7 \u0e2b\u0e19\u0e49\u0e32\u0e08\u0e2d\u0e41\u0e14\u0e07\u0e08\u0e30\u0e2b\u0e32\u0e22\u0e40\u0e21\u0e37\u0e48\u0e2d\u0e2a\u0e41\u0e01\u0e19\u0e16\u0e39\u0e01\u0e15\u0e49\u0e2d\u0e07</div>' +
      '<div style="margin-top:28px;width:100%;max-width:280px">' +
      '<label style="font-size:12px;color:rgba(255,255,255,.7);display:block;margin-bottom:6px">\u0e23\u0e30\u0e14\u0e31\u0e1a\u0e40\u0e2a\u0e35\u0e22\u0e07\u0e40\u0e15\u0e37\u0e2d\u0e19</label>' +
      '<input type="range" id="pack-err-vol" min="0" max="1" step="0.05" style="width:100%">' +
      '</div>' +
      '<button type="button" id="pack-err-mute" style="margin-top:16px;padding:12px 20px;border-radius:12px;' +
      'background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.3);font-size:14px">\u0e1b\u0e34\u0e14\u0e40\u0e2a\u0e35\u0e22\u0e07\u0e04\u0e23\u0e31\u0e49\u0e07\u0e19\u0e35\u0e49</button>';
    document.body.appendChild(ov);
    var vol = document.getElementById('pack-err-vol');
    if (vol) {
      vol.value = String(volume);
      vol.addEventListener('input', function () {
        volume = parseFloat(vol.value);
        localStorage.setItem('sf_alert_vol', String(volume));
      });
    }
    document.getElementById('pack-err-mute').addEventListener('click', function () { stopBeep(); });
  }

  function ensureVolControl() {
    if (document.getElementById('pack-vol-wrap')) return;
    var fb = document.getElementById('pack-fb');
    if (!fb || !fb.parentNode) return;
    var wrap = document.createElement('div');
    wrap.id = 'pack-vol-wrap';
    wrap.style.cssText = 'margin-bottom:10px;padding:10px 12px;background:var(--bg);border-radius:12px;border:1px solid var(--line)';
    wrap.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">' +
      '<span style="font-size:11px;color:var(--ink3);font-weight:500">\u0e23\u0e30\u0e14\u0e31\u0e1a\u0e40\u0e2a\u0e35\u0e22\u0e07\u0e40\u0e15\u0e37\u0e2d\u0e19\u0e40\u0e21\u0e37\u0e48\u0e2d\u0e2a\u0e41\u0e01\u0e19\u0e1c\u0e34\u0e14</span>' +
      '<span id="pack-vol-pct" style="font-size:11px;font-family:IBM Plex Mono,monospace">' + Math.round(volume * 100) + '%</span></div>' +
      '<input type="range" id="pack-vol-slider" min="0" max="1" step="0.05" value="' + volume + '" style="width:100%">';
    fb.parentNode.insertBefore(wrap, fb);
    document.getElementById('pack-vol-slider').addEventListener('input', function (e) {
      volume = parseFloat(e.target.value);
      localStorage.setItem('sf_alert_vol', String(volume));
      var pct = document.getElementById('pack-vol-pct');
      if (pct) pct.textContent = Math.round(volume * 100) + '%';
      var errVol = document.getElementById('pack-err-vol');
      if (errVol) errVol.value = String(volume);
    });
  }

  function getCtx() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }
  function playTone(freq, dur, vol, type) {
    var ctx = getCtx();
    if (!ctx || vol <= 0) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    gain.gain.value = vol;
    osc.connect(gain);
    gain.connect(ctx.destination);
    var now = ctx.currentTime;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }
  function startBeepLoop() {
    stopBeep();
    function tick() {
      if (!errorActive) return;
      var v = Math.max(0, Math.min(1, volume));
      playTone(880, 0.18, v * 0.9, 'square');
      setTimeout(function () { if (errorActive) playTone(660, 0.18, v * 0.9, 'square'); }, 200);
      setTimeout(function () { if (errorActive) playTone(990, 0.22, v * 1.0, 'square'); }, 420);
      try { if (navigator.vibrate) navigator.vibrate([200, 80, 200, 80, 300]); } catch (e) {}
      beepTimer = setTimeout(tick, 1400);
    }
    tick();
  }
  function stopBeep() {
    if (beepTimer) { clearTimeout(beepTimer); beepTimer = null; }
  }
  function showError(scannedValue) {
    ensureOverlay();
    errorActive = true;
    var ov = document.getElementById('pack-err-ov');
    ov.style.display = 'flex';
    var msg = document.getElementById('pack-err-msg');
    var det = document.getElementById('pack-err-detail');
    if (msg) msg.textContent = '\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e1c\u0e34\u0e14\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c \u2014 \u0e1a\u0e25\u0e47\u0e2d\u0e01\u0e41\u0e25\u0e49\u0e27';
    if (det) det.textContent = (scannedValue ? ('\u0e2a\u0e41\u0e01\u0e19\u0e44\u0e14\u0e49: ' + scannedValue + '\n') : '') +
      '\u0e2a\u0e41\u0e01\u0e19\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e17\u0e35\u0e48\u0e2d\u0e22\u0e39\u0e48\u0e43\u0e19\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e19\u0e35\u0e49\u0e40\u0e17\u0e48\u0e32\u0e19\u0e31\u0e49\u0e19\n\u0e2b\u0e19\u0e49\u0e32\u0e08\u0e2d\u0e41\u0e14\u0e07\u0e08\u0e30\u0e2b\u0e32\u0e22\u0e40\u0e21\u0e37\u0e48\u0e2d\u0e2a\u0e41\u0e01\u0e19\u0e16\u0e39\u0e01\u0e15\u0e49\u0e2d\u0e07';
    var errVol = document.getElementById('pack-err-vol');
    if (errVol) errVol.value = String(volume);
    var fb = document.getElementById('pack-fb');
    if (fb) {
      fb.style.background = '#FEE2E2';
      fb.style.color = '#B91C1C';
      fb.style.border = '2px solid #EF4444';
      fb.style.fontSize = '15px';
      fb.setAttribute('data-err', '1');
    }
    startBeepLoop();
  }
  function clearError() {
    if (!errorActive) return;
    errorActive = false;
    stopBeep();
    var ov = document.getElementById('pack-err-ov');
    if (ov) ov.style.display = 'none';
    var fb = document.getElementById('pack-fb');
    if (fb) {
      fb.style.border = 'none';
      fb.style.fontSize = '13px';
      fb.removeAttribute('data-err');
    }
  }
  function isWrongText(t) {
    t = (t || '');
    return t.indexOf('\u0e1c\u0e34\u0e14') >= 0 || t.indexOf('\u0e1a\u0e25\u0e47\u0e2d\u0e01') >= 0 || t.indexOf('\u2715') >= 0 || t.indexOf('\u00d7') >= 0;
  }
  function isOkText(t) {
    t = (t || '');
    return t.indexOf('\u2713') === 0 || t.indexOf('\u0e16\u0e39\u0e01\u0e15\u0e49\u0e2d\u0e07') >= 0;
  }
  function watchFb() {
    var fb = document.getElementById('pack-fb');
    if (!fb || fb._alertObs) return;
    var obs = new MutationObserver(function () {
      var t = fb.textContent || '';
      if (isWrongText(t)) {
        var m = t.match(/[:\u00b7]\s*([^\s\u00b7]+)\s*$/);
        showError(m ? m[1] : '');
      } else if (isOkText(t) || t.indexOf('\u0e23\u0e2d\u0e2a\u0e41\u0e01\u0e19') >= 0) {
        clearError();
      }
    });
    obs.observe(fb, { childList: true, characterData: true, subtree: true });
    fb._alertObs = obs;
  }
  function onPack() {
    ensureOverlay();
    ensureVolControl();
    watchFb();
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.ni[data-page="pack"]');
    if (btn) setTimeout(onPack, 200);
  });
  setTimeout(onPack, 2500);
  setTimeout(onPack, 5000);
})();
