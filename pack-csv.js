/**
 * BigSeller CSV / Excel import for Pack tab
 * After import: save ALL orders to local store + hard-focus scan input
 * so USB scanner works immediately without mouse click.
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
    var scan = document.getElementById('pack-scan');
    if (!scan) return;
    try {
      scan.removeAttribute('readonly');
      scan.setAttribute('lang', 'en');
      scan.setAttribute('spellcheck', 'false');
      scan.setAttribute('autocomplete', 'off');
      scan.setAttribute('inputmode', 'text');
      if (document.activeElement && document.activeElement !== scan) {
        try { document.activeElement.blur(); } catch (e) {}
      }
      scan.focus({ preventScroll: true });
      try { scan.select(); } catch (e2) {}
    } catch (e) {
      try { scan.focus(); } catch (e3) {}
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
      sku: pickCol(headers, ['sku', 'seller sku', 'sku id', 'product sku', '\u0e23\u0e2b\u0e31\u0e2as\u0e34\u0e19\u0e04\u0e49\u0e32', '\u0e23\u0e2b\u0e31\u0e2a sku']),
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
    if (!page || document.getElementById('pack-csv-file')) return;
    var card = page.querySelector('.card');
    if (!card) return;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="field" style="margin-bottom:8px">' +
      '<label>\u0e44\u0e1f\u0e25\u0e4c BigSeller (CSV / Excel)</label>' +
      '<input type="file" id="pack-csv-file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style="font-size:13px;width:100%">' +
      '</div>' +
      '<div id="pack-csv-status" style="font-size:12px;color:var(--ink3);margin-bottom:10px">\u0e2d\u0e31\u0e1b\u0e42\u0e2b\u0e25\u0e14\u0e41\u0e25\u0e49\u0e27\u0e2a\u0e41\u0e01\u0e19\u0e43\u0e1a\u0e1b\u0e30\u0e2b\u0e19\u0e49\u0e32\u0e44\u0e14\u0e49\u0e17\u0e31\u0e19\u0e17\u0e35 \u2014 \u0e44\u0e21\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e04\u0e25\u0e34\u0e01\u0e40\u0e21\u0e32\u0e2a\u0e4c</div>';
    card.insertBefore(wrap, card.firstChild);
  }

  function loadSheetJs() {
    if (window.XLSX) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = resolve;
      s.onerror = reject;
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
      toast('\u0e44\u0e1f\u0e25\u0e4c\u0e27\u0e48\u0e32\u0e07');
      focusScanSoon();
      return;
    }
    var map = colMap(parsed.headers);
    if (!map.sku && !map.name && !map.barcode) {
      toast('\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e04\u0e2d\u0e25\u0e31\u0e21\u0e19\u0e4c SKU / \u0e0a\u0e37\u0e48\u0e2d / \u0e1a\u0e32\u0e23\u0e4c\u0e40\u0e04\u0e49\u0e14');
      if (statusEl) statusEl.textContent = '\u0e2b\u0e31\u0e27\u0e15\u0e32\u0e23\u0e32\u0e07: ' + parsed.headers.slice(0, 8).join(', ');
      focusScanSoon();
      return;
    }
    var orders = buildOrders(parsed);
    var saved = saveOrders(orders);
    var lineCount = orders.reduce(function (n, o) { return n + o.lines.length; }, 0);
    var matched = orders.reduce(function (n, o) {
      return n + o.lines.filter(function (l) { return l.matched !== false; }).length;
    }, 0);

    var resetBtn = document.getElementById('pack-reset');
    if (resetBtn) resetBtn.click();

    var msg = '\u0e19\u0e33\u0e40\u0e02\u0e49\u0e32 ' + saved + ' \u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c \u00b7 ' + lineCount + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23';
    if (matched < lineCount) msg += ' \u00b7 \u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48\u0e04\u0e25\u0e31\u0e07\u0e44\u0e14\u0e49 ' + matched;
    toast(msg);
    if (statusEl) {
      statusEl.style.color = 'var(--ok)';
      statusEl.textContent = '\u2713 \u0e1e\u0e23\u0e49\u0e2d\u0e21\u0e2a\u0e41\u0e01\u0e19\u0e43\u0e1a\u0e1b\u0e30\u0e2b\u0e19\u0e49\u0e32 \u00b7 ' + saved + ' \u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e43\u0e19\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07 \u2014 \u0e2a\u0e41\u0e01\u0e19\u0e44\u0e14\u0e49\u0e17\u0e31\u0e19\u0e17\u0e35';
    }
    var fb = document.getElementById('pack-fb');
    if (fb) {
      fb.style.background = 'var(--ok-soft)';
      fb.style.color = 'var(--ok)';
      fb.textContent = '\u2713 \u0e42\u0e2b\u0e25\u0e14\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e41\u0e25\u0e49\u0e27 ' + saved + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23 \u2014 \u0e2a\u0e41\u0e01\u0e19 Tracking / Order ID \u0e44\u0e14\u0e49\u0e40\u0e25\u0e22';
    }
    focusScanSoon();
  }

  function doImportFile(file) {
    var name = (file.name || '').toLowerCase();
    var statusEl = document.getElementById('pack-csv-status');
    if (statusEl) {
      statusEl.style.color = 'var(--ink3)';
      statusEl.textContent = '\u0e01\u0e33\u0e25\u0e31\u0e07\u0e2d\u0e48\u0e32\u0e19\u0e44\u0e1f\u0e25\u0e4c\u2026';
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
      toast('\u0e2d\u0e48\u0e32\u0e19\u0e44\u0e1f\u0e25\u0e4c\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08: ' + (e.message || e));
      focusScanSoon();
    });
  }

  function wire() {
    ensureCsvUi();
    var input = document.getElementById('pack-csv-file');
    if (!input) return;
    if (!input.getAttribute('data-csv-wired-v2')) {
      input.setAttribute('data-csv-wired-v2', '1');
      input.addEventListener('change', function () {
        if (input.files && input.files[0]) {
          var f = input.files[0];
          input.value = '';
          doImportFile(f);
        }
        focusScanSoon();
      });
      input.addEventListener('click', function () {
        setTimeout(focusScanSoon, 300);
      });
    }
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.ni[data-page="pack"]');
    if (btn) setTimeout(wire, 200);
  });
  setTimeout(wire, 1500);
  setTimeout(wire, 3000);
  setTimeout(wire, 5000);

  ['pack-sync.js', 'pack-alert.js', 'pack-evidence.js', 'pack-sku-expand.js'].forEach(function (src) {
    if (document.querySelector('script[src*="' + src.replace('.js', '') + '"]')) return;
    var s = document.createElement('script');
    s.src = src + '?v=focus2';
    document.body.appendChild(s);
  });

  window.__packFocusScan = hardFocusScan;
  window.__packAfterCsvImport = focusScanSoon;
})();
