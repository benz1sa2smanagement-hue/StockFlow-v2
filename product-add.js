/**
 * Add product on Products tab: name, SKU, barcode, units, image upload
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
    setTimeout(function () { t.remove(); }, 2800);
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

  function ensureAddBtn() {
    var page = document.getElementById('page-products');
    if (!page) return;
    var btn = document.getElementById('prod-add-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'prod-add-btn';
      btn.type = 'button';
      btn.textContent = '+ \u0e40\u0e1e\u0e34\u0e48\u0e21\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32';
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
      '<div class="sheet" style="max-height:92vh;overflow:auto">' +
      '<div class="sheet-h"><div class="sheet-t">\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e43\u0e2b\u0e21\u0e48</div>' +
      '<button type="button" class="sheet-x" id="pa-close">\u2715</button></div>' +
      '<div class="sheet-b">' +
      '<div class="field"><label>\u0e23\u0e39\u0e1b\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32</label>' +
      '<div id="pa-img-box" style="border:2px dashed var(--line2,#ddd);border-radius:14px;padding:14px;text-align:center;cursor:pointer;background:var(--bg,#faf8f4);min-height:120px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px">' +
      '<img id="pa-img-preview" alt="" style="display:none;max-width:100%;max-height:160px;border-radius:10px;object-fit:contain">' +
      '<div id="pa-img-ph" style="color:var(--ink3);font-size:13px;font-weight:600">\u0e41\u0e15\u0e30\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e2d\u0e31\u0e1b\u0e42\u0e2b\u0e25\u0e14\u0e23\u0e39\u0e1b<br><span style="font-weight:400;font-size:11px">JPG / PNG</span></div>' +
      '</div>' +
      '<input type="file" id="pa-img-file" accept="image/*" capture="environment" style="display:none">' +
      '<button type="button" id="pa-img-clear" style="display:none;margin-top:8px;padding:8px 12px;border-radius:10px;border:1px solid var(--line);background:#fff;font-size:12px;cursor:pointer">\u0e25\u0e1a\u0e23\u0e39\u0e1b</button></div>' +
      '<div class="field"><label>\u0e0a\u0e37\u0e48\u0e2d\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32 <span style="color:#b91c1c">*</span></label>' +
      '<input type="text" id="pa-name" placeholder="\u0e40\u0e0a\u0e48\u0e19 \u0e04\u0e34\u0e42\u0e22\u0e21\u0e34 \u0e17\u0e34\u0e0a\u0e0a\u0e39\u0e48\u0e14\u0e36\u0e07" autocomplete="off"></div>' +
      '<div class="field"><label>\u0e23\u0e2b\u0e31\u0e2a SKU <span style="color:#b91c1c">*</span></label>' +
      '<input type="text" id="pa-sku" placeholder="\u0e40\u0e0a\u0e48\u0e19 PULL-1PACK" autocomplete="off"></div>' +
      '<div class="field"><label>\u0e1a\u0e32\u0e23\u0e4c\u0e40\u0e04\u0e49\u0e14</label>' +
      '<input type="text" id="pa-barcode" placeholder="\u0e2a\u0e41\u0e01\u0e19\u0e2b\u0e23\u0e37\u0e2d\u0e1e\u0e34\u0e21\u0e1e\u0e4c\u0e1a\u0e32\u0e23\u0e4c\u0e40\u0e04\u0e49\u0e14" autocomplete="off" inputmode="numeric"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      '<div class="field"><label>\u0e2b\u0e19\u0e48\u0e27\u0e22\u0e1e\u0e37\u0e49\u0e19\u0e10\u0e32\u0e19</label>' +
      '<select id="pa-base-unit">' +
      '<option value="\u0e41\u0e1e\u0e47\u0e04">\u0e41\u0e1e\u0e47\u0e04</option>' +
      '<option value="\u0e0a\u0e34\u0e49\u0e19">\u0e0a\u0e34\u0e49\u0e19</option>' +
      '<option value="\u0e01\u0e25\u0e48\u0e2d\u0e07">\u0e01\u0e25\u0e48\u0e2d\u0e07</option>' +
      '<option value="\u0e21\u0e49\u0e27\u0e19">\u0e21\u0e49\u0e27\u0e19</option>' +
      '<option value="\u0e2b\u0e48\u0e2d">\u0e2b\u0e48\u0e2d</option>' +
      '<option value="\u0e16\u0e38\u0e07">\u0e16\u0e38\u0e07</option>' +
      '<option value="\u0e02\u0e27\u0e14">\u0e02\u0e27\u0e14</option>' +
      '<option value="\u0e2d\u0e31\u0e19">\u0e2d\u0e31\u0e19</option>' +
      '</select></div>' +
      '<div class="field"><label>\u0e2b\u0e19\u0e48\u0e27\u0e22\u0e25\u0e31\u0e07</label>' +
      '<select id="pa-case-unit">' +
      '<option value="\u0e25\u0e31\u0e07">\u0e25\u0e31\u0e07</option>' +
      '<option value="\u0e01\u0e25\u0e48\u0e2d\u0e07">\u0e01\u0e25\u0e48\u0e2d\u0e07</option>' +
      '<option value="\u0e41\u0e1e\u0e47\u0e04">\u0e41\u0e1e\u0e47\u0e04</option>' +
      '<option value="\u0e0a\u0e38\u0e14">\u0e0a\u0e38\u0e14</option>' +
      '</select></div></div>' +
      '<div class="field"><label>\u0e08\u0e33\u0e19\u0e27\u0e19\u0e15\u0e48\u0e2d\u0e25\u0e31\u0e07</label>' +
      '<input type="number" id="pa-ppc" min="1" step="1" value="1">' +
      '<div style="font-size:11px;color:var(--ink3);margin-top:4px">\u0e16\u0e49\u0e32 1 \u0e25\u0e31\u0e07 = 4 \u0e41\u0e1e\u0e47\u0e04 \u0e43\u0e2b\u0e49\u0e43\u0e2a\u0e48 4</div></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      '<div class="field"><label>\u0e23\u0e32\u0e04\u0e32\u0e17\u0e38\u0e19</label>' +
      '<input type="number" id="pa-cost" min="0" step="any" value="0"></div>' +
      '<div class="field"><label>\u0e23\u0e32\u0e04\u0e32\u0e02\u0e32\u0e22</label>' +
      '<input type="number" id="pa-sale" min="0" step="any" value="0"></div></div>' +
      '<div class="field"><label>\u0e2b\u0e21\u0e27\u0e14\u0e2b\u0e21\u0e39\u0e48</label>' +
      '<input type="text" id="pa-cat" placeholder="\u0e40\u0e0a\u0e48\u0e19 \u0e17\u0e34\u0e0a\u0e0a\u0e39\u0e48" autocomplete="off"></div>' +
      '<button type="button" class="btn btn-ink" id="pa-save" style="width:100%;margin-top:8px;padding:14px;font-size:15px;font-weight:800">\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e43\u0e2b\u0e21\u0e48</button>' +
      '</div></div>';
    document.body.appendChild(ov);

    document.getElementById('pa-close').addEventListener('click', function (e) {
      e.preventDefault();
      ov.classList.remove('open');
    });
    ov.addEventListener('click', function (e) {
      if (e.target === ov) ov.classList.remove('open');
    });

    var box = document.getElementById('pa-img-box');
    var file = document.getElementById('pa-img-file');
    var prev = document.getElementById('pa-img-preview');
    var ph = document.getElementById('pa-img-ph');
    var clearBtn = document.getElementById('pa-img-clear');

    box.addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      compressImage(f, 720, 0.72).then(function (data) {
        pendingImage = data;
        prev.src = data;
        prev.style.display = 'block';
        ph.style.display = 'none';
        clearBtn.style.display = 'inline-block';
      }).catch(function () { toast('\u0e2d\u0e48\u0e32\u0e19\u0e23\u0e39\u0e1b\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08'); });
    });
    clearBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      pendingImage = null;
      prev.src = '';
      prev.style.display = 'none';
      ph.style.display = 'block';
      clearBtn.style.display = 'none';
      file.value = '';
    });

    document.getElementById('pa-save').addEventListener('click', function (e) {
      e.preventDefault();
      saveNewProduct();
    });
  }

  function openAddSheet() {
    if (!wsKey()) {
      toast('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e23\u0e30\u0e1a\u0e1a');
      return;
    }
    ensureSheet();
    pendingImage = null;
    document.getElementById('pa-name').value = '';
    document.getElementById('pa-sku').value = '';
    document.getElementById('pa-barcode').value = '';
    document.getElementById('pa-base-unit').value = '\u0e41\u0e1e\u0e47\u0e04';
    document.getElementById('pa-case-unit').value = '\u0e25\u0e31\u0e07';
    document.getElementById('pa-ppc').value = '1';
    document.getElementById('pa-cost').value = '0';
    document.getElementById('pa-sale').value = '0';
    document.getElementById('pa-cat').value = '';
    var prev = document.getElementById('pa-img-preview');
    var ph = document.getElementById('pa-img-ph');
    var clearBtn = document.getElementById('pa-img-clear');
    var file = document.getElementById('pa-img-file');
    if (prev) { prev.src = ''; prev.style.display = 'none'; }
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
      toast('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e23\u0e30\u0e1a\u0e1a');
      return;
    }
    var name = (document.getElementById('pa-name').value || '').trim();
    var unitSku = (document.getElementById('pa-sku').value || '').trim();
    var barcode = (document.getElementById('pa-barcode').value || '').trim();
    var baseUnit = document.getElementById('pa-base-unit').value || '\u0e41\u0e1e\u0e47\u0e04';
    var caseUnit = document.getElementById('pa-case-unit').value || '\u0e25\u0e31\u0e07';
    var ppc = parseInt(document.getElementById('pa-ppc').value, 10) || 1;
    if (ppc < 1) ppc = 1;
    var cost = parseFloat(document.getElementById('pa-cost').value) || 0;
    var sale = parseFloat(document.getElementById('pa-sale').value) || 0;
    var cat = (document.getElementById('pa-cat').value || '').trim();

    if (!name) {
      toast('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e43\u0e2a\u0e48\u0e0a\u0e37\u0e48\u0e2d\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32');
      document.getElementById('pa-name').focus();
      return;
    }
    if (!unitSku) {
      toast('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e43\u0e2a\u0e48\u0e23\u0e2b\u0e31\u0e2a SKU');
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
      btn.textContent = '\u0e01\u0e33\u0e25\u0e31\u0e07\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u2026';
    }

    fetch(DB + '/' + rp() + '/skus/' + encodeURIComponent(id) + '.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function () {
      toast('\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e41\u0e25\u0e49\u0e27: ' + name);
      document.getElementById('pa-ov').classList.remove('open');
      pendingImage = null;
      setTimeout(function () { location.reload(); }, 700);
    }).catch(function (err) {
      toast('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08: ' + (err && err.message || err));
    }).finally(function () {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e43\u0e2b\u0e21\u0e48';
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
      '<div class="field"><label>\u0e2b\u0e19\u0e48\u0e27\u0e22\u0e1e\u0e37\u0e49\u0e19\u0e10\u0e32\u0e19</label>' +
      '<select id="bc-base-unit"><option value="\u0e41\u0e1e\u0e47\u0e04">\u0e41\u0e1e\u0e47\u0e04</option><option value="\u0e0a\u0e34\u0e49\u0e19">\u0e0a\u0e34\u0e49\u0e19</option><option value="\u0e01\u0e25\u0e48\u0e2d\u0e07">\u0e01\u0e25\u0e48\u0e2d\u0e07</option><option value="\u0e21\u0e49\u0e27\u0e19">\u0e21\u0e49\u0e27\u0e19</option><option value="\u0e2b\u0e48\u0e2d">\u0e2b\u0e48\u0e2d</option><option value="\u0e16\u0e38\u0e07">\u0e16\u0e38\u0e07</option><option value="\u0e02\u0e27\u0e14">\u0e02\u0e27\u0e14</option><option value="\u0e2d\u0e31\u0e19">\u0e2d\u0e31\u0e19</option></select></div>' +
      '<div class="field"><label>\u0e2b\u0e19\u0e48\u0e27\u0e22\u0e25\u0e31\u0e07</label>' +
      '<select id="bc-case-unit"><option value="\u0e25\u0e31\u0e07">\u0e25\u0e31\u0e07</option><option value="\u0e01\u0e25\u0e48\u0e2d\u0e07">\u0e01\u0e25\u0e48\u0e2d\u0e07</option><option value="\u0e41\u0e1e\u0e47\u0e04">\u0e41\u0e1e\u0e47\u0e04</option><option value="\u0e0a\u0e38\u0e14">\u0e0a\u0e38\u0e14</option></select></div></div>' +
      '<div class="field"><label>\u0e08\u0e33\u0e19\u0e27\u0e19\u0e15\u0e48\u0e2d\u0e25\u0e31\u0e07</label>' +
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
          if (b) b.value = s.baseUnit || '\u0e41\u0e1e\u0e47\u0e04';
          if (c) c.value = s.caseUnit || '\u0e25\u0e31\u0e07';
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
