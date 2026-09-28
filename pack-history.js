/**
 * Combined today stats (left) + pack history (right)
 */
(function () {
  'use strict';
  var KEY = 'sf_pack_history_v1';

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
    var elW = document.getElementById('pack-stat-wrong');
    var elP = document.getElementById('pack-stat-prot');
    var coreWrong = elW ? parseInt(elW.textContent, 10) || 0 : 0;
    var coreProt = elP ? parseInt(elP.textContent, 10) || 0 : 0;
    return { packed: packed, wrong: Math.max(wrong, coreWrong), protected: coreProt || packed, list: list };
  }

  function icon(name) {
    var paths = {
      chart: '<path d="M4 19V9M12 19V5M20 19v-7"/>',
      list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>'
    };
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:6px;opacity:.75">' +
      (paths[name] || paths.list) + '</svg>';
  }

  function ensureUi() {
    var page = document.getElementById('page-pack');
    if (!page) return false;
    if (document.getElementById('pack-history-panel')) { render(); hideLegacyStats(); return true; }
    var box = document.createElement('div');
    box.id = 'pack-history-panel';
    box.className = 'card';
    box.style.cssText = 'padding:12px 14px;margin-bottom:12px;border:1px solid var(--line,#e5e7eb)';
    box.innerHTML =
      '<div style="font-size:14px;font-weight:800;margin-bottom:10px;display:flex;align-items:center">' +
      icon('chart') + '\u0e2a\u0e16\u0e34\u0e15\u0e34 & \u0e1b\u0e23\u0e30\u0e27\u0e31\u0e15\u0e34\u0e41\u0e1e\u0e47\u0e01\u0e27\u0e31\u0e19\u0e19\u0e35\u0e49</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1.2fr;gap:12px">' +
      '<div style="border:1px solid var(--line);border-radius:14px;padding:12px;background:rgba(255,255,255,.7)">' +
      '<div style="font-size:12px;font-weight:700;margin-bottom:10px;color:var(--ink2)">' + icon('chart') + '\u0e2a\u0e16\u0e34\u0e15\u0e34\u0e27\u0e31\u0e19\u0e19\u0e35\u0e49</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
      '<div style="padding:10px;border-radius:12px;background:var(--bad-soft,#fee2e2);text-align:center">' +
      '<div style="font-size:11px;color:#991b1b">\u0e2a\u0e41\u0e01\u0e19\u0e1c\u0e34\u0e14</div>' +
      '<div id="pack-hist-wrong" style="font-size:22px;font-weight:700;font-family:IBM Plex Mono,monospace;color:#b91c1c">0</div></div>' +
      '<div style="padding:10px;border-radius:12px;background:var(--ok-soft,#dcfce7);text-align:center">' +
      '<div style="font-size:11px;color:#166534">\u0e01\u0e31\u0e19\u0e44\u0e14\u0e49 / \u0e15\u0e31\u0e14\u0e41\u0e25\u0e49\u0e27</div>' +
      '<div id="pack-hist-ok" style="font-size:22px;font-weight:700;font-family:IBM Plex Mono,monospace;color:#15803d">0</div></div>' +
      '</div>' +
      '<div style="margin-top:8px;font-size:11px;color:var(--ink3);line-height:1.4" id="pack-hist-summary">\u2014</div></div>' +
      '<div style="border:1px solid var(--line);border-radius:14px;padding:12px;background:rgba(255,255,255,.7);min-height:120px">' +
      '<div style="font-size:12px;font-weight:700;margin-bottom:8px;color:var(--ink2)">' + icon('list') + '\u0e1b\u0e23\u0e30\u0e27\u0e31\u0e15\u0e34\u0e25\u0e48\u0e32\u0e2a\u0e38\u0e14</div>' +
      '<div id="pack-history-list" style="display:flex;flex-direction:column;gap:6px;max-height:160px;overflow:auto"></div>' +
      '</div></div>';
    var anchor = document.getElementById('pack-queue-panel') || document.getElementById('pack-bs-bridge');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor.nextSibling);
    else page.appendChild(box);
    hideLegacyStats();
    return true;
  }

  function hideLegacyStats() {
    var w = document.getElementById('pack-stat-wrong');
    if (!w) return;
    var p = w.closest('.card') || w.parentElement;
    if (p && p.querySelector && p.querySelector('#pack-stat-prot') && p.id !== 'pack-history-panel') {
      p.style.display = 'none';
    }
  }

  function render() {
    var s = todayStats();
    var elW = document.getElementById('pack-hist-wrong');
    var elO = document.getElementById('pack-hist-ok');
    var sum = document.getElementById('pack-hist-summary');
    var listEl = document.getElementById('pack-history-list');
    if (elW) elW.textContent = String(s.wrong);
    if (elO) elO.textContent = String(s.protected || s.packed);
    if (sum) sum.textContent = '\u0e41\u0e1e\u0e47\u0e01\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 ' + s.packed + ' \u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c \u00b7 \u0e2a\u0e41\u0e01\u0e19\u0e1c\u0e34\u0e14 ' + s.wrong + ' \u0e04\u0e23\u0e31\u0e49\u0e07';
    if (!listEl) return;
    if (!s.list.length) {
      listEl.innerHTML = '<div style="font-size:12px;color:var(--ink3)">\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e27\u0e31\u0e19\u0e19\u0e35\u0e49</div>';
      return;
    }
    listEl.innerHTML = s.list.slice(0, 40).map(function (e) {
      var time = new Date(e.at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      var ok = e.type === 'complete';
      var color = ok ? '#15803d' : '#b91c1c';
      var label = ok ? '\u2713 \u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01' : '\u2715 \u0e2a\u0e41\u0e01\u0e19\u0e1c\u0e34\u0e14';
      return (
        '<div style="padding:7px 9px;border-radius:10px;border:1px solid var(--line);background:#fff;font-size:11px">' +
        '<div style="display:flex;justify-content:space-between;gap:6px">' +
        '<span style="font-weight:700;color:' + color + '">' + label + '</span>' +
        '<span style="color:var(--ink3)">' + time + '</span></div>' +
        '<div style="font-family:IBM Plex Mono,monospace;margin-top:2px">' + (e.order || '\u2014') + '</div>' +
        '<div style="color:var(--ink3)">' + (e.user || '') + '</div></div>'
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
