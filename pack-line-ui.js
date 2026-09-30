/**
 * Big pack-line cards: product name + qty + unit
 * Keeps data-* attrs so pack-visual can show remaining images
 * RULE: ถ้า SKU มี PACK → ใช้หน่วยแพ็ค (ไม่ให้ (35/ลัง) ในชื่อบังคับเป็นลัง)
 */
(function () {
  'use strict';

  function parseUnit(sku, name) {
    var skuU = String(sku || '').toUpperCase();
    var s = String(sku || '') + ' ' + String(name || '');
    var u = s.toUpperCase();
    // ยึดจาก SKU ก่อน: ถ้าเป็น *PACK → แพ็ค เสมอ (แม้ชื่อมี /ลัง)
    if (skuU.indexOf('PACK') >= 0) return '\u0e41\u0e1e\u0e47\u0e04';
    if (skuU.indexOf('BOX') >= 0) return '\u0e25\u0e31\u0e07';
    // จากชื่อ: ลัง / PACK / แพ็ค
    if (u.indexOf('BOX') >= 0 || s.indexOf('\u0e25\u0e31\u0e07') >= 0) return '\u0e25\u0e31\u0e07';
    if (u.indexOf('PACK') >= 0 || s.indexOf('\u0e41\u0e1e\u0e47\u0e04') >= 0) return '\u0e41\u0e1e\u0e47\u0e04';
    return '\u0e0a\u0e34\u0e49\u0e19';
  }

  function esc(t) {
    return String(t || '')
      .replace(/&/g, '\u0026amp;')
      .replace(/</g, '\u0026lt;')
      .replace(/>/g, '\u0026gt;')
      .replace(/"/g, '\u0026quot;');
  }

  function ensureCss() {
    if (document.getElementById('pack-line-ui-css')) return;
    var s = document.createElement('style');
    s.id = 'pack-line-ui-css';
    s.textContent =
      '#pack-lines .plu{display:flex;flex-direction:column;gap:4px;padding:16px 18px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.55)}' +
      '#pack-lines .plu:last-child{border-bottom:none}' +
      '#pack-lines .plu.done{background:rgba(34,197,94,.10)}' +
      '#pack-lines .plu-top{display:flex;align-items:baseline;justify-content:flex-start;gap:12px;flex-wrap:wrap}' +
      '#pack-lines .plu-name{font-size:22px;font-weight:800;letter-spacing:-.02em;line-height:1.25;color:var(--ink)}' +
      '#pack-lines .plu-qty{display:flex;align-items:baseline;gap:6px;flex-shrink:0;white-space:nowrap}' +
      '#pack-lines .plu-num{font-family:"IBM Plex Mono",monospace;font-size:36px;font-weight:800;line-height:1;color:var(--ink);letter-spacing:-.04em}' +
      '#pack-lines .plu.done .plu-num{color:var(--ok)}' +
      '#pack-lines .plu-unit{font-size:20px;font-weight:800;color:var(--ink)}' +
      '#pack-lines .plu-sub{font-size:14px;font-weight:700;color:var(--ink2);display:flex;flex-wrap:wrap;gap:10px;align-items:center}' +
      '#pack-lines .plu-sku{font-family:"IBM Plex Mono",monospace;font-size:12px;font-weight:600;color:var(--ink3)}' +
      '#pack-lines .plu-prog{font-size:15px;font-weight:800}' +
      '#pack-lines-card .card-h{font-size:16px;font-weight:800}' +
      '#pack-lines .plu .row-n,#pack-lines .plu .row-m,#pack-lines .plu .row-q{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}';
    document.head.appendChild(s);
  }

  function enhanceBox() {
    var box = document.getElementById('pack-lines');
    if (!box) return;
    ensureCss();
    var rows = box.querySelectorAll('.row');
    if (!rows.length) return;
    if (box.querySelector('.plu')) return;
    var html = [];
    rows.forEach(function (row) {
      var name = ((row.querySelector('.row-n') || {}).textContent || '').trim();
      var sku = ((row.querySelector('.row-m') || {}).textContent || '').trim();
      var q = ((row.querySelector('.row-q') || {}).textContent || '0/0').trim();
      var parts = q.split('/');
      var scanned = parseInt(parts[0], 10) || 0;
      var qty = parseInt(parts[1], 10) || 0;
      var remain = Math.max(0, qty - scanned);
      var unit = parseUnit(sku, name);
      var done = remain === 0 && qty > 0;
      html.push(
        '<div class="plu' + (done ? ' done' : '') + '"' +
          ' data-sku-id="' + esc(sku) + '"' +
          ' data-sku-name="' + esc(name) + '"' +
          ' data-scanned="' + scanned + '"' +
          ' data-qty="' + qty + '"' +
          ' data-remain="' + remain + '">' +
          '<span class="row-n">' + esc(name) + '</span>' +
          '<span class="row-m">' + esc(sku) + '</span>' +
          '<span class="row-q">' + scanned + '/' + qty + '</span>' +
          '<div class="plu-top">' +
            '<div class="plu-name">' + esc(name || sku) + '</div>' +
            '<div class="plu-qty"><span class="plu-num">' + qty + '</span><span class="plu-unit">' + unit + '</span></div>' +
          '</div>' +
          '<div class="plu-sub">' +
            '<span class="plu-sku">' + esc(sku) + '</span>' +
            '<span class="plu-prog">' + (done
              ? '\u0e04\u0e23\u0e1a\u0e41\u0e25\u0e49\u0e27 ' + scanned + '/' + qty + ' ' + unit
              : '\u0e15\u0e49\u0e2d\u0e07\u0e2a\u0e41\u0e01\u0e19 ' + remain + ' ' + unit + ' \u00b7 \u0e2a\u0e41\u0e01\u0e19\u0e41\u0e25\u0e49\u0e27 ' + scanned + '/' + qty) +
            '</span>' +
          '</div>' +
        '</div>'
      );
    });
    box.innerHTML = html.join('');
    if (typeof window.__packEnhanceVisual === 'function') {
      setTimeout(function () { window.__packEnhanceVisual(); }, 20);
    }
  }

  var mo = new MutationObserver(function () {
    var box = document.getElementById('pack-lines');
    if (!box) return;
    if (box.querySelector('.row') && !box.querySelector('.plu')) enhanceBox();
  });
  mo.observe(document.body, { childList: true, subtree: true });
  setInterval(enhanceBox, 400);
})();
