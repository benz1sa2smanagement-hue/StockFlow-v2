/**
 * Barcode editor for StockFlow products page
 * Survives app.js updateProducts() overwrites (poll every 5s)
 */
(function () {
  'use strict';
  var DB = 'https://kiyomi-b19d0-default-rtdb.asia-southeast1.firebasedatabase.app';
  var skusCache = {};
  var reloading = false;

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
      '<div class="field"><label>SKU \u0e17\u0e35\u0e48\u0e43\u0e0a\u0e49\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48 BigSeller</label>' +
      '<input type="text" id="bc-sku" placeholder="\u0e40\u0e0a\u0e48\u0e19 KIY-ROLL-250" autocomplete="off"></div>' +
      '<button type="button" class="btn btn-ink" id="bc-save">\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01</button>' +
      '<p style="font-size:11px;color:var(--ink3);margin-top:8px">\u0e1a\u0e32\u0e23\u0e4c\u0e40\u0e04\u0e49\u0e14\u0e43\u0e0a\u0e49\u0e15\u0e2d\u0e19\u0e2a\u0e41\u0e01\u0e19\u0e41\u0e1e\u0e47\u0e01</p>' +
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
    var body = { barcode: barcode || null };
    if (unitSku) body.unitSku = unitSku;
    api(rp() + '/skus/' + editingId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function () {
      if (skusCache[editingId]) {
        skusCache[editingId].barcode = barcode;
        if (unitSku) skusCache[editingId].unitSku = unitSku;
      }
      toast('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e1a\u0e32\u0e23\u0e4c\u0e40\u0e04\u0e49\u0e14\u0e41\u0e25\u0e49\u0e27');
      document.getElementById('bc-ov').classList.remove('open');
      setTimeout(reloadProductsWithBarcode, 100);
    }).catch(function (e) {
      toast('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08: ' + (e.message || e));
    });
  }

  function wireListClicks() {
    var list = document.getElementById('prod-list');
    if (!list || list.getAttribute('data-bc-wired') === '1') return;
    list.setAttribute('data-bc-wired', '1');
    list.style.cursor = 'pointer';
    list.addEventListener('click', function (e) {
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
        var keys = Object.keys(skusCache);
        for (var i = 0; i < keys.length; i++) {
          var s = skusCache[keys[i]] || {};
          if ((s.name || keys[i]) === nm) {
            id = keys[i]; name = s.name || id; barcode = s.barcode || ''; unitSku = s.unitSku || '';
            break;
          }
        }
      }
      if (!id) { toast('\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e23\u0e2b\u0e31\u0e2a\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32'); return; }
      openEdit(id, name || id, barcode, unitSku);
    });
  }

  function paintRows(ents) {
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
      return '<div class="row" data-sku-id="' + x.id + '" data-sku-name="' +
        String(s.name || x.id).replace(/"/g, '') +
        '" data-sku-barcode="' + String(bc).replace(/"/g, '') +
        '" data-sku-unitsku="' + String(us).replace(/"/g, '') +
        '" style="cursor:pointer">' +
        '<div class="row-ico">\u25a2</div><div class="row-b"><div class="row-n">' +
        (s.name || x.id) + '</div><div class="row-m">' + meta.join(' \u00b7 ') +
        '</div></div><div class="row-q">' + x.stock + '</div></div>';
    }).join('') +
      '<div class="empty" style="padding:12px;font-size:11px">\u0e04\u0e25\u0e34\u0e01\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e43\u0e2a\u0e48\u0e1a\u0e32\u0e23\u0e4c\u0e40\u0e04\u0e49\u0e14 / SKU</div>';
    wireListClicks();
  }

  function reloadProductsWithBarcode() {
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
      paintRows(ents);
    }).catch(function (e) {
      console.warn('barcode reload', e);
    }).then(function () { reloading = false; });
  }

  function watchProdList() {
    var el = document.getElementById('prod-list');
    if (!el || el._bcObs) return;
    var timer = null;
    var obs = new MutationObserver(function () {
      if (reloading) return;
      var rows = el.querySelectorAll('.row');
      if (!rows.length) return;
      if (!el.querySelector('.row[data-sku-id]')) {
        clearTimeout(timer);
        timer = setTimeout(reloadProductsWithBarcode, 50);
      }
    });
    obs.observe(el, { childList: true, subtree: true });
    el._bcObs = obs;
  }

  function onProductsPage() {
    ensureSheet();
    wireListClicks();
    watchProdList();
    reloadProductsWithBarcode();
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.ni[data-page="products"]');
    if (btn) {
      setTimeout(onProductsPage, 50);
      setTimeout(onProductsPage, 400);
      setTimeout(onProductsPage, 1200);
    }
  });

  setInterval(function () {
    var page = document.getElementById('page-products');
    if (page && page.classList.contains('active')) {
      wireListClicks();
      watchProdList();
      var el = document.getElementById('prod-list');
      if (el && el.querySelector('.row') && !el.querySelector('.row[data-sku-id]')) {
        reloadProductsWithBarcode();
      }
    }
  }, 2000);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(onProductsPage, 2000); });
  } else {
    setTimeout(onProductsPage, 2000);
  }
  window.__reloadProductsBarcode = reloadProductsWithBarcode;
})();
