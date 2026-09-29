/**
 * Pack visual feedback:
 * - Show product image x remaining qty (e.g. 2 left → 2 slots)
 * - Each successful scan removes one image
 * - Black placeholder when no image + click to upload
 */
(function () {
  'use strict';
  var DB = 'https://kiyomi-b19d0-default-rtdb.asia-southeast1.firebasedatabase.app';
  var skus = {};
  var audioCtx = null;
  var lastFb = '';
  var uploading = false;

  function wsKey() { return sessionStorage.getItem('sf_session_ws') || ''; }
  function roomId() { return localStorage.getItem('sf_room_' + wsKey()) || 'WH_A'; }
  function rp() { return 'ws_' + wsKey() + '/rooms/' + roomId(); }
  function toast(msg) {
    var w = document.getElementById('toast-wrap');
    if (!w) return;
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    w.innerHTML = '';
    w.appendChild(t);
    setTimeout(function () { t.remove(); }, 2400);
  }

  function loadSkus() {
    if (!wsKey()) return Promise.resolve();
    return fetch(DB + '/' + rp() + '/skus.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) { skus = d || {}; })
      .catch(function () {});
  }

  function findSkuKey(skuId, name) {
    if (skuId && skus[skuId]) return skuId;
    var keys = Object.keys(skus);
    var nu = String(name || '').trim().toUpperCase();
    var su = String(skuId || '').trim().toUpperCase();
    var i, s, k;
    for (i = 0; i < keys.length; i++) {
      k = keys[i]; s = skus[k] || {};
      if (su && (k.toUpperCase() === su || String(s.unitSku || '').toUpperCase() === su || String(s.barcode || '') === String(skuId))) return k;
      if (nu && String(s.name || '').toUpperCase() === nu) return k;
    }
    return skuId || '';
  }

  function findImage(skuId, name) {
    var key = findSkuKey(skuId, name);
    if (key && skus[key] && skus[key].image) return skus[key].image;
    return '';
  }

  function compressImage(file, maxW, quality) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var w = img.width, h = img.height;
          if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          var data = canvas.toDataURL('image/jpeg', quality);
          if (data.length > 180000 && quality > 0.45) resolve(canvas.toDataURL('image/jpeg', 0.45));
          else resolve(data);
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function saveImageToSku(skuKey, dataUrl) {
    if (!wsKey() || !skuKey) return Promise.reject(new Error('no sku'));
    return fetch(DB + '/' + rp() + '/skus/' + encodeURIComponent(skuKey) + '.json', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl })
    }).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      if (!skus[skuKey]) skus[skuKey] = {};
      skus[skuKey].image = dataUrl;
    });
  }

  function pickAndUpload(skuId, name) {
    if (uploading) return;
    if (!wsKey()) { toast('\u0e25\u0e47\u0e2d\u0e01\u0e2d\u0e34\u0e19 StockFlow \u0e01\u0e48\u0e2d\u0e19'); return; }
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment');
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      input.remove();
      if (!f) return;
      if (f.size > 8 * 1024 * 1024) { toast('\u0e44\u0e1f\u0e25\u0e4c\u0e43\u0e2b\u0e0d\u0e40\u0e01\u0e34\u0e19'); return; }
      uploading = true;
      toast('\u0e01\u0e33\u0e25\u0e31\u0e07\u0e2d\u0e31\u0e1e\u0e42\u0e2b\u0e25\u0e14\u0e23\u0e39\u0e1b\u2026');
      compressImage(f, 640, 0.72).then(function (dataUrl) {
        var key = findSkuKey(skuId, name) || skuId;
        if (!key) {
          key = String(skuId || name || ('SKU_' + Date.now())).replace(/[\/#.\[\]$]/g, '_');
          skus[key] = skus[key] || { name: name || key, unitSku: skuId || '' };
          return fetch(DB + '/' + rp() + '/skus/' + encodeURIComponent(key) + '.json', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.assign({}, skus[key], { image: dataUrl }))
          }).then(function () { skus[key].image = dataUrl; });
        }
        return saveImageToSku(key, dataUrl);
      }).then(function () {
        toast('\u0e2d\u0e31\u0e1e\u0e42\u0e2b\u0e25\u0e14\u0e23\u0e39\u0e1b\u0e41\u0e25\u0e49\u0e27');
        enhanceAll();
      }).catch(function (e) {
        toast('\u0e2d\u0e31\u0e1e\u0e42\u0e2b\u0e25\u0e14\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08');
        console.warn(e);
      }).then(function () { uploading = false; });
    });
    input.click();
  }

  function getCtx() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    if (audioCtx.state === 'suspended') { try { audioCtx.resume(); } catch (e2) {} }
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
    o.connect(g); g.connect(ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
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

  function parseCard(el) {
    if (el.classList && el.classList.contains('plu')) {
      var scanned = parseInt(el.getAttribute('data-scanned'), 10);
      var qty = parseInt(el.getAttribute('data-qty'), 10);
      if (isNaN(scanned) || isNaN(qty)) {
        var qEl = el.querySelector('.row-q');
        var parts = ((qEl && qEl.textContent) || '0/0').split('/');
        scanned = parseInt(parts[0], 10) || 0;
        qty = parseInt(parts[1], 10) || 0;
      }
      return {
        name: el.getAttribute('data-sku-name') || ((el.querySelector('.plu-name') || {}).textContent || '').trim(),
        skuId: el.getAttribute('data-sku-id') || ((el.querySelector('.plu-sku') || {}).textContent || '').trim(),
        scanned: scanned || 0,
        qty: qty || 0,
        remain: Math.max(0, (qty || 0) - (scanned || 0))
      };
    }
    var n = el.querySelector('.row-n');
    var m = el.querySelector('.row-m');
    var q = el.querySelector('.row-q');
    if (!q) return null;
    var parts2 = (q.textContent || '').split('/');
    var scanned2 = parseInt(parts2[0], 10) || 0;
    var qty2 = parseInt(parts2[1], 10) || 0;
    return {
      name: n ? n.textContent.trim() : '',
      skuId: m ? m.textContent.trim() : '',
      scanned: scanned2,
      qty: qty2,
      remain: Math.max(0, qty2 - scanned2)
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
    wrap.style.cssText = 'grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px;padding:8px 0 4px;width:100%;box-sizing:border-box';

    if (remain <= 0) {
      wrap.innerHTML =
        '<div style="width:100%;text-align:center;padding:10px;border-radius:12px;background:var(--ok-soft,#dcfce7);color:var(--ok,#15803d);font-weight:700;font-size:13px">' +
        '\u2713 \u0e04\u0e23\u0e1a\u0e41\u0e25\u0e49\u0e27 \u00b7 ' + (info.name || info.skuId) + ' \u00b7 ' + info.scanned + '/' + info.qty +
        '</div>';
    } else {
      var maxShow = Math.min(remain, 12);
      for (var i = 0; i < maxShow; i++) {
        var slot = document.createElement('div');
        slot.className = 'pack-vis-slot';
        slot.style.cssText =
          'width:72px;height:72px;border-radius:14px;border:2px solid var(--line,#e5e7eb);' +
          'background:#0a0a0a;display:flex;align-items:center;justify-content:center;overflow:hidden;' +
          'box-shadow:0 1px 3px rgba(0,0,0,.06);cursor:pointer;position:relative;flex-shrink:0';
        slot.title = '\u0e04\u0e25\u0e34\u0e01\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e2d\u0e31\u0e1e\u0e42\u0e2b\u0e25\u0e14\u0e23\u0e39\u0e1b';
        if (imgUrl) {
          var img = document.createElement('img');
          img.src = imgUrl;
          img.alt = info.name || '';
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;pointer-events:none';
          img.onerror = function () { this.remove(); };
          slot.appendChild(img);
        } else {
          slot.innerHTML =
            '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:#9ca3af;pointer-events:none">' +
            '<div style="font-size:20px;line-height:1">+</div>' +
            '<div style="font-size:9px;text-align:center;line-height:1.15;padding:0 4px">\u0e2d\u0e31\u0e1e\u0e42\u0e2b\u0e25\u0e14\u0e23\u0e39\u0e1b</div>' +
            '</div>';
        }
        (function (sid, nm) {
          slot.addEventListener('click', function (ev) {
            ev.preventDefault(); ev.stopPropagation();
            pickAndUpload(sid, nm);
          });
        })(info.skuId, info.name);
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
      label.textContent = '\u0e40\u0e2b\u0e25\u0e37\u0e2d ' + remain + ' \u0e0a\u0e34\u0e49\u0e19 \u00b7 \u0e2a\u0e41\u0e01\u0e19 1 = \u0e2b\u0e32\u0e22 1 \u0e23\u0e39\u0e1b \u00b7 \u0e04\u0e25\u0e34\u0e01\u0e01\u0e25\u0e48\u0e2d\u0e07\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e2d\u0e31\u0e1e\u0e42\u0e2b\u0e25\u0e14\u0e23\u0e39\u0e1b';
      wrap.appendChild(label);
    }
    row.appendChild(wrap);
  }

  function enhanceAll() {
    var box = document.getElementById('pack-lines');
    if (!box) return;
    var cards = box.querySelectorAll('.plu, .row');
    cards.forEach(function (row) {
      if (row.classList.contains('row') && row.closest('.plu')) return;
      enhanceRow(row, parseCard(row));
    });
  }

  function watchLines() {
    var box = document.getElementById('pack-lines');
    if (!box || box._visObs) return;
    var obs = new MutationObserver(function () {
      clearTimeout(box._visTimer);
      box._visTimer = setTimeout(enhanceAll, 40);
    });
    obs.observe(box, { childList: true, subtree: true, characterData: true, attributes: true });
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
        playOk(); setTimeout(enhanceAll, 40); return;
      }
      if (t.indexOf('\u0e1c\u0e34\u0e14') >= 0 || t.indexOf('\u0e1a\u0e25\u0e47\u0e2d\u0e01') >= 0 || t.indexOf('\u2715') >= 0 || t.indexOf('\u00d7') >= 0) playBad();
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
      s.buffer = b; s.connect(ctx.destination); s.start(0);
    } catch (e) {}
  }
  document.addEventListener('click', unlockAudio, { once: true });
  document.addEventListener('keydown', unlockAudio, { once: true });

  function wire() {
    loadSkus().then(function () { watchLines(); watchFeedback(); enhanceAll(); });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.ni[data-page="pack"]');
    if (btn) setTimeout(wire, 200);
  });

  setTimeout(wire, 1500);
  setTimeout(wire, 3500);
  setInterval(function () {
    var page = document.getElementById('page-pack');
    if (page && page.classList.contains('active')) { watchLines(); watchFeedback(); loadSkus(); }
  }, 4000);

  window.__packPlayOk = playOk;
  window.__packPlayBad = playBad;
  window.__packEnhanceVisual = enhanceAll;
  window.__packReloadSkuImages = loadSkus;
})();
