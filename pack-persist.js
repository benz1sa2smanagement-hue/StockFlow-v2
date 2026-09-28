/**
 * 1) Stop forced reload after stock cut (no re-login)
 * 2) Persist BigSeller orders to Firebase + localStorage
 *    until new upload OR every order is packed/completed
 */
(function () {
  'use strict';
  var DB = 'https://kiyomi-b19d0-default-rtdb.asia-southeast1.firebasedatabase.app';
  var LOCAL_KEY = 'sf_bs_orders_v1';
  var DONE_KEY = 'sf_bs_orders_done_v1';

  function wsKey() { return sessionStorage.getItem('sf_session_ws') || ''; }
  function roomId() {
    var k = wsKey();
    return localStorage.getItem('sf_room_' + k) || 'WH_A';
  }
  function cloudPath() {
    var ws = wsKey();
    if (!ws) return '';
    return 'ws_' + ws + '/rooms/' + roomId() + '/bsOrders';
  }

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

  function loadLocal() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveLocal(store) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(store)); } catch (e) {}
  }
  function loadDone() {
    try { return JSON.parse(localStorage.getItem(DONE_KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveDone(d) {
    try { localStorage.setItem(DONE_KEY, JSON.stringify(d)); } catch (e) {}
  }

  function norm(v) {
    return String(v || '').trim().toUpperCase().replace(/\s+/g, '');
  }

  function orderKeys(order) {
    var keys = [];
    [order.id, order.track, order.packageId].forEach(function (k) {
      k = norm(k);
      if (k && keys.indexOf(k) < 0) keys.push(k);
      var k2 = k.replace(/[^A-Z0-9]/g, '');
      if (k2 && keys.indexOf(k2) < 0) keys.push(k2);
    });
    return keys;
  }

  function pushCloud(store) {
    var p = cloudPath();
    if (!p) return Promise.resolve();
    var payload = {};
    var seen = {};
    Object.keys(store || {}).forEach(function (k) {
      var o = store[k];
      if (!o || !o.lines) return;
      var id = norm(o.id || o.track || o.packageId || k);
      if (!id || seen[id]) return;
      seen[id] = 1;
      payload[id] = {
        id: o.id || '',
        track: o.track || '',
        packageId: o.packageId || '',
        platform: o.platform || '',
        lines: o.lines,
        updatedAt: Date.now()
      };
    });
    return fetch(DB + '/' + p + '.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(function () {});
  }

  function pullCloud() {
    var p = cloudPath();
    if (!p) return Promise.resolve(null);
    return fetch(DB + '/' + p + '.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || typeof data !== 'object') return null;
        return data;
      })
      .catch(function () { return null; });
  }

  function mergeCloudIntoLocal(cloud) {
    if (!cloud) return 0;
    var store = loadLocal();
    var done = loadDone();
    var n = 0;
    Object.keys(cloud).forEach(function (id) {
      var o = cloud[id];
      if (!o || !o.lines || !o.lines.length) return;
      var keys = orderKeys(o);
      if (keys.some(function (k) { return done[k]; })) return;
      keys.forEach(function (k) { store[k] = o; });
      n++;
    });
    saveLocal(store);
    return n;
  }

  function markOrderDone(orderIdRaw) {
    var store = loadLocal();
    var done = loadDone();
    var v = norm(orderIdRaw);
    if (!v) return;

    var ord = store[v] || store[v.replace(/[^A-Z0-9]/g, '')] || null;
    if (!ord) {
      Object.keys(store).forEach(function (k) {
        if (ord) return;
        var o = store[k];
        if (!o) return;
        var keys = orderKeys(o);
        if (keys.indexOf(v) >= 0 || keys.some(function (x) { return v.indexOf(x) >= 0 || x.indexOf(v) >= 0; })) {
          ord = o;
        }
      });
    }

    var keys = ord ? orderKeys(ord) : [v, v.replace(/[^A-Z0-9]/g, '')];
    keys.forEach(function (k) {
      if (k) {
        done[k] = Date.now();
        delete store[k];
      }
    });
    saveDone(done);
    saveLocal(store);

    var p = cloudPath();
    if (p && ord) {
      var cid = norm(ord.id || ord.track || ord.packageId || v);
      if (cid) {
        fetch(DB + '/' + p + '/' + encodeURIComponent(cid) + '.json', { method: 'DELETE' }).catch(function () {});
      }
    }
  }

  function patchSave() {
    if (typeof window.__bsSaveOrders !== 'function') return false;
    if (window.__bsSaveOrders._persist) return true;
    var orig = window.__bsSaveOrders;
    window.__bsSaveOrders = function (orders) {
      var n = orig(orders);
      setTimeout(function () {
        var store = loadLocal();
        pushCloud(store).then(function () {
          var statusEl = document.getElementById('pack-csv-status');
          if (statusEl && statusEl.textContent.indexOf('\u0e1e\u0e23\u0e49\u0e2d\u0e21') >= 0) {
            statusEl.textContent = statusEl.textContent + ' \u00b7 \u0e0b\u0e34\u0e07\u0e01\u0e4c\u0e04\u0e25\u0e32\u0e27\u0e14\u0e4c\u0e41\u0e25\u0e49\u0e27';
          }
        });
      }, 200);
      return n;
    };
    window.__bsSaveOrders._persist = true;
    return true;
  }

  function softResetAfterComplete() {
    var resetBtn = document.getElementById('pack-reset');
    if (resetBtn) {
      try { resetBtn.click(); } catch (e) {}
    }
    var orderEl = document.getElementById('pack-order');
    var oid = orderEl ? orderEl.value : '';
    if (oid) markOrderDone(oid);

    var fb = document.getElementById('pack-fb');
    if (fb) {
      fb.style.background = 'var(--ok-soft, #dcfce7)';
      fb.style.color = 'var(--ok, #15803d)';
      fb.textContent = '\u2713 \u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e41\u0e25\u0e49\u0e27 \u2014 \u0e2a\u0e41\u0e01\u0e19\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e16\u0e31\u0e14\u0e44\u0e1b\u0e44\u0e14\u0e49\u0e40\u0e25\u0e22 (\u0e44\u0e21\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e25\u0e47\u0e2d\u0e01\u0e2d\u0e34\u0e19\u0e43\u0e2b\u0e21\u0e48)';
    }
    var statusEl = document.getElementById('pack-csv-status');
    if (statusEl) {
      var left = 0;
      try {
        var store = loadLocal();
        var seen = {};
        Object.keys(store).forEach(function (k) {
          var o = store[k];
          if (o && (o.id || o.track)) seen[norm(o.id || o.track)] = 1;
        });
        left = Object.keys(seen).length;
      } catch (e) {}
      statusEl.style.color = 'var(--ok, #15803d)';
      statusEl.textContent = left
        ? ('\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e41\u0e25\u0e49\u0e27 \u00b7 \u0e40\u0e2b\u0e25\u0e37\u0e2d ' + left + ' \u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e43\u0e19\u0e44\u0e1f\u0e25\u0e4c (\u0e44\u0e21\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e2d\u0e31\u0e1b\u0e42\u0e2b\u0e25\u0e14\u0e43\u0e2b\u0e21\u0e48)')
        : '\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e04\u0e23\u0e1a\u0e17\u0e38\u0e01\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e43\u0e19\u0e44\u0e1f\u0e25\u0e4c\u0e41\u0e25\u0e49\u0e27';
    }

    setTimeout(function () {
      if (typeof window.__bsFocusOrder === 'function') window.__bsFocusOrder();
      else {
        var o = document.getElementById('pack-order');
        if (o) try { o.focus(); } catch (e) {}
      }
    }, 200);
  }

  var nativeReload = location.reload.bind(location);
  var blockReloadUntil = 0;
  location.reload = function () {
    if (Date.now() < blockReloadUntil) {
      softResetAfterComplete();
      return;
    }
    return nativeReload();
  };

  function bindCompleteBtn() {
    var btn = document.getElementById('pack-complete');
    if (!btn || btn.getAttribute('data-persist-bound')) return;
    btn.setAttribute('data-persist-bound', '1');
    btn.addEventListener('click', function () {
      blockReloadUntil = Date.now() + 5000;
    }, true);
  }

  function watchComplete() {
    var btn = document.getElementById('pack-complete');
    if (!btn || btn._persistObs) return;
    var obs = new MutationObserver(function () {
      var t = btn.textContent || '';
      if (t.indexOf('\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e41\u0e25\u0e49\u0e27') >= 0 || t.indexOf('done') >= 0) {
        blockReloadUntil = Date.now() + 3000;
        setTimeout(softResetAfterComplete, 400);
      }
    });
    obs.observe(btn, { childList: true, characterData: true, subtree: true });
    btn._persistObs = obs;
  }

  function bootPull() {
    if (!wsKey()) return;
    pullCloud().then(function (cloud) {
      var n = mergeCloudIntoLocal(cloud);
      if (n > 0) {
        toast('\u0e42\u0e2b\u0e25\u0e14\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e08\u0e32\u0e01\u0e04\u0e25\u0e32\u0e27\u0e14\u0e4c ' + n + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23');
        var statusEl = document.getElementById('pack-csv-status');
        if (statusEl) {
          statusEl.style.color = 'var(--ok, #15803d)';
          statusEl.textContent = '\u0e21\u0e35\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e04\u0e49\u0e32\u0e07\u0e08\u0e32\u0e01\u0e04\u0e25\u0e32\u0e27\u0e14\u0e4c ' + n + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23 \u2014 \u0e2a\u0e41\u0e01\u0e19\u0e43\u0e1a\u0e1b\u0e30\u0e2b\u0e19\u0e49\u0e32\u0e44\u0e14\u0e49\u0e40\u0e25\u0e22';
        }
      }
    });
  }

  function wire() {
    patchSave();
    bindCompleteBtn();
    watchComplete();
  }

  var n = 0;
  var iv = setInterval(function () {
    wire();
    if (++n > 40) clearInterval(iv);
  }, 400);

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.ni[data-page="pack"]');
    if (btn) {
      setTimeout(wire, 200);
      setTimeout(bootPull, 500);
    }
  });

  setTimeout(bootPull, 2000);
  setTimeout(bootPull, 5000);
  setTimeout(wire, 1000);

  window.__packMarkOrderDone = markOrderDone;
  window.__packPushOrdersCloud = function () { return pushCloud(loadLocal()); };
  window.__packPullOrdersCloud = bootPull;
})();
