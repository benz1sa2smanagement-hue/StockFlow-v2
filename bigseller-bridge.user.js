// ==UserScript==
// @name         StockFlow BigSeller Bridge
// @namespace    https://benz1sa2smanagement-hue.github.io/StockFlow-v2/
// @version      1.3.0
// @description  Pull orders from logged-in BigSeller tab into StockFlow via Firebase
// @match        https://*.bigseller.com/*
// @match        https://www.bigseller.com/*
// @match        https://bigseller.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      kiyomi-b19d0-default-rtdb.asia-southeast1.firebasedatabase.app
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';
  var DB = 'https://kiyomi-b19d0-default-rtdb.asia-southeast1.firebasedatabase.app';
  var captured = [];
  var lastPullHandled = 0;

  function getCfg() {
    return {
      wsKey: GM_getValue('sf_ws', '') || localStorage.getItem('sf_bridge_ws') || '',
      room: GM_getValue('sf_room', '') || localStorage.getItem('sf_bridge_room') || 'WH_A'
    };
  }
  function setCfg(ws, room) {
    GM_setValue('sf_ws', ws || '');
    GM_setValue('sf_room', room || 'WH_A');
    try {
      localStorage.setItem('sf_bridge_ws', ws || '');
      localStorage.setItem('sf_bridge_room', room || 'WH_A');
    } catch (e) {}
  }
  function pathBase() {
    var c = getCfg();
    if (!c.wsKey) return '';
    return 'ws_' + c.wsKey + '/rooms/' + (c.room || 'WH_A');
  }
  function gmFetch(url, method, body) {
    return new Promise(function (resolve, reject) {
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
    if (!base) return;
    fbPut(base + '/bsBridge/status', {
      onlineAt: Date.now(), page: location.pathname + location.search,
      message: msg || '', href: location.href
    }).catch(function () {});
  }

  function norm(v) { return String(v || '').trim(); }

  function extractOrdersFromJson(data, depth) {
    depth = depth || 0;
    if (depth > 6 || data == null) return [];
    var out = [];
    if (Array.isArray(data)) {
      data.forEach(function (item) { out = out.concat(extractOrdersFromJson(item, depth + 1)); });
      return out;
    }
    if (typeof data !== 'object') return out;

    var id = data.orderId || data.order_id || data.orderNo || data.order_no || data.orderNumber ||
      data.order_number || data.platformOrderId || data.packageId || data.package_id ||
      data.trackingNumber || data.tracking_number || data.bsCode || data.bs_code || data.id;
    var items = data.items || data.orderItems || data.order_items || data.skus || data.productList ||
      data.products || data.details || data.lineItems;

    if (id && items && Array.isArray(items) && items.length) {
      var lines = items.map(function (it) {
        return {
          skuId: norm(it.sellerSku || it.seller_sku || it.sku || it.skuId || it.merchantSku || it.msku || it.productSku || ''),
          name: norm(it.productName || it.product_name || it.name || it.title || it.skuName || ''),
          qty: parseInt(it.quantity || it.qty || it.amount || 1, 10) || 1,
          unitSku: norm(it.sellerSku || it.sku || ''),
          barcode: norm(it.barcode || it.ean || ''),
          matched: false
        };
      }).filter(function (l) { return l.skuId || l.name; });
      if (lines.length) {
        out.push({
          id: String(id),
          track: norm(data.trackingNumber || data.tracking_number || data.trackingNo || ''),
          packageId: norm(data.packageId || data.package_id || data.bsCode || ''),
          platform: norm(data.platform || data.channel || data.shopName || data.marketplace || data.site || ''),
          printStatus: norm(data.printStatus || data.labelPrintStatus || data.print_status || data.isPrint || data.printed || ''),
          shipStatus: norm(data.shippingStatus || data.shipStatus || data.packageStatus || data.orderStatus || data.statusName || data.status || ''),
          printedAt: data.printTime || data.printedAt || data.labelPrintTime || data.printDate || null,
          orderAt: data.orderTime || data.createTime || data.createdAt || data.payTime || data.paymentTime || data.orderDate || data.gmtCreate || null,
          lines: lines
        });
      }
    }

    Object.keys(data).forEach(function (k) {
      if (k === 'items' || k === 'orderItems') return;
      var v = data[k];
      if (v && typeof v === 'object') out = out.concat(extractOrdersFromJson(v, depth + 1));
    });
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
    if (ts == null) return true; // keep if unknown date
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
    var origFetch = window.fetch;
    if (origFetch && !window.__sfFetchHooked) {
      window.__sfFetchHooked = true;
      window.fetch = function () {
        return origFetch.apply(this, arguments).then(function (res) {
          try {
            var clone = res.clone();
            clone.json().then(function (data) {
              var found = extractOrdersFromJson(data);
              if (found.length) {
                captured = mergeUnique(captured.concat(found));
                heartbeat('cached ' + captured.length);
              }
            }).catch(function () {});
          } catch (e) {}
          return res;
        });
      };
    }
    if (!XMLHttpRequest.prototype.__sfHooked) {
      XMLHttpRequest.prototype.__sfHooked = true;
      var XO = XMLHttpRequest.prototype.open;
      var XS = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function () {
        this.__sfUrl = arguments[1];
        return XO.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function () {
        this.addEventListener('load', function () {
          try {
            var t = this.responseText;
            if (!t || t.length < 20 || t.length > 5000000) return;
            if (t[0] !== '{' && t[0] !== '[') return;
            var found = extractOrdersFromJson(JSON.parse(t));
            if (found.length) {
              captured = mergeUnique(captured.concat(found));
              heartbeat('cached ' + captured.length);
            }
          } catch (e) {}
        });
        return XS.apply(this, arguments);
      };
    }
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
      });
    }).catch(function () {});
  }

  function ensureFloatingUi() {
    if (document.getElementById('sf-bs-float')) return;
    var el = document.createElement('div');
    el.id = 'sf-bs-float';
    el.style.cssText = 'position:fixed;z-index:2147483646;right:16px;bottom:16px;background:#0C0E12;color:#fff;padding:12px 14px;border-radius:14px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:280px';
    el.innerHTML =
      '<div style="font-weight:700;margin-bottom:6px">StockFlow Bridge</div>' +
      '<div id="sf-bs-msg" style="opacity:.85;font-size:12px;margin-bottom:8px">connecting...</div>' +
      '<button id="sf-bs-send" style="width:100%;padding:10px;border:0;border-radius:10px;background:#2563eb;color:#fff;font-weight:700;cursor:pointer">Send orders to StockFlow</button>' +
      '<button id="sf-bs-cfg" style="width:100%;margin-top:6px;padding:8px;border:0;border-radius:10px;background:#333;color:#fff;cursor:pointer">Set Workspace</button>';
    document.body.appendChild(el);
    document.getElementById('sf-bs-send').addEventListener('click', function () { doPull(Date.now(), {}); });
    document.getElementById('sf-bs-cfg').addEventListener('click', function () {
      var ws = prompt('Workspace key', getCfg().wsKey || '');
      if (ws == null) return;
      var room = prompt('Room', getCfg().room || 'WH_A');
      setCfg(String(ws).trim(), String(room || 'WH_A').trim());
      heartbeat('configured');
      showBadge('Workspace saved');
    });
  }

  function showBadge(msg) {
    var m = document.getElementById('sf-bs-msg');
    if (m) m.textContent = msg;
  }

  hookNetwork();
  ensureFloatingUi();
  heartbeat('ready');
  showBadge(getCfg().wsKey ? ('WS: ' + getCfg().wsKey) : 'Set Workspace first');
  setInterval(function () {
    heartbeat(captured.length ? ('cached ' + captured.length) : 'open To Pack / printed list');
    pollBridge();
  }, 4000);
})();
