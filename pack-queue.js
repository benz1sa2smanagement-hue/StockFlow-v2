/**
 * Pack order queue: pending + done lists, search, delete, warn if already cut
 */
(function () {
  'use strict';
  var KEY = 'sf_bs_orders_v1';
  var DONE_KEY = 'sf_bs_orders_done_v1';
  var filterPending = '';
  var filterDone = '';

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
        platform: o.platform || '', lineCount: o.lines.length, qty: qty, order: o
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
    renderAll();
    var oe = document.getElementById('pack-order');
    if (oe && targets.indexOf(norm(oe.value)) >= 0) {
      var reset = document.getElementById('pack-reset');
      if (reset) reset.click();
    }
  }

  function showDoneAlert(code) {
    toast('\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e19\u0e35\u0e49\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e44\u0e1b\u0e41\u0e25\u0e49\u0e27: ' + code);
    var fb = document.getElementById('pack-fb');
    if (fb) {
      fb.style.background = 'var(--warn-soft,#fef3c7)';
      fb.style.color = '#92400e';
      fb.textContent = '\u26a0 \u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e19\u0e35\u0e49\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e44\u0e1b\u0e41\u0e25\u0e49\u0e27 \u2014 ' + code;
    }
    var old = document.getElementById('pack-done-alert');
    if (old) old.remove();
    var div = document.createElement('div');
    div.id = 'pack-done-alert';
    div.style.cssText = 'position:fixed;left:50%;top:20%;transform:translateX(-50%);z-index:99999;max-width:92vw;width:360px;background:#fff;border:2px solid #f59e0b;border-radius:16px;padding:16px;box-shadow:0 12px 40px rgba(0,0,0,.18)';
    div.innerHTML =
      '<div style="font-size:16px;font-weight:800;color:#92400e;margin-bottom:8px">\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e41\u0e25\u0e49\u0e27</div>' +
      '<div style="font-size:13px;color:#374151;margin-bottom:12px;line-height:1.45">\u0e40\u0e25\u0e02 <b style="font-family:IBM Plex Mono,monospace">' +
      String(code).replace(/</g, '') +
      '</b> \u0e16\u0e39\u0e01\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e44\u0e1b\u0e41\u0e25\u0e49\u0e27 \u0e44\u0e21\u0e48\u0e04\u0e27\u0e23\u0e41\u0e1e\u0e47\u0e01\u0e0b\u0e49\u0e33</div>' +
      '<button type="button" id="pack-done-alert-ok" style="width:100%;height:44px;border:none;border-radius:12px;background:#f59e0b;color:#fff;font-weight:700;cursor:pointer;font-size:15px">\u0e15\u0e01\u0e25\u0e07</button>';
    document.body.appendChild(div);
    document.getElementById('pack-done-alert-ok').onclick = function () { div.remove(); };
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
      renderAll();
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
      '<input id="pack-queue-search" type="search" placeholder="\u0e04\u0e49\u0e19\u0e2b\u0e32\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e04\u0e49\u0e32\u0e07 (Tracking / Order ID)\u2026" ' +
      'style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:12px;border:1px solid var(--line2,#d1d5db);font-size:13px;margin-bottom:8px">' +
      '<div id="pack-queue-count" style="font-size:12px;color:var(--ink3);margin-bottom:8px"></div>' +
      '<div id="pack-queue-list" style="display:flex;flex-direction:column;gap:6px;max-height:200px;overflow:auto;margin-bottom:14px"></div>' +
      '<div style="border-top:1px solid var(--line,#e5e7eb);padding-top:12px">' +
      '<div style="font-size:14px;font-weight:800;margin-bottom:8px">\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e17\u0e35\u0e48\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e41\u0e25\u0e49\u0e27</div>' +
      '<input id="pack-done-search" type="search" placeholder="\u0e04\u0e49\u0e19\u0e2b\u0e32\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e17\u0e35\u0e48\u0e15\u0e31\u0e14\u0e41\u0e25\u0e49\u0e27\u2026" ' +
      'style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:12px;border:1px solid var(--line2,#d1d5db);font-size:13px;margin-bottom:8px">' +
      '<div id="pack-done-count" style="font-size:12px;color:var(--ink3);margin-bottom:8px"></div>' +
      '<div id="pack-done-list" style="display:flex;flex-direction:column;gap:6px;max-height:160px;overflow:auto"></div>' +
      '</div>';

    var anchor = document.getElementById('pack-bs-bridge') || document.getElementById('pack-csv-panel');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor.nextSibling);
    else {
      var title = page.querySelector('.pt');
      if (title && title.nextSibling) page.insertBefore(box, title.nextSibling);
      else page.insertBefore(box, page.firstChild);
    }

    document.getElementById('pack-queue-refresh').addEventListener('click', function () {
      if (typeof window.__packPullOrdersCloud === 'function') window.__packPullOrdersCloud();
      renderAll();
      toast('\u0e23\u0e35\u0e40\u0e1f\u0e23\u0e0a\u0e04\u0e34\u0e27\u0e41\u0e25\u0e49\u0e27');
    });
    document.getElementById('pack-queue-search').addEventListener('input', function (e) {
      filterPending = e.target.value || '';
      renderPending();
    });
    document.getElementById('pack-done-search').addEventListener('input', function (e) {
      filterDone = e.target.value || '';
      renderDone();
    });
    ensureSkipBtn();
    return true;
  }

  function ensureSkipBtn() {
    if (document.getElementById('pack-skip-order')) return;
    var complete = document.getElementById('pack-complete');
    if (!complete || !complete.parentNode) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'pack-skip-order';
    btn.textContent = '\u0e25\u0e1a / \u0e02\u0e49\u0e32\u0e21\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e19\u0e35\u0e49';
    btn.style.cssText = 'height:44px;padding:0 14px;border-radius:12px;border:1px solid #fca5a5;background:#fef2f2;color:#b91c1c;font-weight:700;cursor:pointer;margin-top:8px;width:100%';
    complete.parentNode.appendChild(btn);
    btn.addEventListener('click', function () {
      var oe = document.getElementById('pack-order');
      var code = oe ? oe.value : '';
      if (!code) { toast('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e17\u0e35\u0e48\u0e42\u0e2b\u0e25\u0e14\u0e2d\u0e22\u0e39\u0e48'); return; }
      if (!confirm('\u0e25\u0e1a\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c ' + code + ' \u0e2d\u0e2d\u0e01\u0e08\u0e32\u0e01\u0e04\u0e34\u0e27\u0e41\u0e1e\u0e47\u0e01?\n(\u0e44\u0e21\u0e48\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01)')) return;
      removeOrder({ key: code, id: code, track: code, packageId: code });
      var reset = document.getElementById('pack-reset');
      if (reset) reset.click();
    });
  }

  function renderPending() {
    var listEl = document.getElementById('pack-queue-list');
    var countEl = document.getElementById('pack-queue-count');
    if (!listEl) return;
    var list = uniquePending().filter(function (item) {
      return matchFilter([item.track, item.id, item.packageId, item.platform].join(' '), filterPending);
    });
    if (countEl) {
      countEl.textContent = list.length
        ? ('\u0e41\u0e2a\u0e14\u0e07 ' + list.length + ' \u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c \u00b7 \u0e41\u0e15\u0e30\u0e42\u0e2b\u0e25\u0e14 \u00b7 \u00d7 = \u0e25\u0e1a\u0e08\u0e32\u0e01\u0e04\u0e34\u0e27')
        : (filterPending ? '\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e43\u0e19\u0e04\u0e34\u0e27' : '\u0e04\u0e34\u0e27\u0e27\u0e48\u0e32\u0e07');
    }
    if (!list.length) {
      listEl.innerHTML = '<div style="font-size:12px;color:var(--ink3);padding:6px 0">\u2014</div>';
      return;
    }
    listEl.innerHTML = list.map(function (item) {
      var label = item.track || item.id || item.packageId || item.key;
      var sub = (item.platform ? item.platform + ' \u00b7 ' : '') + item.lineCount + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23 \u00b7 ' + item.qty + ' \u0e0a\u0e34\u0e49\u0e19';
      return (
        '<div style="display:flex;gap:8px;align-items:stretch">' +
        '<button type="button" class="pack-queue-item" data-key="' + item.key.replace(/"/g, '') + '" style="flex:1;text-align:left;padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:#fff;cursor:pointer;font:inherit">' +
        '<div style="font-weight:700;font-size:13px;font-family:IBM Plex Mono,monospace">' + label + '</div>' +
        '<div style="font-size:11px;color:var(--ink3);margin-top:2px">' + sub + '</div></button>' +
        '<button type="button" class="pack-queue-del" data-key="' + item.key.replace(/"/g, '') + '" style="width:44px;border-radius:12px;border:1px solid #fca5a5;background:#fef2f2;color:#b91c1c;cursor:pointer;font-size:16px">\u00d7</button></div>'
      );
    }).join('');
    listEl.querySelectorAll('.pack-queue-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var found = uniquePending().filter(function (x) { return x.key === btn.getAttribute('data-key'); })[0];
        if (found) activate(found.order);
      });
    });
    listEl.querySelectorAll('.pack-queue-del').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var found = uniquePending().filter(function (x) { return x.key === btn.getAttribute('data-key'); })[0];
        if (!found) return;
        if (!confirm('\u0e25\u0e1a\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c ' + (found.track || found.id) + ' ?')) return;
        removeOrder(found);
      });
    });
  }

  function renderDone() {
    var listEl = document.getElementById('pack-done-list');
    var countEl = document.getElementById('pack-done-count');
    if (!listEl) return;
    var list = uniqueDone().filter(function (item) {
      return matchFilter(item.label + ' ' + item.key, filterDone);
    });
    if (countEl) {
      countEl.textContent = list.length
        ? ('\u0e15\u0e31\u0e14\u0e41\u0e25\u0e49\u0e27 ' + list.length + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23')
        : (filterDone ? '\u0e44\u0e21\u0e48\u0e1e\u0e1a' : '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e17\u0e35\u0e48\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01');
    }
    if (!list.length) {
      listEl.innerHTML = '<div style="font-size:12px;color:var(--ink3);padding:6px 0">\u2014</div>';
      return;
    }
    listEl.innerHTML = list.slice(0, 80).map(function (item) {
      var time = item.at ? new Date(item.at).toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '';
      return (
        '<div style="padding:8px 12px;border-radius:12px;border:1px solid #d1fae5;background:#ecfdf5;display:flex;justify-content:space-between;gap:8px;align-items:center">' +
        '<div style="font-weight:600;font-size:12px;font-family:IBM Plex Mono,monospace">' + String(item.label).replace(/</g, '') + '</div>' +
        '<div style="font-size:11px;color:#047857;white-space:nowrap">' + time + '</div></div>'
      );
    }).join('');
  }

  function renderAll() { renderPending(); renderDone(); }

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
    var oe = document.getElementById('pack-order');
    if (oe && !oe._doneGuard) {
      oe._doneGuard = true;
      oe.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        var v = (oe.value || '').trim();
        if (v && isDoneCode(v)) {
          e.preventDefault();
          e.stopPropagation();
          showDoneAlert(v);
        }
      }, true);
    }
  }

  function wire() {
    if (!ensureUi()) return;
    ensureSkipBtn();
    installGuard();
    renderAll();
  }

  var lastSig = '';
  setInterval(function () {
    var page = document.getElementById('page-pack');
    if (!page || !page.classList.contains('active')) return;
    wire();
    var sig = (localStorage.getItem(KEY) || '') + '|' + (localStorage.getItem(DONE_KEY) || '');
    if (sig !== lastSig) { lastSig = sig; renderAll(); }
  }, 2000);

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.ni[data-page="pack"]');
    if (btn) setTimeout(wire, 200);
  });

  window.__packQueueRefresh = renderAll;
  window.__packIsOrderDone = isDoneCode;
  setTimeout(wire, 800);
  setTimeout(wire, 2000);
})();
