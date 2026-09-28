/**
 * Product image upload in edit sheet (Products tab)
 */
(function () {
  'use strict';
  var DB = 'https://kiyomi-b19d0-default-rtdb.asia-southeast1.firebasedatabase.app';
  var pendingImage = null;

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
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          var data = canvas.toDataURL('image/jpeg', quality);
          if (data.length > 180000 && quality > 0.45) {
            resolve(canvas.toDataURL('image/jpeg', 0.45));
          } else {
            resolve(data);
          }
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function ensureImageField() {
    var sheetB = document.querySelector('#bc-ov .sheet-b');
    if (!sheetB || document.getElementById('bc-img-wrap')) return;
    var wrap = document.createElement('div');
    wrap.id = 'bc-img-wrap';
    wrap.className = 'field';
    wrap.innerHTML =
      '<label>\u0e23\u0e39\u0e1b\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32 (\u0e41\u0e2a\u0e14\u0e07\u0e40\u0e21\u0e37\u0e48\u0e2d\u0e2a\u0e41\u0e01\u0e19\u0e1c\u0e34\u0e14)</label>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
      '<img id="bc-img-preview" alt="" style="width:88px;height:88px;object-fit:cover;border-radius:12px;border:1px solid var(--line2);background:var(--bg);display:none">' +
      '<div style="flex:1;min-width:140px">' +
      '<input type="file" id="bc-img-file" accept="image/*" capture="environment" style="font-size:13px;width:100%">' +
      '<div style="font-size:11px;color:var(--ink3);margin-top:4px">\u0e41\u0e19\u0e30\u0e23\u0e39\u0e1b\u0e0a\u0e31\u0e14\u0e0a\u0e31\u0e14\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32</div>' +
      '<button type="button" id="bc-img-clear" class="btn" style="margin-top:6px;padding:8px 12px;width:auto;background:var(--bg);border:1px solid var(--line2);font-size:12px">\u0e25\u0e1a\u0e23\u0e39\u0e1b</button>' +
      '</div></div>';
    var saveBtn = document.getElementById('bc-save');
    if (saveBtn) sheetB.insertBefore(wrap, saveBtn);
    else sheetB.appendChild(wrap);

    document.getElementById('bc-img-file').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      if (f.size > 8 * 1024 * 1024) { toast('\u0e44\u0e1f\u0e25\u0e4c\u0e43\u0e2b\u0e0d\u0e40\u0e01\u0e34\u0e19'); return; }
      toast('\u0e01\u0e33\u0e25\u0e31\u0e07\u0e22\u0e48\u0e2d\u0e23\u0e39\u0e1b\u2026');
      compressImage(f, 640, 0.72).then(function (dataUrl) {
        pendingImage = dataUrl;
        var prev = document.getElementById('bc-img-preview');
        if (prev) { prev.src = dataUrl; prev.style.display = 'block'; }
        toast('\u0e1e\u0e23\u0e49\u0e2d\u0e21\u0e41\u0e25\u0e49\u0e27 \u2014 \u0e01\u0e14\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01');
      }).catch(function () { toast('\u0e2d\u0e48\u0e32\u0e19\u0e23\u0e39\u0e1b\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49'); });
    });
    document.getElementById('bc-img-clear').addEventListener('click', function (e) {
      e.preventDefault();
      pendingImage = '';
      var prev = document.getElementById('bc-img-preview');
      if (prev) { prev.removeAttribute('src'); prev.style.display = 'none'; }
      var fi = document.getElementById('bc-img-file');
      if (fi) fi.value = '';
    });
  }

  function showExistingImage(id) {
    pendingImage = null;
    var prev = document.getElementById('bc-img-preview');
    var fi = document.getElementById('bc-img-file');
    if (fi) fi.value = '';
    if (!prev) return;
    if (!wsKey() || !id) { prev.style.display = 'none'; return; }
    fetch(DB + '/' + rp() + '/skus/' + id + '.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (s) {
        if (s && s.image) {
          prev.src = s.image;
          prev.style.display = 'block';
        } else {
          prev.style.display = 'none';
        }
      }).catch(function () {});
  }

  var obs = new MutationObserver(function () {
    var ov = document.getElementById('bc-ov');
    if (!ov) return;
    ensureImageField();
    if (ov.classList.contains('open')) {
      var idEl = document.getElementById('bc-id');
      var id = (idEl && idEl.textContent || '').replace(/^ID:\s*/, '').trim();
      if (id) showExistingImage(id);
    }
  });
  obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('#bc-save');
    if (!btn) return;
    setTimeout(function () {
      var idEl = document.getElementById('bc-id');
      var id = (idEl && idEl.textContent || '').replace(/^ID:\s*/, '').trim();
      if (!id || !wsKey()) return;
      if (pendingImage === null) return;
      fetch(DB + '/' + rp() + '/skus/' + id + '.json', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: pendingImage || null })
      }).then(function () {
        toast(pendingImage ? '\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e23\u0e39\u0e1b\u0e41\u0e25\u0e49\u0e27' : '\u0e25\u0e1a\u0e23\u0e39\u0e1b\u0e41\u0e25\u0e49\u0e27');
        pendingImage = null;
      }).catch(function () {
        toast('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e23\u0e39\u0e1b\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08');
      });
    }, 600);
  }, true);

  setInterval(ensureImageField, 1500);
})();
