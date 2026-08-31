(function () {
  'use strict';
  var DB = 'https://kiyomi-b19d0-default-rtdb.asia-southeast1.firebasedatabase.app';
  var PC_LEN = 6;
  var WH_DEFAULTS = [
    { id: 'WH_A', label: 'คลัง A', badge: 'a' },
    { id: 'WH_B', label: 'คลัง B', badge: 'b' },
    { id: 'WH_C', label: 'คลัง C', badge: 'c' }
  ];
  var AW_VALUE_USERS = ['นารินทร์', 'เบ้น'];
  var pcBuffer = '';
  var currentWsKey = '', room = 'WH_A', user = '';
  var skus = {}, movements = {}, movArr = [];
  var warehouses = WH_DEFAULTS.slice();
  var pollTimer = null, chart = null, lastChartKey = '';
  var outDetailDate = null, chOutPie = null, chOutBar = null, chOutPlat = null;

  function hashCode(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return ('0000000' + (h >>> 0).toString(16)).slice(-8).toUpperCase();
  }
  function canSeeValue() {
    return AW_VALUE_USERS.some(function (n) { return user.trim() === n; });
  }
  function isValueUser(u) {
    return AW_VALUE_USERS.some(function (n) { return (u || '').trim() === n; });
  }
  function fmtB(n) { return '฿' + Math.round(n || 0).toLocaleString('th-TH'); }
  function maskB(n) { return canSeeValue() ? fmtB(n) : '••••'; }
  function toast(msg, type) {
    var w = document.getElementById('toast-wrap');
    var t = document.createElement('div');
    t.className = 'toast' + (type === 'ok' ? ' ok' : type === 'err' ? ' err' : '');
    t.textContent = msg;
    w.innerHTML = '';
    w.appendChild(t);
    setTimeout(function () { t.remove(); }, 2500);
  }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function updateDots() {
    var dots = document.querySelectorAll('#pc-dots .pc-dot');
    for (var i = 0; i < dots.length; i++) {
      dots[i].className = 'pc-dot' + (i < pcBuffer.length ? ' on' : '');
    }
  }
  function pcKey(d) {
    if (pcBuffer.length >= PC_LEN) return;
    pcBuffer += d;
    updateDots();
    if (pcBuffer.length === PC_LEN) setTimeout(confirmPasscode, 160);
  }
  function pcDel() {
    if (pcBuffer.length) {
      pcBuffer = pcBuffer.slice(0, -1);
      updateDots();
    }
  }
  function buildPasscodeUI() {
    var dotsEl = document.getElementById('pc-dots');
    var padEl = document.getElementById('pc-pad');
    if (!dotsEl || !padEl) return;
    dotsEl.innerHTML = '';
    padEl.innerHTML = '';
    for (var i = 0; i < 6; i++) {
      var d = document.createElement('div');
      d.className = 'pc-dot';
      dotsEl.appendChild(d);
    }
    var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
    keys.forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pc-key' + (k === '' ? ' ghost' : '');
      b.textContent = k === 'del' ? '⌫' : k;
      if (k !== '') {
        b.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          if (k === 'del') pcDel(); else pcKey(k);
        });
      }
      padEl.appendChild(b);
    });
  }
  function confirmPasscode() {
    currentWsKey = hashCode(pcBuffer);
    pcBuffer = '';
    updateDots();
    document.getElementById('passcode-screen').style.display = 'none';
    document.getElementById('ws-display').textContent = 'WS-' + currentWsKey;
    var saved = localStorage.getItem('sf_user_' + currentWsKey);
    if (saved) {
      user = saved;
      startApp();
    } else {
      document.getElementById('login-screen').style.display = 'flex';
      setTimeout(function () {
        var inp = document.getElementById('login-name');
        if (inp) inp.focus();
      }, 200);
    }
  }
  function backToPasscode() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('passcode-screen').style.display = 'flex';
    pcBuffer = '';
    updateDots();
    currentWsKey = '';
  }
  function doLogin() {
    var n = document.getElementById('login-name').value.trim();
    if (!n) { toast('กรุณากรอกชื่อ', 'err'); return; }
    user = n;
    localStorage.setItem('sf_user_' + currentWsKey, n);
    document.getElementById('login-screen').style.display = 'none';
    startApp();
  }

  function api(p, opt) {
    opt = opt || {};
    return fetch(DB + '/' + p + '.json', Object.assign({ cache: 'no-store' }, opt)).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }
  function rp() { return 'ws_' + currentWsKey + '/rooms/' + room; }
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
  function effCost(s) { return (s.costPrice || 0) + (s.shippingCost || 0); }
  function bU(s) { return (s && s.baseUnit) || 'แพ็ค'; }
  function cU(s) { return (s && s.caseUnit) || 'ลัง'; }
  function fmtStock(qty, s) {
    var bu = bU(s), cu = cU(s), ppc = (s && s.piecesPerCase) || 1;
    if (ppc > 1) {
      var cases = Math.floor(qty / ppc), rem = qty % ppc, t = '';
      if (cases > 0) t += cases + ' ' + cu;
      if (rem > 0) t += (cases > 0 ? ' + ' : '') + rem + ' ' + bu;
      if (!t) t = '0 ' + bu;
      return { main: t, sub: 'รวม ' + qty.toLocaleString() + ' ' + bu };
    }
    return { main: qty.toLocaleString() + ' ' + bu, sub: '' };
  }

  function poll() {
    Promise.all([api(rp() + '/skus'), api(rp() + '/movements')]).then(function (res) {
      skus = res[0] || {};
      movements = res[1] || {};
      movArr = Object.entries(movements).sort(function (a, b) {
        return (b[1].createdAt || 0) - (a[1].createdAt || 0);
      });
      updateDash();
    }).catch(function (e) { console.warn(e); });
  }

  function updateDash() {
    var today = todayStr(), cnt = 0, tin = 0, tout = 0;
    Object.values(movements).forEach(function (m) {
      if ((m.date || '').slice(0, 10) === today) {
        cnt++;
        if (m.type === 'in' && !m.isTransferIn) tin += m.pieces;
        else if (m.type === 'out' || m.type === 'transfer') tout += m.pieces;
      }
    });
    document.getElementById('s-today').textContent = cnt.toLocaleString();
    document.getElementById('s-sku').textContent = Object.keys(skus).length.toLocaleString();
    document.getElementById('s-in').textContent = tin.toLocaleString();
    document.getElementById('s-out').textContent = tout.toLocaleString();
    var sm = computeStock(movements);
    var ents = Object.entries(sm).filter(function (e) { return e[1] !== 0; }).sort(function (a, b) { return b[1] - a[1]; });
    document.getElementById('stock-count').textContent = ents.length + ' รายการ';
    var list = document.getElementById('stock-list');
    if (!ents.length) list.innerHTML = '<div class="empty">ยังไม่มีสต็อก</div>';
    else list.innerHTML = ents.slice(0, 10).map(function (pair) {
      var s = skus[pair[0]] || {}, f = fmtStock(pair[1], s);
      return '<div class="list-row"><div class="list-icon">📦</div><div class="list-body"><div class="list-name">' + (s.name || pair[0]) + '</div><div class="list-meta">' + bU(s) + (s.piecesPerCase > 1 ? ' · ' + s.piecesPerCase + ' ' + bU(s) + '/' + cU(s) : '') + '</div></div><div class="list-qty"><div>' + f.main + '</div>' + (f.sub ? '<div class="list-qty-sub">' + f.sub + '</div>' : '') + '</div></div>';
    }).join('');
    var recent = document.getElementById('recent-list');
    var items = movArr.slice(0, 5);
    if (!items.length) recent.innerHTML = '<div class="empty">ยังไม่มีรายการ</div>';
    else recent.innerHTML = items.map(function (pair) {
      var m = pair[1], s = skus[m.skuId] || {};
      var isIn = m.type === 'in', isOut = m.type === 'out' || m.type === 'transfer';
      var dot = isIn ? 'g' : isOut ? 'r' : 'o';
      var pfx = isIn ? '+' : isOut ? '−' : '';
      var cls = isIn ? 'pos' : isOut ? 'neg' : '';
      var label = isIn ? 'รับเข้า' : isOut ? 'จ่ายออก' : 'ปรับสต็อก';
      var time = (m.date || '').slice(11, 16) || '';
      return '<div class="list-row"><div class="dot ' + dot + '"></div><div class="list-body"><div class="list-name">' + label + ': ' + (s.name || m.skuId) + '</div><div class="list-meta">' + time + ' · ' + (m.user || '-') + '</div></div><div class="list-qty ' + cls + '">' + pfx + m.pieces + '</div></div>';
    }).join('');
    updateChart(ents.slice(0, 6));
    updateProducts(ents);
  }

  function updateChart(ents) {
    var rawLabels = ents.map(function (p) {
      return (skus[p[0]] || {}).name || p[0];
    });
    var labels = rawLabels.map(function (n) {
      if (n.length <= 18) return n;
      return n.slice(0, 8) + '…' + n.slice(-7);
    });
    var data = ents.map(function (p) { return Math.max(0, p[1]); });
    var key = rawLabels.join('|') + '::' + data.join(',');
    var ctx = document.getElementById('stock-chart');
    if (!ctx) return;
    if (key === lastChartKey && chart) return;
    lastChartKey = key;
    if (chart) { try { chart.destroy(); } catch (e) {} chart = null; }
    if (!ents.length) return;
    chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: '#0F1620',
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 22
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        layout: { padding: { left: 4, right: 8 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: function (items) {
                var i = items[0].dataIndex;
                return rawLabels[i] || items[0].label;
              },
              label: function (item) {
                return ' ' + item.raw.toLocaleString() + ' แพ็ค';
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: '#E8E4DC' },
            ticks: { font: { size: 10, family: 'IBM Plex Mono' }, color: '#3D4654' }
          },
          y: {
            grid: { display: false },
            ticks: {
              font: { size: 11, family: 'Sarabun' },
              color: '#121820',
              autoSkip: false,
              crossAlign: 'far'
            }
          }
        }
      }
    });
  }

  function updateProducts(ents) {
    var el = document.getElementById('prod-list');
    if (!ents.length) { el.innerHTML = '<div class="empty">ยังไม่มีสินค้า</div>'; return; }
    el.innerHTML = ents.map(function (pair) {
      var s = skus[pair[0]] || {}, f = fmtStock(pair[1], s);
      var ppc = s.piecesPerCase || 1;
      var meta = (s.unitSku || pair[0].slice(0, 12)) + (ppc > 1 ? ' · ' + ppc + ' ' + bU(s) + '/' + cU(s) : '');
      return '<div class="list-row"><div class="list-icon">📦</div><div class="list-body"><div class="list-name">' + (s.name || pair[0]) + '</div><div class="list-meta">' + meta + '</div></div><div class="list-qty"><div>' + f.main + '</div>' + (f.sub ? '<div class="list-qty-sub">' + f.sub + '</div>' : '') + '</div></div>';
    }).join('');
  }

  function loadOverview() {
    document.getElementById('aw-ws').textContent = currentWsKey;
    var today = todayStr(), totalIn = 0, totalOut = 0, totalCost = 0, totalSale = 0, totalSold = 0, nameSet = {}, html = '', i = 0;
    function next() {
      if (i >= warehouses.length) {
        document.getElementById('aw-sku').textContent = Object.keys(nameSet).length.toLocaleString();
        document.getElementById('aw-in').textContent = totalIn.toLocaleString();
        document.getElementById('aw-out').textContent = totalOut.toLocaleString();
        document.getElementById('aw-cost').textContent = maskB(totalCost);
        document.getElementById('aw-sale').textContent = maskB(totalSale);
        document.getElementById('aw-profit').textContent = maskB(totalSale - totalCost);
        document.getElementById('aw-sold').textContent = maskB(totalSold);
        document.getElementById('aw-wh-list').innerHTML = html || '<div class="empty">ไม่มีข้อมูล</div>';
        return;
      }
      var wh = warehouses[i++];
      Promise.all([
        api('ws_' + currentWsKey + '/rooms/' + wh.id + '/skus'),
        api('ws_' + currentWsKey + '/rooms/' + wh.id + '/movements')
      ]).then(function (res) {
        var skusW = res[0] || {}, movW = res[1] || {}, sm = computeStock(movW);
        Object.keys(skusW).forEach(function (id) { nameSet[(skusW[id].name || id).trim()] = 1; });
        var whIn = 0, whOut = 0;
        Object.values(movW).forEach(function (mv) {
          if ((mv.date || '').slice(0, 10) === today) {
            if (mv.type === 'in' && !mv.isTransferIn) { whIn += mv.pieces; totalIn += mv.pieces; }
            else if (mv.type === 'out') { whOut += mv.pieces; totalOut += mv.pieces; }
          }
          if (mv.type === 'out' && isValueUser(mv.user)) {
            var sk = skusW[mv.skuId] || {};
            totalSold += mv.pieces * (sk.salePrice || 0);
          }
        });
        Object.entries(sm).forEach(function (e) {
          if (e[1] > 0) {
            var sk = skusW[e[0]] || {};
            totalCost += e[1] * effCost(sk);
            totalSale += e[1] * (sk.salePrice || 0);
          }
        });
        var totalStock = Object.values(sm).reduce(function (a, b) { return a + (b > 0 ? b : 0); }, 0);
        html += '<div class="wh-card"><div class="wh-badge ' + wh.badge + '">' + wh.label.replace('คลัง ', '') + '</div><div class="wh-info"><div class="wh-name">' + wh.label + '</div><div class="wh-meta">SKU ' + Object.keys(skusW).length + ' · สต็อก ' + totalStock + ' · +' + whIn + '/−' + whOut + ' วันนี้</div></div><button type="button" class="wh-btn" data-wh="' + wh.id + '">เปิด</button></div>';
        next();
      }).catch(function () {
        html += '<div class="wh-card"><div class="wh-badge ' + wh.badge + '">?</div><div class="wh-info"><div class="wh-name">' + wh.label + '</div><div class="wh-meta">ไม่มีข้อมูล</div></div></div>';
        next();
      });
    }
    next();
  }

  function showPage(name, el) {
    if (name === 'allwh') {
      document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
      document.getElementById('page-allwh').classList.add('active');
      document.querySelectorAll('.nav-item').forEach(function (b) { b.classList.remove('active'); });
      if (el) el.classList.add('active');
      loadOverview();
      return;
    }
    document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
    var page = document.getElementById('page-' + name);
    if (page) page.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(function (b) { b.classList.remove('active'); });
    if (el) el.classList.add('active');
    if (name === 'dash') poll();
  }
  function switchWarehouse(whId) {
    room = whId;
    localStorage.setItem('sf_room_' + currentWsKey, whId);
    var wh = warehouses.find(function (w) { return w.id === whId; });
    document.getElementById('wh-label').textContent = wh ? wh.label : whId;
    skus = {}; movements = {}; movArr = []; lastChartKey = '';
    if (chart) { try { chart.destroy(); } catch (e) {} chart = null; }
    showPage('dash', document.querySelector('[data-page="dash"]'));
    toast('เปลี่ยนเป็น ' + (wh ? wh.label : whId), 'ok');
    poll();
  }
  function cycleWarehouse() {
    var idx = warehouses.findIndex(function (w) { return w.id === room; });
    switchWarehouse(warehouses[(idx + 1) % warehouses.length].id);
  }
  function startApp() {
    sessionStorage.setItem('sf_session_ws', currentWsKey);
    sessionStorage.setItem('sf_session_user', user);
    document.getElementById('app').style.display = 'flex';
    api('ws_' + currentWsKey + '/warehouse_labels').then(function (data) {
      if (data) warehouses = WH_DEFAULTS.map(function (w) {
        return Object.assign({}, w, { label: data[w.id] || w.label });
      });
    }).catch(function () {}).then(function () {
      var last = localStorage.getItem('sf_room_' + currentWsKey) || warehouses[0].id;
      room = last;
      var wh = warehouses.find(function (w) { return w.id === room; });
      document.getElementById('wh-label').textContent = wh ? wh.label : room;
      poll();
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(poll, 5000);
    });
  }

  function shiftDateStr(dateStr, days) {
    var p = dateStr.split('-').map(Number);
    var dt = new Date(p[0], p[1] - 1, p[2]);
    dt.setDate(dt.getDate() + days);
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  }
  function getOutBreakdown(dateStr) {
    var byItem = {};
    Object.values(movements).forEach(function (m) {
      if ((m.date || '').slice(0, 10) !== dateStr) return;
      if (m.type === 'out' || m.type === 'transfer') byItem[m.skuId] = (byItem[m.skuId] || 0) + m.pieces;
    });
    return Object.entries(byItem).sort(function (a, b) { return b[1] - a[1]; });
  }
  function getOutPlatform(dateStr) {
    var byPlat = {};
    Object.values(movements).forEach(function (m) {
      if ((m.date || '').slice(0, 10) !== dateStr) return;
      if (m.type === 'out') {
        var p = m.platform || 'ไม่ระบุ';
        byPlat[p] = (byPlat[p] || 0) + m.pieces;
      }
    });
    return Object.entries(byPlat).sort(function (a, b) { return b[1] - a[1]; });
  }
  function showOutDetail(dateStr) {
    outDetailDate = dateStr || outDetailDate || todayStr();
    var dStr = outDetailDate;
    var dObj = new Date(dStr + 'T00:00:00');
    var dayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
    var isToday = dStr === todayStr();
    var isYest = dStr === shiftDateStr(todayStr(), -1);
    var dLbl = dObj.getDate() + '/' + (dObj.getMonth() + 1) + '/' + dObj.getFullYear() + ' (' + dayNames[dObj.getDay()] + ')';
    if (isToday) dLbl += ' · วันนี้';
    else if (isYest) dLbl += ' · เมื่อวาน';
    document.getElementById('od-date-label').textContent = dLbl;
    document.getElementById('od-next').disabled = isToday;
    document.getElementById('od-next').style.opacity = isToday ? 0.4 : 1;
    document.getElementById('od-today').style.display = isToday ? 'none' : 'inline-flex';
    var ents = getOutBreakdown(dStr);
    var total = ents.reduce(function (s, e) { return s + e[1]; }, 0);
    document.getElementById('od-total').textContent = total.toLocaleString();
    document.getElementById('od-skucount').textContent = ents.length;
    var listEl = document.getElementById('od-list');
    if (!ents.length) listEl.innerHTML = '<div class="empty">ยังไม่มีการจ่ายออก' + (isToday ? 'วันนี้' : 'ในวันที่เลือก') + '</div>';
    else listEl.innerHTML = ents.map(function (pair) {
      var s = skus[pair[0]] || {}, f = fmtStock(pair[1], s);
      return '<div class="od-row"><div class="od-row-name">' + (s.name || pair[0]) + '</div><div><div class="od-row-qty">' + f.main + '</div><div class="od-row-sub">' + (f.sub || ('รวม ' + pair[1] + ' ' + bU(s))) + '</div></div></div>';
    }).join('');
    [chOutPie, chOutBar, chOutPlat].forEach(function (c) { if (c) { try { c.destroy(); } catch (e) {} } });
    chOutPie = chOutBar = chOutPlat = null;
    document.getElementById('od-overlay').classList.add('open');
    var colors = ['#C45C4A', '#C48A3A', '#A8894E', '#6B5B8A', '#4A7AB5', '#2D8A5C'];
    var rawLabels = ents.map(function (p) { return (skus[p[0]] || {}).name || p[0]; });
    var labels = rawLabels.map(function (n) { return n.length > 14 ? n.slice(0, 13) + '…' : n; });
    var data = ents.map(function (p) { return p[1]; });
    requestAnimationFrame(function () {
      var pieEl = document.getElementById('ch-out-pie');
      var barEl = document.getElementById('ch-out-bar');
      var platEl = document.getElementById('ch-out-plat');
      if (pieEl && ents.length) {
        chOutPie = new Chart(pieEl, {
          type: 'doughnut',
          data: { labels: rawLabels, datasets: [{ data: data, backgroundColor: colors.slice(0, ents.length), borderWidth: 2, borderColor: '#FFFEFA' }] },
          options: { responsive: true, maintainAspectRatio: false, cutout: '55%', plugins: { legend: { position: 'bottom', labels: { font: { family: 'Sarabun', size: 11 }, padding: 8, boxWidth: 10, usePointStyle: true } } } }
        });
      }
      if (barEl && ents.length) {
        chOutBar = new Chart(barEl, {
          type: 'bar',
          data: { labels: labels, datasets: [{ data: data, backgroundColor: colors.slice(0, ents.length).map(function (c) { return c + '99'; }), borderColor: colors.slice(0, ents.length), borderWidth: 2, borderRadius: 6 }] },
          options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true }, y: { ticks: { font: { family: 'Sarabun', size: 11 } } } } }
        });
      }
      var platEnts = getOutPlatform(dStr);
      if (platEl && platEnts.length) {
        chOutPlat = new Chart(platEl, {
          type: 'doughnut',
          data: { labels: platEnts.map(function (p) { return p[0]; }), datasets: [{ data: platEnts.map(function (p) { return p[1]; }), backgroundColor: ['#0F1620', '#A8894E', '#2D8A5C', '#C45C4A', '#6B5B8A'], borderWidth: 2, borderColor: '#FFFEFA' }] },
          options: { responsive: true, maintainAspectRatio: false, cutout: '50%', plugins: { legend: { position: 'bottom', labels: { font: { family: 'Sarabun', size: 11 }, padding: 8, boxWidth: 10, usePointStyle: true } } } }
        });
      }
    });
  }
  function closeOutDetail() {
    document.getElementById('od-overlay').classList.remove('open');
    [chOutPie, chOutBar, chOutPlat].forEach(function (c) { if (c) { try { c.destroy(); } catch (e) {} } });
    chOutPie = chOutBar = chOutPlat = null;
    outDetailDate = null;
  }
  function doLogout() {
    if (!confirm('ออกจากระบบ "' + user + '" ?')) return;
    clearInterval(pollTimer);
    currentWsKey = '';
    user = '';
    sessionStorage.clear();
    document.getElementById('app').style.display = 'none';
    document.getElementById('passcode-screen').style.display = 'flex';
    pcBuffer = '';
    updateDots();
  }

  function bindUI() {
    buildPasscodeUI();
    var btnLogin = document.getElementById('btn-login');
    if (btnLogin) btnLogin.addEventListener('click', doLogin);
    var btnBack = document.getElementById('btn-back');
    if (btnBack) btnBack.addEventListener('click', backToPasscode);
    var whChip = document.getElementById('wh-chip');
    if (whChip) whChip.addEventListener('click', cycleWarehouse);
    var cardOut = document.getElementById('card-out');
    if (cardOut) cardOut.addEventListener('click', function () { showOutDetail(); });
    var btnScan = document.getElementById('btn-scan');
    if (btnScan) btnScan.addEventListener('click', function () { toast('ฟีเจอร์สแกน QR จะเพิ่มในอัปเดตถัดไป'); });
    var btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.addEventListener('click', doLogout);
    var odClose = document.getElementById('od-close');
    if (odClose) odClose.addEventListener('click', closeOutDetail);
    var odPrev = document.getElementById('od-prev');
    if (odPrev) odPrev.addEventListener('click', function () {
      showOutDetail(shiftDateStr(outDetailDate || todayStr(), -1));
    });
    var odNext = document.getElementById('od-next');
    if (odNext) odNext.addEventListener('click', function () {
      if ((outDetailDate || todayStr()) >= todayStr()) return;
      showOutDetail(shiftDateStr(outDetailDate, 1));
    });
    var odToday = document.getElementById('od-today');
    if (odToday) odToday.addEventListener('click', function () { showOutDetail(todayStr()); });
    var odOverlay = document.getElementById('od-overlay');
    if (odOverlay) odOverlay.addEventListener('click', function (e) {
      if (e.target === this) closeOutDetail();
    });
    document.querySelectorAll('.nav-item[data-page]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showPage(btn.getAttribute('data-page'), btn);
      });
    });
    var awList = document.getElementById('aw-wh-list');
    if (awList) awList.addEventListener('click', function (e) {
      var b = e.target.closest('[data-wh]');
      if (b) switchWarehouse(b.getAttribute('data-wh'));
    });
    var ln = document.getElementById('login-name');
    if (ln) ln.addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
    document.addEventListener('keydown', function (e) {
      var pc = document.getElementById('passcode-screen');
      if (!pc || pc.style.display === 'none') return;
      if (e.key >= '0' && e.key <= '9') pcKey(e.key);
      else if (e.key === 'Backspace') pcDel();
    });
  }

  function init() {
    bindUI();
    var sw = sessionStorage.getItem('sf_session_ws');
    var su = sessionStorage.getItem('sf_session_user');
    if (sw && su) {
      currentWsKey = sw;
      user = su;
      document.getElementById('passcode-screen').style.display = 'none';
      startApp();
    } else {
      document.getElementById('passcode-screen').style.display = 'flex';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
