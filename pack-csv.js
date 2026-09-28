/**
 * BigSeller CSV / Excel import for Pack tab
 * Always shows a clear upload control on the Pack page.
 */
(function () {
  'use strict';
  var skusCache = {};
  var DB = 'https://kiyomi-b19d0-default-rtdb.asia-southeast1.firebasedatabase.app';

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
  function wsKey() { return sessionStorage.getItem('sf_session_ws') || ''; }
  function roomId() { return localStorage.getItem('sf_room_' + wsKey()) || 'WH_A'; }

  function hardFocusScan() {
    var page = document.getElementById('page-pack');
    if (!page || !page.classList.contains('active')) return;
    var order = document.getElementById('pack-order');
    var scan = document.getElementById('pack-scan');
    var target = order || scan;
    if (!target) return;
    try {
      target.removeAttribute('readonly');
      target.setAttribute('lang', 'en');
      target.setAttribute('spellcheck', 'false');
      target.setAttribute('autocomplete', 'off');
      target.setAttribute('inputmode', 'text');
      if (document.activeElement && document.activeElement !== target) {
        try { document.activeElement.blur(); } catch (e) {}
      }
      target.focus({ preventScroll: true });
      try { target.select(); } catch (e2) {}
    } catch (e) {
      try { target.focus(); } catch (e3) {}
    }
  }
  function focusScanSoon() {
    [0, 50, 150, 300, 600, 1000, 1600].forEach(function (ms) {
      setTimeout(hardFocusScan, ms);
    });
  }

  function loadSkus() {
    if (!wsKey()) return Promise.resolve({});
    return fetch(DB + '/ws_' + wsKey() + '/rooms/' + roomId() + '/skus.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) { skusCache = d || {}; return skusCache; })
      .catch(function () { return {}; });
  }

  function parseCsvText(text) {
    var rows = [], i = 0, field = '', row = [], inQ = false;
    text = String(text || '').replace(/^\uFEFF/, '');
    while (i < text.length) {
      var c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQ = false;
        } else field += c;
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
    var data = [];
    for (var r = 1; r < rows.length; r++) {
      var obj = {};
      headers.forEach(function (h, idx) { obj[h] = rows[r][idx] != null ? String(rows[r][idx]).trim() : ''; });
      data.push(obj);
    }
    return { headers: headers, data: data };
  }

  function pickCol(headers, aliases) {
    var lower = headers.map(function (h) { return String(h).toLowerCase().trim(); });
    for (var a = 0; a < aliases.length; a++) {
      var al = aliases[a].toLowerCase();
      for (var i = 0; i < lower.length; i++) {
        if (lower[i] === al || lower[i].indexOf(al) >= 0) return headers[i];
      }
    }
    return null;
  }

  function norm(s) {
    return String(s || '').trim().toUpperCase().replace(/\s+/g, '');
  }

  function matchSku(skuV, nameV, barV) {
    var keys = Object.keys(skusCache || {});
    var candidates = [skuV, barV].map(norm).filter(Boolean);
    var i, id, s;
    for (i = 0; i < candidates.length; i++) {
      var su = candidates[i];
      if (skusCache[su]) return { id: su, s: skusCache[su] };
      for (var k = 0; k < keys.length; k++) {
        id = keys[k]; s = skusCache[id] || {};
        var cands = [s.unitSku, s.sku, s.barcode, id].map(norm);
        if (cands.indexOf(su) >= 0) return { id: id, s: s };
      }
    }
    if (nameV) {
      var nu = String(nameV).trim().toUpperCase();
      for (i = 0; i < keys.length; i++) {
        id = keys[i]; s = skusCache[id] || {};
        if (String(s.name || '').toUpperCase() === nu) return { id: id, s: s };
      }
    }
    return null;
  }

  function colMap(headers) {
    return {
      order: pickCol(headers, ['order id', 'orderid', 'order_id', 'order no', 'order number', '\u0e40\u0e25\u0e02\u0e17\u0e35\u0e48\u0e04\u0e33\u0e2a\u0e31\u0e48\u0e07\u0e0b\u0e37\u0e49\u0e2d', '\u0e04\u0e33\u0e2a\u0e31\u0e48\u0e07\u0e0b\u0e37\u0e49\u0e2d', '\u0e40\u0e25\u0e02\u0e04\u0e33\u0e2a\u0e31\u0e48\u0e07\u0e0b\u0e37\u0e49\u0e2d']),
      track: pickCol(headers, ['tracking', 'tracking number', 'tracking_number', 'tracking no', '\u0e40\u0e25\u0e02\u0e1e\u0e28\u0e38', '\u0e2b\u0e21\u0e32\u0e22\u0e40\u0e25\u0e02\u0e1e\u0e28\u0e38', 'package id', 'package_id']),
      packageId: pickCol(headers, ['package id', 'package_id', 'package no']),
      sku: pickCol(headers, ['sku', 'seller sku', 'sku id', 'product sku', '\u0e23\u0e2b\u0e31\u0e2a\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32', '\u0e23\u0e2b\u0e31\u0e2a sku']),
      name: pickCol(headers, ['product name', 'product', 'item name', '\u0e0a\u0e37\u0e48\u0e2d\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32', 'name']),
      qty: pickCol(headers, ['quantity', 'qty', '\u0e08\u0e33\u0e19\u0e27\u0e19', 'amount']),
      barcode: pickCol(headers, ['barcode', 'bar code', 'ean', 'upc', '\u0e1a\u0e32\u0e23\u0e4c\u0e40\u0e04\u0e49\u0e14']),
      plat: pickCol(headers, ['platform', 'channel', 'shop', '\u0e41\u0e1e\u0e25\u0e15\u0e1f\u0e2d\u0e23\u0e4c\u0e21'])
    };
  }

  function buildOrders(parsed) {
    var map = colMap(parsed.headers);
    var byId = {};
    parsed.data.forEach(function (row) {
      var oid = (map.order && row[map.order]) || '';
      var track = (map.track && row[map.track]) || '';
      var pkg = (map.packageId && row[map.packageId]) || '';
      var key = oid || track || pkg;
      if (!key) key = '_row_' + Math.random().toString(36).slice(2, 8);
      if (!byId[key]) {
        byId[key] = {
          id: oid || key,
          track: track,
          packageId: pkg,
          platform: (map.plat && row[map.plat]) || '',
          lines: []
        };
      }
      var skuV = map.sku ? row[map.sku] : '';
      var nameV = map.name ? row[map.name] : '';
      var barV = map.barcode ? row[map.barcode] : '';
      var qty = parseInt(map.qty ? row[map.qty] : '1', 10) || 1;
      var m = matchSku(skuV, nameV, barV);
      byId[key].lines.push({
        skuId: m ? m.id : (skuV || nameV || 'UNKNOWN'),
        name: m ? (m.s.name || m.id) : (nameV || skuV || '\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e43\u0e19\u0e04\u0e25\u0e31\u0e07'),
        qty: qty,
        unitSku: m ? (m.s.unitSku || '') : skuV,
        barcode: m ? (m.s.barcode || barV || '') : barV,
        matched: !!m
      });
    });
    return Object.keys(byId).map(function (k) { return byId[k]; }).filter(function (o) { return o.lines && o.lines.length; });
  }

  function saveOrders(orders) {
    var n = 0;
    if (typeof window.__bsSaveOrders === 'function') {
      n = window.__bsSaveOrders(orders) || orders.length;
    } else {
      try {
        var KEY = 'sf_bs_orders_v1';
        var store = JSON.parse(localStorage.getItem(KEY) || '{}');
        orders.forEach(function (order) {
          if (!order || !order.lines || !order.lines.length) return;
          var keys = [];
          [order.id, order.track, order.packageId].forEach(function (k) {
            k = String(k || '').trim().toUpperCase().replace(/\s+/g, '');
            if (k && keys.indexOf(k) < 0) keys.push(k);
            var k2 = k.replace(/[^A-Z0-9]/g, '');
            if (k2 && keys.indexOf(k2) < 0) keys.push(k2);
          });
          keys.forEach(function (k) { store[k] = order; });
          n++;
        });
        localStorage.setItem(KEY, JSON.stringify(store));
      } catch (e) {}
    }
    return n;
  }

  function ensureCsvUi() {
    var page = document.getElementById('page-pack');
    if (!page) return false;
    if (document.getElementById('pack-csv-panel')) {
      wireInput();
      return true;
    }

    var panel = document.createElement('div');
    panel.id = 'pack-csv-panel';
    panel.className = 'card';
    panel.style.cssText = 'padding:14px 16px;margin-bottom:12px;border:2px dashed rgba(12,14,18,.18);background:rgba(255,248,230,.95)';
    panel.innerHTML =
      '<div style="font-size:14px;font-weight:800;margin-bottom:6px">\u0e19\u0e33\u0e40\u0e02\u0e49\u0e32\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e08\u0e32\u0e01 BigSeller</div>' +
      '<div style="font-size:12px;color:var(--ink3,#8A8F99);margin-bottom:10px;line-height:1.4">' +
      '\u0e23\u0e2d\u0e07\u0e23\u0e31\u0e1a\u0e44\u0e1f\u0e25\u0e4c <b>CSV</b> \u0e41\u0e25\u0e30 <b>Excel (.xlsx / .xls)</b> \u2014 \u0e2b\u0e25\u0e31\u0e07\u0e2d\u0e31\u0e1b\u0e42\u0e2b\u0e25\u0e14\u0e2a\u0e41\u0e01\u0e19\u0e43\u0e1a\u0e1b\u0e30\u0e2b\u0e19\u0e49\u0e32\u0e44\u0e14\u0e49\u0e17\u0e31\u0e19\u0e17\u0e35' +
      '</div>' +
      '<label for="pack-csv-file" id="pack-csv-btn" style="' +
      'display:flex;align-items:center;justify-content:center;gap:8px;' +
      'width:100%;box-sizing:border-box;padding:14px 16px;border-radius:14px;' +
      'background:var(--ink,#0C0E12);color:#fff;font-size:15px;font-weight:700;' +
      'cursor:pointer;text-align:center;user-select:none">' +
      '\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e44\u0e1f\u0e25\u0e4c CSV / Excel' +
      '</label>' +
      '<input type="file" id="pack-csv-file" accept=".csv,.xlsx,.xls,text/csv,' +
      'application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ' +
      'style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;z-index:-1">' +
      '<div id="pack-csv-status" style="font-size:12px;color:var(--ink3,#8A8F99);margin-top:10px">\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e44\u0e1f\u0e25\u0e4c</div>';

    var title = page.querySelector('.pt');
    if (title && title.nextSibling) page.insertBefore(panel, title.nextSibling);
    else if (page.firstChild) page.insertBefore(panel, page.firstChild);
    else page.appendChild(panel);

    wireInput();
    return true;
  }

  function wireInput() {
    var input = document.getElementById('pack-csv-file');
    if (!input || input.getAttribute('data-csv-wired-v3')) return;
    input.setAttribute('data-csv-wired-v3', '1');
    input.addEventListener('change', function () {
      if (input.files && input.files[0]) {
        var f = input.files[0];
        input.value = '';
        doImportFile(f);
      }
      focusScanSoon();
    });
  }

  function loadSheetJs() {
    if (window.XLSX) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = resolve;
      s.onerror = function () { reject(new Error('SheetJS load failed')); };
      document.head.appendChild(s);
    });
  }

  function sheetToParsed(wb) {
    var sheet = wb.Sheets[wb.SheetNames[0]];
    var rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!rows.length) return { headers: [], data: [] };
    var headers = rows[0].map(function (h) { return String(h || '').trim(); });
    var data = [];
    for (var r = 1; r < rows.length; r++) {
      var obj = {};
      headers.forEach(function (h, idx) { obj[h] = rows[r][idx] != null ? String(rows[r][idx]).trim() : ''; });
      data.push(obj);
    }
    return { headers: headers, data: data };
  }

  function finishImport(parsed) {
    var statusEl = document.getElementById('pack-csv-status');
    if (!parsed.data.length) {
      toast('empty file');
      if (statusEl) statusEl.textContent = 'empty';
      focusScanSoon();
      return;
    }
    var map = colMap(parsed.headers);
    if (!map.sku && !map.name && !map.barcode) {
      toast('no SKU columns');
      if (statusEl) statusEl.textContent = 'headers: ' + parsed.headers.slice(0, 8).join(', ');
      focusScanSoon();
      return;
    }
    var orders = buildOrders(parsed);
    var saved = saveOrders(orders);
    var lineCount = orders.reduce(function (n, o) { return n + o.lines.length; }, 0);

    var resetBtn = document.getElementById('pack-reset');
    if (resetBtn) resetBtn.click();

    toast('imported ' + saved + ' orders');
    if (statusEl) {
      statusEl.style.color = 'var(--ok, #15803d)';
      statusEl.textContent = '\u2713 ready \u00b7 ' + saved + ' orders';
    }
    focusScanSoon();
  }

  function doImportFile(file) {
    var name = (file.name || '').toLowerCase();
    var statusEl = document.getElementById('pack-csv-status');
    if (statusEl) {
      statusEl.style.color = 'var(--ink3, #8A8F99)';
      statusEl.textContent = 'loading: ' + (file.name || '');
    }
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
      finishImport(parsed);
    }).catch(function (e) {
      toast('import fail: ' + (e.message || e));
      if (statusEl) statusEl.textContent = 'import fail';
      focusScanSoon();
    });
  }

  function wire() { ensureCsvUi(); }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.ni[data-page="pack"]');
    if (btn) {
      setTimeout(wire, 50);
      setTimeout(wire, 200);
      setTimeout(wire, 500);
      setTimeout(wire, 1200);
    }
  }, true);

  var mo = new MutationObserver(function () {
    if (document.getElementById('page-pack')) wire();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  setInterval(function () {
    var page = document.getElementById('page-pack');
    if (page && (page.classList.contains('active') || page.offsetParent !== null)) wire();
  }, 800);

  [400, 1000, 2000, 3500, 6000, 10000].forEach(function (ms) { setTimeout(wire, ms); });

  ['pack-sync.js', 'pack-alert.js', 'pack-evidence.js', 'pack-sku-expand.js', 'pack-persist.js', 'pack-bigseller-bridge.js'].forEach(function (src) {
    if (document.querySelector('script[src*="' + src.replace('.js', '') + '"]')) return;
    var s = document.createElement('script');
    s.src = src + '?v=bsbridge1';
    document.body.appendChild(s);
  });

  window.__packFocusScan = hardFocusScan;
  window.__packAfterCsvImport = focusScanSoon;
  window.__packEnsureCsvUi = ensureCsvUi;
})();
