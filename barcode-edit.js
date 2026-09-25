/**
 * Product edit (name / barcode / SKU) — stable, clickable
 */
(function () {
  'use strict';
  var DB = 'https://kiyomi-b19d0-default-rtdb.asia-southeast1.firebasedatabase.app';
  var skusCache = {};
  var reloading = false;
  var lastPaintKey = '';

  function wsKey() { return sessionStorage.getItem('sf_session_ws') || ''; }
  function roomId() {
    return localStorage.getItem('sf_room_' + wsKey()) || 'WH_A';
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
      '<div class="sheet-h"><div class="sheet-t">\u0e41\u0e01\u0e49\u0e44\u0e02\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32</div>' +
      '<button type="button" class="sheet-x" id="bc-close">\u2715</button></div>' +
      '<div class="sheet-b">' +
      '<div style="font-size:11px;color:var(--ink3);margin-bottom:8px" id="bc-id">\u2014</div>' +
      '<div class="field"><label>\u0e0a\u0e37\u0e48\u0e2d\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32</label>' +
      '<input type="text" id="bc-name-input" placeholder="\u0e0a\u0e37\u0e48\u0e2d\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32" autocomplete="off"></div>' +
      '<div class="field"><label>\u0e1a\u0e32\u0e23\u0e4c\u0e40\u0e04\u0e49\u0e14 / \u0e23\u0e2b\u0e31\u0e2a\u0e2a\u0e41\u0e01\u0e19</label>' +
      '<input type="text" id="bc-input" placeholder="\u0e2a\u0e41\u0e01\u0e19\u0e2b\u0e23\u0e37\u0e2d\u0e1e\u0e34\u0e21\u0e1e\u0e4c\u0e1a\u0e32\u0e23\u0e4c\u0e40\u0e04\u0e49\u0e14" autocomplete="off" enterkeyhint="done"></div>' +
      '<div class="field"><label>SKU BigSeller</label>' +
      '<input type="text" id="bc-sku" placeholder="\u0e40\u0e0a\u0e48\u0e19 KIY-ROLL-250" autocomplete="off"></div>' +
      '<button type="button" class="btn btn-ink" id="bc-save">\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01</button>' +
      '</div></div>';
    document.body.appendChild(ov);
    document.getElementById('bc-close').addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation(); ov.classList.remove('open');
    });
    ov.addEventListener('click', function (e) {
      if (e.target === ov) ov.classList.remove('open');
    });
    document.getElementById('bc-save').addEventListener('click', function (e) {
      e.preventDefault(); saveBarcode();
    });
  }

  var editingId = null;

  function openEdit(id, name, barcode, unitSku) {
    ensureSheet();
    editingId = id;
    document.getElementById('bc-id').textContent = 'ID: ' + id;
    var ni = document.getElementById('bc-name-input');
    if (ni) ni.value = name || '';
    document.getElementById('bc-input').value = barcode || '';
    document.getElementById('bc-sku').value = unitSku || '';
    document.getElementById('bc-ov').classList.add('open');
    setTimeout(function () {
      var i = document.getElementById('bc-name-input') || document.getElementById('bc-input');
      if (i) { i.focus(); i.select(); }
    }, 200);
  }

  function saveBarcode() {
    if (!editingId || !wsKey()) { toast('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e25\u0e47\u0e2d\u0e01\u0e2d\u0e34\u0e19'); return; }
    var name = ((document.getElementById('bc-name-input') || {}).value || '').trim();
    var barcode = (document.getElementById('bc-input').value || '').trim();
    var unitSku = (document.getElementById('bc-sku').value || '').trim();
    if (!name) { toast('\u0e01\u0e23\u0e2d\u0e01\u0e0a\u0e37\u0e48\u0e2d\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32'); return; }
    api(rp() + '/skus/' + editingId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, barcode: barcode || null, unitSku: unitSku || null })
    }).then(function () {
      if (!skusCache[editingId]) skusCache[editingId] = {};
      skusCache[editingId].name = name;
      skusCache[editingId].barcode = barcode;
      skusCache[editingId].unitSku = unitSku || '';
      lastPaintKey = '';
      toast('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e41\u0e25\u0e49\u0e27');
      document.getElementById('bc-ov').classList.remove('open');
      setTimeout(function () { reloadProductsWithBarcode(true); }, 80);
    }).catch(function (e) {
      toast('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08: ' + (e.message || e));
    });
  }

  function onRowClick(e) {
    var list = document.getElementById('prod-list');
    if (!list) return;
    var row = e.target.closest('.row');
    if (!row || !list.contains(row)) return;
    e.preventDefault();
    e.stopPropagation();
    var id = row.getAttribute('data-sku-id');
    var name = row.getAttribute('data-sku-name');
    var barcode = row.getAttribute('data-sku-barcode') || '';
    var unitSku = row.getAttribute('data-sku-unitsku') || '';
    if (!id) {
      var nameEl = row.querySelector('.row-n');
      var nm = nameEl ? nameEl.textContent.trim() : '';
      Object.keys(skusCache).forEach(function (k) {
        if (id) return;
        var s = skusCache[k] || {};
        if ((s.name || k) === nm) {
          id = k; name = s.name || k; barcode = s.barcode || ''; unitSku = s.unitSku || '';
        }
      });
    }
    if (!id) {
      toast('\u0e01\u0e33\u0e25\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u2026');
      reloadProductsWithBarcode(true);
      return;
    }
    openEdit(id, name || id, barcode, unitSku);
  }

  function wireListClicks() {
    if (!document._bcDocClick) {
      document._bcDocClick = true;
      document.addEventListener('click', function (e) {
        var list = document.getElementById('prod-list');
        var page = document.getElementById('page-products');
        if (!list || !page || !page.classList.contains('active')) return;
        if (!list.contains(e.target)) return;
        if (!e.target.closest('.row')) return;
        onRowClick(e);
      }, true);
    }
    var list = document.getElementById('prod-list');
    if (list) list.style.cursor = 'pointer';
  }

  function paintRows(ents) {
    var el = document.getElementById('prod-list');
    if (!el) return;
    var key = ents.map(function (x) {
      var s = x.s || {};
      return x.id + '|' + (s.name || '') + '|' + (s.barcode || '') + '|' + (s.unitSku || '') + '|' + x.stock;
    }).join(';;');
    if (key === lastPaintKey && el.querySelector('.row[data-sku-id]')) {
      wireListClicks();
      return;
    }
    lastPaintKey = key;
    var page = document.getElementById('page-products');
    var scrollY = page ? page.scrollTop : 0;
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
      else meta.push('\u0e04\u0e25\u0e34\u0e01\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e41\u0e01\u0e49\u0e44\u0e02');
      return '<div class="row" data-sku-id="' + x.id +
        '" data-sku-name="' + String(s.name || x.id).replace(/"/g, '') +
        '" data-sku-barcode="' + String(bc).replace(/"/g, '') +
        '" data-sku-unitsku="' + String(us).replace(/"/g, '') +
        '" style="cursor:pointer">' +
        '<div class="row-ico">\u25a2</div><div class="row-b"><div class="row-n">' +
        (s.name || x.id) + '</div><div class="row-m">' + meta.join(' \u00b7 ') +
        '</div></div><div class="row-q">' + x.stock + '</div></div>';
    }).join('') +
      '<div class="empty" style="padding:12px;font-size:11px">\u0e04\u0e25\u0e34\u0e01\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e41\u0e01\u0e49\u0e0a\u0e37\u0e48\u0e2d / \u0e1a\u0e32\u0e23\u0e4c\u0e40\u0e04\u0e49\u0e14 / SKU</div>';
    wireListClicks();
    if (page) page.scrollTop = scrollY;
  }

  function reloadProductsWithBarcode(force) {
    if (!wsKey() || reloading) return;
    reloading = true;
    Promise.all([api(rp() + '/skus'), api(rp() + '/movements')]).then(function (res) {
      skusCache = res[0] || {};
      var movs = res[1] || {};
      var map = {};
      Object.values(movs).forEach(function (m) {
        if (!map[m.skuId]) map[m.skuId] = 0;
        if (m.type === 'in') map[m.skuId] += m.pieces;
        else if (m.type === 'adj') map[m.skuId] += (m.adjDir === 'minus' ? -m.pieces : m.pieces);
        else if (m.type === 'out' || m.type === 'transfer') map[m.skuId] -= m.pieces;
      });
      var ents = Object.keys(skusCache).map(function (id) {
        return { id: id, s: skusCache[id], stock: map[id] || 0 };
      }).sort(function (a, b) {
        return (a.s.name || a.id).localeCompare(b.s.name || b.id, 'th');
      });
      if (force) lastPaintKey = '';
      paintRows(ents);
    }).catch(function (e) {
      console.warn('barcode reload', e);
    }).then(function () { reloading = false; });
  }

  function onProductsPage() {
    ensureSheet();
    wireListClicks();
    reloadProductsWithBarcode(true);
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.ni[data-page="products"]');
    if (btn) {
      setTimeout(onProductsPage, 80);
      setTimeout(wireListClicks, 400);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(onProductsPage, 2000); });
  } else {
    setTimeout(onProductsPage, 2000);
  }
  window.__reloadProductsBarcode = function () {
    lastPaintKey = '';
    reloadProductsWithBarcode(true);
  };
})();
