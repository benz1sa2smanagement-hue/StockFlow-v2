/**
 * BigSeller bridge UI + platform / print filters
 */
(function () {
  'use strict';
  var DB = 'https://kiyomi-b19d0-default-rtdb.asia-southeast1.firebasedatabase.app';
  var SCRIPT_URL = 'https://raw.githubusercontent.com/benz1sa2smanagement-hue/StockFlow-v2/main/bigseller-bridge.user.js';

  function toast(msg) {
    var w = document.getElementById('toast-wrap');
    if (!w) return;
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    w.innerHTML = '';
    w.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  }
  function wsKey() { return sessionStorage.getItem('sf_session_ws') || ''; }
  function roomId() { return localStorage.getItem('sf_room_' + wsKey()) || 'WH_A'; }
  function bridgePath() {
    var ws = wsKey();
    if (!ws) return '';
    return 'ws_' + ws + '/rooms/' + roomId() + '/bsBridge';
  }
  function api(path, opt) {
    return fetch(DB + '/' + path + '.json', Object.assign({ cache: 'no-store' }, opt || {}))
      .then(function (r) { return r.json(); });
  }

  function ensureFilters() {
    if (document.getElementById('pack-bs-filters')) return;
    var st = document.getElementById('pack-bs-status');
    if (!st || !st.parentNode) return;
    var wrap = document.createElement('div');
    wrap.id = 'pack-bs-filters';
    wrap.style.cssText = 'margin-bottom:10px;padding:10px;border-radius:12px;background:#fff;border:1px solid var(--line,#e5e7eb)';
    wrap.innerHTML =
      '<div style="font-size:12px;font-weight:700;margin-bottom:8px">\u0e15\u0e31\u0e27\u0e01\u0e23\u0e2d\u0e07\u0e14\u0e36\u0e07\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c</div>' +
      '<div style="font-size:11px;color:var(--ink3);margin-bottom:6px">\u0e41\u0e1e\u0e25\u0e15\u0e1f\u0e2d\u0e23\u0e4c\u0e21</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px 12px;margin-bottom:10px;font-size:12px">' +
      '<label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" class="pack-bs-plat" value="Shopee" checked> Shopee</label>' +
      '<label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" class="pack-bs-plat" value="Lazada" checked> Lazada</label>' +
      '<label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" class="pack-bs-plat" value="TikTok" checked> TikTok</label>' +
      '<label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" class="pack-bs-plat" value="Facebook" checked> Facebook</label>' +
      '<label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" class="pack-bs-plat" value="other" checked> \u0e2d\u0e37\u0e48\u0e19\u0e46</label></div>' +
      '<div style="font-size:11px;color:var(--ink3);margin-bottom:6px">\u0e2a\u0e16\u0e32\u0e19\u0e30\u0e43\u0e1a\u0e1b\u0e30\u0e2b\u0e19\u0e49\u0e32 / \u0e08\u0e31\u0e14\u0e2a\u0e48\u0e07</div>' +
      '<select id="pack-bs-print-filter" style="width:100%;padding:8px 10px;border-radius:10px;border:1px solid var(--line2);font-size:12px;background:#fff">' +
      '<option value="printed_not_shipped" selected>\u0e1e\u0e34\u0e21\u0e1e\u0e4c\u0e43\u0e1a\u0e1b\u0e30\u0e2b\u0e19\u0e49\u0e32\u0e41\u0e25\u0e49\u0e27 \u00b7 \u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e2a\u0e48\u0e07\u0e2d\u0e2d\u0e01\u0e02\u0e19\u0e2a\u0e48\u0e07 (\u0e41\u0e19\u0e30\u0e19\u0e33)</option>' +
      '<option value="printed">\u0e1e\u0e34\u0e21\u0e1e\u0e4c\u0e43\u0e1a\u0e1b\u0e30\u0e2b\u0e19\u0e49\u0e32\u0e41\u0e25\u0e49\u0e27\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14</option>' +
      '<option value="not_printed">\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e1e\u0e34\u0e21\u0e1e\u0e4c\u0e43\u0e1a\u0e1b\u0e30\u0e2b\u0e19\u0e49\u0e32</option>' +
      '<option value="all">\u0e17\u0e38\u0e01\u0e2a\u0e16\u0e32\u0e19\u0e30\u0e17\u0e35\u0e48\u0e14\u0e36\u0e07\u0e44\u0e14\u0e49</option></select>' +
      '<div style="font-size:11px;color:var(--ink3);margin-top:6px;line-height:1.35">\u0e40\u0e1b\u0e49\u0e32\u0e2b\u0e21\u0e32\u0e22: \u0e1e\u0e34\u0e21\u0e1e\u0e4c\u0e43\u0e1a\u0e1b\u0e30\u0e2b\u0e19\u0e49\u0e32\u0e41\u0e25\u0e49\u0e27\u0e41\u0e15\u0e48\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e22\u0e34\u0e07\u0e2d\u0e2d\u0e01\u0e02\u0e19\u0e2a\u0e48\u0e07 = \u0e04\u0e34\u0e27\u0e41\u0e1e\u0e47\u0e01\u0e08\u0e23\u0e34\u0e07</div>';
    st.parentNode.insertBefore(wrap, st.nextSibling);
  }

  function ensureUi() {
    var page = document.getElementById('page-pack');
    if (!page) return false;
    if (document.getElementById('pack-bs-bridge')) { ensureFilters(); return true; }

    var box = document.createElement('div');
    box.id = 'pack-bs-bridge';
    box.className = 'card';
    box.style.cssText = 'padding:14px 16px;margin-bottom:12px;border:1px solid rgba(37,99,235,.25);background:rgba(239,246,255,.95)';
    box.innerHTML =
      '<div style="font-size:14px;font-weight:800;margin-bottom:4px">\u0e14\u0e36\u0e07\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e08\u0e32\u0e01 BigSeller</div>' +
      '<div style="font-size:12px;color:var(--ink3);line-height:1.45;margin-bottom:10px">\u0e25\u0e47\u0e2d\u0e01\u0e2d\u0e34\u0e19 BigSeller \u0e04\u0e49\u0e32\u0e07\u0e44\u0e27\u0e49 \u00b7 \u0e15\u0e34\u0e14\u0e15\u0e31\u0e49\u0e07\u0e2a\u0e04\u0e23\u0e34\u0e1b\u0e15\u0e4c \u00b7 \u0e40\u0e25\u0e37\u0e2d\u0e01\u0e15\u0e31\u0e27\u0e01\u0e23\u0e2d\u0e07 \u00b7 \u0e01\u0e14\u0e14\u0e36\u0e07</div>' +
      '<div id="pack-bs-status" style="font-size:12px;margin-bottom:10px;padding:8px 10px;border-radius:10px;background:#fff;border:1px solid var(--line)">\u0e01\u0e33\u0e25\u0e31\u0e07\u0e15\u0e23\u0e27\u0e08\u0e2a\u0e2d\u0e1a\u0e2a\u0e32\u0e19\u2026</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
      '<button type="button" id="pack-bs-pull" class="btn" style="flex:1;min-width:140px;height:44px;background:#2563eb;color:#fff;border:none;border-radius:12px;font-weight:700;cursor:pointer">\u0e14\u0e36\u0e07\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e15\u0e2d\u0e19\u0e19\u0e35\u0e49</button>' +
      '<button type="button" id="pack-bs-install" class="btn" style="height:44px;padding:0 14px;background:#fff;border:1px solid var(--line2);border-radius:12px;cursor:pointer">\u0e15\u0e34\u0e14\u0e15\u0e31\u0e49\u0e07\u0e2a\u0e04\u0e23\u0e34\u0e1b\u0e15\u0e4c</button>' +
      '<button type="button" id="pack-bs-open" class="btn" style="height:44px;padding:0 14px;background:#fff;border:1px solid var(--line2);border-radius:12px;cursor:pointer">\u0e40\u0e1b\u0e34\u0e14 BigSeller</button></div>';

    var csv = document.getElementById('pack-csv-panel');
    if (csv && csv.parentNode) csv.parentNode.insertBefore(box, csv.nextSibling);
    else page.insertBefore(box, page.firstChild);

    document.getElementById('pack-bs-pull').addEventListener('click', requestPull);
    document.getElementById('pack-bs-install').addEventListener('click', function () {
      try { navigator.clipboard.writeText(SCRIPT_URL); } catch (e) {}
      window.open(SCRIPT_URL, '_blank');
      toast('\u0e40\u0e1b\u0e34\u0e14\u0e25\u0e34\u0e07\u0e01\u0e4c\u0e2a\u0e04\u0e23\u0e34\u0e1b\u0e15\u0e4c \u2014 \u0e01\u0e14 Install \u0e41\u0e25\u0e49\u0e27');
    });
    document.getElementById('pack-bs-open').addEventListener('click', function () {
      window.open('https://www.bigseller.com/', '_blank');
    });
    ensureFilters();
    return true;
  }

  function requestPull() {
    if (!wsKey()) { toast('\u0e25\u0e47\u0e2d\u0e01\u0e2d\u0e34\u0e19 StockFlow \u0e01\u0e48\u0e2d\u0e19'); return; }
    var p = bridgePath();
    if (!p) return;
    var st = document.getElementById('pack-bs-status');
    if (st) {
      st.style.borderColor = '#fbbf24';
      st.textContent = '\u0e2a\u0e48\u0e07\u0e04\u0e33\u0e02\u0e2d\u0e14\u0e36\u0e07\u2026 \u0e40\u0e1b\u0e34\u0e14 BigSeller \u0e04\u0e49\u0e32\u0e07\u0e44\u0e27\u0e49 + \u0e2b\u0e19\u0e49\u0e32\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23';
    }
    var plats = [];
    document.querySelectorAll('.pack-bs-plat:checked').forEach(function (c) { plats.push(c.value); });
    var printFilter = (document.getElementById('pack-bs-print-filter') || {}).value || 'printed_not_shipped';
    var payload = {
      at: Date.now(),
      by: sessionStorage.getItem('sf_session_user') || 'pc',
      status: 'pending',
      platforms: plats,
      printFilter: printFilter
    };
    api(p + '/pullRequest', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function () {
      toast('\u0e2a\u0e48\u0e07\u0e04\u0e33\u0e02\u0e2d\u0e14\u0e36\u0e07\u0e41\u0e25\u0e49\u0e27');
      pollResult(payload.at);
    }).catch(function (e) {
      toast('\u0e2a\u0e48\u0e07\u0e04\u0e33\u0e02\u0e2d\u0e25\u0e49\u0e21: ' + (e.message || e));
    });
  }

  function pollResult(since) {
    var p = bridgePath();
    if (!p) return;
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      Promise.all([api(p + '/status'), api(p + '/lastPull'), api(p.replace(/\/bsBridge$/, '') + '/bsOrders')])
        .then(function (res) {
          var status = res[0] || {};
          var last = res[1] || {};
          var orders = res[2];
          var st = document.getElementById('pack-bs-status');
          var online = status.onlineAt && (Date.now() - status.onlineAt < 90000);
          if (last.at && last.at >= since) {
            clearInterval(iv);
            if (st) {
              st.style.borderColor = last.ok ? '#86efac' : '#fca5a5';
              st.textContent = last.ok
                ? ('\u2713 \u0e14\u0e36\u0e07\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 ' + (last.count || 0) + ' \u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c')
                : ('\u0e14\u0e36\u0e07\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08: ' + (last.error || ''));
            }
            if (last.ok) {
              toast('\u0e14\u0e36\u0e07 ' + (last.count || 0) + ' \u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c');
              if (typeof window.__packPullOrdersCloud === 'function') window.__packPullOrdersCloud();
              if (orders && typeof window.__bsSaveOrders === 'function') {
                var list = [];
                Object.keys(orders).forEach(function (k) {
                  if (orders[k] && orders[k].lines) list.push(orders[k]);
                });
                if (list.length) window.__bsSaveOrders(list);
              }
              if (typeof window.__packQueueRefresh === 'function') window.__packQueueRefresh();
            }
            return;
          }
          if (st) st.textContent = (online ? '\u0e2a\u0e04\u0e23\u0e34\u0e1b\u0e15\u0e4c\u0e2d\u0e2d\u0e19\u0e44\u0e25\u0e19\u0e4c' : '\u0e23\u0e2d\u0e2a\u0e04\u0e23\u0e34\u0e1b\u0e15\u0e4c') + ' \u00b7 \u0e23\u0e2d\u0e1c\u0e25\u2026 (' + tries + ')';
          if (tries > 40) {
            clearInterval(iv);
            if (st) {
              st.style.borderColor = '#fca5a5';
              st.textContent = '\u0e2b\u0e21\u0e14\u0e40\u0e27\u0e25\u0e32 \u2014 \u0e15\u0e23\u0e27\u0e08\u0e41\u0e17\u0e47\u0e1a BigSeller + userscript v1.2';
            }
          }
        }).catch(function () {});
    }, 1500);
  }

  function refreshStatus() {
    var p = bridgePath();
    if (!p) return;
    api(p + '/status').then(function (status) {
      status = status || {};
      var st = document.getElementById('pack-bs-status');
      if (!st) return;
      var online = status.onlineAt && (Date.now() - status.onlineAt < 90000);
      if (online) {
        st.style.borderColor = '#86efac';
        st.textContent = '\u2713 \u0e2a\u0e30\u0e1e\u0e32\u0e19\u0e1e\u0e23\u0e49\u0e2d\u0e21 \u00b7 ' + (status.message || 'BigSeller');
      } else {
        st.style.borderColor = '#e5e7eb';
        st.textContent = '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e21 \u2014 \u0e15\u0e34\u0e14\u0e15\u0e31\u0e49\u0e07\u0e2a\u0e04\u0e23\u0e34\u0e1b\u0e15\u0e4c + \u0e40\u0e1b\u0e34\u0e14 BigSeller';
      }
    }).catch(function () {});
  }

  function wire() {
    if (!ensureUi()) return;
    ensureFilters();
    refreshStatus();
  }

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.ni[data-page="pack"]');
    if (btn) { setTimeout(wire, 100); setTimeout(wire, 500); }
  }, true);
  setInterval(function () {
    var page = document.getElementById('page-pack');
    if (page && (page.classList.contains('active') || page.offsetParent !== null)) wire();
  }, 2000);
  [600, 1500, 3000].forEach(function (ms) { setTimeout(wire, ms); });
})();
