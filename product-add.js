/**
 * Add product on Products tab: name, SKU, barcode, units, image upload
 * v3: block ghost-click close after file picker (Chrome mobile flicker fix)
 */
(function () {
  'use strict';
  var DB = 'https://kiyomi-b19d0-default-rtdb.asia-southeast1.firebasedatabase.app';
  var pendingImage = null;
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
      if (!file || !file.type || file.type.indexOf('image/') !== 0) {
        reject(new Error('not-image'));
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          try {
            var w = img.width, h = img.height;
            if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
            var canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            var data = canvas.toDataURL('image/jpeg', quality);
            if (data.length > 180000 && quality > 0.45) {
              data = canvas.toDataURL('image/jpeg', 0.45);
            }
            resolve(data);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = function () { reject(new Error('img-load')); };
        img.src = reader.result;
      };
      reader.onerror = function () { reject(new Error('read')); };
      reader.readAsDataURL(file);
    });
  }

  function isBlocked() {
    return Date.now() < blockCloseUntil;
  }

  function armBlock(ms) {
    blockCloseUntil = Date.now() + (ms || 2000);
  }

  function ensureAddBtn() {
    var page = document.getElementById('page-products');
    if (!page) return;
    var btn = document.getElementById('prod-add-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'prod-add-btn';
      btn.type = 'button';
      btn.textContent = '+ เพิ่มสินค้า';
      btn.style.cssText = 'display:block;width:100%;box-sizing:border-box;margin:8px 0 14px;padding:14px 16px;border-radius:14px;border:none;background:#0C0E12;color:#fff;font-size:15px;font-weight:800;cursor:pointer;z-index:5;position:relative';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        openAddSheet();
      });
    }
    var list = document.getElementById('prod-list');
    var title = page.querySelector('.pt');
    if (list && list.parentNode) {
      if (btn.parentNode !== list.parentNode || btn.nextSibling !== list) {
        list.parentNode.insertBefore(btn, list);
      }
    } else if (title && title.nextSibling !== btn) {
      title.parentNode.insertBefore(btn, title.nextSibling);
    } else if (!btn.parentNode) {
      page.insertBefore(btn, page.firstChild);
    }
  }

  function ensureSheet() {
    if (document.getElementById('pa-ov')) return;
    var ov = document.createElement('div');
    ov.className = 'ov';
    ov.id = 'pa-ov';
    ov.innerHTML =
      '<div class="sheet" id="pa-sheet" style="max-height:92vh;overflow:auto">' +
      '<div class="sheet-h"><div class="sheet-t">เพิ่มสินค้าใหม่</div>' +
      '<button type="button" class="sheet-x" id="pa-close">\u2715</button></div>' +
      '<div class="sheet-b">' +
      '<div class="field"><label>รูปสินค้า</label>' +
      '<label id="pa-img-box" for="pa-img-file" style="display:block;position:relative;border:2px dashed var(--line2,#ddd);border-radius:14px;padding:14px;text-align:center;cursor:pointer;background:var(--bg,#faf8f4);min-height:120px;z-index:5;">' +
      '<img id="pa-img-preview" alt="" style="display:none;max-width:100%;max-height:160px;border-radius:10px;object-fit:contain;margin:0 auto;pointer-events:none">' +
      '<div id="pa-img-ph" style="color:var(--ink3);font-size:13px;font-weight:600;pointer-events:none">แตะเพื่ออัปโหลดรูป<br><span style="font-weight:400;font-size:11px">JPG / PNG · กดแล้วเลือกจากแกลเลอรี</span></div>' +
      '</label>' +
      '<input type="file" id="pa-img-file" accept="image/*" style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;clip:rect(0,0,0,0);">' +
      '<button type="button" id="pa-img-clear" style="display:none;margin-top:8px;padding:8px 12px;border-radius:10px;border:1px solid var(--line);background:#fff;font-size:12px;cursor:pointer">ลบรูป</button></div>' +
      '<div class="field"><label>ชื่อสินค้า <span style="color:#b91c1c">*</span></label>' +
      '<input type="text" id="pa-name" placeholder="เช่น คิโยมิ ทิชชู่ดึง" autocomplete="off"></div>' +
      '<div class="field"><label>รหัส SKU <span style="color:#b91c1c">*</span></label>' +
      '<input type="text" id="pa-sku" placeholder="เช่น PULL-1PACK" autocomplete="off"></div>' +
      '<div class="field"><label>บาร์โค้ด</label>' +
      '<input type="text" id="pa-barcode" placeholder="สแกนหรือพิมพ์บาร์โค้ด" autocomplete="off" inputmode="numeric"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      '<div class="field"><label>หน่วยพื้นฐาน</label>' +
      '<select id="pa-base-unit">' +
      '<option value="แพ็ค">แพ็ค</option>' +
      '<option value="ชิ้น">ชิ้น</option>' +
      '<option value="กล่อง">กล่อง</option>' +
      '<option value="ม้วน">ม้วน</option>' +
      '<option value="ห่อ">ห่อ</option>' +
      '<option value="ถุง">ถุง</option>' +
      '<option value="ขวด">ขวด</option>' +
      '<option value="อัน">อัน</option>' +
      '</select></div>' +
      '<div class="field"><label>หน่วยลัง</label>' +
      '<select id="pa-case-unit">' +
      '<option value="ลัง">ลัง</option>' +
      '<option value="กล่อง">กล่อง</option>' +
      '<option value="แพ็ค">แพ็ค</option>' +
      '<option value="ชุด">ชุด</option>' +
      '</select></div></div>' +
      '<div class="field"><label>จำนวนต่อลัง</label>' +
      '<input type="number" id="pa-ppc" min="1" step="1" value="1">' +
      '<div style="font-size:11px;color:var(--ink3);margin-top:4px">ถ้า 1 ลัง = 4 แพ็ค ให้ใส่ 4</div></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      '<div class="field"><label>ราคาทุน</label>' +
      '<input type="number" id="pa-cost" min="0" step="any" value="0"></div>' +
      '<div class="field"><label>ราคาขาย</label>' +
      '<input type="number" id="pa-sale" min="0" step="any" value="0"></div></div>' +
      '<div class="field"><label>หมวดหมู่</label>' +
      '<input type="text" id="pa-cat" placeholder="เช่น ทิชชู่" autocomplete="off"></div>' +
      '<button type="button" class="btn btn-ink" id="pa-save" style="width:100%;margin-top:8px;padding:14px;font-size:15px;font-weight:800">บันทึกสินค้าใหม่</button>' +
      '</div></div>';
    document.body.appendChild(ov);

    function tryClose(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      if (isBlocked()) return;
      ov.classList.remove('open');
    }

    document.getElementById('pa-close').addEventListener('click', tryClose);

    ov.addEventListener('click', function (e) {
      if (e.target !== ov) return;
      if (isBlocked()) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      ov.classList.remove('open');
    });

    ['click', 'pointerdown', 'pointerup', 'touchend', 'mousedown', 'mouseup'].forEach(function (evt) {
      ov.addEventListener(evt, function (e) {
        if (!isBlocked()) return;
        var sheet = document.getElementById('pa-sheet');
        if (sheet && sheet.contains(e.target) && e.target !== ov) return;
        if (e.target === ov || !sheet || !sheet.contains(e.target)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }, true);
    });

    var file = document.getElementById('pa-img-file');
    var prev = document.getElementById('pa-img-preview');
    var ph = document.getElementById('pa-img-ph');
    var clearBtn = document.getElementById('pa-img-clear');
    var imgBox = document.getElementById('pa-img-box');

    function applyPreview(data) {
      pendingImage = data;
      if (prev) {
        prev.src = data;
        prev.style.display = 'block';
      }
      if (ph) ph.style.display = 'none';
      if (clearBtn) clearBtn.style.display = 'inline-block';
      ov.classList.add('open');
    }

    function onFileSelected(f) {
      if (!f) {
        armBlock(1500);
        ov.classList.add('open');
        return;
      }
      if (f.size > 8 * 1024 * 1024) {
        toast('ไฟล์ใหญ่เกิน 8MB');
        armBlock(1500);
        ov.classList.add('open');
        return;
      }
      toast('กำลังย่อรูป…');
      armBlock(3000);
      ov.classList.add('open');
      compressImage(f, 720, 0.72).then(function (data) {
        applyPreview(data);
        toast('พร้อมแล้ว — กดบันทึก');
        armBlock(1500);
        ov.classList.add('open');
      }).catch(function () {
        toast('อ่านรูปไม่สำเร็จ');
        armBlock(1500);
        ov.classList.add('open');
      });
    }

    if (imgBox) {
      imgBox.addEventListener('click', function () {
        armBlock(5000);
      });
    }

    if (file) {
      file.addEventListener('click', function () {
        armBlock(5000);
      });
      file.addEventListener('change', function () {
        armBlock(3000);
        ov.classList.add('open');
        var f = file.files && file.files[0];
        onFileSelected(f);
        setTimeout(function () {
          try { file.value = ''; } catch (err) {}
        }, 500);
      });
    }

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && document.getElementById('pa-ov')) {
        armBlock(2500);
        var o = document.getElementById('pa-ov');
        if (o) o.classList.add('open');
      }
    });
    window.addEventListener('focus', function () {
      if (document.getElementById('pa-ov')) {
        armBlock(2000);
        var o = document.getElementById('pa-ov');
        if (o && pendingImage !== null) o.classList.add('open');
      }
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        pendingImage = null;
        if (prev) { prev.removeAttribute('src'); prev.style.display = 'none'; }
        if (ph) ph.style.display = 'block';
        clearBtn.style.display = 'none';
        if (file) file.value = '';
      });
    }

    document.getElementById('pa-save').addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      saveNewProduct();
    });
  }

  function openAddSheet() {
    if (!wsKey()) {
      toast('ยังไม่ได้เข้าสู่ระบบ');
      return;
    }
    ensureSheet();
    pendingImage = null;
    blockCloseUntil = 0;
    document.getElementById('pa-name').value = '';
    document.getElementById('pa-sku').value = '';
    document.getElementById('pa-barcode').value = '';
    document.getElementById('pa-base-unit').value = 'แพ็ค';
    document.getElementById('pa-case-unit').value = 'ลัง';
    document.getElementById('pa-ppc').value = '1';
    document.getElementById('pa-cost').value = '0';
    document.getElementById('pa-sale').value = '0';
    document.getElementById('pa-cat').value = '';
    var prev = document.getElementById('pa-img-preview');
    var ph = document.getElementById('pa-img-ph');
    var clearBtn = document.getElementById('pa-img-clear');
    var file = document.getElementById('pa-img-file');
    if (prev) { prev.removeAttribute('src'); prev.style.display = 'none'; }
    if (ph) ph.style.display = 'block';
    if (clearBtn) clearBtn.style.display = 'none';
    if (file) file.value = '';
    document.getElementById('pa-ov').classList.add('open');
    setTimeout(function () {
      var n = document.getElementById('pa-name');
      if (n) n.focus();
    }, 200);
  }

  function saveNewProduct() {
    if (!wsKey()) {
      toast('ยังไม่ได้เข้าสู่ระบบ');
      return;
    }
    var name = (document.getElementById('pa-name').value || '').trim();
    var unitSku = (document.getElementById('pa-sku').value || '').trim();
    var barcode = (document.getElementById('pa-barcode').value || '').trim();
    var baseUnit = document.getElementById('pa-base-unit').value || 'แพ็ค';
    var caseUnit = document.getElementById('pa-case-unit').value || 'ลัง';
    var ppc = parseInt(document.getElementById('pa-ppc').value, 10) || 1;
    if (ppc < 1) ppc = 1;
    var cost = parseFloat(document.getElementById('pa-cost').value) || 0;
    var sale = parseFloat(document.getElementById('pa-sale').value) || 0;
    var cat = (document.getElementById('pa-cat').value || '').trim();

    if (!name) {
      toast('กรุณาใส่ชื่อสินค้า');
      document.getElementById('pa-name').focus();
      return;
    }
    if (!unitSku) {
      toast('กรุณาใส่รหัส SKU');
      document.getElementById('pa-sku').focus();
      return;
    }

    var id = 'sku_' + Date.now();
    var payload = {
      name: name,
      unitSku: unitSku,
      barcode: barcode || '',
      baseUnit: baseUnit,
      caseUnit: caseUnit,
      piecesPerCase: ppc,
      caseSku: '1',
      costPrice: cost,
      salePrice: sale,
      category: cat,
      updatedAt: Date.now()
    };
    if (pendingImage) payload.image = pendingImage;

    var btn = document.getElementById('pa-save');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'กำลังบันทึก…';
    }

    fetch(DB + '/' + rp() + '/skus/' + encodeURIComponent(id) + '.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function () {
      toast('เพิ่มสินค้าแล้ว: ' + name);
      blockCloseUntil = 0;
      document.getElementById('pa-ov').classList.remove('open');
      pendingImage = null;
      setTimeout(function () { location.reload(); }, 700);
    }).catch(function (err) {
      toast('บันทึกไม่สำเร็จ: ' + (err && err.message || err));
    }).finally(function () {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'บันทึกสินค้าใหม่';
      }
    });
  }

  function enhanceEditSheet() {
    var body = document.querySelector('#bc-ov .sheet-b');
    if (!body || document.getElementById('bc-base-unit')) return;
    var skuField = document.getElementById('bc-sku');
    if (!skuField) return;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px">' +
      '<div class="field"><label>หน่วยพื้นฐาน</label>' +
      '<select id="bc-base-unit"><option value="แพ็ค">แพ็ค</option><option value="ชิ้น">ชิ้น</option><option value="กล่อง">กล่อง</option><option value="ม้วน">ม้วน</option><option value="ห่อ">ห่อ</option><option value="ถุง">ถุง</option><option value="ขวด">ขวด</option><option value="อัน">อัน</option></select></div>' +
      '<div class="field"><label>หน่วยลัง</label>' +
      '<select id="bc-case-unit"><option value="ลัง">ลัง</option><option value="กล่อง">กล่อง</option><option value="แพ็ค">แพ็ค</option><option value="ชุด">ชุด</option></select></div></div>' +
      '<div class="field"><label>จำนวนต่อลัง</label>' +
      '<input type="number" id="bc-ppc" min="1" step="1" value="1"></div>';
    var saveBtn = document.getElementById('bc-save');
    if (saveBtn) body.insertBefore(wrap, saveBtn);
    else body.appendChild(wrap);

    if (!window.__bcSavePatched) {
      window.__bcSavePatched = true;
      document.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest && e.target.closest('#bc-save');
        if (!btn) return;
        var idEl = document.getElementById('bc-id');
        var idText = idEl && idEl.textContent || '';
        var m = idText.match(/ID:\s*(.+)/);
        var id = m ? m[1].trim() : '';
        if (!id || !wsKey()) return;
        var base = document.getElementById('bc-base-unit');
        var cas = document.getElementById('bc-case-unit');
        var ppc = document.getElementById('bc-ppc');
        if (!base && !cas && !ppc) return;
        var patch = { updatedAt: Date.now() };
        if (base) patch.baseUnit = base.value;
        if (cas) patch.caseUnit = cas.value;
        if (ppc) patch.piecesPerCase = parseInt(ppc.value, 10) || 1;
        setTimeout(function () {
          fetch(DB + '/' + rp() + '/skus/' + encodeURIComponent(id) + '.json', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch)
          }).catch(function () {});
        }, 500);
      }, true);
    }
  }

  document.addEventListener('click', function (e) {
    var row = e.target && e.target.closest && e.target.closest('.row[data-sku-id]');
    if (!row) return;
    var id = row.getAttribute('data-sku-id');
    if (!id || !wsKey()) return;
    setTimeout(function () {
      enhanceEditSheet();
      fetch(DB + '/' + rp() + '/skus/' + encodeURIComponent(id) + '.json', { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (s) {
          if (!s) return;
          var b = document.getElementById('bc-base-unit');
          var c = document.getElementById('bc-case-unit');
          var p = document.getElementById('bc-ppc');
          if (b) b.value = s.baseUnit || 'แพ็ค';
          if (c) c.value = s.caseUnit || 'ลัง';
          if (p) p.value = String(s.piecesPerCase || 1);
        }).catch(function () {});
    }, 250);
  }, true);

  function wire() {
    ensureAddBtn();
    enhanceEditSheet();
  }

  window.__sfEnsureAddProduct = wire;
  setInterval(wire, 600);
  setTimeout(wire, 200);
  setTimeout(wire, 800);
  setTimeout(wire, 2000);
  setTimeout(wire, 4000);
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.ni[data-page="products"]');
    if (btn) setTimeout(wire, 200);
  }, true);
})();
