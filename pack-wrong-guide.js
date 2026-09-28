/**
 * Wrong-scan guide: big correct product images + remaining qty
 */
(function () {
  'use strict';
  var DB = 'https://kiyomi-b19d0-default-rtdb.asia-southeast1.firebasedatabase.app';
  var skus = {};
  var lastFb = '';

  function wsKey() { return sessionStorage.getItem('sf_session_ws') || ''; }
  function roomId() { return localStorage.getItem('sf_room_' + wsKey()) || 'WH_A'; }

  function loadSkus() {
    if (!wsKey()) return Promise.resolve();
    var url = DB + '/ws_' + wsKey() + '/rooms/' + roomId() + '/skus.json';
    return fetch(url, { cache: 'no-store' }).then(function (r) { return r.json(); })
      .then(function (d) { skus = d || {}; }).catch(function () {});
  }

  function ensureOverlay() {
    if (document.getElementById('pack-wrong-guide')) return;
    var el = document.createElement('div');
    el.id = 'pack-wrong-guide';
    el.style.cssText = 'display:none;position:fixed;inset:0;z-index:9999;background:rgba(120,0,0,.92);color:#fff;overflow:auto;padding:16px;';
    el.innerHTML =
      '<div style="max-width:520px;margin:0 auto">' +
      '<div style="font-size:22px;font-weight:800;text-align:center;margin:8px 0 4px">\u274c \u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e1c\u0e34\u0e14</div>' +
      '<div style="text-align:center;font-size:14px;opacity:.9;margin-bottom:14px">\u0e2a\u0e41\u0e01\u0e19\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e15\u0e32\u0e21\u0e23\u0e39\u0e1b\u0e19\u0e35\u0e49\u0e40\u0e17\u0e48\u0e32\u0e19\u0e31\u0e49\u0e19</div>' +
      '<div id="pack-wrong-items"></div>' +
      '<button type="button" id="pack-wrong-dismiss" style="margin:16px auto;display:block;padding:12px 24px;border:none;border-radius:12px;background:#fff;color:#900;font-weight:700;font-size:15px;cursor:pointer">\u0e2a\u0e41\u0e01\u0e19\u0e43\u0e2b\u0e21\u0e48 / \u0e1b\u0e34\u0e14</button>' +
      '</div>';
    document.body.appendChild(el);
    document.getElementById('pack-wrong-dismiss').addEventListener('click', function () {
      el.style.display = 'none';
      var scan = document.getElementById('pack-scan');
      if (scan) try { scan.focus(); } catch (e) {}
    });
  }

  function findSkuImage(skuId, name) {
    if (skuId && skus[skuId] && skus[skuId].image) return skus[skuId].image;
    var keys = Object.keys(skus);
    var nu = (name || '').toUpperCase();
    for (var i = 0; i < keys.length; i++) {
      var s = skus[keys[i]] || {};
      if (s.image && ((s.name || '').toUpperCase() === nu || keys[i] === skuId)) return s.image;
    }
    for (i = 0; i < keys.length; i++) {
      var s2 = skus[keys[i]] || {};
      if (s2.image && nu && (s2.name || '').toUpperCase().indexOf(nu) >= 0) return s2.image;
    }
    return '';
  }

  function parseLinesFromDom() {
    var rows = document.querySelectorAll('#pack-lines .row');
    var out = [];
    rows.forEach(function (row) {
      var name = (row.querySelector('.row-n') || {}).textContent || '';
      var meta = (row.querySelector('.row-m') || {}).textContent || '';
      var q = (row.querySelector('.row-q') || {}).textContent || '0/0';
      var parts = q.split('/');
      var scanned = parseInt(parts[0], 10) || 0;
      var qty = parseInt(parts[1], 10) || 0;
      out.push({ name: name.trim(), skuId: meta.trim(), scanned: scanned, qty: qty, remain: Math.max(0, qty - scanned) });
    });
    return out;
  }

  function showGuide() {
    ensureOverlay();
    loadSkus().then(function () {
      var lines = parseLinesFromDom().filter(function (l) { return l.remain > 0; });
      var box = document.getElementById('pack-wrong-items');
      if (!box) return;
      if (!lines.length) {
        box.innerHTML = '<div style="text-align:center;opacity:.8">\u0e44\u0e21\u0e48\u0e21\u0e35\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e04\u0e49\u0e32\u0e07\u0e04\u0e49\u0e32</div>';
      } else {
        box.innerHTML = lines.map(function (l) {
          var img = findSkuImage(l.skuId, l.name);
          var imgHtml = img
            ? '<img src="' + img.replace(/"/g, '') + '" alt="" style="width:100%;max-height:280px;object-fit:contain;border-radius:16px;background:#fff;margin-bottom:10px">'
            : '<div style="height:160px;border-radius:16px;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;margin-bottom:10px;font-size:13px;opacity:.8">\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e23\u0e39\u0e1b \u2014 \u0e43\u0e2a\u0e48\u0e23\u0e39\u0e1b\u0e43\u0e19\u0e41\u0e17\u0e47\u0e1a\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32</div>';
          return '<div style="background:rgba(0,0,0,.25);border-radius:18px;padding:14px;margin-bottom:14px">' +
            imgHtml +
            '<div style="font-size:18px;font-weight:700;margin-bottom:4px">' + (l.name || l.skuId) + '</div>' +
            '<div style="font-size:13px;opacity:.85;margin-bottom:8px">' + (l.skuId || '') + '</div>' +
            '<div style="font-size:28px;font-weight:800;font-family:IBM Plex Mono,monospace">\u0e15\u0e49\u0e2d\u0e07\u0e2a\u0e41\u0e01\u0e19\u0e2d\u0e35\u0e01 ' + l.remain + ' \u0e0a\u0e34\u0e49\u0e19</div>' +
            '<div style="font-size:13px;opacity:.8">\u0e04\u0e37\u0e1a\u0e41\u0e25\u0e49\u0e27 ' + l.scanned + '/' + l.qty + '</div>' +
            '</div>';
        }).join('');
      }
      document.getElementById('pack-wrong-guide').style.display = 'block';
    });
  }

  function hideGuide() {
    var el = document.getElementById('pack-wrong-guide');
    if (el) el.style.display = 'none';
  }

  function checkFb() {
    var fb = document.getElementById('pack-fb');
    if (!fb) return;
    var t = (fb.textContent || '').trim();
    if (t === lastFb) return;
    lastFb = t;
    if (/\u0e1c\u0e34\u0e14|\u0e1a\u0e25\u0e47\u0e2d\u0e01|\u2715/.test(t)) {
      showGuide();
    } else if (/\u0e16\u0e39\u0e01|\u2713|\u0e42\u0e2b\u0e25\u0e14/.test(t)) {
      hideGuide();
    }
  }

  setInterval(checkFb, 400);
  loadSkus();
  setInterval(loadSkus, 30000);
})();
