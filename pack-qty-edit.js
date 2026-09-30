/**
 * pack-qty-edit.js — แก้จำนวนได้ตรงหน้าสแกน (+/−) + รูปแพ็คตามจำนวน
 */
(function () {
  'use strict';
  var DB = 'https://kiyomi-b19d0-default-rtdb.asia-southeast1.firebasedatabase.app';
  var skus = {};

  function wsKey() { return sessionStorage.getItem('sf_session_ws') || ''; }
  function roomId() { return localStorage.getItem('sf_room_' + wsKey()) || 'WH_A'; }

  function toast(msg) {
    var w = document.getElementById('toast-wrap');
    if (!w) return;
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    w.innerHTML = '';
    w.appendChild(t);
    setTimeout(function () { t.remove(); }, 2000);
  }

  function loadSkus() {
    if (!wsKey()) return Promise.resolve({});
    return fetch(DB + '/ws_' + wsKey() + '/rooms/' + roomId() + '/skus.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) { skus = d || {}; return skus; })
      .catch(function () { return {}; });
  }

  function readLinesFromDom() {
    var box = document.getElementById('pack-lines');
    if (!box) return [];
    var lines = [], seen = {};
    box.querySelectorAll('.plu, .row').forEach(function (row) {
      var name = '', sku = '', scanned = 0, qty = 1;
      if (row.classList.contains('plu')) {
        name = row.getAttribute('data-sku-name') || ((row.querySelector('.plu-name') || {}).textContent || '');
        sku = row.getAttribute('data-sku-id') || ((row.querySelector('.plu-sku') || {}).textContent || '');
        scanned = parseInt(row.getAttribute('data-scanned'), 10) || 0;
        qty = parseInt(row.getAttribute('data-qty'), 10) || 1;
      } else {
        if (row.closest && row.closest('.plu')) return;
        name = ((row.querySelector('.row-n') || {}).textContent || '').trim();
        sku = ((row.querySelector('.row-m') || {}).textContent || '').trim();
        var q = ((row.querySelector('.row-q') || {}).textContent || '0/1').replace(/[^\d\/]/g, '');
        var parts = q.split('/');
        scanned = parseInt(parts[0], 10) || 0;
        qty = parseInt(parts[1], 10) || 1;
      }
      if (!sku) return;
      var key = sku + '|' + name;
      if (seen[key]) return;
      seen[key] = 1;
      lines.push({ skuId: sku, name: name, scanned: scanned, qty: qty });
    });
    return lines;
  }

  function rebuildLines(lines) {
    var resetBtn = document.getElementById('pack-reset');
    var sel = document.getElementById('pack-add-sku');
    var qtyEl = document.getElementById('pack-add-qty');
    var addBtn = document.getElementById('pack-add-btn');
    if (!sel || !addBtn || !qtyEl) { toast('\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e0b\u0e48\u0e2d\u0e07\u0e41\u0e1e\u0e47\u0e01'); return; }
    if (resetBtn) { try { resetBtn.click(); } catch (e) {} }
    setTimeout(function () {
      lines.forEach(function (l) {
        if (!l.skuId || l.qty < 1) return;
        var has = false;
        for (var i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value === l.skuId) { has = true; break; }
        }
        if (!has) {
          var opt = document.createElement('option');
          opt.value = l.skuId;
          opt.textContent = l.name || l.skuId;
          sel.appendChild(opt);
        }
        sel.value = l.skuId;
        qtyEl.value = String(l.qty);
        try { addBtn.click(); } catch (e) {}
      });
      setTimeout(function () { enhance(); toast('\u0e41\u0e01\u0e49\u0e08\u0e33\u0e19\u0e27\u0e19\u0e41\u0e25\u0e49\u0e27'); }, 200);
    }, 150);
  }

  function adjustQty(skuId, delta) {
    var lines = readLinesFromDom();
    if (!lines.length) return;
    var found = false;
    lines.forEach(function (l) {
      if (l.skuId === skuId) {
        l.qty = Math.max(1, (l.qty || 1) + delta);
        if (l.scanned > l.qty) l.scanned = l.qty;
        found = true;
      }
    });
    if (!found) return;
    if (delta > 0) {
      var sel = document.getElementById('pack-add-sku');
      var qtyEl = document.getElementById('pack-add-qty');
      var addBtn = document.getElementById('pack-add-btn');
      if (sel && qtyEl && addBtn) {
        var has = false;
        for (var i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value === skuId) { has = true; break; }
        }
        if (!has) {
          var opt = document.createElement('option');
          opt.value = skuId;
          opt.textContent = skuId;
          sel.appendChild(opt);
        }
        sel.value = skuId;
        qtyEl.value = String(delta);
        try { addBtn.click(); } catch (e) {}
        setTimeout(enhance, 200);
        var cur = lines.filter(function (l) { return l.skuId === skuId; })[0];
        toast('\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e40\u0e1b\u0e47\u0e19 ' + (cur ? cur.qty : '') + ' \u0e41\u0e1e\u0e47\u0e04');
        return;
      }
    }
    rebuildLines(lines);
  }

  function ensureCss() {
    if (document.getElementById('pack-qty-edit-css')) return;
    var s = document.createElement('style');
    s.id = 'pack-qty-edit-css';
    s.textContent =
      '.pqe-bar{display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap}' +
      '.pqe-btn{width:40px;height:40px;border-radius:12px;border:1.5px solid #d1d5db;background:#fff;font-size:20px;font-weight:800;cursor:pointer;line-height:1;color:#111}' +
      '.pqe-btn:active{background:#f3f4f6}' +
      '.pqe-num{font-family:IBM Plex Mono,monospace;font-weight:800;font-size:18px;min-width:32px;text-align:center}' +
      '.pqe-hint{font-size:11px;color:#9ca3af;font-weight:600;width:100%}' +
      '.pqe-thumbs{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}' +
      '.pqe-thumbs img,.pqe-thumbs .pqe-ph{width:52px;height:52px;border-radius:12px;object-fit:cover;border:2px solid #e5e7eb}' +
      '.pqe-thumbs img.on,.pqe-thumbs .pqe-ph.on{border-color:#16a34a}' +
      '.pqe-thumbs .pqe-ph{display:grid;place-items:center;background:#f3f4f6;font-size:12px;font-weight:800;color:#9ca3af}' +
      '.pqe-thumbs .pqe-ph.on{background:#dcfce7;color:#166534}';
    document.head.appendChild(s);
  }

  function enhance() {
    ensureCss();
    var box = document.getElementById('pack-lines');
    if (!box) return;

    box.querySelectorAll('.plu').forEach(function (plu) {
      if (plu.querySelector('.pqe-bar')) return;
      var sku = plu.getAttribute('data-sku-id') || '';
      var qty = parseInt(plu.getAttribute('data-qty'), 10) || 1;
      var scanned = parseInt(plu.getAttribute('data-scanned'), 10) || 0;
      var s = skus[sku] || {};
      var img = s.image || '';

      var thumbs = document.createElement('div');
      thumbs.className = 'pqe-thumbs';
      var nShow = Math.min(qty, 8);
      for (var i = 0; i < nShow; i++) {
        var on = i < scanned;
        if (img) {
          var im = document.createElement('img');
          im.src = img;
          im.alt = '';
          if (on) im.className = 'on';
          thumbs.appendChild(im);
        } else {
          var ph = document.createElement('div');
          ph.className = 'pqe-ph' + (on ? ' on' : '');
          ph.textContent = String(i + 1);
          thumbs.appendChild(ph);
        }
      }
      if (qty > 8) {
        var more = document.createElement('div');
        more.className = 'pqe-ph';
        more.textContent = '+' + (qty - 8);
        thumbs.appendChild(more);
      }

      var bar = document.createElement('div');
      bar.className = 'pqe-bar';
      bar.innerHTML =
        '<button type="button" class="pqe-btn" data-act="minus" data-sku="' + sku.replace(/"/g, '') + '">\u2212</button>' +
        '<span class="pqe-num">' + qty + '</span>' +
        '<button type="button" class="pqe-btn" data-act="plus" data-sku="' + sku.replace(/"/g, '') + '">+</button>' +
        '<span style="font-size:14px;font-weight:800;margin-left:4px">\u0e41\u0e1e\u0e47\u0e04</span>' +
        '<div class="pqe-hint">\u0e01\u0e14 + / \u2212 \u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e41\u0e01\u0e49\u0e08\u0e33\u0e19\u0e27\u0e19\u0e15\u0e23\u0e07\u0e2b\u0e19\u0e49\u0e32\u0e2a\u0e41\u0e01\u0e19</div>';

      var sub = plu.querySelector('.plu-sub');
      if (sub) { plu.insertBefore(thumbs, sub); plu.appendChild(bar); }
      else { plu.appendChild(thumbs); plu.appendChild(bar); }

      var unitEl = plu.querySelector('.plu-unit');
      if (unitEl) unitEl.textContent = '\u0e41\u0e1e\u0e47\u0e04';
      var prog = plu.querySelector('.plu-prog');
      if (prog) {
        var remain = Math.max(0, qty - scanned);
        prog.textContent = remain === 0
          ? '\u0e04\u0e23\u0e1a\u0e41\u0e25\u0e49\u0e27 ' + scanned + '/' + qty + ' \u0e41\u0e1e\u0e47\u0e04'
          : '\u0e15\u0e49\u0e2d\u0e07\u0e2a\u0e41\u0e01\u0e19 ' + remain + ' \u0e41\u0e1e\u0e47\u0e04 \u00b7 \u0e2a\u0e41\u0e01\u0e19\u0e41\u0e25\u0e49\u0e27 ' + scanned + '/' + qty;
      }
    });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.pqe-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    var sku = btn.getAttribute('data-sku') || '';
    var act = btn.getAttribute('data-act');
    if (!sku) return;
    adjustQty(sku, act === 'plus' ? 1 : -1);
  }, true);

  var mo = new MutationObserver(function () {
    var box = document.getElementById('pack-lines');
    if (box && box.querySelector('.plu') && !box.querySelector('.pqe-bar')) enhance();
  });
  mo.observe(document.body, { childList: true, subtree: true });
  setInterval(function () {
    var box = document.getElementById('pack-lines');
    if (box && box.querySelector('.plu') && !box.querySelector('.pqe-bar')) enhance();
  }, 600);

  loadSkus();
  setInterval(loadSkus, 60000);
  console.log('[SF] pack-qty-edit ready');
})();
