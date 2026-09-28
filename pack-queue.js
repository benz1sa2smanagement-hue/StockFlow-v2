/**
 * Pending orders queue on Pack page
 */
(function () {
  'use strict';
  var KEY = 'sf_bs_orders_v1';
  var DONE_KEY = 'sf_bs_orders_done_v1';

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

  function loadStore() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; }
  }
  function loadDone() {
    try { return JSON.parse(localStorage.getItem(DONE_KEY) || '{}'); } catch (e) { return {}; }
  }
  function norm(v) {
    return String(v || '').trim().toUpperCase().replace(/\s+/g, '');
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
        lineCount: o.lines.length,
        qty: qty,
        order: o
      });
    });
    list.sort(function (a, b) {
      return String(a.track || a.id).localeCompare(String(b.track || b.id));
    });
    return list;
  }

  function ensureUi() {
    var page = document.getElementById('page-pack');
    if (!page) return false;
    if (document.getElementById('pack-queue-panel')) {
      renderList();
      return true;
    }
    var box = document.createElement('div');
    box.id = 'pack-queue-panel';
    box.className = 'card';
    box.style.cssText = 'padding:12px 14px;margin-bottom:12px;border:1px solid var(--line,#e5e7eb)';
    box.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">' +
      '<div style="font-size:14px;font-weight:800">\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e04\u0e49\u0e32\u0e07\u0e43\u0e19\u0e04\u0e34\u0e27\u0e41\u0e1e\u0e47\u0e01</div>' +
      '<button type="button" id="pack-queue-refresh" style="padding:6px 10px;border-radius:10px;border:1px solid var(--line2,#d1d5db);background:#fff;font-size:12px;cursor:pointer">\u0e23\u0e35\u0e40\u0e1f\u0e23\u0e0a</button>' +
      '</div>' +
      '<div id="pack-queue-count" style="font-size:12px;color:var(--ink3);margin-bottom:8px"></div>' +
      '<div id="pack-queue-list" style="display:flex;flex-direction:column;gap:6px;max-height:220px;overflow:auto"></div>';

    var anchor = document.getElementById('pack-bs-bridge') || document.getElementById('pack-csv-panel');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor.nextSibling);
    else {
      var title = page.querySelector('.pt');
      if (title && title.nextSibling) page.insertBefore(box, title.nextSibling);
      else page.insertBefore(box, page.firstChild);
    }

    document.getElementById('pack-queue-refresh').addEventListener('click', function () {
      if (typeof window.__packPullOrdersCloud === 'function') window.__packPullOrdersCloud();
      renderList();
      toast('\u0e23\u0e35\u0e40\u0e1f\u0e23\u0e0a\u0e04\u0e34\u0e27\u0e41\u0e25\u0e49\u0e27');
    });
    return true;
  }

  function activate(order) {
    if (!order) return;
    if (typeof window.__bsTryLoadOrder === 'function') {
      var code = order.track || order.packageId || order.id;
      if (window.__bsTryLoadOrder(code, false)) {
        toast('\u0e42\u0e2b\u0e25\u0e14\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c ' + code);
        return;
      }
    }
    if (typeof window.__packLoadLines === 'function') {
      window.__packLoadLines(order);
      var oe = document.getElementById('pack-order');
      if (oe) oe.value = order.track || order.packageId || order.id || '';
      toast('\u0e42\u0e2b\u0e25\u0e14\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e41\u0e25\u0e49\u0e27');
    }
  }

  function renderList() {
    var listEl = document.getElementById('pack-queue-list');
    var countEl = document.getElementById('pack-queue-count');
    if (!listEl) return;
    var list = uniqueOrders();
    if (countEl) {
      countEl.textContent = list.length
        ? ('\u0e40\u0e2b\u0e25\u0e37\u0e2d ' + list.length + ' \u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c \u00b7 \u0e41\u0e15\u0e30\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e42\u0e2b\u0e25\u0e14\u0e02\u0e36\u0e49\u0e19\u0e41\u0e1e\u0e47\u0e01')
        : '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e04\u0e49\u0e32\u0e07 \u2014 \u0e2d\u0e31\u0e1b\u0e44\u0e1f\u0e25\u0e4c\u0e2b\u0e23\u0e37\u0e2d\u0e14\u0e36\u0e07\u0e08\u0e32\u0e01 BigSeller';
    }
    if (!list.length) {
      listEl.innerHTML = '<div style="font-size:12px;color:var(--ink3);padding:8px 0">\u0e04\u0e34\u0e27\u0e27\u0e48\u0e32\u0e07</div>';
      return;
    }
    listEl.innerHTML = list.map(function (item) {
      var label = item.track || item.id || item.packageId || item.key;
      var sub = (item.platform ? item.platform + ' \u00b7 ' : '') + item.lineCount + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23 \u00b7 ' + item.qty + ' \u0e0a\u0e34\u0e49\u0e19';
      return (
        '<button type="button" class="pack-queue-item" data-key="' + item.key.replace(/"/g, '') + '" style="' +
        'text-align:left;padding:10px 12px;border-radius:12px;border:1px solid var(--line,#e5e7eb);' +
        'background:#fff;cursor:pointer;font:inherit;width:100%;box-sizing:border-box">' +
        '<div style="font-weight:700;font-size:13px;font-family:IBM Plex Mono,monospace">' + label + '</div>' +
        '<div style="font-size:11px;color:var(--ink3);margin-top:2px">' + sub + '</div>' +
        '</button>'
      );
    }).join('');

    listEl.querySelectorAll('.pack-queue-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-key');
        var found = uniqueOrders().filter(function (x) { return x.key === key; })[0];
        if (found) activate(found.order);
      });
    });
  }

  function wire() {
    if (!ensureUi()) return;
    renderList();
  }

  var lastSig = '';
  setInterval(function () {
    var page = document.getElementById('page-pack');
    if (!page || !page.classList.contains('active')) return;
    wire();
    var sig = localStorage.getItem(KEY) || '';
    if (sig !== lastSig) {
      lastSig = sig;
      renderList();
    }
  }, 2000);

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.ni[data-page="pack"]');
    if (btn) setTimeout(wire, 200);
  });

  window.__packQueueRefresh = renderList;
  setTimeout(wire, 800);
  setTimeout(wire, 2000);
})();
