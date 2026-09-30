/**
 * Product image upload in edit sheet — gallery pick (no forced camera)
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
      if (!file) { reject(new Error('no-file')); return; }
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          try {
            var w = img.width, h = img.height;
            if (!w || !h) { reject(new Error('dims')); return; }
            if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
            var c = document.createElement('canvas');
            c.width = w; c.height = h;
            c.getContext('2d').drawImage(img, 0, 0, w, h);
            var data = c.toDataURL('image/jpeg', quality);
            if (data.length > 180000 && quality > 0.45) data = c.toDataURL('image/jpeg', 0.45);
            resolve(data);
          } catch (e) { reject(e); }
        };
        img.onerror = function () { reject(new Error('img')); };
        img.src = reader.result;
      };
      reader.onerror = function () { reject(new Error('read')); };
      reader.readAsDataURL(file);
    });
  }

  function currentEditId() {
    var idEl = document.getElementById('bc-id');
    return (idEl && idEl.textContent || '').replace(/^ID:\s*/, '').trim();
  }

  function refreshAll() {
    if (typeof window.__packReloadSkuImages === 'function') window.__packReloadSkuImages();
    if (typeof window.__sfRefreshThumbs === 'function') window.__sfRefreshThumbs();
    if (typeof window.__reloadProductsBarcode === 'function') window.__reloadProductsBarcode();
  }

  function ensureImageField() {
    var sheetB = document.querySelector('#bc-ov .sheet-b');
    if (!sheetB) return;
    var old = document.getElementById('bc-img-wrap');
    if (old) {
      var fi = document.getElementById('bc-img-file');
      if (fi && fi.hasAttribute('capture')) old.remove();
      else { wireImageControls(); return; }
    }
    var wrap = document.createElement('div');
    wrap.id = 'bc-img-wrap';
    wrap.className = 'field';
    wrap.style.cssText = 'position:relative;z-index:5;pointer-events:auto';
    wrap.innerHTML =
      '<label>รูปสินค้า</label>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
      '<div id="bc-img-tap" style="width:88px;height:88px;border-radius:12px;border:2px dashed #d1d5db;background:#0a0a0a;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">' +
      '<img id="bc-img-preview" alt="" style="width:100%;height:100%;object-fit:cover;display:none">' +
      '<div id="bc-img-ph" style="color:#9ca3af;font-size:11px;text-align:center;line-height:1.2;padding:6px">+ รูป</div>' +
      '</div>' +
      '<div style="flex:1;min-width:140px">' +
      '<input type="file" id="bc-img-file" accept="image/*" style="display:block;font-size:14px;width:100%;padding:6px 0;cursor:pointer">' +
      '<div style="font-size:11px;color:var(--ink3);margin-top:4px">เลือกจากคลังรูปหรือไฟล์ (ไม่บังคับกล้อง)</div>' +
      '<button type="button" id="bc-img-clear" class="btn" style="margin-top:6px;padding:8px 12px;width:auto;background:var(--bg);border:1px solid var(--line2);font-size:12px">ลบรูป</button>' +
      '</div></div>';
    var saveBtn = document.getElementById('bc-save');
    if (saveBtn) sheetB.insertBefore(wrap, saveBtn);
    else sheetB.appendChild(wrap);
    wireImageControls();
  }

  function wireImageControls() {
    var file = document.getElementById('bc-img-file');
    var clear = document.getElementById('bc-img-clear');
    if (!file || file._sfWired) return;
    file._sfWired = true;
    file.removeAttribute('capture');

    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) { toast('ยังไม่ได้เลือกไฟล์'); return; }
      if (f.size > 12 * 1024 * 1024) { toast('ไฟล์ใหญ่เกิน 12MB'); return; }
      toast('กำลังย่อรูป… (' + (f.name || 'ไฟล์') + ')');
      compressImage(f, 640, 0.72).then(function (dataUrl) {
        pendingImage = dataUrl;
        var prev = document.getElementById('bc-img-preview');
        var ph = document.getElementById('bc-img-ph');
        if (prev) { prev.src = dataUrl; prev.style.display = 'block'; }
        if (ph) ph.style.display = 'none';
        toast('พร้อมแล้ว — กดบันทึก');
      }).catch(function () { toast('อ่านรูปไม่สำเร็จ ลอง JPG/PNG'); });
    });

    if (clear && !clear._sfWired) {
      clear._sfWired = true;
      clear.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        pendingImage = '';
        var prev = document.getElementById('bc-img-preview');
        var ph = document.getElementById('bc-img-ph');
        if (prev) { prev.removeAttribute('src'); prev.style.display = 'none'; }
        if (ph) ph.style.display = 'block';
        file.value = '';
      });
    }
  }

  function showExistingImage(id) {
    pendingImage = null;
    var prev = document.getElementById('bc-img-preview');
    var ph = document.getElementById('bc-img-ph');
    var fi = document.getElementById('bc-img-file');
    if (fi) { fi.value = ''; fi.removeAttribute('capture'); }
    if (!prev) return;
    if (!wsKey() || !id) {
      prev.style.display = 'none';
      if (ph) ph.style.display = 'block';
      return;
    }
    fetch(DB + '/' + rp() + '/skus/' + encodeURIComponent(id) + '.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (s) {
        if (s && s.image) {
          prev.src = s.image;
          prev.style.display = 'block';
          if (ph) ph.style.display = 'none';
        } else {
          prev.style.display = 'none';
          if (ph) ph.style.display = 'block';
        }
      }).catch(function () {});
  }

  function onOpenSheet() {
    ensureImageField();
    var id = currentEditId();
    if (id) showExistingImage(id);
  }

  var obs = new MutationObserver(function () {
    var ov = document.getElementById('bc-ov');
    if (ov && ov.classList.contains('open')) onOpenSheet();
  });
  obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('#bc-save');
    if (!btn) return;
    var id = currentEditId();
    var img = pendingImage;
    if (!id || !wsKey()) return;
    if (img === null) return;
    setTimeout(function () {
      fetch(DB + '/' + rp() + '/skus/' + encodeURIComponent(id) + '.json', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: img || null })
      }).then(function () {
        toast(img ? 'บันทึกรูปแล้ว' : 'ลบรูปแล้ว');
        pendingImage = null;
        refreshAll();
      }).catch(function () { toast('บันทึกรูปไม่สำเร็จ'); });
    }, 700);
  }, true);

  setInterval(function () {
    var ov = document.getElementById('bc-ov');
    if (ov && ov.classList.contains('open')) ensureImageField();
  }, 800);
})();
