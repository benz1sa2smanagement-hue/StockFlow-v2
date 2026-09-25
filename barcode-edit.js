/**
 * Product edit (name / barcode / SKU) — stable list, no flicker
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
      '<div class="field"><label>SKU \u0e17\u0e35\u0e48\u0e43\u0e0a\u0e49\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48 BigSeller</label>' +
      '<input type="text" id="bc-sku" placeholder="\u0e40\u0e0a\u0e48\u0e19 KIY-ROLL-250" autocomplete="off"></div>' +
      '<button type="button" class="btn btn-ink" id="bc-save">\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01</button>' +
      '<p style="font-size:11px;color:var(--ink3);margin-top:8px">\u0e41\u0e01\u0e49\u0e0a\u0e37\u0e48\u0e2d\u0e43\u0e2b\u0e49\u0e15\u0e23\u0e07 BigSeller \u00b7 \u0e1a\u0e32\u0e23\u0e4c\u0e40\u0e04\u0e49\u0e14\u0e43\u0e0a\u0e49\u0e15\u0e2d\u0e19\u0e2a\u0e41\u0e01\u0e19\u0e41\u0e1e\u0e47\u0e01</p>' +
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
    var body = { name: name, barcode: barcode || null, unitSku: unitSku || null };
    api(rp() + '/skus/' + editingId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function () {
      if (!skusCache[editingId]) skusCache[editingId] = {};
      skusCache[editingId].name = name;
      skusCache[editingId].barcode = barcode;
      skusCache[editingId].unitSku = unitSku || '';
      lastPaintKey = '';
      toast('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e0a\u0e37\u0e48\u0e2d \u00b7 \u0e1a\u0e32\u0e23\u0e4c\u0e40\u0e04\u0e49\u0e14 \u0e41\u0e25\u0e49\u0e27');
      document.getElementById('bc-ov').classList.remove('open');
      setTimeout(function () { reloadProductsWithBarcode(true); }, 80);
    }).catch(function (e) {
      toast('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08: ' + (e.message || e));
    });
  }

  function wireListClicks() {
    var list = document.getElementById('prod-list');
    if (!list || list.getAttribute('data-bc-wired') === '1') return;
    list.setAttribute('data-bc-wired', '1');
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
        Object.keys(skusCache).forEach(function (k) {
          if (id) return;
          var s = skusCache[k] || {};
          if ((s.name || k) === nm) {
            id = k; name = s.name || k; barcode = s.barcode || ''; unitSku = s.unitSku || '';
          }
        });
      }
      if (!id) { toast('\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e23\u0e2b\u0e31\u0e2a\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32'); return; }
      openEdit(id, name || id, barcode, unitSku);
    });
  }

  function buildPaintKey(ents) {
    return ents.map(function (x) {
      var s = x.s || {};
      return x.id + '|' + (s.name || '') + '|' + (s.barcode || '') + '|' + (s.unitSku || '') + '|' + x.stock;
    }).join(';;');
  }

  function paintRows(ents) {
    var el = document.getElementById('prod-list');
    if (!el) return;
    var key = buildPaintKey(ents);
    if (key === lastPaintKey && el.querySelector('.row[data-sku-id]')) return;
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

  function enhanceExistingRows() {
    var el = document.getElementById('prod-list');
    if (!el) return false;
    var rows = el.querySelectorAll('.row');
    if (!rows.length) return false;
    if (el.querySelector('.row[data-sku-id]')) return true;
    if (!Object.keys(skusCache).length) return false;
    var matched = 0;
    rows.forEach(function (row) {
      var nameEl = row.querySelector('.row-n');
      var metaEl = row.querySelector('.row-m');
      if (!nameEl) return;
      var nm = nameEl.textContent.trim();
      var id = null, s = null;
      var keys = Object.keys(skusCache);
      for (var i = 0; i < keys.length; i++) {
        var cand = skusCache[keys[i]] || {};
        if ((cand.name || keys[i]) === nm) { id = keys[i]; s = cand; break; }
      }
      if (!id) return;
      matched++;
      row.setAttribute('data-sku-id', id);
      row.setAttribute('data-sku-name', s.name || id);
      row.setAttribute('data-sku-barcode', s.barcode || '');
      row.setAttribute('data-sku-unitsku', s.unitSku || '');
      row.style.cursor = 'pointer';
      if (metaEl) {
        var parts = [];
        if (s.unitSku) parts.push('SKU ' + s.unitSku);
        if (s.barcode) parts.push('BC ' + s.barcode);
        else parts.push('\u0e04\u0e25\u0e34\u0e01\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e41\u0e01\u0e49\u0e44\u0e02');
        var next = parts.join(' \u00b7 ');
        if (metaEl.textContent !== next) metaEl.textContent = next;
      }
    });
    return matched > 0;
  }

  function reloadProductsWithBarcode(force) {
    if (!wsKey() || reloading) return;
    if (!force && enhanceExistingRows()) {
      wireListClicks();
      return;
    }
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
      if (!el.querySelector('.row')) return;
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (el.querySelector('.row[data-sku-id]')) return;
        if (!enhanceExistingRows()) reloadProductsWithBarcode(true);
        else wireListClicks();
      }, 80);
    });
    obs.observe(el, { childList: true, subtree: false });
    el._bcObs = obs;
  }

  function onProductsPage() {
    ensureSheet();
    wireListClicks();
    watchProdList();
    if (!Object.keys(skusCache).length) reloadProductsWithBarcode(true);
    else {
      if (!enhanceExistingRows()) reloadProductsWithBarcode(true);
      else wireListClicks();
    }
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.ni[data-page="products"]');
    if (btn) setTimeout(onProductsPage, 60);
  });

  setInterval(function () {
    var page = document.getElementById('page-products');
    if (!page || !page.classList.contains('active')) return;
    wireListClicks();
    watchProdList();
    var el = document.getElementById('prod-list');
    if (el && el.querySelector('.row') && !el.querySelector('.row[data-sku-id]')) {
      enhanceExistingRows();
    }
  }, 4000);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(onProductsPage, 2500); });
  } else {
    setTimeout(onProductsPage, 2500);
  }
  window.__reloadProductsBarcode = function () {
    lastPaintKey = '';
    reloadProductsWithBarcode(true);
  };
})();
