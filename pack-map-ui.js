/**
 * Permanent BigSeller SKU map table UI (sf_sku_map_v1)
 */
(function () {
  'use strict';
  var MAP_KEY = 'sf_sku_map_v1';

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

  function loadMap() {
    try { return JSON.parse(localStorage.getItem(MAP_KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveMap(m) {
    try { localStorage.setItem(MAP_KEY, JSON.stringify(m)); } catch (e) {}
  }

  function ensureUi() {
    var page = document.getElementById('page-pack');
    if (!page) return false;
    if (document.getElementById('pack-map-panel')) { render(); return true; }
    var box = document.createElement('div');
    box.id = 'pack-map-panel';
    box.className = 'card';
    box.style.cssText = 'padding:12px 14px;margin-bottom:12px;border:1px solid var(--line,#e5e7eb)';
    box.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">' +
      '<div style="font-size:14px;font-weight:800">\u0e15\u0e32\u0e23\u0e32\u0e07\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48 SKU (BigSeller \u2194 \u0e04\u0e25\u0e31\u0e07)</div>' +
      '<button type="button" id="pack-map-toggle" style="padding:6px 10px;border-radius:10px;border:1px solid var(--line2);background:#fff;font-size:12px;cursor:pointer">\u0e22\u0e48\u0e2d/\u0e02\u0e22\u0e32\u0e22</button></div>' +
      '<div style="font-size:12px;color:var(--ink3);margin-bottom:8px">\u0e08\u0e33\u0e01\u0e32\u0e23\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48\u0e16\u0e32\u0e27\u0e23 \u2014 \u0e04\u0e23\u0e31\u0e49\u0e07\u0e2b\u0e19\u0e49\u0e32\u0e2d\u0e31\u0e1b\u0e44\u0e1f\u0e25\u0e4c\u0e08\u0e30\u0e43\u0e0a\u0e49\u0e04\u0e39\u0e48\u0e40\u0e14\u0e34\u0e21</div>' +
      '<div id="pack-map-body" style="display:none">' +
      '<input id="pack-map-search" type="search" placeholder="\u0e04\u0e49\u0e19\u0e2b\u0e32 SKU\u2026" style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:12px;border:1px solid var(--line2);font-size:13px;margin-bottom:8px">' +
      '<div id="pack-map-list" style="max-height:180px;overflow:auto;display:flex;flex-direction:column;gap:6px"></div>' +
      '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
      '<input id="pack-map-from" placeholder="SKU BigSeller" style="flex:1;min-width:120px;padding:10px;border-radius:10px;border:1px solid var(--line2);font-size:13px">' +
      '<input id="pack-map-to" placeholder="SKU/ID \u0e04\u0e25\u0e31\u0e07" style="flex:1;min-width:120px;padding:10px;border-radius:10px;border:1px solid var(--line2);font-size:13px">' +
      '<button type="button" id="pack-map-add" style="padding:10px 14px;border-radius:10px;border:none;background:#2563eb;color:#fff;font-weight:700;cursor:pointer">\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e04\u0e39\u0e48</button></div></div>';
    var anchor = document.getElementById('pack-history-panel') || document.getElementById('pack-queue-panel');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor.nextSibling);
    else page.appendChild(box);
    document.getElementById('pack-map-toggle').onclick = function () {
      var body = document.getElementById('pack-map-body');
      if (!body) return;
      body.style.display = body.style.display === 'none' ? 'block' : 'none';
      if (body.style.display === 'block') render();
    };
    document.getElementById('pack-map-search').addEventListener('input', render);
    document.getElementById('pack-map-add').onclick = function () {
      var a = (document.getElementById('pack-map-from').value || '').trim().toUpperCase().replace(/\s+/g, '');
      var b = (document.getElementById('pack-map-to').value || '').trim();
      if (!a || !b) { toast('\u0e01\u0e23\u0e2d\u0e01\u0e17\u0e31\u0e49\u0e07\u0e2a\u0e2d\u0e07\u0e0a\u0e48\u0e2d\u0e07'); return; }
      var m = loadMap();
      m[a] = b;
      var a2 = a.replace(/[^A-Z0-9]/g, '');
      if (a2) m[a2] = b;
      saveMap(m);
      document.getElementById('pack-map-from').value = '';
      document.getElementById('pack-map-to').value = '';
      toast('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e04\u0e39\u0e48\u0e41\u0e25\u0e49\u0e27');
      render();
    };
    return true;
  }

  function render() {
    var listEl = document.getElementById('pack-map-list');
    var qEl = document.getElementById('pack-map-search');
    if (!listEl) return;
    var q = (qEl && qEl.value || '').toUpperCase().trim();
    var m = loadMap();
    var keys = Object.keys(m).sort();
    if (q) keys = keys.filter(function (k) {
      return k.indexOf(q) >= 0 || String(m[k]).toUpperCase().indexOf(q) >= 0;
    });
    var seen = {}, rows = [];
    keys.forEach(function (k) {
      var sig = k + '=>' + m[k];
      if (seen[sig]) return;
      seen[sig] = 1;
      rows.push({ k: k, v: m[k] });
    });
    if (!rows.length) {
      listEl.innerHTML = '<div style="font-size:12px;color:var(--ink3)">\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e04\u0e39\u0e48\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48</div>';
      return;
    }
    listEl.innerHTML = rows.slice(0, 100).map(function (r) {
      return (
        '<div style="display:flex;gap:8px;align-items:center;padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:#fff;font-size:12px">' +
        '<div style="flex:1;font-family:IBM Plex Mono,monospace"><b>' + r.k.replace(/</g, '') + '</b> \u2192 ' + String(r.v).replace(/</g, '') + '</div>' +
        '<button type="button" data-k="' + r.k.replace(/"/g, '') + '" class="pack-map-del" style="border:1px solid #fca5a5;background:#fef2f2;color:#b91c1c;border-radius:8px;width:36px;height:36px;cursor:pointer">\u00d7</button></div>'
      );
    }).join('');
    listEl.querySelectorAll('.pack-map-del').forEach(function (btn) {
      btn.onclick = function () {
        var m2 = loadMap();
        delete m2[btn.getAttribute('data-k')];
        saveMap(m2);
        toast('\u0e25\u0e1a\u0e04\u0e39\u0e48\u0e41\u0e25\u0e49\u0e27');
        render();
      };
    });
  }

  function wire() { ensureUi(); }
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.ni[data-page="pack"]');
    if (btn) setTimeout(wire, 300);
  });
  setTimeout(wire, 1500);
  setTimeout(wire, 4000);
})();
