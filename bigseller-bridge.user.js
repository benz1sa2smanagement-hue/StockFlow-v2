// ==UserScript==
// @name         StockFlow BigSeller Bridge
// @namespace    https://benz1sa2smanagement-hue.github.io/StockFlow-v2/
// @version      1.3.3
// @description  Pull orders from logged-in BigSeller tab into StockFlow via Firebase
// @match        *://*.bigseller.com/*
// @match        *://bigseller.com/*
// @match        *://www.bigseller.com/*
// @include      *://*bigseller.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      kiyomi-b19d0-default-rtdb.asia-southeast1.firebasedatabase.app
// @connect      raw.githubusercontent.com
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';
  var DB = 'https://kiyomi-b19d0-default-rtdb.asia-southeast1.firebasedatabase.app';
  var captured = [];
  var lastPullHandled = 0;
  var uiTries = 0;
  var lastJsonHits = 0;
  var lastHint = '';

  function getCfg() {
    var ws = '';
    var room = 'WH_A';
    try { if (typeof GM_getValue === 'function') ws = GM_getValue('sf_ws', '') || ''; } catch (e) {}
    try { if (typeof GM_getValue === 'function') room = GM_getValue('sf_room', '') || 'WH_A'; } catch (e) {}
    try {
      if (!ws) ws = localStorage.getItem('sf_bridge_ws') || '';
      var r2 = localStorage.getItem('sf_bridge_room');
      if (r2) room = r2;
    } catch (e2) {}
    return {
      wsKey: String(ws || '').trim().replace(/^WS-/i, ''),
      room: String(room || 'WH_A').trim() || 'WH_A'
    };
  }
  function setCfg(ws, room) {
    ws = String(ws || '').trim().replace(/^WS-/i, '');
    room = String(room || 'WH_A').trim() || 'WH_A';
    try {
      if (typeof GM_setValue === 'function') {
        GM_setValue('sf_ws', ws || '');
        GM_setValue('sf_room', room);
      }
    } catch (e) {}
    try {
      localStorage.setItem('sf_bridge_ws', ws || '');
      localStorage.setItem('sf_bridge_room', room);
    } catch (e2) {}
  }
  function pathBase() {
    var c = getCfg();
    if (!c.wsKey) return '';
    return 'ws_' + c.wsKey + '/rooms/' + (c.room || 'WH_A');
  }
  function gmFetch(url, method, body) {
    return new Promise(function (resolve, reject) {
      if (typeof GM_xmlhttpRequest !== 'function') {
        reject(new Error('Need Tampermonkey/Violentmonkey'));
        return;
      }
      GM_xmlhttpRequest({
        method: method || 'GET',
        url: url,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        data: body ? JSON.stringify(body) : undefined,
        onload: function (res) {
          try { resolve(res.responseText ? JSON.parse(res.responseText) : null); }
          catch (e) { resolve(null); }
        },
        onerror: function (e) { reject(e); }
      });
    });
  }
  function fbGet(p) { return gmFetch(DB + '/' + p + '.json', 'GET'); }
  function fbPut(p, data) { return gmFetch(DB + '/' + p + '.json', 'PUT', data); }

  function heartbeat(msg) {
    var base = pathBase();
    if (!base) return Promise.resolve();
    return fbPut(base + '/bsBridge/status', {
      onlineAt: Date.now(),
      page: location.pathname + location.search,
      message: msg || '',
      href: location.href,
      ver: '1.3.3',
      captured: captured.length,
      jsonHits: lastJsonHits
    }).catch(function () {});
  }

  function norm(v) { return String(v == null ? '' : v).trim(); }

  function pickId(data) {
    if (!data || typeof data !== 'object') return '';
    var keys = [
      'orderId', 'order_id', 'orderNo', 'order_no', 'orderNumber', 'order_number',
      'platformOrderId', 'platform_order_id', 'platformOrderNo', 'platform_order_no',
      'packageId', 'package_id', 'packageNo', 'package_no', 'pkgId',
      'trackingNumber', 'tracking_number', 'trackingNo', 'tracking_no',
      'bsCode', 'bs_code', 'shipmentId', 'shipment_id', 'id'
    ];
    for (var i = 0; i < keys.length; i++) {
      var v = data[keys[i]];
      if (v != null && String(v).trim() !== '' && String(v).trim() !== '0') return String(v).trim();
    }
    return '';
  }

  function pickItems(data) {
    if (!data || typeof data !== 'object') return [];
    var keys = [
      'items', 'orderItems', 'order_items', 'orderItemList', 'order_item_list',
      'skus', 'skuList', 'sku_list', 'productList', 'product_list', 'products',
      'details', 'detailList', 'lineItems', 'line_items', 'goodsList', 'goods_list',
      'packageItemList', 'packageItems', 'itemList', 'item_list', 'rows'
    ];
    for (var i = 0; i < keys.length; i++) {
      var v = data[keys[i]];
      if (Array.isArray(v) && v.length) return v;
    }
    return [];
  }

  function lineFromItem(it) {
    if (!it || typeof it !== 'object') return null;
    var sku = norm(
      it.sellerSku || it.seller_sku || it.sku || it.skuId || it.sku_id ||
      it.merchantSku || it.msku || it.productSku || it.product_sku ||
      it.outerSku || it.outer_sku || it.shopSku || it.variationSku ||
      it.skuCode || it.sku_code || it.styleCode || ''
    );
    var name = norm(
      it.productName || it.product_name || it.name || it.title ||
      it.skuName || it.sku_name || it.itemName || it.item_name ||
      it.goodsName || it.goods_name || it.variationName || ''
    );
    var qty = parseInt(it.quantity || it.qty || it.amount || it.num || it.count || it.buyCount || 1, 10);
    if (!qty || qty < 1) qty = 1;
    if (!sku && !name) return null;
    return {
      skuId: sku,
      name: name,
      qty: qty,
      unitSku: sku,
      barcode: norm(it.barcode || it.ean || it.upc || ''),
      matched: false
    };
  }

  function fallbackLines(data) {
    var sku = norm(
      data.sellerSku || data.sku || data.skuId || data.merchantSku ||
      data.productSku || data.outerSku || data.mainSku || ''
    );
    var name = norm(
      data.productName || data.product_name || data.itemName || data.title ||
      data.skuName || data.goodsName || data.mainProductName || ''
    );
    var qty = parseInt(data.quantity || data.qty || data.itemCount || data.totalQty || 1, 10) || 1;
    if (!sku && !name) return [];
    return [{ skuId: sku, name: name || sku, qty: qty, unitSku: sku, barcode: '', matched: false }];
  }

  function looksLikeOrder(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    if (pickId(data)) return true;
    var s = '';
    try { s = Object.keys(data).join(',').toLowerCase(); } catch (e) { return false; }
    return /order|package|tracking|shipment|sku|product/.test(s);
  }

  function extractOrdersFromJson(data, depth) {
    depth = depth || 0;
    if (depth > 8 || data == null) return [];
    var out = [];
    if (Array.isArray(data)) {
      data.forEach(function (item) { out = out.concat(extractOrdersFromJson(item, depth + 1)); });
      return out;
    }
    if (typeof data !== 'object') return out;

    var id = pickId(data);
    var items = pickItems(data);
    if (id && items.length) {
      var lines = items.map(lineFromItem).filter(Boolean);
      if (lines.length) {
        out.push({
          id: String(id),
          track: norm(data.trackingNumber || data.tracking_number || data.trackingNo || data.tracking_no || data.expressNo || ''),
          packageId: norm(data.packageId || data.package_id || data.packageNo || data.bsCode || ''),
          platform: norm(data.platform || data.channel || data.shopName || data.shop_name || data.marketplace || data.site || data.platformName || ''),
          printStatus: norm(data.printStatus || data.labelPrintStatus || data.print_status || data.isPrint || data.printed || data.printFlag || ''),
          shipStatus: norm(data.shippingStatus || data.shipStatus || data.packageStatus || data.orderStatus || data.statusName || data.status || ''),
          printedAt: data.printTime || data.printedAt || data.labelPrintTime || data.printDate || null,
          orderAt: data.orderTime || data.createTime || data.createdAt || data.payTime || data.paymentTime || data.orderDate || data.gmtCreate || null,
          lines: lines
        });
      }
    } else if (id && (data.sellerSku || data.sku || data.productName || data.itemName || data.goodsName)) {
      var fl = fallbackLines(data);
      if (fl.length) {
        out.push({
          id: String(id),
          track: norm(data.trackingNumber || data.trackingNo || ''),
          packageId: norm(data.packageId || data.packageNo || data.bsCode || ''),
          platform: norm(data.platform || data.channel || data.shopName || data.marketplace || ''),
          printStatus: norm(data.printStatus || data.isPrint || ''),
          shipStatus: norm(data.shippingStatus || data.orderStatus || data.statusName || data.status || ''),
          printedAt: data.printTime || data.printedAt || null,
          orderAt: data.orderTime || data.createTime || data.createdAt || data.payTime || null,
          lines: fl
        });
      }
    }

    var childKeys = ['data', 'result', 'rows', 'list', 'records', 'content', 'pageData', 'orderList', 'orders', 'packages', 'packageList'];
    childKeys.forEach(function (k) {
      if (data[k] && typeof data[k] === 'object') {
        out = out.concat(extractOrdersFromJson(data[k], depth + 1));
      }
    });

    if (depth < 4) {
      Object.keys(data).forEach(function (k) {
        if (childKeys.indexOf(k) >= 0) return;
        if (k === 'items' || k === 'orderItems') return;
        var v = data[k];
        if (v && typeof v === 'object') out = out.concat(extractOrdersFromJson(v, depth + 1));
      });
    }
    return out;
  }

  function mergeUnique(list) {
    var map = {};
    list.forEach(function (o) {
      if (!o || !o.lines || !o.lines.length) return;
      var key = String(o.id || o.track || o.packageId || Math.random());
      if (!map[key]) map[key] = o;
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  function noteJson(data, url) {
    lastJsonHits++;
    try {
      var keys = data && typeof data === 'object' ? Object.keys(data).slice(0, 12).join(',') : typeof data;
      lastHint = (url || '').slice(-60) + ' | ' + keys;
      if (looksLikeOrder(data) || (data && (data.data || data.list || data.rows || data.records))) {
        console.log('[StockFlow Bridge] JSON hit', url || '', keys);
      }
    } catch (e) {}
  }

  function ingestPayload(data, url) {
    if (data == null) return;
    noteJson(data, url);
    var found = extractOrdersFromJson(data);
    if (found.length) {
      captured = mergeUnique(captured.concat(found));
      console.log('[StockFlow Bridge] captured +' + found.length + ' total=' + captured.length, found[0] && found[0].id);
      heartbeat('cached ' + captured.length);
      showBadge('cached ' + captured.length);
    }
  }

  function matchPlatform(orderPlat, allowed) {
    if (!allowed || !allowed.length) return true;
    var p = String(orderPlat || '').toLowerCase();
    var hit = false, other = false;
    allowed.forEach(function (a) {
      var x = String(a).toLowerCase();
      if (x === 'other') other = true;
      else if (p.indexOf(x) >= 0) hit = true;
    });
    if (hit) return true;
    if (other) {
      var known = ['shopee', 'lazada', 'tiktok', 'facebook', 'fb'];
      return !known.some(function (k) { return p.indexOf(k) >= 0; });
    }
    if (!p) return true;
    return false;
  }

  function matchPrintFilter(order, filter) {
    filter = filter || 'all';
    if (filter === 'all') return true;
    var pr = String(order.printStatus || '').toLowerCase();
    var sh = String(order.shipStatus || '').toLowerCase();
    var printed = /print|printed|1|true|yes|done|already/.test(pr) || !!order.printedAt || !!order.track;
    var shipped = /ship|dispatch|handover|picked|in_transit|delivered/.test(sh);
    var notPrinted = /unprint|not.?print|0|false|no/.test(pr);
    if (filter === 'printed_not_shipped') {
      if (shipped) return false;
      if (printed || order.track) return true;
      if (!pr && !sh) return true;
      return false;
    }
    if (filter === 'printed') return printed || !!order.track || (!pr && !notPrinted);
    if (filter === 'not_printed') return notPrinted || (!printed && !order.track);
    return true;
  }

  function startOfLocalDay(d) {
    var x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  }

  function parseAnyTime(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return v < 1e12 ? v * 1000 : v;
    var s = String(v).trim();
    if (/^\d{10,13}$/.test(s)) {
      var n = parseInt(s, 10);
      return n < 1e12 ? n * 1000 : n;
    }
    var t = Date.parse(s);
    return isNaN(t) ? null : t;
  }

  function matchDayRange(order, dayRange) {
    dayRange = parseInt(dayRange, 10);
    if (isNaN(dayRange) || dayRange < 0) dayRange = 0;
    if (dayRange > 7) dayRange = 7;
    var ts = parseAnyTime(order.printedAt) || parseAnyTime(order.orderAt);
    if (ts == null) return true;
    var today0 = startOfLocalDay(Date.now());
    var from = today0 - dayRange * 24 * 60 * 60 * 1000;
    var to = today0 + 24 * 60 * 60 * 1000 - 1;
    return ts >= from && ts <= to;
  }

  function applyPullFilters(list, req) {
    req = req || {};
    var plats = req.platforms || [];
    var pf = req.printFilter || 'all';
    var dayRange = req.dayRange != null ? req.dayRange : 0;
    return (list || []).filter(function (o) {
      return matchPlatform(o.platform, plats) && matchPrintFilter(o, pf) && matchDayRange(o, dayRange);
    });
  }

  function pushOrders(orderList, pullAt) {
    var base = pathBase();
    if (!base) {
      alert('Set Workspace in StockFlow Bridge first.');
      return Promise.resolve();
    }
    var payload = {};
    orderList.forEach(function (o) {
      var id = String(o.id || o.track || o.packageId).toUpperCase().replace(/\s+/g, '');
      if (!id) return;
      payload[id] = {
        id: o.id || '', track: o.track || '', packageId: o.packageId || '',
        platform: o.platform || '', lines: o.lines,
        updatedAt: Date.now(), source: 'bigseller-bridge'
      };
    });
    var count = Object.keys(payload).length;
    return fbPut(base + '/bsOrders', payload).then(function () {
      return fbPut(base + '/bsBridge/lastPull', {
        at: Date.now(), ok: count > 0, count: count, pullRequestAt: pullAt || 0,
        error: count ? '' : 'No matching orders for filters/day range.'
      });
    }).then(function () {
      heartbeat(count ? ('sent ' + count + ' orders') : 'no orders');
      showBadge(count ? ('Sent: ' + count) : 'No matching orders');
    });
  }

  function doPull(pullAt, req) {
    var list = applyPullFilters(mergeUnique(captured), req || {});
    return pushOrders(list, pullAt);
  }

  function hookNetwork() {
    try {
      var origFetch = window.fetch;
      if (origFetch && !window.__sfFetchHooked) {
        window.__sfFetchHooked = true;
        window.fetch = function () {
          var args = arguments;
          var reqUrl = '';
          try {
            if (typeof args[0] === 'string') reqUrl = args[0];
            else if (args[0] && args[0].url) reqUrl = args[0].url;
          } catch (e0) {}
          return origFetch.apply(this, args).then(function (res) {
            try {
              var clone = res.clone();
              clone.text().then(function (t) {
                if (!t || t.length < 2 || t.length > 8000000) return;
                var c0 = t.charAt(0);
                if (c0 !== '{' && c0 !== '[') return;
                try { ingestPayload(JSON.parse(t), reqUrl); } catch (e1) {}
              }).catch(function () {});
            } catch (e) {}
            return res;
          });
        };
      }
    } catch (eF) {}

    try {
      if (!XMLHttpRequest.prototype.__sfHooked) {
        XMLHttpRequest.prototype.__sfHooked = true;
        var XO = XMLHttpRequest.prototype.open;
        var XS = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function () {
          try { this.__sfUrl = arguments[1]; } catch (e) {}
          return XO.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function () {
          this.addEventListener('load', function () {
            try {
              var t = this.responseText;
              if (!t || t.length < 2 || t.length > 8000000) return;
              var c0 = t.charAt(0);
              if (c0 !== '{' && c0 !== '[') return;
              ingestPayload(JSON.parse(t), this.__sfUrl || '');
            } catch (e) {}
          });
          return XS.apply(this, arguments);
        };
      }
    } catch (eX) {}
  }

  function pollBridge() {
    var base = pathBase();
    if (!base) return;
    fbGet(base + '/bsBridge/pullRequest').then(function (req) {
      if (!req || !req.at) return;
      if (req.at <= lastPullHandled) return;
      if (req.status === 'done') return;
      lastPullHandled = req.at;
      heartbeat('pulling...');
      doPull(req.at, req).then(function () {
        return fbPut(base + '/bsBridge/pullRequest', Object.assign({}, req, { status: 'done', doneAt: Date.now() }));
      }).catch(function () { lastPullHandled = 0; });
    }).catch(function () {});
  }

  function showBadge(msg) {
    var m = document.getElementById('sf-bs-msg');
    if (m) m.textContent = msg;
  }

  function ensureFloatingUi() {
    if (document.getElementById('sf-bs-float')) return true;
    var host = document.body || document.documentElement;
    if (!host) return false;

    var el = document.createElement('div');
    el.id = 'sf-bs-float';
    el.setAttribute('data-sf-bridge', '1.3.3');
    el.style.cssText = [
      'all:initial',
      'position:fixed',
      'z-index:2147483647',
      'right:12px',
      'bottom:12px',
      'background:#0C0E12',
      'color:#fff',
      'padding:12px 14px',
      'border-radius:14px',
      'font:13px/1.4 system-ui,-apple-system,sans-serif',
      'box-shadow:0 8px 28px rgba(0,0,0,.45)',
      'max-width:300px',
      'min-width:220px',
      'border:2px solid #2563eb',
      'pointer-events:auto'
    ].join(';');
    el.innerHTML =
      '<div style="all:initial;display:block;font:700 13px system-ui,sans-serif;color:#fff;margin-bottom:6px">StockFlow Bridge v1.3.3</div>' +
      '<div id="sf-bs-msg" style="all:initial;display:block;font:12px system-ui,sans-serif;color:#cbd5e1;margin-bottom:8px;line-height:1.35">starting\u2026</div>' +
      '<button id="sf-bs-send" type="button" style="all:initial;display:block;width:100%;box-sizing:border-box;padding:10px;border:0;border-radius:10px;background:#2563eb;color:#fff;font:700 13px system-ui,sans-serif;cursor:pointer;text-align:center">Send orders to StockFlow</button>' +
      '<button id="sf-bs-cfg" type="button" style="all:initial;display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:8px;border:0;border-radius:10px;background:#334155;color:#fff;font:12px system-ui,sans-serif;cursor:pointer;text-align:center">Set Workspace</button>';

    try { host.appendChild(el); } catch (e) { return false; }

    var sendBtn = document.getElementById('sf-bs-send');
    var cfgBtn = document.getElementById('sf-bs-cfg');
    if (sendBtn) {
      sendBtn.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (!getCfg().wsKey) { showBadge('Set Workspace first'); return; }
        doPull(Date.now(), {});
      }, true);
    }
    if (cfgBtn) {
      cfgBtn.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var ws = prompt('Workspace key from StockFlow (e.g. 54A39201)', getCfg().wsKey || '');
        if (ws == null) return;
        var room = prompt('Room (e.g. WH_A)', getCfg().room || 'WH_A');
        setCfg(String(ws).trim(), String(room || 'WH_A').trim());
        lastPullHandled = 0;
        heartbeat('configured');
        showBadge('WS: ' + getCfg().wsKey + ' \u00b7 ' + getCfg().room);
        setTimeout(pollBridge, 400);
      }, true);
    }
    return true;
  }

  function bootUi() {
    uiTries++;
    var ok = ensureFloatingUi();
    if (ok) {
      var c = getCfg();
      showBadge(c.wsKey ? ('WS: ' + c.wsKey + ' \u00b7 ' + c.room) : 'Set Workspace first');
      return;
    }
    if (uiTries < 50) setTimeout(bootUi, 400);
  }

  try { hookNetwork(); } catch (e) {}

  function startUiWhenReady() {
    if (document.body) bootUi();
    else setTimeout(startUiWhenReady, 50);
  }
  startUiWhenReady();

  setInterval(function () {
    if (!document.getElementById('sf-bs-float')) {
      uiTries = 0;
      bootUi();
    }
  }, 2000);

  function tick() {
    var c = getCfg();
    var msg;
    if (!c.wsKey) msg = 'Set Workspace first';
    else if (captured.length) msg = 'WS:' + c.wsKey + ' \u00b7 ' + c.room + ' \u00b7 ' + captured.length + ' cached';
    else msg = 'WS:' + c.wsKey + ' \u00b7 hits:' + lastJsonHits + ' \u00b7 waiting list';
    showBadge(msg);
    heartbeat(captured.length ? ('cached ' + captured.length) : ('hits ' + lastJsonHits));
    pollBridge();
  }

  setInterval(tick, 3000);
  setTimeout(pollBridge, 800);
  setTimeout(pollBridge, 2500);

  try { console.log('[StockFlow Bridge 1.3.3] loaded on', location.href); } catch (e) {}
})();
