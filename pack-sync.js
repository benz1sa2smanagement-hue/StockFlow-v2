/**
 * Multi-device Pack session sync (PC barcode scanner + phone monitor)
 * Shared path: ws_{key}/rooms/{room}/packSessions/{sessionId}
 */
(function () {
  'use strict';
  var DB = 'https://kiyomi-b19d0-default-rtdb.asia-southeast1.firebasedatabase.app';
  var pollTimer = null;
  var sessionId = localStorage.getItem('sf_pack_session') || '';
  var lastRemote = '';
  var writing = false;

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
  function wsKey() { return sessionStorage.getItem('sf_session_ws') || ''; }
  function roomId() {
    return localStorage.getItem('sf_room_' + wsKey()) || 'WH_A';
  }
  function userName() { return sessionStorage.getItem('sf_session_user') || ''; }
  function sessPath(id) {
    return 'ws_' + wsKey() + '/rooms/' + roomId() + '/packSessions/' + id;
  }
  function api(p, opt) {
    opt = opt || {};
    return fetch(DB + '/' + p + '.json', Object.assign({ cache: 'no-store' }, opt)).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      if (r.status === 204) return null;
      return r.json();
    });
  }
  function isMobile() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
      (window.matchMedia && window.matchMedia('(max-width: 700px)').matches);
  }
  function ensureSyncUI() {
    var page = document.getElementById('page-pack');
    if (!page || document.getElementById('pack-sync-bar')) return;
    var bar = document.createElement('div');
    bar.id = 'pack-sync-bar';
    bar.style.cssText = 'background:rgba(91,108,255,0.1);border:1px solid rgba(91,108,255,0.25);border-radius:14px;padding:12px 14px;margin-bottom:12px;font-size:12px';
    bar.innerHTML =
      '<div style="font-weight:600;margin-bottom:6px">\u0e0b\u0e34\u0e07\u0e01\u0e4c\u0e04\u0e2d\u0e21 \u2194 \u0e21\u0e37\u0e2d\u0e16\u0e37\u0e2d</div>' +
      '<div style="color:var(--ink3);margin-bottom:8px" id="pack-sync-hint">' +
      (isMobile()
        ? '\u0e21\u0e37\u0e2d\u0e16\u0e37\u0e2d: \u0e43\u0e2a\u0e48\u0e23\u0e2b\u0e31\u0e2a\u0e41\u0e1e\u0e47\u0e01\u0e40\u0e14\u0e35\u0e22\u0e27\u0e01\u0e31\u0e1a\u0e04\u0e2d\u0e21 \u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e14\u0e39\u0e2a\u0e16\u0e32\u0e19\u0e30\u0e2a\u0e41\u0e01\u0e19\u0e41\u0e1a\u0e1a\u0e40\u0e23\u0e35\u0e22\u0e25\u0e44\u0e17\u0e21\u0e4c'
        : '\u0e04\u0e2d\u0e21: \u0e43\u0e0a\u0e49\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07\u0e2a\u0e41\u0e01\u0e19 USB \u00b7 \u0e2a\u0e23\u0e49\u0e32\u0e07\u0e23\u0e2b\u0e31\u0e2a\u0e41\u0e1e\u0e47\u0e01\u0e41\u0e25\u0e49\u0e27\u0e43\u0e2b\u0e49\u0e21\u0e37\u0e2d\u0e16\u0e37\u0e2d\u0e43\u0e2a\u0e48\u0e23\u0e2b\u0e31\u0e2a\u0e40\u0e14\u0e35\u0e22\u0e27\u0e01\u0e31\u0e19') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:end">' +
      '<div class="field" style="margin:0;padding:8px 12px"><label style="font-size:10px">\u0e23\u0e2b\u0e31\u0e2a\u0e41\u0e1e\u0e47\u0e01 (\u0e23\u0e48\u0e27\u0e21\u0e01\u0e31\u0e19)</label>' +
      '<input type="text" id="pack-session-id" placeholder="\u0e40\u0e0a\u0e48\u0e19 4821 \u0e2b\u0e23\u0e37\u0e2d\u0e40\u0e25\u0e02\u0e1e\u0e28\u0e38" autocomplete="off" ' +
      'style="font-size:15px;font-family:IBM Plex Mono,monospace;letter-spacing:.05em"></div>' +
      '<button type="button" class="btn" id="pack-sync-join" style="height:44px;padding:0 14px;background:var(--ink);color:#fff;border-radius:12px;font-size:13px;white-space:nowrap">\u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e21</button>' +
      '<button type="button" class="btn" id="pack-sync-stop" style="height:44px;padding:0 12px;background:var(--bg);border:1px solid var(--line2);border-radius:12px;font-size:13px">\u0e2b\u0e22\u0e38\u0e14</button>' +
      '</div>' +
      '<div id="pack-sync-status" style="margin-top:8px;font-size:11px;color:var(--ink3)">\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e21</div>';
    var first = page.querySelector('.card') || page.firstChild;
    if (first) page.insertBefore(bar, first);
    else page.appendChild(bar);

    document.getElementById('pack-sync-join').addEventListener('click', function () {
      var id = (document.getElementById('pack-session-id').value || '').trim();
      if (!id) { toast('\u0e43\u0e2a\u0e48\u0e23\u0e2b\u0e31\u0e2a\u0e41\u0e1e\u0e47\u0e01\u0e01\u0e48\u0e2d\u0e19'); return; }
      joinSession(id);
    });
    document.getElementById('pack-sync-stop').addEventListener('click', stopSync);
    if (sessionId) document.getElementById('pack-session-id').value = sessionId;
  }
  function setStatus(msg, ok) {
    var el = document.getElementById('pack-sync-status');
    if (!el) return;
    el.textContent = msg;
    el.style.color = ok === true ? 'var(--ok)' : (ok === false ? 'var(--bad)' : 'var(--ink3)');
  }
  function getLocalPackState() { return window.__packSyncState || null; }
  function applyRemoteState(data) {
    if (!data || !data.lines) return;
    var key = JSON.stringify(data.lines) + '|' + (data.orderId || '') + '|' + (data.completed ? 1 : 0);
    if (key === lastRemote) return;
    lastRemote = key;
    var orderEl = document.getElementById('pack-order');
    if (orderEl && data.orderId && orderEl.value !== data.orderId) orderEl.value = data.orderId;
    if (typeof window.__packApplyRemote === 'function') {
      window.__packApplyRemote(data);
      return;
    }
    var box = document.getElementById('pack-lines');
    if (!box) return;
    data.lines.forEach(function (l) {
      box.querySelectorAll('.row').forEach(function (row) {
        var m = row.querySelector('.row-m');
        var q = row.querySelector('.row-q');
        if (m && q && m.textContent === l.skuId) {
          q.textContent = (l.scanned || 0) + '/' + l.qty;
          if (l.scanned >= l.qty) q.classList.add('pos');
        }
      });
    });
    var st = document.getElementById('pack-status');
    if (st) {
      var allDone = data.lines.every(function (l) { return (l.scanned || 0) >= l.qty; });
      st.textContent = data.completed ? '\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e41\u0e25\u0e49\u0e27' : (allDone ? '\u0e04\u0e23\u0e1a\u0e41\u0e25\u0e49\u0e27' : '\u0e23\u0e2d\u0e2a\u0e41\u0e01\u0e19 \u00b7 \u0e0b\u0e34\u0e07\u0e01\u0e4c\u0e08\u0e32\u0e01\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07\u0e2d\u0e37\u0e48\u0e19');
    }
    var fb = document.getElementById('pack-fb');
    if (fb && data.lastMsg) {
      fb.textContent = data.lastMsg;
      fb.style.background = data.lastOk ? 'var(--ok-soft)' : 'var(--bg)';
      fb.style.color = data.lastOk ? 'var(--ok)' : 'var(--ink3)';
    }
  }
  function pushLocalState() {
    if (!sessionId || !wsKey() || writing) return Promise.resolve();
    var state = getLocalPackState();
    if (!state) return Promise.resolve();
    writing = true;
    var payload = {
      orderId: state.orderId || '',
      platform: state.platform || '',
      lines: state.lines || [],
      completed: !!state.completed,
      lastMsg: state.lastMsg || '',
      lastOk: !!state.lastOk,
      updatedAt: Date.now(),
      updatedBy: userName() || (isMobile() ? 'phone' : 'pc'),
      device: isMobile() ? 'phone' : 'pc'
    };
    return api(sessPath(sessionId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function () {
      writing = false;
      setStatus('\u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e21\u0e41\u0e25\u0e49\u0e27 \u00b7 ' + new Date().toLocaleTimeString('th-TH') + ' \u00b7 ' + (payload.updatedBy || ''), true);
    }).catch(function (e) {
      writing = false;
      setStatus('\u0e0b\u0e34\u0e07\u0e01\u0e4c\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08: ' + (e.message || e), false);
    });
  }
  function poll() {
    if (!sessionId || !wsKey()) return;
    api(sessPath(sessionId)).then(function (data) {
      if (!data) { setStatus('\u0e23\u0e2d\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07\u0e2d\u0e37\u0e48\u0e19\u0e2a\u0e23\u0e49\u0e32\u0e07 session\u2026', null); return; }
      setStatus('\u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e21\u0e41\u0e25\u0e49\u0e27 \u00b7 ' + (data.updatedBy || '') + ' \u00b7 ' + (data.device || ''), true);
      if (!writing) applyRemoteState(data);
    }).catch(function () {});
  }
  function joinSession(id) {
    sessionId = id.trim();
    localStorage.setItem('sf_pack_session', sessionId);
    setStatus('\u0e01\u0e33\u0e25\u0e31\u0e07\u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e21\u2026', null);
    api(sessPath(sessionId)).then(function (data) {
      if (!data) {
        return api(sessPath(sessionId), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: (document.getElementById('pack-order') || {}).value || '',
            lines: [], completed: false,
            createdAt: Date.now(), updatedAt: Date.now(),
            updatedBy: userName(), device: isMobile() ? 'phone' : 'pc'
          })
        });
      }
    }).then(function () {
      toast('\u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e21\u0e23\u0e2b\u0e31\u0e2a\u0e41\u0e1e\u0e47\u0e01 ' + sessionId);
      startPoll();
      if (!isMobile()) pushLocalState();
      if (isMobile()) {
        var camOff = document.getElementById('pack-cam-off');
        if (camOff) camOff.click();
        setStatus('\u0e21\u0e37\u0e2d\u0e16\u0e37\u0e2d\u0e42\u0e2b\u0e21\u0e14\u0e14\u0e39\u0e2a\u0e16\u0e32\u0e19\u0e30 \u00b7 \u0e2a\u0e41\u0e01\u0e19\u0e17\u0e35\u0e48\u0e04\u0e2d\u0e21\u0e14\u0e49\u0e27\u0e22\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07\u0e2a\u0e41\u0e01\u0e19', true);
      } else {
        setStatus('\u0e04\u0e2d\u0e21\u0e42\u0e2b\u0e21\u0e14\u0e2a\u0e41\u0e01\u0e19 \u00b7 USB scanner', true);
        var scan = document.getElementById('pack-scan');
        if (scan) setTimeout(function () { scan.focus(); }, 300);
      }
    }).catch(function () {
      setStatus('\u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e21\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08', false);
      toast('\u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e21\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08');
    });
  }
  function stopSync() {
    sessionId = '';
    localStorage.removeItem('sf_pack_session');
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    setStatus('\u0e2b\u0e22\u0e38\u0e14\u0e0b\u0e34\u0e07\u0e01\u0e4c\u0e41\u0e25\u0e49\u0e27', null);
    toast('\u0e2b\u0e22\u0e38\u0e14\u0e0b\u0e34\u0e07\u0e01\u0e4c');
  }
  function startPoll() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(poll, 1200);
    poll();
  }
  function installHooks() {
    window.__packSyncPublish = function (state) {
      window.__packSyncState = state;
      if (sessionId) pushLocalState();
    };
    window.__packGetSessionId = function () { return sessionId; };
    var fb = document.getElementById('pack-fb');
    var box = document.getElementById('pack-lines');
    if (box && !box._syncObs) {
      var obs = new MutationObserver(function () {
        if (isMobile() && sessionId) return;
        var lines = [];
        box.querySelectorAll('.row').forEach(function (row) {
          var n = row.querySelector('.row-n');
          var m = row.querySelector('.row-m');
          var q = row.querySelector('.row-q');
          if (!m || !q) return;
          var parts = (q.textContent || '').split('/');
          lines.push({
            skuId: m.textContent.trim(),
            name: n ? n.textContent.trim() : m.textContent.trim(),
            scanned: parseInt(parts[0], 10) || 0,
            qty: parseInt(parts[1], 10) || 0
          });
        });
        var orderEl = document.getElementById('pack-order');
        window.__packSyncState = {
          orderId: orderEl ? orderEl.value : '',
          lines: lines,
          completed: false,
          lastMsg: fb ? fb.textContent : '',
          lastOk: fb && (fb.textContent || '').indexOf('\u2713') === 0
        };
        if (sessionId && !isMobile()) pushLocalState();
      });
      obs.observe(box, { childList: true, subtree: true, characterData: true });
      box._syncObs = obs;
    }
  }
  function onPackPage() {
    ensureSyncUI();
    installHooks();
    if (sessionId) {
      var inp = document.getElementById('pack-session-id');
      if (inp) inp.value = sessionId;
      startPoll();
    }
    if (!isMobile()) {
      setTimeout(function () {
        var scan = document.getElementById('pack-scan');
        if (scan) scan.focus();
      }, 400);
    }
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.ni[data-page="pack"]');
    if (btn) setTimeout(onPackPage, 150);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    if (e.target && e.target.id === 'pack-scan' && !isMobile()) {
      setTimeout(function () {
        var scan = document.getElementById('pack-scan');
        if (scan) { scan.value = ''; scan.focus(); }
      }, 50);
    }
  });
  setTimeout(onPackPage, 2500);
})();
