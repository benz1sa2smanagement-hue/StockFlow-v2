/**
 * Pack evidence: local device storage + shared index in Firebase
 * Photos: IndexedDB + compressed preview in RTDB for other devices
 * Videos: IndexedDB local + metadata shared; open/share on capturing device
 */
(function () {
  'use strict';
  var DB = 'https://kiyomi-b19d0-default-rtdb.asia-southeast1.firebasedatabase.app';
  var IDB_NAME = 'sf_pack_evidence';
  var IDB_STORE = 'files';
  var deviceId = localStorage.getItem('sf_device_id');
  if (!deviceId) {
    deviceId = 'd_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    localStorage.setItem('sf_device_id', deviceId);
  }
  var deviceLabel = localStorage.getItem('sf_device_label') || '';

  function toast(msg) {
    var w = document.getElementById('toast-wrap');
    if (!w) return;
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    w.innerHTML = '';
    w.appendChild(t);
    setTimeout(function () { t.remove(); }, 2800);
  }
  function wsKey() { return sessionStorage.getItem('sf_session_ws') || ''; }
  function roomId() { return localStorage.getItem('sf_room_' + wsKey()) || 'WH_A'; }
  function userName() { return sessionStorage.getItem('sf_session_user') || ''; }
  function evidencePath(orderId) {
    return 'ws_' + wsKey() + '/rooms/' + roomId() + '/packEvidence/' + encodeURIComponent(orderId || '_none');
  }
  function api(p, opt) {
    opt = opt || {};
    return fetch(DB + '/' + p + '.json', Object.assign({ cache: 'no-store' }, opt)).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      if (r.status === 204) return null;
      return r.json();
    });
  }
  function openIdb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function idbPut(rec) {
    return openIdb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(rec);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }
  function idbGet(id) {
    return openIdb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, 'readonly');
        var req = tx.objectStore(IDB_STORE).get(id);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }
  function idbGetAll() {
    return openIdb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, 'readonly');
        var req = tx.objectStore(IDB_STORE).getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }
  function currentOrderId() {
    var el = document.getElementById('pack-order');
    var v = (el && el.value || '').trim();
    var sess = (typeof window.__packGetSessionId === 'function' && window.__packGetSessionId()) || localStorage.getItem('sf_pack_session') || '';
    return v || sess || 'NO-ORDER';
  }
  function compressImage(file, maxW, quality) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) {
          if (!blob) reject(new Error('compress fail'));
          else resolve(blob);
        }, 'image/jpeg', quality);
      };
      img.onerror = reject;
      img.src = url;
    });
  }
  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }
  function ensureUI() {
    if (document.getElementById('pack-ev-wrap')) return;
    var anchor = document.getElementById('pack-complete') || document.getElementById('pack-fb');
    if (!anchor || !anchor.parentNode) return;
    if (!deviceLabel) {
      deviceLabel = (userName() || '\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07') + '-' + deviceId.slice(-4);
      localStorage.setItem('sf_device_label', deviceLabel);
    }
    var wrap = document.createElement('div');
    wrap.id = 'pack-ev-wrap';
    wrap.style.cssText = 'margin:12px 0;padding:12px;background:var(--bg);border-radius:14px;border:1px solid var(--line)';
    wrap.innerHTML =
      '<div style="font-size:13px;font-weight:600;margin-bottom:6px">\u0e2b\u0e25\u0e31\u0e01\u0e10\u0e32\u0e19\u0e41\u0e1e\u0e47\u0e01 (\u0e40\u0e01\u0e47\u0e1a\u0e43\u0e19\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07\u0e19\u0e35\u0e49)</div>' +
      '<div style="font-size:11px;color:var(--ink3);margin-bottom:10px">\u0e23\u0e39\u0e1b/\u0e27\u0e34\u0e14\u0e35\u0e42\u0e2d\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e43\u0e19\u0e21\u0e37\u0e2d\u0e16\u0e37\u0e2d \u00b7 \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e41\u0e0a\u0e23\u0e4c\u0e43\u0e2b\u0e49\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07\u0e2d\u0e37\u0e48\u0e19\u0e40\u0e2b\u0e47\u0e19 \u00b7 \u0e23\u0e39\u0e1b\u0e22\u0e48\u0e2d\u0e41\u0e0a\u0e23\u0e4c\u0e02\u0e49\u0e32\u0e21\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07\u0e44\u0e14\u0e49</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">' +
      '<label class="btn" style="display:block;text-align:center;padding:12px;background:var(--ink);color:#fff;border-radius:12px;font-size:13px;cursor:pointer">' +
      '\u0e16\u0e48\u0e32\u0e22\u0e23\u0e39\u0e1b<input type="file" id="pack-ev-photo" accept="image/*" capture="environment" style="display:none"></label>' +
      '<label class="btn" style="display:block;text-align:center;padding:12px;background:var(--ink);color:#fff;border-radius:12px;font-size:13px;cursor:pointer">' +
      '\u0e16\u0e48\u0e32\u0e22\u0e27\u0e34\u0e14\u0e35\u0e42\u0e2d<input type="file" id="pack-ev-video" accept="video/*" capture="environment" style="display:none"></label>' +
      '</div>' +
      '<button type="button" class="btn" id="pack-ev-refresh" style="width:100%;padding:10px;border-radius:12px;background:var(--paper);border:1px solid var(--line2);font-size:13px;margin-bottom:8px">\u0e23\u0e35\u0e40\u0e1f\u0e23\u0e0a\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e2b\u0e25\u0e31\u0e01\u0e10\u0e32\u0e19\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e19\u0e35\u0e49</button>' +
      '<div id="pack-ev-list" style="font-size:12px;color:var(--ink3)">\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e2b\u0e25\u0e31\u0e01\u0e10\u0e32\u0e19</div>';
    if (anchor.id === 'pack-complete') anchor.parentNode.insertBefore(wrap, anchor);
    else anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
    document.getElementById('pack-ev-photo').addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) handleCapture(e.target.files[0], 'photo');
      e.target.value = '';
    });
    document.getElementById('pack-ev-video').addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) handleCapture(e.target.files[0], 'video');
      e.target.value = '';
    });
    document.getElementById('pack-ev-refresh').addEventListener('click', refreshList);
  }
  function handleCapture(file, type) {
    var orderId = currentOrderId();
    if (orderId === 'NO-ORDER') { toast('\u0e43\u0e2a\u0e48\u0e40\u0e25\u0e02\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c / Tracking \u0e01\u0e48\u0e2d\u0e19'); return; }
    var id = 'ev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    toast(type === 'photo' ? '\u0e01\u0e33\u0e25\u0e31\u0e07\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e23\u0e39\u0e1b\u2026' : '\u0e01\u0e33\u0e25\u0e31\u0e07\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e27\u0e34\u0e14\u0e35\u0e42\u0e2d\u2026');
    var localBlob = file;
    var meta = {
      id: id, orderId: orderId, type: type,
      mime: file.type || (type === 'photo' ? 'image/jpeg' : 'video/mp4'),
      name: file.name || (type + '_' + id), size: file.size,
      createdAt: Date.now(), deviceId: deviceId, deviceLabel: deviceLabel, user: userName(), hasLocal: true
    };
    var chain = Promise.resolve();
    if (type === 'photo') {
      chain = compressImage(file, 1280, 0.72).then(function (blob) {
        localBlob = blob; meta.size = blob.size; meta.mime = 'image/jpeg';
        return compressImage(file, 480, 0.55).then(function (thumb) {
          return blobToDataUrl(thumb).then(function (dataUrl) { meta.preview = dataUrl; });
        });
      });
    }
    chain.then(function () {
      return idbPut({ id: id, orderId: orderId, type: type, mime: meta.mime, blob: localBlob, createdAt: meta.createdAt, name: meta.name });
    }).then(function () {
      var shared = {
        id: meta.id, orderId: meta.orderId, type: meta.type, mime: meta.mime, name: meta.name,
        size: meta.size, createdAt: meta.createdAt, deviceId: meta.deviceId, deviceLabel: meta.deviceLabel,
        user: meta.user, preview: meta.preview || null
      };
      return api(evidencePath(orderId) + '/' + id, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(shared)
      });
    }).then(function () {
      try {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(localBlob);
        a.download = (orderId + '_' + type + '_' + id).replace(/[^\w\-]+/g, '_') + (type === 'photo' ? '.jpg' : '.mp4');
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      } catch (e) {}
      toast('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e43\u0e19\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07\u0e41\u0e25\u0e49\u0e27');
      refreshList();
    }).catch(function (e) {
      toast('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08: ' + (e.message || e));
    });
  }
  function refreshList() {
    var list = document.getElementById('pack-ev-list');
    if (!list) return;
    var orderId = currentOrderId();
    if (!wsKey()) { list.textContent = '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e25\u0e47\u0e2d\u0e01\u0e2d\u0e34\u0e19'; return; }
    list.innerHTML = '\u0e01\u0e33\u0e25\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14\u2026';
    Promise.all([api(evidencePath(orderId)).catch(function () { return null; }), idbGetAll()]).then(function (res) {
      var remote = res[0] || {};
      var local = res[1] || [];
      var localMap = {};
      local.forEach(function (x) { localMap[x.id] = x; });
      var items = Object.keys(remote).map(function (k) { return remote[k]; });
      local.forEach(function (x) {
        if (x.orderId === orderId && !remote[x.id]) {
          items.push({ id: x.id, orderId: x.orderId, type: x.type, name: x.name, createdAt: x.createdAt, deviceId: deviceId, deviceLabel: deviceLabel + ' (local)', size: x.blob && x.blob.size });
        }
      });
      items.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
      if (!items.length) {
        list.innerHTML = '<span style="color:var(--ink3)">\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e2b\u0e25\u0e31\u0e01\u0e10\u0e32\u0e19\u0e02\u0e2d\u0e07\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e19\u0e35\u0e49</span>';
        return;
      }
      list.innerHTML = items.map(function (it) {
        var when = it.createdAt ? new Date(it.createdAt).toLocaleString('th-TH') : '';
        var onThis = it.deviceId === deviceId || localMap[it.id];
        var kind = it.type === 'video' ? '\u0e27\u0e34\u0e14\u0e35\u0e42\u0e2d' : '\u0e23\u0e39\u0e1b';
        var sizeKb = it.size ? (Math.round(it.size / 1024) + ' KB') : '';
        var preview = (it.preview && it.type === 'photo') ? ('<img src="' + it.preview + '" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:8px;margin-right:10px">') : '';
        var actions = '';
        if (onThis) {
          actions += '<button type="button" data-ev-open="' + it.id + '" style="font-size:11px;padding:6px 10px;border-radius:8px;background:var(--ink);color:#fff;margin-right:4px">\u0e40\u0e1b\u0e34\u0e14</button>';
          actions += '<button type="button" data-ev-share="' + it.id + '" style="font-size:11px;padding:6px 10px;border-radius:8px;background:var(--gold-soft);color:var(--ink)">\u0e41\u0e0a\u0e23\u0e4c</button>';
        } else if (it.preview) {
          actions += '<button type="button" data-ev-preview="' + it.id + '" style="font-size:11px;padding:6px 10px;border-radius:8px;background:var(--ink);color:#fff">\u0e14\u0e39\u0e23\u0e39\u0e1b\u0e22\u0e48\u0e2d</button>';
        } else {
          actions += '<span style="font-size:11px;color:var(--ink3)">\u0e44\u0e1f\u0e25\u0e4c\u0e2d\u0e22\u0e39\u0e48\u0e17\u0e35\u0e48 ' + (it.deviceLabel || '') + '</span>';
        }
        return '<div style="display:flex;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)">' + preview +
          '<div style="flex:1;min-width:0"><div style="font-weight:600;color:var(--ink)">' + kind + ' \u00b7 ' + (it.deviceLabel || '') + '</div>' +
          '<div style="font-size:11px;color:var(--ink3)">' + when + (sizeKb ? ' \u00b7 ' + sizeKb : '') + '</div>' +
          '<div style="margin-top:6px">' + actions + '</div></div></div>';
      }).join('');
    }).catch(function () { list.textContent = 'error'; });
  }
  document.addEventListener('click', function (e) {
    var openBtn = e.target.closest && e.target.closest('[data-ev-open]');
    if (openBtn) {
      idbGet(openBtn.getAttribute('data-ev-open')).then(function (rec) {
        if (!rec || !rec.blob) { toast('\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e44\u0e1f\u0e25\u0e4c\u0e43\u0e19\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07\u0e19\u0e35\u0e49'); return; }
        var url = URL.createObjectURL(rec.blob);
        if (rec.type === 'video' || (rec.mime || '').indexOf('video') === 0) window.open(url, '_blank');
        else {
          var w = window.open('');
          if (w) w.document.write('<img src="' + url + '" style="max-width:100%">');
          else window.open(url, '_blank');
        }
      });
      return;
    }
    var shareBtn = e.target.closest && e.target.closest('[data-ev-share]');
    if (shareBtn) {
      idbGet(shareBtn.getAttribute('data-ev-share')).then(function (rec) {
        if (!rec || !rec.blob) { toast('\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e44\u0e1f\u0e25\u0e4c'); return; }
        var file = new File([rec.blob], rec.name || 'evidence.jpg', { type: rec.mime || 'image/jpeg' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: 'pack ' + rec.orderId }).catch(function () {});
        } else {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(rec.blob);
          a.download = rec.name || 'evidence';
          a.click();
          toast('\u0e14\u0e32\u0e27\u0e19\u0e4c\u0e42\u0e2b\u0e25\u0e14\u0e41\u0e25\u0e49\u0e27');
        }
      });
      return;
    }
    var prevBtn = e.target.closest && e.target.closest('[data-ev-preview]');
    if (prevBtn) {
      var pid = prevBtn.getAttribute('data-ev-preview');
      api(evidencePath(currentOrderId()) + '/' + pid).then(function (it) {
        if (it && it.preview) {
          var w = window.open('');
          if (w) w.document.write('<img src="' + it.preview + '" style="max-width:100%">');
        } else toast('no preview');
      });
    }
  });
  function onPack() { ensureUI(); setTimeout(refreshList, 300); }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.ni[data-page="pack"]');
    if (btn) setTimeout(onPack, 250);
  });
  document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'pack-order') refreshList();
  });
  setTimeout(onPack, 2800);
})();
