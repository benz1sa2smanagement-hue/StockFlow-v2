// ==UserScript==
// @name         StockFlow BigSeller Bridge
// @namespace    https://benz1sa2smanagement-hue.github.io/StockFlow-v2/
// @version      1.3.6
// @description  Auto-pair + auto-send BigSeller orders to StockFlow via Firebase
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
  var lastAutoSendAt = 0;
  var lastCapturedCount = 0;

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

  function autoPairFromStockFlow() {
    return fbGet('bsBridgePairing/active').then(function (info) {
      if (!info || !info.wsKey) return false;
      if (info.updatedAt && (Date.now() - Number(info.updatedAt) > 15 * 60 * 1000)) return false;
      var cur = getCfg();
      var nextWs = String(info.wsKey || '').trim().replace(/^WS-/i, '');
      var nextRoom = String(info.room || 'WH_A').trim() || 'WH_A';
      if (!nextWs) return false;
      if (cur.wsKey !== nextWs || cur.room !== nextRoom) {
        setCfg(nextWs, nextRoom);
        lastPullHandled = 0;
        console.log('[StockFlow Bridge] auto-paired', nextWs, nextRoom);
        showBadge('Auto: ' + nextWs + ' \u00b7 ' + nextRoom);
        heartbeat('auto-paired');
      }
      return true;
    }).catch(function () { return false; });
  }

  function autoSendIfNeeded() {
    if (!getCfg().wsKey) return;
    if (!captured.length) return;
    var now = Date.now();
    var grew = captured.length > lastCapturedCount;
    if (!grew && now - lastAutoSendAt < 20000) return;
    lastCapturedCount = captured.length;
    lastAutoSendAt = now;
    doPull(now, { printFilter: 'all', dayRange: 7, platforms: [] });
  }

  function heartbeat(msg) {
    var base = pathBase();
    if (!base) return Promise.resolve();
    var sample = null;
    if (captured.length) {
      var o = captured[0];
      sample = {
        id: o.id || '', track: o.track || '', platform: o.platform || '',
        printStatus: o.printStatus || '', shipStatus: o.shipStatus || '',
        printedAt: o.printedAt || null, orderAt: o.orderAt || null,
        lines: (o.lines && o.lines.length) || 0
      };
    }
    return fbPut(base + '/bsBridge/status', {
      onlineAt: Date.now(),
      page: location.pathname + location.search,
      message: msg || '',
      href: location.href,
      ver: '1.3.6',
      captured: captured.length,
      jsonHits: lastJsonHits,
      sample: sample
    }).catch(function () {});
  }

  function norm(v) { return String(v == null ? '' : v).trim(); }

  function pickId(data) {
    if (!data || typeof data !== 'object') return '';
    var keys = [
      'packageId', 'package_id', 'packageNo', 'package_no', 'pkgId', 'bsCode', 'bs_code',
      'orderId', 'order_id', 'orderNo', 'order_no', 'orderNumber', 'order_number',
      'platformOrderId', 'platform_order_id', 'platformOrderNo', 'platform_order_no',
      'trackingNumber', 'tracking_number', 'trackingNo', 'tracking_no',
      'shipmentId', 'shipment_id', 'expressNo', 'waybillNo', 'waybill_no'
    ];
    for (var i = 0; i < keys.length; i++) {
      var v = data[keys[i]];
      if (v != null && String(v).trim() !== '' && String(v).trim() !== '0') return String(v).trim();
    }
    if (data.id != null && String(data.id).trim() !== '' && String(data.id).trim() !== '0') {
      return String(data.id).trim();
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
    return { skuId: sku, name: name, qty: qty, unitSku: sku, barcode: norm(it.barcode || it.ean || it.upc || ''), matched: false };
  }

  function fallbackLines(data) {
    var sku = norm(data.sellerSku || data.sku || data.skuId || data.merchantSku || data.productSku || data.outerSku || data.mainSku || '');
    var name = norm(data.productName || data.product_name || data.itemName || data.title || data.skuName || data.goodsName || data.mainProductName || '');
    var qty = parseInt(data.quantity || data.qty || data.itemCount || data.totalQty || 1, 10) || 1;
    if (!sku && !name) return [];
    return [{ skuId: sku, name: name || sku, qty: qty, unitSku: sku, barcode: '', matched: false }];
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
    } else if (id) {
      var fl = fallbackLines(data);
      if (!fl.length && (data.itemCount || data.skuCount || data.productCount || data.totalQty)) {
        fl = [{ skuId: '', name: '(\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e08\u0e32\u0e01 BigSeller)', qty: parseInt(data.itemCount || data.skuCount || data.productCount || data.totalQty || 1, 10) || 1, unitSku: '', barcode: '', matched: false }];
      }
      if (fl.length) {
        out.push({
          id: String(id),
          track: norm(data.trackingNumber || data.tracking_number || data.trackingNo || data.tracking_no || data.expressNo || ''),
          packageId: norm(data.packageId || data.package_id || data.packageNo || data.bsCode || ''),
          platform: norm(data.platform || data.channel || data.shopName || data.shop_name || data.marketplace || ''),
          printStatus: norm(data.printStatus || data.isPrint || data.labelPrintStatus || ''),
          shipStatus: norm(data.shippingStatus || data.orderStatus || data.statusName || data.status || ''),
          printedAt: data.printTime || data.printedAt || null,
          orderAt: data.orderTime || data.createTime || data.createdAt || data.payTime || null,
          lines: fl
        });
      }
    }

    var childKeys = ['data', 'result', 'rows', 'list', 'records', 'content', 'pageData', 'orderList', 'orders', 'packages', 'packageList'];
    childKeys.forEach(function (k) {
      if (data[k] && typeof data[k] === 'object') out = out.concat(extractOrdersFromJson(data[k], depth + 1));
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

  function orderKey(o) {
    if (!o) return '';
    var pkg = String(o.packageId || '').trim().toUpperCase().replace(/\s+/g, '');
    var track = String(o.track || '').trim().toUpperCase().replace(/\s+/g, '');
    var id = String(o.id || '').trim().toUpperCase().replace(/\s+/g, '');
    if (pkg) return 'P:' + pkg;
    if (track) return 'T:' + track;
    if (id) return 'I:' + id;
    return '';
  }
  function mergeUnique(list) {
    var map = {};
    var skipped = 0;
    (list || []).forEach(function (o) {
      if (!o) return;
      if (!o.lines || !o.lines.length) { skipped++; return; }
      var key = orderKey(o);
      if (!key) { skipped++; return; }
      var prev = map[key];
      if (!prev) {
        map[key] = o;
        return;
      }
      var score = function (x) {
        return (x.lines ? x.lines.length : 0) * 10 + (x.track ? 3 : 0) + (x.packageId ? 2 : 0) + (x.platform ? 1 : 0);
      };
      if (score(o) >= score(prev)) map[key] = o;
    });
    if (skipped) console.log('[StockFlow Bridge] merge skipped (no lines/key):', skipped);
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  function noteJson(data, url) {
    lastJsonHits++;
    try {
      var keys = data && typeof data === 'object' ? Object.keys(data).slice(0, 12).join(',') : typeof data;
      lastHint = (url || '').slice(-60) + ' | ' + keys;
    } catch (e) {}
  }

  function ingestPayload(data, url) {
    if (data == null) return;
    noteJson(data, url);
    var found = extractOrdersFromJson(data);
    if (found.length) {
      var before = captured.length;
      captured = mergeUnique(captured.concat(found));
      var added = captured.length - before;
      console.log('[StockFlow Bridge] found=' + found.length + ' added=' + added + ' total=' + captured.length, found[0] && (found[0].packageId || found[0].id));
      heartbeat('cached ' + captured.length);
      showBadge('cached ' + captured.length + (added ? ' (+' + added + ')' : ''));
      try { autoSendIfNeeded(); } catch (eA) {}
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
    var printed = (/print|printed|already|done|yes|true|1|y/.test(pr) || pr === '2' || pr === '3' || !!order.printedAt || !!order.track);
    var shipped = /ship|dispatch|handover|picked|in_transit|delivered|complete|success/.test(sh);
    var notPrinted = /unprint|not.?print|no.?print|false|0|n/.test(pr);
    if (filter === 'printed_not_shipped') {
      if (shipped) return false;
      return true;
    }
    if (filter === 'printed') return printed || !!order.track || (!notPrinted);
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
    from -= 24 * 60 * 60 * 1000;
    to += 24 * 60 * 60 * 1000;
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
    if (!base) return Promise.resolve();
    var payload = {};
    orderList.forEach(function (o) {
      var id = String(o.packageId || o.track || o.id || '').toUpperCase().replace(/\s+/g, '');
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
    el.setAttribute('data-sf-bridge', '1.3.6');
    el.style.cssText = 'all:initial;position:fixed;z-index:2147483647;right:12px;bottom:12px;background:#0C0E12;color:#fff;padding:12px 14px;border-radius:14px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.45);max-width:300px;min-width:220px;border:2px solid #2563eb;pointer-events:auto';
    el.innerHTML =
      '<div style="all:initial;display:block;font:700 13px system-ui,sans-serif;color:#fff;margin-bottom:6px">StockFlow Bridge v1.3.6</div>' +
      '<div id="sf-bs-msg" style="all:initial;display:block;font:12px system-ui,sans-serif;color:#cbd5e1;margin-bottom:8px;line-height:1.4">Starting\u2026</div>' +
      '<div style="all:initial;display:block;font:11px system-ui,sans-serif;color:#94a3b8">Open New + In Process order pages to capture</div>';
    host.appendChild(el);
    return true;
  }

  function tickUi() {
    uiTries++;
    if (!ensureFloatingUi() && uiTries < 40) setTimeout(tickUi, 250);
  }

  function boot() {
    hookNetwork();
    tickUi();
    setInterval(function () {
      autoPairFromStockFlow();
      pollBridge();
      heartbeat('ok');
      autoSendIfNeeded();
    }, 4000);
    autoPairFromStockFlow();
    setTimeout(function () { heartbeat('boot'); }, 800);
  }

  hookNetwork();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  setTimeout(tickUi, 100);
  setTimeout(tickUi, 500);
  setTimeout(tickUi, 1500);
})();
