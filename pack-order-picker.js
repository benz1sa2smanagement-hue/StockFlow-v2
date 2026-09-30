/**
 * pack-order-picker.js
 * เมื่อสแกนออเดอร์แล้วจับคู่ไม่เจอ → เปิดหน้าต่างเลือกออเดอร์
 * พิมพ์ค้นหา Tracking / Order ID / Package ได้
 */
(function () {
  'use strict';
  var KEY = 'sf_bs_orders_v1';
  var DONE_KEY = 'sf_bs_orders_done_v1';
  var lastQuery = '';
  var open = false;

  function toast(msg) {
    var w = document.getElementById('toast-wrap');
    if (!w) return;
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    w.innerHTML = '';
    w.appendChild(t);
    setTimeout(function () { t.remove(); }, 2500);
  }

  function norm(v) {
    return String(v || '').trim().toUpperCase().replace(/\s+/g, '');
  }

  function loadStore() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; }
  }
  function loadDone() {
    try { return JSON.parse(localStorage.getItem(DONE_KEY) || '{}'); } catch (e) { return {}; }
  }

  function uniqueOrders() {
    var store = loadStore();
    var done = loadDone();
    var seen = {};
    var list = [];
    Object.keys(store).forEach(function (k) {
      var o = store[k];
      if (!o || !o.lines || !o.lines.length) return;
      var id = norm(o.id || o.track || o.packageId || k);
      if (!id || seen[id]) return;
      if (done[id] || done[norm(o.track)] || done[norm(o.packageId)]) return;
      seen[id] = 1;
      var qty = 0;
      o.lines.forEach(function (l) { qty += parseInt(l.qty, 10) || 0; });
      list.push({
        key: id,
        id: o.id || '',
        track: o.track || '',
        packageId: o.packageId || '',
        platform: o.platform || '',
        qty: qty,
        lineCount: o.lines.length,
        order: o,
        name: (o.lines[0] && (o.lines[0].name || o.lines[0].sku)) || ''
      });
    });
    list.sort(function (a, b) {
      return String(b.id || b.track).localeCompare(String(a.id || a.track));
    });
    return list;
  }

  function matchFilter(item, q) {
    q = norm(q);
    if (!q) return true;
    var hay = norm([item.id, item.track, item.packageId, item.platform, item.name, item.key].join(' '));
    if (hay.indexOf(q) >= 0) return true;
    var compact = hay.replace(/[^A-Z0-9]/g, '');
    var qc = q.replace(/[^A-Z0-9]/g, '');
    return qc && compact.indexOf(qc) >= 0;
  }

  function ensureCss() {
    if (document.getElementById('pack-order-picker-css')) return;
    var s = document.createElement('style');
    s.id = 'pack-order-picker-css';
    s.textContent =
      '#pack-order-picker{display:none;position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.55);backdrop-filter:blur(3px);padding:12px;overflow:auto}' +
      '#pack-order-picker.open{display:block}' +
      '#pack-order-picker .pop-card{max-width:520px;margin:8vh auto 24px;background:#fff;border-radius:18px;box-shadow:0 20px 50px rgba(0,0,0,.25);overflow:hidden}' +
      '#pack-order-picker .pop-h{padding:16px 18px 10px;border-bottom:1px solid #e5e7eb}' +
      '#pack-order-picker .pop-title{font-size:18px;font-weight:800;color:#0f172a;margin:0 0 4px}' +
      '#pack-order-picker .pop-sub{font-size:13px;color:#64748b;font-weight:600}' +
      '#pack-order-picker .pop-search{padding:12px 16px;border-bottom:1px solid #e5e7eb}' +
      '#pack-order-picker #pop-order-q{width:100%;box-sizing:border-box;padding:14px 16px;border-radius:14px;border:2px solid #2563eb;font-size:16px;font-weight:600;outline:none;background:#f8fafc}' +
      '#pack-order-picker #pop-order-q:focus{border-color:#1d4ed8;box-shadow:0 0 0 3px rgba(37,99,235,.2)}' +
      '#pack-order-picker .pop-list{max-height:50vh;overflow:auto;padding:8px}' +
      '#pack-order-picker .pop-item{display:block;width:100%;text-align:left;padding:12px 14px;border:none;background:#fff;border-radius:12px;cursor:pointer;border-bottom:1px solid #f1f5f9}' +
      '#pack-order-picker .pop-item:hover,#pack-order-picker .pop-item:active{background:#eff6ff}' +
      '#pack-order-picker .pop-id{font-family:IBM Plex Mono,monospace;font-size:14px;font-weight:800;color:#0f172a}' +
      '#pack-order-picker .pop-meta{font-size:12px;color:#64748b;margin-top:2px;font-weight:600}' +
      '#pack-order-picker .pop-empty{padding:28px 16px;text-align:center;color:#94a3b8;font-weight:700}' +
      '#pack-order-picker .pop-foot{padding:12px 16px;border-top:1px solid #e5e7eb;display:flex;gap:8px}' +
      '#pack-order-picker .pop-btn{flex:1;padding:12px;border-radius:12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:700;font-size:14px;cursor:pointer}' +
      '#pack-order-picker .pop-btn.primary{background:#2563eb;color:#fff;border-color:#2563eb}';
    document.head.appendChild(s);
  }

  function ensureModal() {
    ensureCss();
    if (document.getElementById('pack-order-picker')) return;
    var el = document.createElement('div');
    el.id = 'pack-order-picker';
    el.innerHTML =
      '<div class="pop-card">' +
        '<div class="pop-h">' +
          '<div class="pop-title">\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c</div>' +
          '<div class="pop-sub" id="pop-order-sub">\u0e1e\u0e34\u0e21\u0e1e\u0e4c\u0e04\u0e49\u0e19\u0e2b\u0e32\u0e2b\u0e23\u0e37\u0e2d\u0e01\u0e14\u0e40\u0e25\u0e37\u0e2d\u0e01</div>' +
        '</div>' +
        '<div class="pop-search">' +
          '<input id="pop-order-q" type="search" inputmode="search" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="\u0e1e\u0e34\u0e21\u0e1e\u0e4c\u0e04\u0e49\u0e19: Tracking / Order ID / Package\u2026">' +
        '</div>' +
        '<div class="pop-list" id="pop-order-list"></div>' +
        '<div class="pop-foot">' +
          '<button type="button" class="pop-btn" id="pop-order-close">\u0e1b\u0e34\u0e14</button>' +
          '<button type="button" class="pop-btn primary" id="pop-order-refresh">\u0e23\u0e35\u0e40\u0e1f\u0e23\u0e0a\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);

    el.addEventListener('click', function (e) {
      if (e.target === el) closePicker();
    });
    document.getElementById('pop-order-close').addEventListener('click', closePicker);
    document.getElementById('pop-order-refresh').addEventListener('click', function () {
      renderList(document.getElementById('pop-order-q').value || '');
      toast('\u0e23\u0e35\u0e40\u0e1f\u0e23\u0e0a\u0e41\u0e25\u0e49\u0e27');
    });
    var q = document.getElementById('pop-order-q');
    q.addEventListener('input', function () {
      lastQuery = q.value || '';
      renderList(lastQuery);
    });
    q.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closePicker(); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        var first = document.querySelector('#pop-order-list .pop-item');
        if (first) first.click();
      }
    });
  }

  function renderList(query) {
    var listEl = document.getElementById('pop-order-list');
    if (!listEl) return;
    var all = uniqueOrders();
    var filtered = all.filter(function (item) { return matchFilter(item, query); });
    if (!filtered.length) {
      listEl.innerHTML = '<div class="pop-empty">' +
        (all.length ? '\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e17\u0e35\u0e48\u0e15\u0e23\u0e07\u0e01\u0e31\u0e1a \u201c' + (query || '') + '\u201d' : '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c \u2014 \u0e14\u0e36\u0e07\u0e08\u0e32\u0e01 BigSeller \u0e01\u0e48\u0e2d\u0e19') +
        '</div>';
      return;
    }
    listEl.innerHTML = filtered.slice(0, 60).map(function (item) {
      var title = item.track || item.id || item.packageId || item.key;
      var meta = [];
      if (item.id && item.id !== title) meta.push(item.id);
      if (item.packageId && item.packageId !== title) meta.push(item.packageId);
      if (item.platform) meta.push(item.platform);
      meta.push(item.lineCount + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23');
      meta.push(item.qty + ' \u0e0a\u0e34\u0e49\u0e19');
      return '<button type="button" class="pop-item" data-key="' + item.key.replace(/"/g, '') + '">' +
        '<div class="pop-id">' + title + '</div>' +
        '<div class="pop-meta">' + meta.join(' \u00b7 ') + (item.name ? '<br>' + item.name : '') + '</div>' +
        '</button>';
    }).join('');

    listEl.querySelectorAll('.pop-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-key');
        var found = uniqueOrders().filter(function (x) { return x.key === key; })[0];
        if (!found) return;
        selectOrder(found);
      });
    });
  }

  function selectOrder(item) {
    closePicker();
    var orderEl = document.getElementById('pack-order');
    var code = item.track || item.id || item.packageId || item.key;
    if (orderEl) orderEl.value = code;

    if (typeof window.__packLoadLines === 'function') {
      try {
        window.__packLoadLines(item.order);
        toast('\u0e42\u0e2b\u0e25\u0e14\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c: ' + code);
        return;
      } catch (e) {}
    }
    if (typeof window.__bsTryLoadOrder === 'function') {
      try { window.__bsTryLoadOrder(code, false); return; } catch (e) {}
    }
    toast('\u0e40\u0e25\u0e37\u0e2d\u0e01: ' + code);
  }

  function openPicker(hint) {
    ensureModal();
    var el = document.getElementById('pack-order-picker');
    if (!el) return;
    open = true;
    el.classList.add('open');
    var sub = document.getElementById('pop-order-sub');
    if (sub) {
      sub.textContent = hint
        ? ('\u0e2a\u0e41\u0e01\u0e19\u0e44\u0e21\u0e48\u0e1e\u0e1a: ' + hint + ' \u2014 \u0e1e\u0e34\u0e21\u0e1e\u0e4c\u0e04\u0e49\u0e19\u0e2b\u0e32\u0e2b\u0e23\u0e37\u0e2d\u0e01\u0e14\u0e40\u0e25\u0e37\u0e2d\u0e01')
        : '\u0e1e\u0e34\u0e21\u0e1e\u0e4c\u0e04\u0e49\u0e19 Tracking / Order ID \u0e2b\u0e23\u0e37\u0e2d\u0e01\u0e14\u0e40\u0e25\u0e37\u0e2d\u0e01';
    }
    var q = document.getElementById('pop-order-q');
    if (q) {
      var pre = '';
      if (hint && String(hint).length <= 24) pre = String(hint);
      q.value = pre;
      lastQuery = pre;
      renderList(pre);
      setTimeout(function () {
        try { q.focus(); q.select(); } catch (e) {}
      }, 80);
    } else {
      renderList('');
    }
  }

  function closePicker() {
    open = false;
    var el = document.getElementById('pack-order-picker');
    if (el) el.classList.remove('open');
    setTimeout(function () {
      var orderEl = document.getElementById('pack-order');
      if (orderEl) try { orderEl.focus(); } catch (e) {}
    }, 100);
  }

  function wrapTry() {
    if (typeof window.__bsTryLoadOrder !== 'function') return false;
    if (window.__bsTryLoadOrder._picker) return true;
    var orig = window.__bsTryLoadOrder;
    window.__bsTryLoadOrder = function (v, silent) {
      var ok = orig(v, silent);
      if (!ok && !silent) {
        var short = String(v || '').trim();
        if (short.length > 40) short = short.slice(0, 40) + '\u2026';
        setTimeout(function () { openPicker(short); }, 120);
      }
      return ok;
    };
    window.__bsTryLoadOrder._picker = true;
    return true;
  }

  function watchStatus() {
    if (document.getElementById('pack-order-search-btn')) return;
    var orderEl = document.getElementById('pack-order');
    if (!orderEl || !orderEl.parentNode) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'pack-order-search-btn';
    btn.textContent = '\u0e04\u0e49\u0e19\u0e2b\u0e32';
    btn.title = '\u0e04\u0e49\u0e19\u0e2b\u0e32\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c';
    btn.style.cssText = 'margin-left:6px;padding:8px 12px;border-radius:10px;border:1px solid #d1d5db;background:#fff;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      openPicker(orderEl.value || '');
    });
    var parent = orderEl.parentNode;
    if (parent.style) {
      parent.style.display = 'flex';
      parent.style.alignItems = 'center';
      parent.style.gap = '6px';
    }
    orderEl.style.flex = '1';
    parent.appendChild(btn);
  }

  function unlockOrderInput() {
    var orderEl = document.getElementById('pack-order');
    if (!orderEl) return;
    orderEl.removeAttribute('readonly');
    orderEl.setAttribute('inputmode', 'text');
    orderEl.setAttribute('autocomplete', 'off');
  }

  function boot() {
    wrapTry();
    unlockOrderInput();
    watchStatus();
  }

  var tries = 0;
  function tryBoot() {
    boot();
    if (!window.__bsTryLoadOrder || !window.__bsTryLoadOrder._picker) {
      if (++tries < 40) setTimeout(tryBoot, 250);
    }
  }
  tryBoot();
  setInterval(function () {
    wrapTry();
    unlockOrderInput();
    watchStatus();
  }, 3000);

  window.__packOpenOrderPicker = openPicker;
  window.__packCloseOrderPicker = closePicker;
  console.log('[SF] pack-order-picker ready');
})();
