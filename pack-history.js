/**
 * Pack history for today
 */
(function () {
  'use strict';
  var KEY = 'sf_pack_history_v1';

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

  function dayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function loadAll() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveAll(all) {
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {}
  }

  function userName() {
    return sessionStorage.getItem('sf_session_user') || localStorage.getItem('sf_user_name') || 'unknown';
  }

  function appendEvent(type, payload) {
    var all = loadAll();
    var dk = dayKey();
    if (!all[dk]) all[dk] = [];
    all[dk].unshift({
      at: Date.now(), type: type, user: userName(),
      order: payload.order || '', detail: payload.detail || '', wrong: payload.wrong || 0
    });
    if (all[dk].length > 200) all[dk] = all[dk].slice(0, 200);
    var keys = Object.keys(all).sort();
    while (keys.length > 14) { delete all[keys[0]]; keys = Object.keys(all).sort(); }
    saveAll(all);
    render();
  }

  function todayStats() {
    var list = (loadAll()[dayKey()] || []);
    var packed = 0, wrong = 0;
    list.forEach(function (e) {
      if (e.type === 'complete') packed++;
      if (e.type === 'wrong') wrong += (e.wrong || 1);
    });
    return { packed: packed, wrong: wrong, list: list };
  }

  function ensureUi() {
    var page = document.getElementById('page-pack');
    if (!page) return false;
    if (document.getElementById('pack-history-panel')) { render(); return true; }
    var box = document.createElement('div');
    box.id = 'pack-history-panel';
    box.className = 'card';
    box.style.cssText = 'padding:12px 14px;margin-bottom:12px;border:1px solid var(--line,#e5e7eb)';
    box.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">' +
      '<div style="font-size:14px;font-weight:800">\u0e1b\u0e23\u0e30\u0e27\u0e31\u0e15\u0e34\u0e41\u0e1e\u0e47\u0e01\u0e27\u0e31\u0e19\u0e19\u0e35\u0e49</div>' +
      '<button type="button" id="pack-history-toggle" style="padding:6px 10px;border-radius:10px;border:1px solid var(--line2);background:#fff;font-size:12px;cursor:pointer">\u0e22\u0e48\u0e2d/\u0e02\u0e22\u0e32\u0e22</button></div>' +
      '<div id="pack-history-stats" style="font-size:12px;color:var(--ink3);margin-bottom:8px"></div>' +
      '<div id="pack-history-list" style="display:flex;flex-direction:column;gap:6px;max-height:180px;overflow:auto"></div>';
    var anchor = document.getElementById('pack-queue-panel') || document.getElementById('pack-bs-bridge');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor.nextSibling);
    else page.appendChild(box);
    document.getElementById('pack-history-toggle').onclick = function () {
      var list = document.getElementById('pack-history-list');
      if (list) list.style.display = list.style.display === 'none' ? 'flex' : 'none';
    };
    return true;
  }

  function render() {
    var st = document.getElementById('pack-history-stats');
    var listEl = document.getElementById('pack-history-list');
    if (!st || !listEl) return;
    var s = todayStats();
    st.textContent = '\u0e41\u0e1e\u0e47\u0e01\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 ' + s.packed + ' \u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c \u00b7 \u0e2a\u0e41\u0e01\u0e19\u0e1c\u0e34\u0e14 ' + s.wrong + ' \u0e04\u0e23\u0e31\u0e49\u0e07';
    if (!s.list.length) {
      listEl.innerHTML = '<div style="font-size:12px;color:var(--ink3)">\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e27\u0e31\u0e19\u0e19\u0e35\u0e49</div>';
      return;
    }
    listEl.innerHTML = s.list.slice(0, 50).map(function (e) {
      var time = new Date(e.at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      var label = e.type === 'complete' ? '\u2713 \u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01' : (e.type === 'wrong' ? '\u2715 \u0e2a\u0e41\u0e01\u0e19\u0e1c\u0e34\u0e14' : e.type);
      var color = e.type === 'complete' ? '#15803d' : (e.type === 'wrong' ? '#b91c1c' : '#374151');
      return (
        '<div style="padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:#fff;font-size:12px">' +
        '<div style="display:flex;justify-content:space-between;gap:8px">' +
        '<span style="font-weight:700;color:' + color + '">' + label + '</span>' +
        '<span style="color:var(--ink3)">' + time + '</span></div>' +
        '<div style="margin-top:2px;font-family:IBM Plex Mono,monospace">' + (e.order || '\u2014') + '</div>' +
        '<div style="color:var(--ink3);margin-top:2px">' + (e.user || '') + (e.detail ? ' \u00b7 ' + e.detail : '') + '</div></div>'
      );
    }).join('');
  }

  function watchComplete() {
    var btn = document.getElementById('pack-complete');
    if (!btn || btn._histBound) return;
    btn._histBound = true;
    btn.addEventListener('click', function () {
      setTimeout(function () {
        var oe = document.getElementById('pack-order');
        setTimeout(function () {
          var t2 = btn.textContent || '';
          if (t2.indexOf('\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e41\u0e25\u0e49\u0e27') >= 0 || t2.indexOf('\u2713') >= 0) {
            appendEvent('complete', { order: oe ? oe.value : '', detail: '\u0e41\u0e1e\u0e47\u0e01\u0e04\u0e23\u0e1a' });
          }
        }, 800);
      }, 50);
    });
  }

  function watchWrong() {
    var fb = document.getElementById('pack-fb');
    if (!fb || fb._histObs) return;
    var last = '';
    var obs = new MutationObserver(function () {
      var t = (fb.textContent || '').trim();
      if (!t || t === last) return;
      last = t;
      if (t.indexOf('\u0e1c\u0e34\u0e14') >= 0 || t.indexOf('\u0e1a\u0e25\u0e47\u0e2d\u0e01') >= 0) {
        var oe = document.getElementById('pack-order');
        appendEvent('wrong', { order: oe ? oe.value : '', detail: t.slice(0, 80), wrong: 1 });
      }
    });
    obs.observe(fb, { childList: true, characterData: true, subtree: true });
    fb._histObs = obs;
  }

  function wire() {
    if (!ensureUi()) return;
    watchComplete();
    watchWrong();
    render();
  }

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.ni[data-page="pack"]');
    if (btn) setTimeout(wire, 250);
  });
  setTimeout(wire, 1200);
  setTimeout(wire, 3500);
  setInterval(function () {
    var page = document.getElementById('page-pack');
    if (page && page.classList.contains('active')) wire();
  }, 4000);

  window.__packHistoryRefresh = render;
  window.__packHistoryAdd = appendEvent;
})();
