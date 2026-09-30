/**
 * Edit-product image — hard fix
 * - Image field always at TOP of edit sheet
 * - Rewire file input every time sheet opens
 * - Save image immediately on #bc-save (not only delayed)
 */
(function () {
  'use strict';
  var DB = 'https://kiyomi-b19d0-default-rtdb.asia-southeast1.firebasedatabase.app';
  var pendingImage = null;
  var hasNewSelection = false;
  var lastOpenedId = '';
  var saving = false;

  function wsKey() { return sessionStorage.getItem('sf_session_ws') || ''; }
  function roomId() { return localStorage.getItem('sf_room_' + wsKey()) || 'WH_A'; }
  function rp() { return 'ws_' + wsKey() + '/rooms/' + roomId(); }

  function toast(msg) {
    var w = document.getElementById('toast-wrap');
    if (!w) {
      console.log('[SF-img]', msg);
      return;
    }
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    w.innerHTML = '';
    w.appendChild(t);
    setTimeout(function () { t.remove(); }, 3000);
  }

  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file) { reject(new Error('no-file')); return; }
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          try {
            var maxW = 640, w = img.width, h = img.height;
            if (!w || !h) { reject(new Error('dims')); return; }
            if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
            var c = document.createElement('canvas');
            c.width = w; c.height = h;
            c.getContext('2d').drawImage(img, 0, 0, w, h);
            var data = c.toDataURL('image/jpeg', 0.72);
            if (data.length > 180000) data = c.toDataURL('image/jpeg', 0.45);
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
    var t = (idEl && idEl.textContent || '').trim();
    var m = t.match(/ID:\s*(.+)/i);
    return m ? m[1].trim() : t.replace(/^ID:\s*/i, '').trim();
  }

  function refreshAll() {
    try {
      if (typeof window.__packReloadSkuImages === 'function') window.__packReloadSkuImages();
      if (typeof window.__sfRefreshThumbs === 'function') window.__sfRefreshThumbs();
      if (typeof window.__reloadProductsBarcode === 'function') window.__reloadProductsBarcode();
    } catch (e) {}
  }

  function applyPreview(dataUrl, label) {
    pendingImage = dataUrl;
    hasNewSelection = true;
    var prev = document.getElementById('bc-img-preview');
    var ph = document.getElementById('bc-img-ph');
    var nameEl = document.getElementById('bc-img-name');
    var clr = document.getElementById('bc-img-clear');
    if (prev) {
      prev.src = dataUrl;
      prev.style.display = 'block';
    }
    if (ph) {
      ph.textContent = 'เลือกรูปแล้ว — กดบันทึก';
      ph.style.display = 'block';
    }
    if (nameEl) nameEl.textContent = label || '';
    if (clr) clr.style.display = 'inline-block';
  }

  function ensureImageField() {
    var sheetB = document.querySelector('#bc-ov .sheet-b');
    if (!sheetB) return false;

    var wrap = document.getElementById('bc-img-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'bc-img-wrap';
      wrap.className = 'field';
      wrap.style.cssText = 'position:relative;z-index:20;pointer-events:auto;margin-bottom:12px';
      wrap.innerHTML =
        '<label style="font-weight:700">รูปสินค้า</label>' +
        '<div style="border:2px dashed #94a3b8;border-radius:14px;padding:12px;text-align:center;background:#f8fafc">' +
        '<img id="bc-img-preview" alt="" style="display:none;max-width:100%;max-height:160px;border-radius:10px;object-fit:contain;margin:0 auto 8px">' +
        '<div id="bc-img-ph" style="color:#64748b;font-size:13px;font-weight:600;margin-bottom:8px">เลือกไฟล์รูปด้านล่าง</div>' +
        '<div id="bc-img-name" style="font-size:12px;color:#64748b;margin-bottom:6px;word-break:break-all"></div>' +
        '<input type="file" id="bc-img-file" accept="image/*" ' +
        'style="display:block;width:100%;font-size:15px;padding:10px 0;cursor:pointer">' +
        '</div>' +
        '<button type="button" id="bc-img-clear" style="display:none;margin-top:8px;padding:8px 12px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;font-size:12px;cursor:pointer">ลบรูป</button>';

      // ใส่บนสุดของฟอร์ม (หลัง bc-id ถ้ามี)
      var idEl = document.getElementById('bc-id');
      if (idEl && idEl.parentNode === sheetB) {
        if (idEl.nextSibling) sheetB.insertBefore(wrap, idEl.nextSibling);
        else sheetB.appendChild(wrap);
      } else {
        sheetB.insertBefore(wrap, sheetB.firstChild);
      }
    }

    wireFileInput();
    return true;
  }

  function wireFileInput() {
    var file = document.getElementById('bc-img-file');
    var clear = document.getElementById('bc-img-clear');
    if (!file) return;

    file.removeAttribute('capture');

    // ผูกใหม่ทุกครั้ง — ลบ listener เก่าด้วย clone
    if (!file._sfImgBound) {
      file._sfImgBound = true;
      file.addEventListener('change', function () {
        var f = file.files && file.files[0];
        if (!f) {
          toast('ยังไม่ได้เลือกไฟล์');
          return;
        }
        var nameEl = document.getElementById('bc-img-name');
        if (nameEl) {
          nameEl.textContent = 'เลือกแล้ว: ' + (f.name || 'ไฟล์') + ' (' + Math.round(f.size / 1024) + ' KB)';
        }
        if (f.size > 12 * 1024 * 1024) {
          toast('ไฟล์ใหญ่เกิน 12MB');
          return;
        }
        toast('กำลังย่อรูป…');
        compressImage(f).then(function (dataUrl) {
          applyPreview(dataUrl, f.name || 'รูปพร้อมบันทึก');
          toast('พร้อมแล้ว — กดบันทึก');
          console.log('[SF-img] pending set', dataUrl.slice(0, 30), 'len', dataUrl.length);
        }).catch(function (err) {
          console.warn('[SF-img] compress fail', err);
          toast('อ่านรูปไม่สำเร็จ ลอง JPG/PNG');
        });
      });
    }

    if (clear && !clear._sfImgBound) {
      clear._sfImgBound = true;
      clear.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        pendingImage = '';
        hasNewSelection = true;
        var prev = document.getElementById('bc-img-preview');
        var ph = document.getElementById('bc-img-ph');
        var nameEl = document.getElementById('bc-img-name');
        if (prev) { prev.removeAttribute('src'); prev.style.display = 'none'; }
        if (ph) ph.textContent = 'เลือกไฟล์รูปด้านล่าง';
        if (nameEl) nameEl.textContent = '';
        clear.style.display = 'none';
        file.value = '';
        toast('จะลบรูปเมื่อกดบันทึก');
      });
    }
  }

  function loadExisting(id) {
    if (hasNewSelection) return;
    if (!wsKey() || !id) return;
    fetch(DB + '/' + rp() + '/skus/' + encodeURIComponent(id) + '.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (s) {
        if (hasNewSelection) return;
        var prev = document.getElementById('bc-img-preview');
        var ph = document.getElementById('bc-img-ph');
        var clr = document.getElementById('bc-img-clear');
        if (s && s.image) {
          if (prev) { prev.src = s.image; prev.style.display = 'block'; }
          if (ph) ph.textContent = 'รูปปัจจุบัน — เลือกไฟล์ใหม่เพื่อเปลี่ยน';
          if (clr) clr.style.display = 'inline-block';
        } else {
          if (prev) { prev.removeAttribute('src'); prev.style.display = 'none'; }
          if (ph) ph.textContent = 'เลือกไฟล์รูปด้านล่าง';
          if (clr) clr.style.display = 'none';
        }
      }).catch(function () {});
  }

  function onSheetOpen() {
    if (!ensureImageField()) return;
    var id = currentEditId();
    if (!id) return;
    if (id !== lastOpenedId) {
      lastOpenedId = id;
      pendingImage = null;
      hasNewSelection = false;
      var fi = document.getElementById('bc-img-file');
      if (fi) fi.value = '';
      loadExisting(id);
    }
  }

  function saveImageNow(id, img) {
    if (saving) return;
    if (!id || !wsKey()) return;
    saving = true;
    console.log('[SF-img] saving', id, img ? img.length : 'null');
    fetch(DB + '/' + rp() + '/skus/' + encodeURIComponent(id) + '.json', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: img || null })
    }).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      toast(img ? 'บันทึกรูปแล้ว' : 'ลบรูปแล้ว');
      pendingImage = null;
      hasNewSelection = false;
      refreshAll();
    }).catch(function (e) {
      console.warn('[SF-img] save fail', e);
      toast('บันทึกรูปไม่สำเร็จ');
    }).then(function () {
      saving = false;
    });
  }

  // เปิดชีท
  var obs = new MutationObserver(function () {
    var ov = document.getElementById('bc-ov');
    if (!ov) return;
    if (ov.classList.contains('open')) {
      onSheetOpen();
    } else {
      lastOpenedId = '';
    }
  });
  obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  // คลิกแถวสินค้า → เปิดแก้
  document.addEventListener('click', function (e) {
    var row = e.target && e.target.closest && e.target.closest('.row[data-sku-id], #prod-list .row');
    if (row) {
      setTimeout(onSheetOpen, 100);
      setTimeout(onSheetOpen, 300);
      setTimeout(onSheetOpen, 600);
    }
  }, true);

  // บันทึก — จับทันทีใน capture phase
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('#bc-save');
    if (!btn) return;

    var id = currentEditId();
    if (!id || !wsKey()) return;

    if (!hasNewSelection && pendingImage === null) {
      console.log('[SF-img] no new image to save');
      return;
    }

    var img = pendingImage;
    // บันทึกทันที
    saveImageNow(id, img);
    // กันกรณี race กับ barcode-edit
    setTimeout(function () { saveImageNow(id, img); }, 400);
  }, true);

  // วนเช็คชีทเปิดอยู่
  setInterval(function () {
    var ov = document.getElementById('bc-ov');
    if (ov && ov.classList.contains('open')) {
      ensureImageField();
    }
  }, 700);

  console.log('[SF-img] product-image hard-fix loaded');
})();
