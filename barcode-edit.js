/**
 * Barcode editor for StockFlow products page
 */
(function () {
  'use strict';
  var DB = 'https://kiyomi-b19d0-default-rtdb.asia-southeast1.firebasedatabase.app';

  function wsKey() { return sessionStorage.getItem('sf_session_ws') || ''; }
  function roomId() {
    var k = wsKey();
    return localStorage.getItem('sf_room_' + k) || 'WH_A';
  }
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
  function api(p, opt) {
    opt = opt || {};
    return fetch(DB + '/' + p + '.json', Object.assign({ cache: 'no-store' }, opt)).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      if (r.status === 204) return null;
      return r.json();
    });
  }

  function ensureSheet() {
    if (document.getElementById('bc-ov')) return;
    var ov = document.createElement('div');
    ov.className = 'ov';
    ov.id = 'bc-ov';
    ov.innerHTML =
      '<div class="sheet">' +
      '<div class="sheet-h"><div class="sheet-t">\u0e43\u0e2a\u0e48\u0e1a\u0e32\u0e23\u0e4c\u0e40\u0e04\u0e49\u0e14\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32</div>' +
      '<button type="button" class="sheet-x" id="bc-close">\u2715</button></div>' +
      '<div class="sheet-b">' +
      '<div style="font-size:13px;color:var(--ink2);margin-bottom:4px" id="bc-name">\u2014</div>' +
      '<div style="font-size:11px;color:var(--ink3);margin-bottom:12px" id="bc-id">\u2014</div>' +
      '<div class="field"><label>\u0e1a\u0e32\u0e23\u0e4c\u0e40\u0e04\u0e49\u0e14 / \u0e23\u0e2b\u0e31\u0e2a\u0e2a\u0e41\u0e01\u0e19</label>' +
      '<input type="text" id="bc-input" placeholder="\u0e2a\u0e41\u0e01\u0e19\u0e2b\u0e23\u0e37\u0e2d\u0e1e\u0e34\u0e21\u0e1e\u0e4c\u0e1a\u0e32\u0e23\u0e4c\u0e40\u0e04\u0e49\u0e14" autocomplete="off" enterkeyhint="done"></div>' +
      '<div class="field"><label>SKU \u0e17\u0e35\u0e48\u0e43\u0e0a\u0e49\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48 BigSeller (\u0e16\u0e49\u0e32\u0e21\u0e35)</label>' +
      '<input type="text" id="bc-sku" placeholder="\u0e40\u0e0a\u0e48\u0e19 KIY-ROLL-250" autocomplete="off"></div>' +
      '<button type="button" class="btn btn-ink" id="bc-save">\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01</button>' +
      '<p style="font-size:11px;color:var(--ink3);margin-top:8px">\u0e1a\u0e32\u0e23\u0e4c\u0e40\u0e04\u0e49\u0e14\u0e43\u0e0a\u0e49\u0e15\u0e2d\u0e19\u0e2a\u0e41\u0e01\u0e19\u0e41\u0e1e\u0e47\u0e01 \u00b7 SKU \u0e43\u0e0a\u0e49\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48\u0e44\u0e1f\u0e25\u0e4c CSV</p>' +
      '</div></div>';
    document.body.appendChild(ov);
    document.getElementById('bc-close').addEventListener('click', function () {
      ov.classList.remove('open');
    });
    ov.addEventListener('click', function (e) {
      if (e.target === ov) ov.classList.remove('open');
    });
    document.getElementById('bc-save').addEventListener('click', saveBarcode);
    document.getElementById('bc-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); saveBarcode(); }
    });
  }

  var editingId = null;

  function openEdit(id, name, barcode, unitSku) {
    ensureSheet();
    editingId = id;
    document.getElementById('bc-name').textContent = name || id;
    document.getElementById('bc-id').textContent = id;
    document.getElementById('bc-input').value = barcode || '';
    document.getElementById('bc-sku').value = unitSku || '';
    document.getElementById('bc-ov').classList.add('open');
    setTimeout(function () {
      var i = document.getElementById('bc-input');
      if (i) { i.focus(); i.select(); }
    }, 200);
  }

  function saveBarcode() {
    if (!editingId || !wsKey()) { toast('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e25\u0e47\u0e2d\u0e01\u0e2d\u0e34\u0e19'); return; }
    var barcode = (document.getElementById('bc-input').value || '').trim();
    var unitSku = (document.getElementById('bc-sku').value || '').trim();
    var path = rp() + '/skus/' + editingId;
    var body = { barcode: barcode || null };
    if (unitSku) body.unitSku = unitSku;
    api(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function () {
      toast('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e1a\u0e32\u0e23\u0e4c\u0e40\u0e04\u0e49\u0e14\u0e41\u0e25\u0e49\u0e27');
      document.getElementById('bc-ov').classList.remove('open');
      var row = document.querySelector('[data-sku-id="' + editingId + '"]');
      if (row) {
        var m = row.querySelector('.row-m');
        if (m) {
          var parts = [];
          if (unitSku) parts.push('SKU ' + unitSku);
          if (barcode) parts.push('BC ' + barcode);
          else parts.push('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e1a\u0e32\u0e23\u0e4c\u0e40\u0e04\u0e49\u0e14');
          m.textContent = parts.join(' \u00b7 ');
        }
        row.setAttribute('data-sku-barcode', barcode);
        row.setAttribute('data-sku-unitsku', unitSku);
      }
    }).catch(function (e) {
      toast('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08: ' + (e.message || e));
    });
  }

  function enhanceProductList() {
    var list = document.getElementById('prod-list');
    if (!list || list.getAttribute('data-bc-enhanced')) return;
    list.setAttribute('data-bc-enhanced', '1');
    list.addEventListener('click', function (e) {
      var row = e.target.closest('.row[data-sku-id]');
      if (!row) return;
      openEdit(
        row.getAttribute('data-sku-id'),
        row.getAttribute('data-sku-name'),
        row.getAttribute('data-sku-barcode') || '',
        row.getAttribute('data-sku-unitsku') || ''
      );
    });
  }

  function reloadProductsWithBarcode() {
    if (!wsKey()) return;
    api(rp() + '/skus').then(function (skus) {
      skus = skus || {};
      api(rp() + '/movements').then(function (movs) {
        movs = movs || {};
        var map = {};
        Object.values(movs).forEach(function (m) {
          if (!map[m.skuId]) map[m.skuId] = 0;
          if (m.type === 'in') map[m.skuId] += m.pieces;
          else if (m.type === 'adj') map[m.skuId] += (m.adjDir === 'minus' ? -m.pieces : m.pieces);
          else if (m.type === 'out' || m.type === 'transfer') map[m.skuId] -= m.pieces;
        });
        var ents = Object.keys(skus).map(function (id) {
          return { id: id, s: skus[id], stock: map[id] || 0 };
        }).sort(function (a, b) {
          return (a.s.name || a.id).localeCompare(b.s.name || b.id, 'th');
        });
        var el = document.getElementById('prod-list');
        if (!el) return;
        if (!ents.length) {
          el.innerHTML = '<div class="empty">\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32</div>';
          return;
        }
        el.innerHTML = ents.map(function (x) {
          var s = x.s || {};
          var bc = s.barcode || '';
          var us = s.unitSku || '';
          var meta = [];
          if (us) meta.push('SKU ' + us);
          if (bc) meta.push('BC ' + bc);
          else meta.push('\u0e41\u0e15\u0e30\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e43\u0e2a\u0e48\u0e1a\u0e32\u0e23\u0e4c\u0e40\u0e04\u0e49\u0e14');
          return '<div class="row" data-sku-id="' + x.id + '" data-sku-name="' + (s.name || x.id).replace(/"/g, '') +
            '" data-sku-barcode="' + String(bc).replace(/"/g, '') +
            '" data-sku-unitsku="' + String(us).replace(/"/g, '') +
            '" style="cursor:pointer">' +
            '<div class="row-ico">\u25a2</div><div class="row-b"><div class="row-n">' + (s.name || x.id) +
            '</div><div class="row-m">' + meta.join(' \u00b7 ') + '</div></div>' +
            '<div class="row-q">' + x.stock + '</div></div>';
        }).join('') +
          '<div class="empty" style="padding:12px;font-size:11px">\u0e41\u0e15\u0e30\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e43\u0e2a\u0e48\u0e1a\u0e32\u0e23\u0e4c\u0e40\u0e04\u0e49\u0e14 / SKU</div>';
        enhanceProductList();
      });
    }).catch(function () {});
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.ni[data-page="products"]');
    if (btn) setTimeout(reloadProductsWithBarcode, 80);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(reloadProductsWithBarcode, 1500);
    });
  } else {
    setTimeout(reloadProductsWithBarcode, 1500);
  }
  window.__reloadProductsBarcode = reloadProductsWithBarcode;
})();
