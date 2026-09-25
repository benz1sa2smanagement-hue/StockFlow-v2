/**
 * PackGuard module for StockFlow
 * แพ็กกันของผิด → ตัดสต็อก (movement type:out) ผ่าน Firebase ชุดเดียวกับ StockFlow
 */
(function () {
  'use strict';
  var DB = 'https://kiyomi-b19d0-default-rtdb.asia-southeast1.firebasedatabase.app';
  var PLAT_MAP = { shopee: 'Shopee', lazada: 'Lazada', tiktok: 'TikTok', facebook: 'Facebook', line: 'LINE', other: '\u0e2d\u0e37\u0e48\u0e19\u0e46' };
  var packPlat = 'shopee';
  var packLines = [];
  var packWrongEvents = JSON.parse(localStorage.getItem('sf_pack_wrong') || '[]');
  var packLastScan = { v: '', t: 0 };
  var packCompleted = false;
  var skus = {};
  var movements = {};

  function toast(msg) {
    var w = document.getElementById('toast-wrap');
    if (!w) return;
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    w.innerHTML = '';
    w.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function wsKey() { return sessionStorage.getItem('sf_session_ws') || ''; }
  function userName() { return sessionStorage.getItem('sf_session_user') || ''; }
  function roomId() {
    var k = wsKey();
    return localStorage.getItem('sf_room_' + k) || 'WH_A';
  }
  function rp() { return 'ws_' + wsKey() + '/rooms/' + roomId(); }
  function api(p, opt) {
    opt = opt || {};
    return fetch(DB + '/' + p + '.json', Object.assign({ cache: 'no-store' }, opt)).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }
  function apiPost(p, v) {
    return api(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) })
      .then(function (d) { return d && d.name; });
  }
  function computeStock(mvs) {
    var map = {};
    Object.values(mvs || {}).forEach(function (m) {
      if (!map[m.skuId]) map[m.skuId] = 0;
      if (m.type === 'in') map[m.skuId] += m.pieces;
      else if (m.type === 'adj') map[m.skuId] += (m.adjDir === 'minus' ? -m.pieces : m.pieces);
      else if (m.type === 'out' || m.type === 'transfer') map[m.skuId] -= m.pieces;
    });
    return map;
  }
  function packDedupe(v) {
    var n = Date.now();
    if (packLastScan.v === v && n - packLastScan.t < 800) return false;
    packLastScan = { v: v, t: n };
    return true;
  }
  function findSkuByScan(raw) {
    var v = (raw || '').trim();
    if (!v) return null;
    var upper = v.toUpperCase();
    if (skus[v]) return { id: v, s: skus[v] };
    if (skus[upper]) return { id: upper, s: skus[upper] };
    var keys = Object.keys(skus);
    for (var i = 0; i < keys.length; i++) {
      var id = keys[i], s = skus[id] || {};
      if ((s.barcode && String(s.barcode) === v) || (s.sku && String(s.sku).toUpperCase() === upper)) return { id: id, s: s };
      if ((s.name || '').toUpperCase() === upper || id.toUpperCase() === upper) return { id: id, s: s };
    }
    for (var j = 0; j < keys.length; j++) {
      var id2 = keys[j], s2 = skus[id2] || {};
      if ((s2.name || '').toUpperCase().indexOf(upper) >= 0 && upper.length >= 4) return { id: id2, s: s2 };
    }
    return null;
  }
  function loadData() {
    if (!wsKey()) return Promise.resolve();
    return Promise.all([api(rp() + '/skus'), api(rp() + '/movements')]).then(function (res) {
      skus = res[0] || {};
      movements = res[1] || {};
      fillPackSkuSelect();
    }).catch(function (e) { console.warn('pack load', e); });
  }
  function fillPackSkuSelect() {
    var sel = document.getElementById('pack-add-sku');
    if (!sel) return;
    var stock = computeStock(movements);
    var opts = Object.entries(skus).sort(function (a, b) {
      return (a[1].name || a[0]).localeCompare(b[1].name || b[0], 'th');
    });
    sel.innerHTML = '<option value="">\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e08\u0e32\u0e01\u0e04\u0e25\u0e31\u0e07\u2026</option>' + opts.map(function (e) {
      return '<option value="' + e[0] + '">' + (e[1].name || e[0]) + ' \u00b7 \u0e04\u0e07\u0e40\u0e2b\u0e25\u0e37\u0e2d ' + (stock[e[0]] || 0) + '</option>';
    }).join('');
  }
  function renderPackStats() {
    var elW = document.getElementById('pack-stat-wrong');
    var elP = document.getElementById('pack-stat-prot');
    var prot = {};
    packWrongEvents.forEach(function (e) { prot[e.orderId || '_'] = 1; });
    if (elW) elW.textContent = packWrongEvents.length;
    if (elP) elP.textContent = Object.keys(prot).length;
  }
  function renderPackLines() {
    var card = document.getElementById('pack-lines-card');
    var box = document.getElementById('pack-lines');
    var btn = document.getElementById('pack-complete');
    var st = document.getElementById('pack-status');
    if (!box) return;
    if (!packLines.length) { if (card) card.style.display = 'none'; return; }
    if (card) card.style.display = 'block';
    var allDone = packLines.every(function (l) { return l.scanned >= l.qty; });
    box.innerHTML = packLines.map(function (l, idx) {
      var done = l.scanned >= l.qty;
      return '<div class="row"><div class="row-ico">' + (done ? '\u2713' : (idx + 1)) + '</div><div class="row-b"><div class="row-n">' + (l.name || l.skuId) + '</div><div class="row-m">' + l.skuId + '</div></div><div class="row-q ' + (done ? 'pos' : '') + '">' + l.scanned + '/' + l.qty + '</div></div>';
    }).join('');
    if (st) st.textContent = packCompleted ? '\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e41\u0e25\u0e49\u0e27' : (allDone ? '\u0e04\u0e23\u0e1a\u0e41\u0e25\u0e49\u0e27 \u0e1e\u0e23\u0e49\u0e2d\u0e21\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01' : '\u0e23\u0e2d\u0e2a\u0e41\u0e01\u0e19');
    if (btn) {
      btn.disabled = !allDone || packCompleted;
      btn.style.opacity = (!allDone || packCompleted) ? '.4' : '1';
      btn.textContent = packCompleted ? '\u2713 \u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e41\u0e25\u0e49\u0e27' : '\u2713 \u0e41\u0e1e\u0e47\u0e01\u0e04\u0e23\u0e1a \u00b7 \u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01';
    }
  }
  function packAddLine() {
    var skuId = document.getElementById('pack-add-sku').value;
    var qty = parseInt(document.getElementById('pack-add-qty').value, 10) || 1;
    if (!skuId) { toast('\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e01\u0e48\u0e2d\u0e19'); return; }
    if (qty < 1) { toast('\u0e08\u0e33\u0e19\u0e27\u0e19\u0e15\u0e49\u0e2d\u0e07\u0e21\u0e32\u0e01\u0e01\u0e27\u0e48\u0e32 0'); return; }
    var exist = packLines.find(function (l) { return l.skuId === skuId; });
    if (exist) exist.qty += qty;
    else {
      var s = skus[skuId] || {};
      packLines.push({ skuId: skuId, name: s.name || skuId, qty: qty, scanned: 0 });
    }
    packCompleted = false;
    document.getElementById('pack-add-qty').value = '1';
    renderPackLines();
    toast('\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e41\u0e25\u0e49\u0e27');
    setTimeout(function () { var i = document.getElementById('pack-scan'); if (i) i.focus(); }, 80);
  }
  function packVerify() {
    var input = document.getElementById('pack-scan');
    var v = (input && input.value || '').trim();
    if (!v) return;
    if (!packDedupe('pack:' + v)) return;
    if (!packLines.length) { toast('\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e41\u0e1e\u0e47\u0e01\u0e01\u0e48\u0e2d\u0e19'); return; }
    if (packCompleted) { toast('\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e19\u0e35\u0e49\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e41\u0e25\u0e49\u0e27'); return; }
    var fb = document.getElementById('pack-fb');
    var found = findSkuByScan(v);
    var line = found ? packLines.find(function (l) { return l.skuId === found.id; }) : null;
    if (!line) {
      line = packLines.find(function (l) {
        return l.skuId.toUpperCase() === v.toUpperCase() || (l.name || '').toUpperCase() === v.toUpperCase();
      });
    }
    var orderId = (document.getElementById('pack-order').value || '').trim() || 'NO-ORDER';
    if (!line || line.scanned >= line.qty) {
      packWrongEvents.push({ orderId: orderId, value: v, time: new Date().toISOString() });
      localStorage.setItem('sf_pack_wrong', JSON.stringify(packWrongEvents.slice(-200)));
      if (fb) {
        fb.style.background = 'var(--bad-soft)';
        fb.style.color = 'var(--bad)';
        fb.textContent = '\u2715 \u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e1c\u0e34\u0e14 \u2014 \u0e1a\u0e25\u0e47\u0e2d\u0e01\u0e41\u0e25\u0e49\u0e27 \u00b7 \u0e2a\u0e41\u0e01\u0e19: ' + v;
      }
      try { if (navigator.vibrate) navigator.vibrate([80, 40, 80]); } catch (e) {}
      toast('\u0e1a\u0e25\u0e47\u0e2d\u0e01\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e1c\u0e34\u0e14');
      if (input) input.value = '';
      renderPackStats();
      return;
    }
    line.scanned += 1;
    if (fb) {
      fb.style.background = 'var(--ok-soft)';
      fb.style.color = 'var(--ok)';
      fb.textContent = '\u2713 \u0e16\u0e39\u0e01\u0e15\u0e49\u0e2d\u0e07 \u00b7 ' + (line.name || line.skuId) + ' \u00b7 ' + line.scanned + '/' + line.qty;
    }
    toast('\u0e16\u0e39\u0e01\u0e15\u0e49\u0e2d\u0e07');
    if (input) input.value = '';
    renderPackLines();
    setTimeout(function () { if (input) input.focus(); }, 50);
  }
  function packComplete() {
    if (packCompleted) { toast('\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e44\u0e1b\u0e41\u0e25\u0e49\u0e27'); return; }
    if (!packLines.length) { toast('\u0e44\u0e21\u0e48\u0e21\u0e35\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23'); return; }
    if (!packLines.every(function (l) { return l.scanned >= l.qty; })) { toast('\u0e2a\u0e41\u0e01\u0e19\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e04\u0e23\u0e1a'); return; }
    if (!wsKey()) { toast('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e25\u0e47\u0e2d\u0e01\u0e2d\u0e34\u0e19'); return; }
    var orderId = (document.getElementById('pack-order').value || '').trim() || 'PACK';
    var platform = PLAT_MAP[packPlat] || packPlat || '';
    var date = todayStr();
    var btn = document.getElementById('pack-complete');
    if (btn) { btn.disabled = true; btn.textContent = '\u0e01\u0e33\u0e25\u0e31\u0e07\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u2026'; }
    return loadData().then(function () {
      var stock = computeStock(movements);
      for (var i = 0; i < packLines.length; i++) {
        var l = packLines[i];
        var have = stock[l.skuId] || 0;
        if (have < l.qty) {
          toast('\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e44\u0e21\u0e48\u0e1e\u0e2d: ' + (l.name || l.skuId) + ' \u0e04\u0e07\u0e40\u0e2b\u0e25\u0e37\u0e2d ' + have);
          if (btn) { btn.disabled = false; btn.textContent = '\u2713 \u0e41\u0e1e\u0e47\u0e01\u0e04\u0e23\u0e1a \u00b7 \u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01'; }
          return;
        }
      }
      var chain = Promise.resolve();
      packLines.forEach(function (l) {
        chain = chain.then(function () {
          var rec = {
            skuId: l.skuId,
            type: 'out',
            qty: l.qty,
            unit: 'pack',
            pieces: l.qty,
            date: date,
            note: 'PackGuard \u00b7 ' + orderId,
            platform: platform,
            user: userName(),
            createdAt: Date.now(),
            packOrderId: orderId
          };
          return apiPost(rp() + '/movements', rec);
        });
      });
      return chain.then(function () {
        packCompleted = true;
        renderPackLines();
        toast('\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e41\u0e25\u0e49\u0e27 \u00b7 ' + packLines.length + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23');
        setTimeout(function () { location.reload(); }, 1200);
      });
    }).catch(function (e) {
      toast('\u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08: ' + (e.message || e));
      if (btn) { btn.disabled = false; btn.textContent = '\u2713 \u0e41\u0e1e\u0e47\u0e01\u0e04\u0e23\u0e1a \u00b7 \u0e15\u0e31\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01'; }
    });
  }
  function packReset() {
    packLines = [];
    packCompleted = false;
    packLastScan = { v: '', t: 0 };
    var fb = document.getElementById('pack-fb');
    if (fb) { fb.style.background = 'var(--bg)'; fb.style.color = 'var(--ink3)'; fb.textContent = '\u0e23\u0e2d\u0e2a\u0e41\u0e01\u0e19\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u2026'; }
    var o = document.getElementById('pack-order');
    if (o) o.value = '';
    renderPackLines();
    toast('\u0e40\u0e23\u0e34\u0e48\u0e21\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e43\u0e2b\u0e21\u0e48');
  }
  function onShowPack() {
    loadData().then(function () { renderPackLines(); renderPackStats(); });
  }
  function init() {
    var addBtn = document.getElementById('pack-add-btn');
    var scan = document.getElementById('pack-scan');
    var complete = document.getElementById('pack-complete');
    var reset = document.getElementById('pack-reset');
    if (addBtn) addBtn.addEventListener('click', packAddLine);
    if (complete) complete.addEventListener('click', packComplete);
    if (reset) reset.addEventListener('click', packReset);
    if (scan) scan.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); packVerify(); } });
    document.querySelectorAll('#pack-plat button').forEach(function (b) {
      b.addEventListener('click', function () {
        packPlat = b.getAttribute('data-pplat') || 'shopee';
        document.querySelectorAll('#pack-plat button').forEach(function (x) { x.classList.toggle('on', x === b); });
      });
    });
    document.querySelectorAll('.ni[data-page="pack"]').forEach(function (btn) {
      btn.addEventListener('click', function () { setTimeout(onShowPack, 50); });
    });
    renderPackStats();
    if (wsKey()) loadData();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
