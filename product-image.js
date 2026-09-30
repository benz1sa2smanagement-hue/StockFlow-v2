/**
 * Product image upload in EDIT sheet — stable (same UX as add-product)
 * Fix: do not clear pendingImage when MutationObserver re-fires
 */
(function () {
  'use strict';
  var DB = 'https://kiyomi-b19d0-default-rtdb.asia-southeast1.firebasedatabase.app';
  var pendingImage = null;
  var hasNewSelection = false;
  var lastOpenedId = '';
  var blockCloseUntil = 0;

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
    setTimeout(function () { t.remove(); }, 2800);
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

  function armBlock(ms) { blockCloseUntil = Date.now() + (ms || 2000); }
  function isBlocked() { return Date.now() < blockCloseUntil; }

  function ensureImageField() {
    var sheetB = document.querySelector('#bc-ov .sheet-b');
    if (!sheetB) return;

    var old = document.getElementById('bc-img-wrap');
    if (old) {
      var fi = document.getElementById('bc-img-file');
      if (fi && fi.hasAttribute('capture')) {
        old.remove();
      } else {
        wireImageControls();
        return;
      }
    }

    var wrap = document.createElement('div');
    wrap.id = 'bc-img-wrap';
    wrap.className = 'field';
    wrap.style.cssText = 'position:relative;z-index:5;pointer-events:auto';
    wrap.innerHTML =
      '<label>รูปสินค้า</label>' +
      '<div id="bc-img-box" style="border:2px dashed var(--line2,#ddd);border-radius:14px;padding:12px;text-align:center;background:var(--bg,#faf8f4);min-height:100px">' +
      '<img id="bc-img-preview" alt="" style="display:none;max-width:100%;max-height:160px;border-radius:10px;object-fit:contain;margin:0 auto 8px">' +
      '<div id="bc-img-ph" style="color:var(--ink3);font-size:13px;font-weight:600;margin-bottom:8px">เลือกไฟล์รูปด้านล่าง</div>' +
      '<div id="bc-img-name" style="font-size:12px;color:var(--ink3);margin-bottom:6px;word-break:break-all"></div>' +
      '<input type="file" id="bc-img-file" accept="image/*,.jpg,.jpeg,.png,.webp,.gif" ' +
      'style="display:block;width:100%;font-size:14px;padding:8px 0;cursor:pointer">' +
      '</div>' +
      '<button type="button" id="bc-img-clear" style="display:none;margin-top:8px;padding:8px 12px;border-radius:10px;border:1px solid var(--line);background:#fff;font-size:12px;cursor:pointer">ลบรูป</button>';

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

    file.addEventListener('click', function (e) {
      e.stopPropagation();
      armBlock(6000);
    });

    file.addEventListener('change', function (e) {
      e.stopPropagation();
      armBlock(4000);
      var f = file.files && file.files[0];
      if (!f) {
        toast('ยังไม่ได้เลือกไฟล์');
        return;
      }
      var nameEl = document.getElementById('bc-img-name');
      if (nameEl) nameEl.textContent = 'เลือกแล้ว: ' + (f.name || 'ไฟล์รูป') + ' (' + Math.round(f.size / 1024) + ' KB)';
      if (f.size > 12 * 1024 * 1024) {
        toast('ไฟล์ใหญ่เกิน 12MB');
        return;
      }
      toast('กำลังย่อรูป…');
      compressImage(f, 640, 0.72).then(function (dataUrl) {
        pendingImage = dataUrl;
        hasNewSelection = true;
        var prev = document.getElementById('bc-img-preview');
        var ph = document.getElementById('bc-img-ph');
        var clr = document.getElementById('bc-img-clear');
        if (prev) { prev.src = dataUrl; prev.style.display = 'block'; }
        if (ph) { ph.textContent = 'เลือกรูปแล้ว'; ph.style.display = 'block'; }
        if (clr) clr.style.display = 'inline-block';
        toast('พร้อมแล้ว — กดบันทึก');
        armBlock(1500);
      }).catch(function () {
        toast('อ่านรูปไม่สำเร็จ ลอง JPG/PNG');
      });
    });

    if (clear && !clear._sfWired) {
      clear._sfWired = true;
      clear.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        pendingImage = '';
        hasNewSelection = true;
        var prev = document.getElementById('bc-img-preview');
        var ph = document.getElementById('bc-img-ph');
        var nameEl = document.getElementById('bc-img-name');
        if (prev) { prev.removeAttribute('src'); prev.style.display = 'none'; }
        if (ph) { ph.textContent = 'เลือกไฟล์รูปด้านล่าง'; ph.style.display = 'block'; }
        if (nameEl) nameEl.textContent = '';
        clear.style.display = 'none';
        file.value = '';
      });
    }
  }

  function showExistingImage(id) {
    // อย่าเคลียร์รูปที่ user เพิ่งเลือก
    if (hasNewSelection) return;

    var prev = document.getElementById('bc-img-preview');
    var ph = document.getElementById('bc-img-ph');
    var nameEl = document.getElementById('bc-img-name');
    var clr = document.getElementById('bc-img-clear');
    var fi = document.getElementById('bc-img-file');
    if (fi) fi.removeAttribute('capture');
    if (!prev) return;

    if (!wsKey() || !id) {
      prev.style.display = 'none';
      if (ph) { ph.textContent = 'เลือกไฟล์รูปด้านล่าง'; ph.style.display = 'block'; }
      return;
    }

    fetch(DB + '/' + rp() + '/skus/' + encodeURIComponent(id) + '.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (s) {
        if (hasNewSelection) return;
        if (s && s.image) {
          prev.src = s.image;
          prev.style.display = 'block';
          if (ph) { ph.textContent = 'รูปปัจจุบัน (เลือกไฟล์ใหม่เพื่อเปลี่ยน)'; ph.style.display = 'block'; }
          if (nameEl) nameEl.textContent = '';
          if (clr) clr.style.display = 'inline-block';
        } else {
          prev.style.display = 'none';
          if (ph) { ph.textContent = 'เลือกไฟล์รูปด้านล่าง'; ph.style.display = 'block'; }
          if (clr) clr.style.display = 'none';
        }
      }).catch(function () {});
  }

  function onOpenSheet() {
    ensureImageField();
    var id = currentEditId();
    if (!id) return;
    // เปิดสินค้าคนละตัว → รีเซ็ตสถานะ
    if (id !== lastOpenedId) {
      lastOpenedId = id;
      pendingImage = null;
      hasNewSelection = false;
      var fi = document.getElementById('bc-img-file');
      if (fi) fi.value = '';
      showExistingImage(id);
    }
  }

  // เมื่อชีทปิด ให้รีเซ็ตเพื่อรอบถัดไป
  var obs = new MutationObserver(function () {
    var ov = document.getElementById('bc-ov');
    if (!ov) return;
    if (ov.classList.contains('open')) {
      onOpenSheet();
    } else {
      lastOpenedId = '';
      // ไม่เคลียร์ pending ตอนปิดถ้าเพิ่งบันทึก — รีเซ็ตหลังปิดครบ
      setTimeout(function () {
        if (!document.getElementById('bc-ov') || !document.getElementById('bc-ov').classList.contains('open')) {
          hasNewSelection = false;
          pendingImage = null;
        }
      }, 400);
    }
  });
  obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  // บันทึกรูปตอนกดบันทึก — อ่าน pendingImage ทันที (ก่อน barcode-edit ปิดชีท)
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('#bc-save');
    if (!btn) return;
    var id = currentEditId();
    if (!id || !wsKey()) return;

    // ถ้าไม่ได้เลือกรูปใหม่ ไม่ต้อง PATCH รูป
    if (!hasNewSelection && pendingImage === null) return;

    var imgToSave = pendingImage;
    var wasNew = hasNewSelection;

    setTimeout(function () {
      if (!wasNew && imgToSave === null) return;
      fetch(DB + '/' + rp() + '/skus/' + encodeURIComponent(id) + '.json', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imgToSave || null })
      }).then(function () {
        toast(imgToSave ? 'บันทึกรูปแล้ว' : 'ลบรูปแล้ว');
        pendingImage = null;
        hasNewSelection = false;
        refreshAll();
      }).catch(function () {
        toast('บันทึกรูปไม่สำเร็จ');
      });
    }, 500);
  }, true);

  // กันชีทปิดจาก ghost click หลังเลือกไฟล์
  document.addEventListener('click', function (e) {
    if (!isBlocked()) return;
    var ov = document.getElementById('bc-ov');
    if (!ov || !ov.classList.contains('open')) return;
    if (e.target === ov) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      armBlock(2000);
      var ov = document.getElementById('bc-ov');
      if (ov && hasNewSelection) ov.classList.add('open');
    }
  });

  setInterval(function () {
    var ov = document.getElementById('bc-ov');
    if (ov && ov.classList.contains('open')) ensureImageField();
  }, 1000);
})();
