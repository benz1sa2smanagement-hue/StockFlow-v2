/**
 * Show product images on Dashboard stock list, recent, low-stock, and any .row by name match
 */
(function () {
  'use strict';
  var DB = 'https://kiyomi-b19d0-default-rtdb.asia-southeast1.firebasedatabase.app';
  var skus = {};
  var byName = {};

  function wsKey() { return sessionStorage.getItem('sf_session_ws') || ''; }
  function roomId() { return localStorage.getItem('sf_room_' + wsKey()) || 'WH_A'; }
  function rp() { return 'ws_' + wsKey() + '/rooms/' + roomId(); }

  function rebuildIndex(data) {
    skus = data || {};
    byName = {};
    Object.keys(skus).forEach(function (id) {
      var s = skus[id] || {};
      var n = String(s.name || '').trim();
      if (n) byName[n] = s;
      if (s.unitSku) byName[String(s.unitSku).trim()] = s;
    });
  }

  function loadSkus() {
    if (!wsKey()) return Promise.resolve();
    return fetch(DB + '/' + rp() + '/skus.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) { rebuildIndex(d || {}); })
      .catch(function () {});
  }

  function findSkuForRow(row) {
    var id = row.getAttribute('data-sku-id');
    if (id && skus[id]) return skus[id];
    var nameEl = row.querySelector('.row-n');
    if (!nameEl) return null;
    var raw = (nameEl.textContent || '').trim();
    var name = raw.replace(/^(รับเข้า|จ่ายออก|ปรับสต็อก)\s*[·•]\s*/, '').trim();
    if (byName[name]) return byName[name];
    if (byName[raw]) return byName[raw];
    var keys = Object.keys(byName);
    for (var i = 0; i < keys.length; i++) {
      if (name && (name.indexOf(keys[i]) >= 0 || keys[i].indexOf(name) >= 0)) return byName[keys[i]];
    }
    return null;
  }

  function applyThumb(row) {
    if (!row || row.querySelector('.sf-thumb')) return;
    var s = findSkuForRow(row);
    if (!s || !s.image) return;
    var html =
      '<div class="row-ico sf-thumb" style="width:44px;height:44px;border-radius:10px;overflow:hidden;flex-shrink:0;background:#0a0a0a;padding:0;border:1px solid var(--line,#e5e7eb)">' +
      '<img src="' + String(s.image).replace(/"/g, '') + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block" onerror="this.parentNode.style.display=\'none\'">' +
      '</div>';
    var ico = row.querySelector('.row-ico');
    if (ico) {
      ico.outerHTML = html;
    } else {
      var wrap = document.createElement('div');
      wrap.innerHTML = html;
      var node = wrap.firstChild;
      row.insertBefore(node, row.firstChild);
    }
  }

  function enhanceList(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.querySelectorAll('.row').forEach(applyThumb);
  }

  function enhanceAll() {
    ['stock-list', 'prod-list', 'recent-list', 'low-stock-list', 'aw-wh-list'].forEach(enhanceList);
    var pack = document.getElementById('pack-lines');
    if (pack) pack.querySelectorAll('.row, .plu').forEach(applyThumb);
  }

  function observe(id) {
    var el = document.getElementById(id);
    if (!el || el._sfThumbObs) return;
    var obs = new MutationObserver(function () {
      clearTimeout(el._sfThumbT);
      el._sfThumbT = setTimeout(function () { enhanceList(id); }, 60);
    });
    obs.observe(el, { childList: true, subtree: true });
    el._sfThumbObs = obs;
  }

  function wire() {
    loadSkus().then(function () {
      ['stock-list', 'prod-list', 'recent-list', 'low-stock-list'].forEach(function (id) {
        observe(id);
        enhanceList(id);
      });
      enhanceAll();
    });
  }

  window.__sfRefreshThumbs = function (cache) {
    if (cache) rebuildIndex(cache);
    else loadSkus().then(enhanceAll);
    enhanceAll();
  };

  setTimeout(function () {
    if (typeof window.__packReloadSkuImages === 'function') {
      var _orig = window.__packReloadSkuImages;
      window.__packReloadSkuImages = function () {
        var p = _orig ? _orig() : Promise.resolve();
        return Promise.resolve(p).then(function () {
          return loadSkus().then(enhanceAll);
        });
      };
    }
  }, 2000);

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.ni');
    if (btn) setTimeout(wire, 300);
  });

  setTimeout(wire, 1800);
  setTimeout(wire, 4000);
  setInterval(function () {
    if (wsKey()) loadSkus().then(enhanceAll);
  }, 12000);
})();
