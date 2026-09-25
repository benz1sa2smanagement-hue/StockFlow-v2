/**
 * BigSeller CSV import for Pack tab (loads after pack.js)
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
    setTimeout(function () { t.remove(); }, 2600);
  }
  function wsKey() { return sessionStorage.getItem('sf_session_ws') || ''; }
  function roomId() {
    return localStorage.getItem('sf_room_' + wsKey()) || 'WH_A';
  }
  function loadSkus() {
    if (!wsKey()) return Promise.resolve({});
    var url = 'https://kiyomi-b19d0-default-rtdb.asia-southeast1.firebasedatabase.app/ws_' +
      wsKey() + '/rooms/' + roomId() + '/skus.json';
    return fetch(url, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      skusCache = d || {};
      return skusCache;
    }).catch(function () { return {}; });
  }
  function parseCsvText(text) {
    var rows = [], i = 0, field = '', row = [], inQ = false;
    text = text.replace(/^\uFEFF/, '');
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
    var data = rows.slice(1).map(function (r) {
      var o = {};
      headers.forEach(function (h, idx) { o[h] = r[idx] != null ? String(r[idx]).trim() : ''; });
      return o;
    });
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
    return null;
  }
  function matchSku(skuVal, nameVal, barcodeVal) {
    var keys = Object.keys(skusCache);
    var sv = (skuVal || '').trim(), nv = (nameVal || '').trim(), bv = (barcodeVal || '').trim();
    var i, id, s;
    if (sv && skusCache[sv]) return { id: sv, s: skusCache[sv] };
    if (bv) {
      for (i = 0; i < keys.length; i++) {
        id = keys[i]; s = skusCache[id] || {};
        if (String(s.barcode || '') === bv) return { id: id, s: s };
      }
    }
    if (sv) {
      var su = sv.toUpperCase();
      for (i = 0; i < keys.length; i++) {
        id = keys[i]; s = skusCache[id] || {};
        if (String(s.unitSku || '').toUpperCase() === su) return { id: id, s: s };
        if (String(s.sku || '').toUpperCase() === su) return { id: id, s: s };
        if (id.toUpperCase() === su) return { id: id, s: s };
      }
    }
    if (nv) {
      var nu = nv.toUpperCase();
      for (i = 0; i < keys.length; i++) {
        id = keys[i]; s = skusCache[id] || {};
        if (String(s.name || '').toUpperCase() === nu) return { id: id, s: s };
      }
      for (i = 0; i < keys.length; i++) {
        id = keys[i]; s = skusCache[id] || {};
        var sn = String(s.name || '').toUpperCase();
        if (sn && (sn.indexOf(nu) >= 0 || nu.indexOf(sn) >= 0) && nu.length >= 4) return { id: id, s: s };
      }
    }
    return null;
  }
  function ensureCsvUi() {
    var page = document.getElementById('page-pack');
    if (!page) return;
    if (document.getElementById('pack-csv-file')) return;
    var card = page.querySelector('.card');
    if (!card) return;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="field" style="margin-bottom:10px"><label>\u0e19\u0e33\u0e40\u0e02\u0e49\u0e32\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e08\u0e32\u0e01 BigSeller (CSV)</label>' +
      '<input type="file" id="pack-csv-file" accept=".csv,text/csv" style="font-size:13px;width:100%"></div>' +
      '<div id="pack-csv-status" style="font-size:11px;color:var(--ink3);margin-bottom:12px">Export \u0e08\u0e32\u0e01 BigSeller \u0e40\u0e1b\u0e47\u0e19 CSV</div>';
    card.insertBefore(wrap, card.firstChild);
  }
  function doImport(file) {
    loadSkus().then(function () {
      var reader = new FileReader();
      reader.onload = function () {
        var parsed = parseCsvText(reader.result);
        if (!parsed.data.length) { toast('\u0e44\u0e1f\u0e25\u0e4c\u0e27\u0e48\u0e32\u0e07'); return; }
        var h = parsed.headers;
        var colOrder = pickCol(h, ['order id', 'orderid', 'order_id', 'order no', 'order number']);
        var colTrack = pickCol(h, ['tracking', 'tracking number', 'tracking_number']);
        var colSku = pickCol(h, ['sku', 'seller sku', 'sku id', 'product sku']);
        var colName = pickCol(h, ['product name', 'product', 'item name', 'name']);
        var colQty = pickCol(h, ['quantity', 'qty', 'amount']);
        var colBarcode = pickCol(h, ['barcode', 'bar code', 'ean', 'upc']);
        var colPlat = pickCol(h, ['platform', 'channel', 'shop']);
        var statusEl = document.getElementById('pack-csv-status');
        if (!colSku && !colName && !colBarcode) {
          toast('\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e04\u0e2d\u0e25\u0e31\u0e21\u0e19\u0e4c SKU');
          if (statusEl) statusEl.textContent = h.slice(0, 6).join(', ');
          return;
        }
        var resetBtn = document.getElementById('pack-reset');
        if (resetBtn) resetBtn.click();
        var firstOrder = '', firstTrack = '', firstPlat = '';
        var added = 0, skipped = 0, unmatched = [];
        var sel = document.getElementById('pack-add-sku');
        var qtyEl = document.getElementById('pack-add-qty');
        var addBtn = document.getElementById('pack-add-btn');
        parsed.data.forEach(function (row) {
          var skuV = colSku ? row[colSku] : '';
          var nameV = colName ? row[colName] : '';
          var barV = colBarcode ? row[colBarcode] : '';
          var qty = parseInt(colQty ? row[colQty] : '1', 10) || 1;
          if (!firstOrder && colOrder) firstOrder = row[colOrder] || '';
          if (!firstTrack && colTrack) firstTrack = row[colTrack] || '';
          if (!firstPlat && colPlat) firstPlat = row[colPlat] || '';
          var m = matchSku(skuV, nameV, barV);
          if (!m) { skipped++; unmatched.push(skuV || nameV || barV || '?'); return; }
          if (sel && addBtn && qtyEl) {
            var has = false;
            for (var oi = 0; oi < sel.options.length; oi++) {
              if (sel.options[oi].value === m.id) { has = true; break; }
            }
            if (!has) {
              var opt = document.createElement('option');
              opt.value = m.id;
              opt.textContent = (m.s.name || m.id);
              sel.appendChild(opt);
            }
            sel.value = m.id;
            qtyEl.value = String(qty);
            addBtn.click();
            added++;
          }
        });
        var orderInput = document.getElementById('pack-order');
        if (orderInput) orderInput.value = firstTrack || firstOrder || '';
        if (firstPlat) {
          var p = firstPlat.toLowerCase();
          document.querySelectorAll('#pack-plat button').forEach(function (b) {
            var pp = (b.getAttribute('data-pplat') || '').toLowerCase();
            if (pp && p.indexOf(pp) >= 0) b.click();
          });
        }
        var msg = '\u0e19\u0e33\u0e40\u0e02\u0e49\u0e32 ' + added + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23';
        if (skipped) msg += ' \u00b7 skip ' + skipped;
        toast(msg);
        if (statusEl) statusEl.textContent = msg;
      };
      reader.readAsText(file, 'UTF-8');
    });
  }
  function wire() {
    ensureCsvUi();
    var input = document.getElementById('pack-csv-file');
    if (input && !input.getAttribute('data-csv-wired')) {
      input.setAttribute('data-csv-wired', '1');
      input.addEventListener('change', function () {
        if (input.files && input.files[0]) {
          doImport(input.files[0]);
          input.value = '';
        }
      });
    }
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.ni[data-page="pack"]');
    if (btn) setTimeout(wire, 200);
  });
  setTimeout(wire, 2000);
  setTimeout(wire, 4000);
  (function loadSync() {
    if (document.querySelector('script[src="pack-sync.js"]')) return;
    var s = document.createElement('script');
    s.src = 'pack-sync.js';
    document.body.appendChild(s);
  })();
})();
