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
  var PLAT_MAP = { shopee: 'Shopee', lazada: 'Lazada', tiktok: 'TikTok', facebook: 'Facebook', line: 'LINE' };
  var pcBuffer = '';
  var currentWsKey = '', room = 'WH_A', user = '';
  var skus = {}, movements = {}, movArr = [];
  var warehouses = WH_DEFAULTS.slice();
  var pollTimer = null, chart = null, lastChartKey = '';
  var outDetailDate = null, chOutPie = null, chOutBar = null, chOutPlat = null;
  var recType = 'in', curPlat = '', curAdjDir = 'plus';

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
  function toast(msg) {
    var w = document.getElementById('toast-wrap');
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
  function rp() { return 'ws_' + currentWsKey + '/rooms/' + room; }

  function updateDots() {
    var dots = document.querySelectorAll('#pc-dots .pc-dot');
    for (var i = 0; i < dots.length; i++) dots[i].className = 'pc-dot' + (i < pcBuffer.length ? ' on' : '');
  }
  function pcKey(d) {
    if (pcBuffer.length >= PC_LEN) return;
    pcBuffer += d;
    updateDots();
    if (pcBuffer.length === PC_LEN) setTimeout(confirmPasscode, 160);
  }
  function pcDel() {
    if (pcBuffer.length) { pcBuffer = pcBuffer.slice(0, -1); updateDots(); }
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
    ['1','2','3','4','5','6','7','8','9','','0','del'].forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pc-key' + (k === '' ? ' ghost' : '');
      b.textContent = k === 'del' ? '⌫' : k;
      if (k !== '') {
        b.addEventListener('click', function (e) {
          e.preventDefault();
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
    document.getElementById('pc').style.display = 'none';
    document.getElementById('ws-display').textContent = 'WS-' + currentWsKey;
    var saved = localStorage.getItem('sf_user_' + currentWsKey);
    if (saved) { user = saved; startApp(); }
    else {
      document.getElementById('login').style.display = 'flex';
      setTimeout(function () { var i = document.getElementById('login-name'); if (i) i.focus(); }, 200);
    }
  }
  function backToPasscode() {
    document.getElementById('login').style.display = 'none';
    document.getElementById('pc').style.display = 'flex';
    pcBuffer = '';
    updateDots();
    currentWsKey = '';
  }
  function doLogin() {
    var n = document.getElementById('login-name').value.trim();
    if (!n) { toast('กรุณากรอกชื่อ'); return; }
    user = n;
    localStorage.setItem('sf_user_' + currentWsKey, n);
    document.getElementById('login').style.display = 'none';
    startApp();
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
  function effCost(s) { return (s.costPrice || 0) + (s.shippingCost || 0); }
  function bU(s) { return (s && s.baseUnit) || 'แพ็ค'; }
  function cU(s) { return (s && s.caseUnit) || 'ลัง'; }
  function isCaseOnlyProduct(s) {
    var name = ((s && s.name) || '').trim();
    return name.indexOf('ชุดเซ็ต') === 0;  // ชื่อขึ้นต้นด้วย "ชุดเซ็ต" เท่านั้น
  }
  function updateUnitOptions() {
    var sel = document.getElementById('rec-unit');
    var skuId = document.getElementById('rec-sku').value;
    var s = skus[skuId] || {};
    if (!sel) return;
    if (isCaseOnlyProduct(s)) {
      sel.innerHTML = '<option value="case">ลัง</option>';
      sel.value = 'case';
    } else {
      sel.innerHTML = '<option value="pack">แพ็ค</option><option value="case">ลัง</option>';
      if (sel.value !== 'case' && sel.value !== 'pack') sel.value = 'pack';
    }
  }
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

  // NOTE: The rest of the original file content was truncated in this call due to length limits.
  // I will restore the full file in the next step.
  console.error('INCOMPLETE - DO NOT USE');
})();
