/**
 * Pack order queue: pending + done — no flicker (render only on data change)
 * Sections: BigSeller pulled | waiting to pack | done
 */
(function () {
  'use strict';
  var KEY = 'sf_bs_orders_v1';
  var DONE_KEY = 'sf_bs_orders_done_v1';
  var filterPending = '';
  var filterDone = '';
  var lastSig = '';
  var lastPendingHtml = '';
  var lastDoneHtml = '';
  var uiBuilt = false;

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
  function loadStore() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveStore(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }
  function loadDone() {
    try { return JSON.parse(localStorage.getItem(DONE_KEY) || '{}'); } catch (e) { return {}; }
  }
  function norm(v) {
    return String(v || '').trim().toUpperCase().replace(/\s+/g, '');
  }
  function dataSig() {
    return (localStorage.getItem(KEY) || '') + '|' + (localStorage.getItem(DONE_KEY) || '') + '|' + filterPending + '|' + filterDone;
  }
  function isDoneCode(code) {
    var d = loadDone();
    var v = norm(code);
    if (!v) return false;
    if (d[v]) return true;
    var k2 = v.replace(/[^A-Z0-9]/g, '');
    if (k2 && d[k2]) return true;
    var keys = Object.keys(d);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].indexOf(v) >= 0 || v.indexOf(keys[i]) >= 0) return true;
    }
    return false;
  }
  function uniquePending() {
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
        key: id, id: o.id || '', track: o.track || '', packageId: o.packageId || '',
        platform: o.platform || '', lineCount: o.lines.length, qty: qty, order: o,
        pulledAt: Number(o.pulledAt || o.updatedAt || 0) || 0,
        source: o.source || ''
      });
    });
    list.sort(function (a, b) {
      return String(a.track || a.id).localeCompare(String(b.track || b.id));
    });
    return list;
  }
  function uniqueDone() {
    var done = loadDone();
    var store = loadStore();
    var list = [];
    var seen = {};
    Object.keys(done).forEach(function (k) {
      if (!k || seen[k]) return;
      var o = store[k];
      var label = k;
      var at = typeof done[k] === 'number' ? done[k] : 0;
      if (o) {
        label = o.track || o.id || o.packageId || k;
        var id = norm(o.id || o.track || o.packageId || k);
        if (seen[id]) return;
        seen[id] = 1;
        seen[norm(o.track)] = 1;
        seen[norm(o.id)] = 1;
      } else {
        if (seen[k]) return;
        seen[k] = 1;
      }
      list.push({ key: k, label: label, at: at });
    });
    list.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    var out = [], seenL = {};
    list.forEach(function (x) {
      var L = norm(x.label);
      if (seenL[L]) return;
      seenL[L] = 1;
      out.push(x);
    });
    return out;
  }
  function matchFilter(text, q) {
    if (!q) return true;
    return String(text || '').toUpperCase().indexOf(String(q).toUpperCase().trim()) >= 0;
  }
  function removeOrder(item) {
    if (!item) return;
    var store = loadStore();
    var keys = Object.keys(store);
    var targets = [norm(item.key), norm(item.id), norm(item.track), norm(item.packageId)].filter(Boolean);
    keys.forEach(function (k) {
      var o = store[k];
      if (!o) return;
      var ok = targets.indexOf(norm(k)) >= 0;
      if (!ok) {
        [o.id, o.track, o.packageId].forEach(function (x) {
          if (targets.indexOf(norm(x)) >= 0) ok = true;
        });
      }
      if (ok) delete store[k];
    });
    saveStore(store);
    toast('\u0e25\u0e1a\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e2d\u0e2d\u0e01\u0e08\u0e32\u0e01\u0e04\u0e34\u0e27\u0e41\u0e25\u0e49\u0e27');
    lastSig = '';
    lastPendingHtml = '';
    renderAll(true);
  }
  function showDoneAlert(code) {
    toast('\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e41\u0e25\u0e49\u0e27: ' + code);
    if (typeof window.__packPlayBad === 'function') window.__packPlayBad();
  }
  function activate(order) {
    if (!order) return;
    var code = order.track || order.packageId || order.id;
    if (isDoneCode(code) || isDoneCode(order.id) || isDoneCode(order.track)) {
      showDoneAlert(code);
      return;
    }
    if (typeof window.__bsTryLoadOrder === 'function') {
      if (window.__bsTryLoadOrder(code, false)) {
        toast('\u0e42\u0e2b\u0e25\u0e14\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c ' + code);
        return;
      }
    }
    if (typeof window.__packLoadLines === 'function') {
      window.__packLoadLines(order);
      var oe = document.getElementById('pack-order');
      if (oe) oe.value = code || '';
      toast('\u0e42\u0e2b\u0e25\u0e14\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e41\u0e25\u0e49\u0e27');
    }
  }
  function ensureUi() {
    var page = document.getElementById('page-pack');
    if (!page) return false;
    if (document.getElementById('pack-queue-panel')) {
      uiBuilt = true;
      return true;
    }
    var box = document.createElement('div');
    box.id = 'pack-queue-panel';
    box.className = 'card';
    box.style.cssText = 'padding:12px 14px;margin-bottom:12px;border:1px solid var(--line,#e5e7eb)';
    box.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">' +
      '<div style="font-size:14px;font-weight:800">\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e04\u0e49\u0e32\u0e07\u0e43\u0e19\u0e04\u0e34\u0e27\u0e41\u0e1e\u0e47\u0e01</div>' +
      '<button type="button" id="pack-queue-refresh" style="padding:6px 10px;border-radius:10px;border:1px solid var(--line2,#d1d5db);background:#fff;font-size:12px;cursor:pointer">\u0e23\u0e35\u0e40\u0e1f\u0e23\u0e0a</button></div>' +
      '<div id="pack-queue-stats" style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0"></div>' +
      '<input id="pack-queue-search" type="search" placeholder="\u0e04\u0e49\u0e19\u0e2b\u0e32 Tracking / Order ID\u2026" style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:12px;border:1px solid var(--line2,#d1d5db);font-size:13px;margin-bottom:8px">' +
      '<div id="pack-queue-sections" style="display:flex;flex-direction:column;gap:12px;margin-bottom:14px">' +
      '<div id="pack-sec-bs" style="display:none"></div>' +
      '<div id="pack-sec-pending"></div></div>' +
      '<div style="border-top:1px solid var(--line,#e5e7eb);padding-top:12px">' +
      '<div style="font-size:14px;font-weight:800;margin-bottom:8px">\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e17\u0e35\u0e48\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e41\u0e25\u0e49\u0e27</div>' +
      '<input id="pack-done-search" type="search" placeholder="\u0e04\u0e49\u0e19\u0e2b\u0e32\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e17\u0e35\u0e48\u0e15\u0e31\u0e14\u0e41\u0e25\u0e49\u0e27\u2026" style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:12px;border:1px solid var(--line2,#d1d5db);font-size:13px;margin-bottom:8px">' +
      '<div id="pack-done-count" style="font-size:12px;color:var(--ink3);margin-bottom:8px"></div>' +
      '<div id="pack-done-list" style="display:flex;flex-direction:column;gap:6px;max-height:160px;overflow:auto"></div></div>';
    var anchor = document.getElementById('pack-bs-bridge') || document.getElementById('pack-csv-panel');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor.nextSibling);
    else page.insertBefore(box, page.firstChild);
    document.getElementById('pack-queue-refresh').addEventListener('click', function () {
      if (typeof window.__packPullOrdersCloud === 'function') window.__packPullOrdersCloud();
      lastSig = ''; lastPendingHtml = ''; lastDoneHtml = '';
      renderAll(true);
      toast('\u0e23\u0e35\u0e40\u0e1f\u0e23\u0e0a\u0e04\u0e34\u0e27\u0e41\u0e25\u0e49\u0e27');
    });
    document.getElementById('pack-queue-search').addEventListener('input', function (e) {
      filterPending = e.target.value || '';
      lastSig = ''; lastPendingHtml = '';
      renderAll(true);
    });
    document.getElementById('pack-done-search').addEventListener('input', function (e) {
      filterDone = e.target.value || '';
      lastSig = ''; lastDoneHtml = '';
      renderAll(true);
    });
    uiBuilt = true;
    return true;
  }
  function isRecentBs(item) {
    var o = item.order || item;
    var src = String((o && o.source) || item.source || '').toLowerCase();
    var fromBs = src.indexOf('bigseller') >= 0 || src === 'bridge';
    var at = Number(item.pulledAt || (o && (o.pulledAt || o.updatedAt)) || 0) || 0;
    return fromBs || (at && Date.now() - at < 6 * 60 * 60 * 1000);
  }
  function timeAgo(ts) {
    if (!ts) return '';
    var sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60) return '\u0e40\u0e21\u0e37\u0e48\u0e2d\u0e2a\u0e31\u0e01\u0e04\u0e23\u0e39\u0e48';
    if (sec < 3600) return Math.floor(sec / 60) + ' \u0e19\u0e32\u0e17\u0e35\u0e41\u0e25\u0e49\u0e27';
    if (sec < 86400) return Math.floor(sec / 3600) + ' \u0e0a\u0e21. \u0e41\u0e25\u0e49\u0e27';
    return new Date(ts).toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  }
  function itemRow(item, kind) {
    var label = item.track || item.id || item.packageId || item.key;
    var sub = (item.platform ? item.platform + ' \u00b7 ' : '') + item.lineCount + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23 \u00b7 ' + item.qty + ' \u0e0a\u0e34\u0e49\u0e19';
    var border, bg, badge;
    if (kind === 'bs') {
      border = '2px solid #f59e0b'; bg = '#fffbeb';
      badge = '<span style="display:inline-block;margin-top:4px;padding:2px 8px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:10px;font-weight:700">\u0e14\u0e36\u0e07 BigSeller ' + timeAgo(item.pulledAt) + '</span>';
    } else {
      border = '1px solid #c7d2fe'; bg = '#eef2ff';
      badge = '<span style="display:inline-block;margin-top:4px;padding:2px 8px;border-radius:999px;background:#e0e7ff;color:#3730a3;font-size:10px;font-weight:700">\u0e23\u0e2d\u0e41\u0e1e\u0e47\u0e01</span>';
    }
    var k = String(item.key).replace(/"/g, '');
    return (
      '<div style="display:flex;gap:8px;align-items:stretch" data-qkey="' + k + '">' +
      '<button type="button" class="pack-queue-item" data-key="' + k + '" style="flex:1;text-align:left;padding:10px 12px;border-radius:12px;border:' + border + ';background:' + bg + ';cursor:pointer;font:inherit">' +
      '<div style="font-weight:700;font-size:13px;font-family:IBM Plex Mono,monospace">' + String(label).replace(/</g, '') + '</div>' +
      '<div style="font-size:11px;color:var(--ink3);margin-top:2px">' + sub + '</div>' + badge +
      '</button>' +
      '<button type="button" class="pack-queue-del" data-key="' + k + '" style="width:44px;border-radius:12px;border:1px solid #fca5a5;background:#fef2f2;color:#b91c1c;cursor:pointer;font-size:16px">\u00d7</button></div>'
    );
  }
  function bindClicks(root) {
    if (!root) return;
    root.querySelectorAll('.pack-queue-item').forEach(function (btn) {
      if (btn._pqBound) return;
      btn._pqBound = true;
      btn.addEventListener('click', function () {
        var found = uniquePending().filter(function (x) { return x.key === btn.getAttribute('data-key'); })[0];
        if (found) activate(found.order);
      });
    });
    root.querySelectorAll('.pack-queue-del').forEach(function (btn) {
      if (btn._pqBound) return;
      btn._pqBound = true;
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var found = uniquePending().filter(function (x) { return x.key === btn.getAttribute('data-key'); })[0];
        if (!found) return;
        if (!confirm('\u0e25\u0e1a\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c ' + (found.track || found.id) + ' ?')) return;
        removeOrder(found);
      });
    });
  }
  function renderPending() {
    var secBs = document.getElementById('pack-sec-bs');
    var secPend = document.getElementById('pack-sec-pending');
    if (!secPend) return;
    var list = uniquePending().filter(function (item) {
      return matchFilter([item.track, item.id, item.packageId, item.platform].join(' '), filterPending);
    });
    var bs = list.filter(isRecentBs);
    var wait = list.filter(function (x) { return !isRecentBs(x); });
    var bsHtml = '';
    if (bs.length) {
      bsHtml =
        '<div style="font-size:12px;font-weight:800;color:#92400e;margin-bottom:6px;padding:6px 10px;border-radius:10px;background:#fef3c7;border:1px solid #fcd34d">' +
        '\u0e14\u0e36\u0e07\u0e08\u0e32\u0e01 BigSeller \u00b7 ' + bs.length + ' \u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c</div>' +
        '<div style="display:flex;flex-direction:column;gap:6px;max-height:180px;overflow:auto">' +
        bs.map(function (item) { return itemRow(item, 'bs'); }).join('') + '</div>';
    }
    var pendHtml =
      '<div style="font-size:12px;font-weight:800;color:#3730a3;margin-bottom:6px;padding:6px 10px;border-radius:10px;background:#e0e7ff;border:1px solid #c7d2fe">' +
      '\u0e23\u0e2d\u0e41\u0e1e\u0e47\u0e01 \u00b7 ' + wait.length + ' \u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c</div>' +
      (wait.length
        ? '<div style="display:flex;flex-direction:column;gap:6px;max-height:200px;overflow:auto">' + wait.map(function (item) { return itemRow(item, 'wait'); }).join('') + '</div>'
        : '<div style="font-size:12px;color:var(--ink3);padding:6px 0">\u2014</div>');
    var full = bsHtml + '||' + pendHtml;
    if (full === lastPendingHtml) return;
    lastPendingHtml = full;
    if (secBs) {
      if (bs.length) {
        secBs.style.display = 'block';
        secBs.innerHTML = bsHtml;
        bindClicks(secBs);
      } else {
        secBs.style.display = 'none';
        secBs.innerHTML = '';
      }
    }
    secPend.innerHTML = pendHtml;
    bindClicks(secPend);
    var stats = document.getElementById('pack-queue-stats');
    if (stats) {
      var doneN = uniqueDone().length;
      var sig = String(list.length) + '-' + doneN + '-' + bs.length;
      if (stats.getAttribute('data-sig') !== sig) {
        stats.setAttribute('data-sig', sig);
        stats.innerHTML =
          '<div style="flex:1;min-width:88px;padding:10px 12px;border-radius:12px;background:#eff6ff;border:1px solid #bfdbfe">' +
          '<div style="font-size:11px;color:#1e40af;font-weight:600">\u0e23\u0e2d\u0e41\u0e1e\u0e47\u0e01</div>' +
          '<div style="font-size:22px;font-weight:800;color:#1e3a8a">' + list.length + '</div></div>' +
          '<div style="flex:1;min-width:88px;padding:10px 12px;border-radius:12px;background:#ecfdf5;border:1px solid #a7f3d0">' +
          '<div style="font-size:11px;color:#047857;font-weight:600">\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e41\u0e25\u0e49\u0e27</div>' +
          '<div style="font-size:22px;font-weight:800;color:#065f46">' + doneN + '</div></div>' +
          '<div style="flex:1;min-width:88px;padding:10px 12px;border-radius:12px;background:#fef3c7;border:1px solid #fcd34d">' +
          '<div style="font-size:11px;color:#92400e;font-weight:600">\u0e14\u0e36\u0e07 BigSeller</div>' +
          '<div style="font-size:22px;font-weight:800;color:#78350f">' + bs.length + '</div></div>';
      }
    }
  }
  function renderDone() {
    var listEl = document.getElementById('pack-done-list');
    var countEl = document.getElementById('pack-done-count');
    if (!listEl) return;
    var list = uniqueDone().filter(function (item) {
      return matchFilter(item.label + ' ' + item.key, filterDone);
    });
    var html;
    if (!list.length) {
      html = '<div style="font-size:12px;color:var(--ink3);padding:6px 0">\u2014</div>';
    } else {
      html = list.slice(0, 80).map(function (item) {
        var time = item.at ? new Date(item.at).toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '';
        return (
          '<div style="padding:8px 12px;border-radius:12px;border:1px solid #d1fae5;background:#ecfdf5;display:flex;justify-content:space-between;gap:8px;align-items:center">' +
          '<div style="font-weight:600;font-size:12px;font-family:IBM Plex Mono,monospace">' + String(item.label).replace(/</g, '') + '</div>' +
          '<div style="font-size:11px;color:#047857;white-space:nowrap">' + time + '</div></div>'
        );
      }).join('');
    }
    if (html === lastDoneHtml) return;
    lastDoneHtml = html;
    listEl.innerHTML = html;
    if (countEl) {
      countEl.textContent = list.length ? ('\u0e15\u0e31\u0e14\u0e41\u0e25\u0e49\u0e27 ' + list.length + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23') : '\u2014';
    }
  }
  function renderAll(force) {
    var sig = dataSig();
    if (!force && sig === lastSig) return;
    lastSig = sig;
    renderPending();
    renderDone();
  }
  function installGuard() {
    if (window.__bsTryLoadOrder && !window.__bsTryLoadOrder._doneGuard) {
      var orig = window.__bsTryLoadOrder;
      var wrapped = function (code, silent) {
        if (isDoneCode(code)) { showDoneAlert(code); return false; }
        return orig(code, silent);
      };
      wrapped._doneGuard = true;
      window.__bsTryLoadOrder = wrapped;
    }
  }
  function wire() {
    if (!ensureUi()) return;
    installGuard();
    renderAll(false);
  }
  setInterval(function () {
    var page = document.getElementById('page-pack');
    if (!page || !page.classList.contains('active')) return;
    if (!uiBuilt) { wire(); return; }
    var sig = dataSig();
    if (sig !== lastSig) renderAll(false);
  }, 2000);
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.ni[data-page="pack"]');
    if (btn) setTimeout(function () { wire(); lastSig = ''; lastPendingHtml = ''; renderAll(true); }, 200);
  });
  function patchSave() {
    if (!window.__bsSaveOrders || window.__bsSaveOrders._pqPatched) return;
    var orig = window.__bsSaveOrders;
    var wrap = function (orders) {
      var now = Date.now();
      (orders || []).forEach(function (o) {
        if (!o) return;
        if (!o.pulledAt) o.pulledAt = now;
        if (!o.source) o.source = 'bigseller-bridge';
        o.updatedAt = now;
      });
      var n = orig(orders);
      lastSig = ''; lastPendingHtml = '';
      setTimeout(function () { renderAll(true); }, 50);
      return n;
    };
    wrap._pqPatched = true;
    window.__bsSaveOrders = wrap;
  }
  setInterval(patchSave, 2000);
  window.__packQueueRefresh = function () { lastSig = ''; lastPendingHtml = ''; lastDoneHtml = ''; renderAll(true); };
  window.__packIsOrderDone = isDoneCode;
  setTimeout(wire, 800);
  setTimeout(wire, 2000);
})();
