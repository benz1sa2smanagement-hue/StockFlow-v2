/**
 * BigSeller CSV / Excel import for Pack tab
 * Supports Thai BigSeller columns + .xlsx via SheetJS
 */
(function () {
  'use strict';
  var skusCache = {};

  function toast(msg) {
    var w = document.getElementById('toast-wrap');
    if (!w) return;
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    w.innerHTML = '';
    w.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  }
  function wsKey() { return sessionStorage.getItem('sf_session_ws') || ''; }
  function roomId() { return localStorage.getItem('sf_room_' + wsKey()) || 'WH_A'; }

  function loadSkus() {
    if (!wsKey()) return Promise.resolve({});
    var url = 'https://kiyomi-b19d0-default-rtdb.asia-southeast1.firebasedatabase.app/ws_' +
      wsKey() + '/rooms/' + roomId() + '/skus.json';
    return fetch(url, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      skusCache = d || {}; return skusCache;
    }).catch(function () { return {}; });
  }

  function loadSheetJs() {
    return new Promise(function (resolve, reject) {
      if (window.XLSX) { resolve(); return; }
      var s = document.createElement('script');
      s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Excel library failed')); };
      document.head.appendChild(s);
    });
  }

  function parseCsvText(text) {
    var rows = [], i = 0, field = '', row = [], inQ = false;
    text = String(text || '').replace(/^\uFEFF/, '');
    while (i < text.length) {
      var c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
        else field += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n' || c === '\r') {
          if (c === '\r' && text[i + 1] === '\n') i++;
          row.push(field); field = '';
          if (row.some(function (x) { return String(x).trim(); })) rows.push(row);
          row = [];
        } else field += c;
      }
      i++;
    }
    if (field.length || row.length) {
      row.push(field);
      if (row.some(function (x) { return String(x).trim(); })) rows.push(row);
    }
    if (!rows.length) return { headers: [], data: [] };
    var headers = rows[0].map(function (h) { return String(h || '').trim(); });
    var data = rows.slice(1).map(function (r) {
      var o = {};
      headers.forEach(function (h, idx) { o[h] = r[idx] != null ? String(r[idx]).trim() : ''; });
      return o;
    });
    return { headers: headers, data: data };
  }

  function sheetToParsed(workbook) {
    var sheet = workbook.Sheets[workbook.SheetNames[0]];
    var aoa = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    if (!aoa.length) return { headers: [], data: [] };
    var headers = aoa[0].map(function (h) { return String(h || '').trim(); });
    var data = [];
    for (var r = 1; r < aoa.length; r++) {
      var row = aoa[r] || [];
      if (!row.some(function (x) { return String(x || '').trim(); })) continue;
      var o = {};
      headers.forEach(function (h, idx) { o[h] = row[idx] != null ? String(row[idx]).trim() : ''; });
      data.push(o);
    }
    return { headers: headers, data: data };
  }

  function pickCol(headers, candidates) {
    var lower = headers.map(function (h) { return h.toLowerCase(); });
    for (var c = 0; c < candidates.length; c++) {
      var want = candidates[c].toLowerCase();
      for (var i = 0; i < lower.length; i++) {
        if (lower[i] === want || lower[i].indexOf(want) >= 0) return headers[i];
      }
    }
    for (var c2 = 0; c2 < candidates.length; c2++) {
      for (var j = 0; j < headers.length; j++) {
        if (headers[j] === candidates[c2]) return headers[j];
      }
    }
    return null;
  }

  function matchSku(skuVal, nameVal, barcodeVal) {
    var keys = Object.keys(skusCache);
    var sv = (skuVal || '').trim();
    var nv = (nameVal || '').trim();
    var bv = (barcodeVal || '').trim();
    var i, id, s;
    if (sv && skusCache[sv]) return { id: sv, s: skusCache[sv] };
    if (bv) {
      for (i = 0; i < keys.length; i++) {
        id = keys[i]; s = skusCache[id] || {};
        if (String(s.barcode || '') === bv) return { id: id, s: s };
      }
    }
    if (sv) {
      var su = sv.toUpperCase().replace(/\s+/g, '');
      for (i = 0; i < keys.length; i++) {
        id = keys[i]; s = skusCache[id] || {};
        var candidates = [s.unitSku, s.sku, id, s.name].map(function (x) {
          return String(x || '').toUpperCase().replace(/\s+/g, '');
        });
        if (candidates.indexOf(su) >= 0) return { id: id, s: s };
      }
    }
    if (nv) {
      var nu = nv.toUpperCase();
      for (i = 0; i < keys.length; i++) {
        id = keys[i]; s = skusCache[id] || {};
        if (String(s.name || '').toUpperCase() === nu) return { id: id, s: s };
      }
    }
    return null;
  }

  function colMap(headers) {
    return {
      order: pickCol(headers, ['\u0e2b\u0e21\u0e32\u0e22\u0e40\u0e25\u0e02\u0e04\u0e33\u0e2a\u0e31\u0e48\u0e07\u0e0b\u0e37\u0e49\u0e2d', 'order id', 'orderid', 'order_id', 'order no', 'order number']),
      track: pickCol(headers, ['\u0e2b\u0e21\u0e32\u0e22\u0e40\u0e25\u0e02\u0e1e\u0e28\u0e38', '\u0e2b\u0e21\u0e32\u0e22\u0e40\u0e25\u0e02\u0e41\u0e17\u0e23\u0e04\u0e01\u0e4c\u0e01\u0e34\u0e49\u0e07', 'tracking', 'tracking number', 'package id']),
      sku: pickCol(headers, ['SKU', 'sku', 'seller sku', 'SKU Merchant', '\u0e23\u0e2b\u0e31\u0e2a\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32']),
      name: pickCol(headers, ['\u0e0a\u0e37\u0e48\u0e2d\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32', 'product name', 'product', 'name', '\u0e0a\u0e37\u0e48\u0e2d\u0e15\u0e31\u0e27\u0e40\u0e25\u0e37\u0e2d\u0e01']),
      qty: pickCol(headers, ['\u0e08\u0e33\u0e19\u0e27\u0e19', 'quantity', 'qty', 'amount']),
      barcode: pickCol(headers, ['barcode', 'ean', 'upc', '\u0e1a\u0e32\u0e23\u0e4c\u0e40\u0e04\u0e49\u0e14']),
      plat: pickCol(headers, ['\u0e41\u0e1e\u0e25\u0e15\u0e1f\u0e2d\u0e23\u0e4c\u0e21', 'platform', 'channel', 'shop'])
    };
  }

  function ensureCsvUi() {
    var page = document.getElementById('page-pack');
    if (!page || document.getElementById('pack-csv-file')) return;
    var card = page.querySelector('.card');
    if (!card) return;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="field" style="margin-bottom:8px">' +
      '<label>\u0e44\u0e1f\u0e25\u0e4c BigSeller (CSV / Excel)</label>' +
      '<input type="file" id="pack-csv-file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style="font-size:13px;width:100%">' +
      '</div>' +
      '<div id="pack-csv-status" style="font-size:11px;color:var(--ink3);margin-bottom:8px">\u0e23\u0e2d\u0e07\u0e23\u0e31\u0e1a CSV \u0e41\u0e25\u0e30 Excel \u0e08\u0e32\u0e01 BigSeller</div>' +
      '<div id="pack-csv-orders" style="display:none;margin-bottom:12px"></div>';
    card.insertBefore(wrap, card.firstChild);
  }

  function applyOrderRows(rows, map, orderId) {
    var resetBtn = document.getElementById('pack-reset');
    if (resetBtn) resetBtn.click();
    var firstTrack = '', firstPlat = '', added = 0, skipped = 0, skippedSku = [];
    var sel = document.getElementById('pack-add-sku');
    var qtyEl = document.getElementById('pack-add-qty');
    var addBtn = document.getElementById('pack-add-btn');
    rows.forEach(function (row) {
      var skuV = map.sku ? row[map.sku] : '';
      var nameV = map.name ? row[map.name] : '';
      var barV = map.barcode ? row[map.barcode] : '';
      var qty = parseInt(map.qty ? row[map.qty] : '1', 10) || 1;
      if (!firstTrack && map.track) firstTrack = row[map.track] || '';
      if (!firstPlat && map.plat) firstPlat = row[map.plat] || '';
      var m = matchSku(skuV, nameV, barV);
      if (!m) {
        skipped++;
        if (skuV && skippedSku.indexOf(skuV) < 0) skippedSku.push(skuV);
        return;
      }
      if (sel && addBtn && qtyEl) {
        var has = false;
        for (var oi = 0; oi < sel.options.length; oi++) if (sel.options[oi].value === m.id) has = true;
        if (!has) {
          var opt = document.createElement('option');
          opt.value = m.id; opt.textContent = (m.s.name || m.id);
          sel.appendChild(opt);
        }
        sel.value = m.id; qtyEl.value = String(qty); addBtn.click(); added++;
      }
    });
    var orderInput = document.getElementById('pack-order');
    if (orderInput) orderInput.value = firstTrack || orderId || '';
    if (firstPlat) {
      var p = firstPlat.toLowerCase();
      document.querySelectorAll('#pack-plat button').forEach(function (b) {
        var pp = (b.getAttribute('data-pplat') || '').toLowerCase();
        if (pp && p.indexOf(pp) >= 0) b.click();
      });
    }
    var statusEl = document.getElementById('pack-csv-status');
    var msg = '\u0e42\u0e2b\u0e25\u0e14 ' + (orderId || '') + ' \u00b7 \u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48 ' + added +
      (skipped ? ' \u00b7 \u0e02\u0e49\u0e32\u0e21 ' + skipped + (skippedSku.length ? ' (' + skippedSku.slice(0, 6).join(', ') + ')' : '') : '');
    toast(msg);
    if (statusEl) statusEl.textContent = msg;
  }

  function showOrderPicker(parsed) {
    var map = colMap(parsed.headers);
    var box = document.getElementById('pack-csv-orders');
    var statusEl = document.getElementById('pack-csv-status');
    if (!map.sku && !map.name && !map.barcode) {
      toast('\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e04\u0e2d\u0e25\u0e31\u0e21\u0e19\u0e4c SKU');
      if (statusEl) statusEl.textContent = parsed.headers.slice(0, 8).join(', ');
      return;
    }
    var groups = {}, orderList = [];
    parsed.data.forEach(function (row) {
      var oid = map.order ? (row[map.order] || '') : '';
      if (!oid) oid = map.track ? (row[map.track] || '') : 'NO-ORDER';
      if (!groups[oid]) { groups[oid] = []; orderList.push(oid); }
      groups[oid].push(row);
    });
    if (orderList.length === 1) {
      if (box) box.style.display = 'none';
      applyOrderRows(groups[orderList[0]], map, orderList[0]);
      return;
    }
    if (!box) { applyOrderRows(parsed.data, map, orderList[0]); return; }
    box.style.display = 'block';
    box.innerHTML =
      '<div style="font-size:12px;font-weight:600;margin-bottom:6px">\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c (' + orderList.length + ')</div>' +
      '<select id="pack-csv-order-sel" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--line2);font-size:13px;margin-bottom:8px">' +
      orderList.map(function (oid) {
        var n = groups[oid].length;
        var skus = groups[oid].map(function (r) { return map.sku ? r[map.sku] : ''; }).filter(Boolean).join(', ');
        return '<option value="' + oid.replace(/"/g, '') + '">' + oid + ' \u00b7 ' + n + ' \u00b7 ' + skus.slice(0, 40) + '</option>';
      }).join('') +
      '</select>' +
      '<button type="button" class="btn btn-ink" id="pack-csv-load-order" style="width:100%;padding:10px;border-radius:12px">\u0e42\u0e2b\u0e25\u0e14\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e19\u0e35\u0e49</button>';
    document.getElementById('pack-csv-load-order').onclick = function () {
      var oid = document.getElementById('pack-csv-order-sel').value;
      applyOrderRows(groups[oid] || [], map, oid);
    };
    if (statusEl) statusEl.textContent = '\u0e1e\u0e1a ' + orderList.length + ' \u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c \u2014 \u0e40\u0e25\u0e37\u0e2d\u0e01\u0e41\u0e25\u0e49\u0e27\u0e01\u0e14\u0e42\u0e2b\u0e25\u0e14';
  }

  function doImportFile(file) {
    var name = (file.name || '').toLowerCase();
    var statusEl = document.getElementById('pack-csv-status');
    if (statusEl) statusEl.textContent = '\u0e01\u0e33\u0e25\u0e31\u0e07\u0e2d\u0e48\u0e32\u0e19\u0e44\u0e1f\u0e25\u0e4c\u2026';
    loadSkus().then(function () {
      if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        return loadSheetJs().then(function () {
          return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
              try {
                var wb = window.XLSX.read(reader.result, { type: 'array' });
                resolve(sheetToParsed(wb));
              } catch (e) { reject(e); }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
          });
        });
      }
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () { resolve(parseCsvText(reader.result)); };
        reader.onerror = reject;
        reader.readAsText(file, 'UTF-8');
      });
    }).then(function (parsed) {
      if (!parsed.data.length) { toast('\u0e44\u0e1f\u0e25\u0e4c\u0e27\u0e48\u0e32\u0e07'); return; }
      showOrderPicker(parsed);
    }).catch(function (e) {
      toast('\u0e2d\u0e48\u0e32\u0e19\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08: ' + (e.message || e));
    });
  }

  function wire() {
    ensureCsvUi();
    var input = document.getElementById('pack-csv-file');
    if (input && !input.getAttribute('data-csv-wired')) {
      input.setAttribute('data-csv-wired', '1');
      input.addEventListener('change', function () {
        if (input.files && input.files[0]) { doImportFile(input.files[0]); input.value = ''; }
      });
    }
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.ni[data-page="pack"]');
    if (btn) setTimeout(wire, 200);
  });
  setTimeout(wire, 2000);
  setTimeout(wire, 4000);
  (function loadExtras() {
    ['pack-sync.js', 'pack-alert.js', 'pack-evidence.js'].forEach(function (src) {
      if (document.querySelector('script[src="' + src + '"]')) return;
      var s = document.createElement('script');
      s.src = src;
      document.body.appendChild(s);
    });
  })();
})();
