/**
 * Pack queue UI enhance: stats, filters, BigSeller colored section
 */
(function () {
  'use strict';
  var KEY = 'sf_bs_orders_v1';
  var DONE_KEY = 'sf_bs_orders_done_v1';
  var statusFilter = 'pending';

  function loadStore() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; }
  }
  function loadDone() {
    try { return JSON.parse(localStorage.getItem(DONE_KEY) || '{}'); } catch (e) { return {}; }
  }
  function norm(v) {
    return String(v || '').trim().toUpperCase().replace(/\s+/g, '');
  }
  function pulledAt(o) {
    return Number((o && (o.pulledAt || o.updatedAt)) || 0) || 0;
  }
  function isRecentBs(o) {
    if (!o) return false;
    var src = String(o.source || '').toLowerCase();
    var fromBs = src.indexOf('bigseller') >= 0 || src === 'bridge';
    var at = pulledAt(o);
    return fromBs || (at && Date.now() - at < 6 * 60 * 60 * 1000);
  }
  function platformKey(p) {
    var s = String(p || '').toLowerCase();
    if (s.indexOf('shopee') >= 0) return 'Shopee';
    if (s.indexOf('lazada') >= 0) return 'Lazada';
    if (s.indexOf('tiktok') >= 0) return 'TikTok';
    if (s.indexOf('facebook') >= 0 || s.indexOf('fb') >= 0) return 'Facebook';
    return s ? 'other' : '';
  }
  function uniquePending() {
    var store = loadStore();
    var done = loadDone();
    var seen = {}, list = [];
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
        pulledAt: pulledAt(o), recentBs: isRecentBs(o), source: o.source || ''
      });
    });
    list.sort(function (a, b) {
      if (a.recentBs !== b.recentBs) return a.recentBs ? -1 : 1;
      return (b.pulledAt || 0) - (a.pulledAt || 0);
    });
    return list;
  }
  function uniqueDoneCount() {
    return Object.keys(loadDone()).length;
  }
  function timeAgo(ts) {
    if (!ts) return '';
    var sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60) return '\u0e40\u0e21\u0e37\u0e48\u0e2d\u0e2a\u0e31\u0e01\u0e04\u0e23\u0e39\u0e48';
    if (sec < 3600) return Math.floor(sec / 60) + ' \u0e19\u0e32\u0e17\u0e35\u0e41\u0e25\u0e49\u0e27';
    if (sec < 86400) return Math.floor(sec / 3600) + ' \u0e0a\u0e21. \u0e41\u0e25\u0e49\u0e27';
    return new Date(ts).toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  }

  function ensureExtras() {
    var panel = document.getElementById('pack-queue-panel');
    if (!panel) return false;
    if (!document.getElementById('pack-queue-stats')) {
      var stats = document.createElement('div');
      stats.id = 'pack-queue-stats';
      stats.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin:8px 0';
      var filters = document.createElement('div');
      filters.id = 'pack-queue-filters';
      filters.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px';
      var recent = document.createElement('div');
      recent.id = 'pack-queue-recent-bs';
      recent.style.cssText = 'display:none;margin-bottom:10px';
      var search = document.getElementById('pack-queue-search');
      if (search && search.parentNode) {
        search.parentNode.insertBefore(stats, search);
        search.parentNode.insertBefore(filters, search);
        var list = document.getElementById('pack-queue-list');
        if (list) list.parentNode.insertBefore(recent, list);
      }
    }
    return true;
  }

  function chip(active, color) {
    var b = 'padding:7px 12px;border-radius:999px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid ';
    if (!active) return b + '#e5e7eb;background:#fff;color:#374151';
    if (color === 'blue') return b + '#93c5fd;background:#dbeafe;color:#1e40af';
    if (color === 'green') return b + '#86efac;background:#dcfce7;color:#166534';
    if (color === 'amber') return b + '#fcd34d;background:#fef3c7;color:#92400e';
    return b + '#0C0E12;background:#0C0E12;color:#fff';
  }

  function renderStats() {
    var statsEl = document.getElementById('pack-queue-stats');
    var filtersEl = document.getElementById('pack-queue-filters');
    if (!statsEl || !filtersEl) return;
    var pending = uniquePending();
    var doneN = uniqueDoneCount();
    var recent = pending.filter(function (x) { return x.recentBs; });
    var plats = {};
    pending.forEach(function (x) {
      var p = platformKey(x.platform) || '\u0e2d\u0e37\u0e48\u0e19\u0e46';
      plats[p] = (plats[p] || 0) + 1;
    });

    statsEl.innerHTML =
      '<div style="flex:1;min-width:88px;padding:10px 12px;border-radius:12px;background:#eff6ff;border:1px solid #bfdbfe">' +
      '<div style="font-size:11px;color:#1e40af;font-weight:600">\u0e23\u0e2d\u0e41\u0e1e\u0e47\u0e01</div>' +
      '<div style="font-size:22px;font-weight:800;color:#1e3a8a">' + pending.length + '</div></div>' +
      '<div style="flex:1;min-width:88px;padding:10px 12px;border-radius:12px;background:#ecfdf5;border:1px solid #a7f3d0">' +
      '<div style="font-size:11px;color:#047857;font-weight:600">\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e41\u0e25\u0e49\u0e27</div>' +
      '<div style="font-size:22px;font-weight:800;color:#065f46">' + doneN + '</div></div>' +
      '<div style="flex:1;min-width:88px;padding:10px 12px;border-radius:12px;background:#fef3c7;border:1px solid #fcd34d">' +
      '<div style="font-size:11px;color:#92400e;font-weight:600">\u0e14\u0e36\u0e07 BigSeller</div>' +
      '<div style="font-size:22px;font-weight:800;color:#78350f">' + recent.length + '</div></div>';

    var chips = [
      { id: 'pending', label: '\u0e23\u0e2d\u0e41\u0e1e\u0e47\u0e01', color: 'ink' },
      { id: 'recent_bs', label: 'BigSeller \u0e25\u0e48\u0e32\u0e2a\u0e38\u0e14', color: 'amber' },
      { id: 'all', label: '\u0e17\u0e38\u0e01', color: 'ink' }
    ];
    Object.keys(plats).forEach(function (p) {
      chips.push({ id: 'platform:' + p, label: p + ' (' + plats[p] + ')', color: 'blue' });
    });
    filtersEl.innerHTML = chips.map(function (c) {
      return '<button type="button" class="pack-qf-chip" data-f="' + c.id + '" style="' + chip(statusFilter === c.id, c.color) + '">' + c.label + '</button>';
    }).join('');
    filtersEl.querySelectorAll('.pack-qf-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        statusFilter = btn.getAttribute('data-f') || 'pending';
        enhanceList();
        renderStats();
      });
    });
  }

  function enhanceList() {
    var listEl = document.getElementById('pack-queue-list');
    var recentEl = document.getElementById('pack-queue-recent-bs');
    if (!listEl) return;
    var pending = uniquePending();
    var recent = pending.filter(function (x) { return x.recentBs; });

    if (recentEl) {
      if (recent.length && (statusFilter === 'pending' || statusFilter === 'all' || statusFilter === 'recent_bs')) {
        recentEl.style.display = 'block';
        recentEl.innerHTML =
          '<div style="font-size:12px;font-weight:800;color:#92400e;margin-bottom:6px">\u0e14\u0e36\u0e07\u0e08\u0e32\u0e01 BigSeller \u0e40\u0e21\u0e37\u0e48\u0e2d\u0e2a\u0e31\u0e01\u0e04\u0e23\u0e39\u0e48 \u00b7 ' + recent.length + ' \u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c</div>';
      } else {
        recentEl.style.display = 'none';
        recentEl.innerHTML = '';
      }
    }

    listEl.querySelectorAll('.pack-queue-item').forEach(function (btn) {
      var key = btn.getAttribute('data-key');
      var item = pending.filter(function (x) { return x.key === key; })[0];
      if (!item) return;
      var show = true;
      if (statusFilter === 'recent_bs') show = item.recentBs;
      else if (statusFilter.indexOf('platform:') === 0) {
        var want = statusFilter.slice(9);
        show = (platformKey(item.platform) || '\u0e2d\u0e37\u0e48\u0e19\u0e46') === want;
      }
      var row = btn.parentNode;
      if (row) row.style.display = show ? 'flex' : 'none';

      if (item.recentBs) {
        btn.style.border = '2px solid #f59e0b';
        btn.style.background = '#fffbeb';
        if (!btn.querySelector('.bs-badge')) {
          var b = document.createElement('div');
          b.className = 'bs-badge';
          b.style.cssText = 'margin-top:4px;display:inline-block;padding:2px 8px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:10px;font-weight:700';
          b.textContent = '\u0e14\u0e36\u0e07 BigSeller ' + timeAgo(item.pulledAt);
          btn.appendChild(b);
        }
      } else if (!btn.querySelector('.bs-badge')) {
        var b2 = document.createElement('div');
        b2.className = 'bs-badge';
        b2.style.cssText = 'margin-top:4px;display:inline-block;padding:2px 8px;border-radius:999px;background:#e0e7ff;color:#3730a3;font-size:10px;font-weight:700';
        b2.textContent = '\u0e23\u0e2d\u0e41\u0e1e\u0e47\u0e01';
        btn.appendChild(b2);
      }
    });
  }

  function tick() {
    if (!document.getElementById('pack-queue-panel')) return;
    ensureExtras();
    renderStats();
    enhanceList();
  }

  function patchSave() {
    if (!window.__bsSaveOrders || window.__bsSaveOrders._uiPatched) return;
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
      setTimeout(tick, 80);
      return n;
    };
    wrap._uiPatched = true;
    window.__bsSaveOrders = wrap;
  }

  setInterval(function () {
    var page = document.getElementById('page-pack');
    if (!page || !page.classList.contains('active')) return;
    patchSave();
    tick();
  }, 1500);

  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('.ni[data-page="pack"]')) {
      setTimeout(tick, 400);
    }
  });
  setTimeout(tick, 1200);
  setTimeout(tick, 3000);
})();
