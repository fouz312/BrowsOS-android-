/* BrowOS core: storage, windows, Windows-style taskbar and start menu, pinning, uninstalling. */
window.BrowOS = (function () {
  const $ = (s, r = document) => r.querySelector(s);
  const VERSION = '1.4.0';

  // ---- Accounts: each account has its own settings, notes, Vault and lock password ----
  const ACC = (() => { try { return localStorage.getItem('browos.current') || 'main'; } catch (e) { return 'main'; } })();
  const SFX = id => id === 'main' ? '' : '.' + id;
  const keys = { store: 'browos' + SFX(ACC), vault: 'browos.vault' + SFX(ACC), lock: 'browos.lock' + SFX(ACC) };
  const accList = () => { try { const l = JSON.parse(localStorage.getItem('browos.accounts') || '[]'); return l.includes('main') ? l : ['main', ...l]; } catch (e) { return ['main']; } };
  const accName = id => { try { return JSON.parse(localStorage.getItem('browos' + SFX(id)) || '{}').username || (id === 'main' ? 'User' : 'New account'); } catch (e) { return 'Account'; } };
  const accounts = {
    current: ACC,
    list: () => accList().map(id => ({ id, name: accName(id) })),
    add() { const id = 'a' + Date.now().toString(36); localStorage.setItem('browos.accounts', JSON.stringify([...accList(), id])); this.switchTo(id); },
    switchTo(id) { localStorage.setItem('browos.current', id); location.reload(); },
    remove(id) { if (id === 'main' || id === ACC) return false; ['browos', 'browos.vault', 'browos.lock'].forEach(k => localStorage.removeItem(k + SFX(id))); localStorage.setItem('browos.accounts', JSON.stringify(accList().filter(x => x !== id))); return true; }
  };

  // ---- Storage: the app's own private browser storage (localStorage) ----
  const store = {
    data: {},
    load() { try { this.data = JSON.parse(localStorage.getItem(keys.store) || '{}'); } catch (e) { this.data = {}; } },
    save() { try { localStorage.setItem(keys.store, JSON.stringify(this.data)); } catch (e) { console.warn('Save failed', e); } },
    get(k, d) { return k in this.data ? this.data[k] : d; },
    set(k, v) { this.data[k] = v; this.save(); },
    del(k) { delete this.data[k]; this.save(); },
    reset() { this.data = {}; try { localStorage.removeItem(keys.store); } catch (e) {} },
    size() { try { return (localStorage.getItem(keys.store) || '').length; } catch (e) { return 0; } }
  };
  store.load();

  const apps = [], wins = {};
  let z = 10, active = null, allMode = false;
  const small = () => innerWidth < 700;
  const register = a => apps.push(a);
  const find = id => apps.find(a => a.id === id);
  const vis = () => apps.filter(a => !store.get('uninstalled', []).includes(a.id) && !(a.hidden && !store.get('secretUnlocked', false)));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ico = (a, cls = '') => `<span class="ico ${cls}" style="--g:${a.color}">${a.icon}</span>`;
  const getPins = k => store.get(k, []);
  const pinned = (k, id) => getPins(k).includes(id);
  const userName = () => store.get('username', 'User');
  // What each app saves, so "Uninstall and delete its data" knows what to remove.
  const dataKeys = { notes: ['notes'], calendar: ['events'], calculator: ['calcHistory'], browser: ['bookmarks', 'history', 'searchExt', 'engine'], weather: ['wxPlace', 'wxCache', 'wxUnit'], music: ['vol'], vault: ['@vault'] };

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 2400);
  }
  function modal(html) {
    const m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = `<div class="mbox">${html}</div>`; document.body.append(m); return m;
  }
  function sheet(root, html) {
    const o = root.querySelector(':scope > .sheet'); if (o) o.remove();
    const s = document.createElement('div'); s.className = 'sheet'; s.innerHTML = `<div class="sheetbox">${html}</div>`; root.append(s); return s;
  }
  const isCovered = () => !$('#start').classList.contains('hidden') || !!$('#lock') || !!$('#setup') || !!document.querySelector('.modal') || !!document.querySelector('.panel.open');

  function applyTheme() {
    const r = document.documentElement.style, w = $('#wall'), b = document.body.dataset;
    r.setProperty('--accent', store.get('accent', '#9b6bff'));
    r.setProperty('--ga', store.get('glass', 0.74));
    r.setProperty('--dim', store.get('dim', 0));
    r.setProperty('--blur', store.get('blur', 0) + 'px');
    r.setProperty('--topfix', store.get('topfix', 40) + 'px');
    b.theme = store.get('theme', 'dark'); b.anim = store.get('anim', 'on'); b.isz = store.get('isz', 'm');
    b.clock = store.get('clock', 'on'); b.tb = store.get('tb', 'win'); b.wc = store.get('wcorner', 'round'); b.wbtn = store.get('wbtn', 'win'); b.tbar = store.get('tbar', 'light'); b.icn = store.get('icnames', true) ? 'on' : 'off';
    let wall = store.get('wall', 'night'); const uri = store.get('wallUri', '');
    if (wall === 'custom' && uri && window.Capacitor && window.Capacitor.convertFileSrc) w.style.backgroundImage = 'url("' + window.Capacitor.convertFileSrc(uri) + '")';
    else { w.style.backgroundImage = ''; if (wall === 'custom') wall = 'night'; }
    w.dataset.w = wall;
    b.blur = store.get('blur', 0) > 0 ? 'on' : 'off'; b.dim = store.get('dim', 0) > 0 ? 'on' : 'off';
  }

  // ---- Pinning, uninstalling ----
  function togglePin(k, id) {
    const l = getPins(k), i = l.indexOf(id); i < 0 ? l.push(id) : l.splice(i, 1);
    store.set(k, l); refresh(); return i < 0;
  }
  function unpinEverywhere(id) { ['favs', 'tbpins', 'deskpins'].forEach(k => { const l = getPins(k); if (l.includes(id)) store.set(k, l.filter(x => x !== id)); }); }
  function wipeData(id) { (dataKeys[id] || []).forEach(k => { if (k === '@vault') { try { localStorage.removeItem(keys.vault); } catch (e) {} } else store.del(k); }); }
  function uninstallApp(id, wipe) {
    close(id); unpinEverywhere(id);
    const u = store.get('uninstalled', []); if (!u.includes(id)) store.set('uninstalled', [...u, id]);
    if (wipe) wipeData(id);
    refresh();
  }
  function confirmUninstall(id, done) {
    const a = find(id); if (!a || a.system) return;
    const finish = () => { refresh(); if (done) done(); };
    if (a.web) {
      const m = modal(`<h3>Remove ${esc(a.name)}?</h3><p class="muted">This web app will be removed. Its website is not affected.</p><div class="col"><button class="btn danger" data-m="y">Remove</button><button class="btn" data-m="x">Cancel</button></div>`);
      m.onclick = e => { const k = e.target.dataset.m; if (!k) return; m.remove(); if (k === 'y' && OS.removeWebApp) { OS.removeWebApp(id); toast('Removed'); finish(); } };
      return;
    }
    const has = !!dataKeys[id];
    const m = modal(`<h3>Uninstall ${esc(a.name)}?</h3><p class="muted">It stays in the App Store, so you can install it again. Files you imported are never deleted by uninstalling.</p><div class="col"><button class="btn" data-m="keep">Uninstall, keep my data</button>${has ? '<button class="btn danger" data-m="wipe">Uninstall and delete its saved data</button>' : ''}<button class="btn" data-m="x">Cancel</button></div>`);
    m.onclick = e => { const k = e.target.dataset.m; if (!k) return; m.remove(); if (k === 'x') return; uninstallApp(id, k === 'wipe'); toast(a.name + ' uninstalled'); finish(); };
  }
  function appMenu(id) {
    const a = find(id); if (!a) return;
    const m = modal(`<div class="mhead">${ico(a)}<b>${esc(a.name)}</b></div><div class="col">
      <button class="btn pri" data-m="open">Open</button>
      <button class="btn" data-m="favs">${pinned('favs', id) ? 'Unpin from Start' : 'Pin to Start'}</button>
      <button class="btn" data-m="tbpins">${pinned('tbpins', id) ? 'Unpin from taskbar' : 'Pin to taskbar'}</button>
      <button class="btn" data-m="deskpins">${pinned('deskpins', id) ? 'Unpin from desktop' : 'Pin to desktop'}</button>
      ${wins[id] ? '<button class="btn" data-m="close">Close app</button>' : ''}${a.system ? '' : '<button class="btn danger" data-m="un">Uninstall...</button>'}<button class="btn" data-m="x">Cancel</button></div>`);
    m.onclick = e => {
      const k = e.target.dataset.m; if (!k) { if (e.target === m) m.remove(); return; }
      m.remove();
      if (k === 'open') open(id); else if (k === 'close') close(id); else if (k === 'un') confirmUninstall(id);
      else if (['favs', 'tbpins', 'deskpins'].includes(k)) togglePin(k, id);
    };
  }

  // ---- Windows ----
  function open(id) {
    const a = find(id); if (!a || !vis().includes(a)) return;
    closeStart();
    if (wins[id]) return restore(id);
    const el = document.createElement('section');
    el.className = 'win';
    el.innerHTML = `<header><span class="t">${a.icon} <span>${esc(a.name)}</span></span><span class="wb"><button data-a="min" aria-label="Minimise"><svg viewBox="0 0 12 12"><path d="M1 6h10"/></svg></button><button data-a="max" aria-label="Maximise"><svg viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9" rx="1"/></svg></button><button data-a="close" aria-label="Close"><svg viewBox="0 0 12 12"><path d="M1.5 1.5l9 9M10.5 1.5l-9 9"/></svg></button></span></header><div class="body"></div>`;
    const n = Object.keys(wins).length;
    if (small()) el.classList.add('max');
    else {
      el.style.left = (70 + n * 30) + 'px'; el.style.top = (30 + n * 30) + 'px';
      el.style.width = Math.min(a.w || 420, innerWidth - 90) + 'px';
      el.style.height = Math.min(a.h || 520, innerHeight - 130) + 'px';
      if (store.get('maxApps', {})[id]) el.classList.add('max');
    }
    $('#windows').append(el);
    const ctx = { store, toast, close: () => close(id) };
    wins[id] = { a, el, min: false, t: Date.now(), ctx };
    wins[id].cleanup = a.build($('.body', el), ctx);
    el.addEventListener('pointerdown', () => { if (active !== id) focus(id); });
    el.querySelector('header').addEventListener('click', e => {
      const b = e.target.closest('button[data-a]'); if (!b) return;
      if (b.dataset.a === 'close') close(id); else if (b.dataset.a === 'min') minimise(id); else { el.classList.toggle('max'); const mm = store.get('maxApps', {}); mm[id] = el.classList.contains('max'); store.set('maxApps', mm); }
    });
    enableDrag(el);
    const r = store.get('recent', []).filter(x => x !== id); r.unshift(id); store.set('recent', r.slice(0, 8));
    focus(id);
  }
  function enableDrag(el) {
    const h = $('header', el);
    h.addEventListener('pointerdown', e => {
      if (e.target.closest('button') || el.classList.contains('max')) return;
      const dx = e.clientX - el.offsetLeft, dy = e.clientY - el.offsetTop;
      h.setPointerCapture(e.pointerId);
      const mv = ev => { el.style.left = Math.max(80 - el.offsetWidth, Math.min(innerWidth - 80, ev.clientX - dx)) + 'px'; el.style.top = Math.max(0, Math.min(innerHeight - 120, ev.clientY - dy)) + 'px'; };
      const up = () => { h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); };
      h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up);
    });
  }
  function focus(id) {
    active = id; wins[id].el.style.zIndex = ++z;
    for (const k in wins) wins[k].el.classList.toggle('active', k === id);
    renderTaskbar();
  }
  function minimise(id) { wins[id].el.classList.add('hide'); wins[id].min = true; if (active === id) active = null; renderTaskbar(); }
  function restore(id) { wins[id].el.classList.remove('hide'); wins[id].min = false; focus(id); }
  function close(id) {
    if (!wins[id]) return;
    if (typeof wins[id].cleanup === 'function') try { wins[id].cleanup(); } catch (e) {}
    wins[id].el.remove(); delete wins[id];
    if (active === id) active = null;
    renderTaskbar();
  }
  function list() { return Object.keys(wins).map(id => ({ id, name: wins[id].a.name, icon: wins[id].a.icon, cat: wins[id].a.cat, min: wins[id].min, active: id === active, t: wins[id].t })); }

  // ---- Taskbar and desktop icons ----
  function renderTaskbar() {
    const ids = [...new Set([...getPins('tbpins'), ...Object.keys(wins)])];
    const box = $('#tbApps'); box.innerHTML = '';
    ids.forEach(id => {
      const a = find(id); if (!a || !vis().includes(a)) return;
      const b = document.createElement('button'), running = !!wins[id];
      b.className = 'tbb' + (running ? ' run' : '') + (active === id ? ' active' : '');
      b.dataset.id = id; b.setAttribute('aria-label', a.name); b.innerHTML = ico(a);
      b.onclick = () => { if (!running) open(id); else if (active === id && !wins[id].min) minimise(id); else restore(id); };
      box.append(b);
    });
    measure();
  }
  function renderIcons() {
    $('#icons').innerHTML = getPins('deskpins').map(find).filter(a => a && vis().includes(a)).map(a => `<button class="dicon" data-id="${a.id}">${ico(a)}<span>${esc(a.name)}</span></button>`).join('');
  }
  function refresh() { renderIcons(); renderTaskbar(); if (!$('#start').classList.contains('hidden')) renderStart(); const n = $('#userName'); if (n) { n.textContent = userName(); $('#avatar').textContent = userName()[0].toUpperCase(); } }
  function measure() { const t = $('#taskbar'); if (!t) return; document.documentElement.style.setProperty('--tb', Math.max(60, innerHeight - t.getBoundingClientRect().top + (document.body.dataset.tb === 'float' ? 8 : 0)) + 'px'); }

  // ---- Start menu ----
  function closeStart() { $('#start').classList.add('hidden'); }
  function toggleStart(focusSearch) {
    const s = $('#start');
    if (s.classList.contains('hidden')) { s.classList.remove('hidden'); $('#search').value = ''; allMode = false; renderStart(); if (focusSearch) $('#search').focus(); } else closeStart();
  }
  const tile = (a, pinBtn) => { const on = pinned('favs', a.id); return `<div class="tile" data-id="${a.id}" role="button">${pinBtn ? `<button class="pinb ${on ? 'on' : ''}" data-pin="${a.id}" aria-label="Pin to Start">${on ? '★' : '☆'}</button>` : ''}${ico(a)}<span>${esc(a.name)}</span></div>`; };
  function renderStart() {
    const q = $('#search').value.trim().toLowerCase(), body = $('#startBody');
    if (q) {
      const r = vis().filter(a => a.name.toLowerCase().includes(q) || a.cat.toLowerCase().includes(q));
      body.innerHTML = r.length ? `<div class="sec"><b>Results</b></div><div class="pgrid">${r.map(a => tile(a, true)).join('')}</div>` : '<div class="empty">No apps found.</div>';
      return;
    }
    const fav = getPins('favs').map(find).filter(a => a && vis().includes(a)), rec = store.get('recent', []).map(find).filter(a => a && vis().includes(a)).slice(0, 6);
    let h = '';
    if (allMode) {
      h = '<div class="sec"><b>All apps</b><button class="lnk" data-s="back">&#8249; Back</button></div><p class="muted pad">Tap the star on an app to pin it to Start.</p>';
      [...new Set(vis().map(a => a.cat))].sort().forEach(c => { h += `<h4>${esc(c)}</h4><div class="pgrid">${vis().filter(a => a.cat === c).sort((x, y) => x.name.localeCompare(y.name)).map(a => tile(a, true)).join('')}</div>`; });
    } else {
      h = '<div class="sec"><b>Pinned</b><button class="lnk" data-s="all">All apps &#8250;</button></div>';
      h += fav.length ? `<div class="pgrid">${fav.map(a => tile(a, false)).join('')}</div>` : '<p class="muted pad">Nothing is pinned yet. Tap <b>All apps</b>, or search above, then tap the star on an app to pin it. Press and hold any app for more choices.</p>';
      h += '<div class="sec"><b>Recommended</b></div>';
      h += rec.length ? `<div class="rgrid">${rec.map(a => `<button class="rrow" data-id="${a.id}">${ico(a)}<span><b>${esc(a.name)}</b><small>Recently opened</small></span></button>`).join('')}</div>` : '<p class="muted pad">Apps you open will show up here.</p>';
    }
    body.innerHTML = h;
  }
  function powerMenu() {
    closeStart();
    const m = modal('<h3>Power</h3><div class="col"><button class="btn" data-m="lock">🔒 Lock</button><button class="btn" data-m="acc">👤 Switch account</button><button class="btn" data-m="re">↻ Restart BrowOS</button><button class="btn" data-m="exit">Shut down</button><button class="btn" data-m="x">Cancel</button></div>');
    m.onclick = e => {
      const k = e.target.dataset.m; if (!k) return; m.remove();
      if (k === 'lock' && OS.lockNow) OS.lockNow(); else if (k === 're') location.reload(); else if (k === 'acc') { OS.nextPage = 'accounts'; open('settings'); }
      else if (k === 'exit') { const A = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App; Object.keys(wins).forEach(close); A ? A.exitApp() : toast('Shut down works inside the Android app.'); }
    };
  }

  function longPress(root, sel, fn) {
    let t, fired = false, sx = 0, sy = 0;
    root.addEventListener('pointerdown', e => { const n = e.target.closest(sel); if (!n || e.target.closest('.pinb')) return; fired = false; sx = e.clientX; sy = e.clientY; clearTimeout(t); t = setTimeout(() => { fired = true; fn(n); }, 550); });
    const stop = () => clearTimeout(t);
    root.addEventListener('pointerup', stop); root.addEventListener('pointercancel', stop);
    root.addEventListener('pointermove', e => { if (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10) stop(); });
    root.addEventListener('contextmenu', e => { if (e.target.closest(sel)) e.preventDefault(); });
    root.addEventListener('click', e => { if (fired) { e.stopPropagation(); e.preventDefault(); fired = false; } }, true);
  }

  // Drag an app out of the Start menu: drop on the desktop to pin it there, or on the taskbar to pin it there.
  function dragPin(root, sel) {
    let t = null, ready = false, dragging = false, ghost = null, id = null, sx = 0, sy = 0, suppress = false, lifted = null;
    const over = (r, x, y) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    function end() { clearTimeout(t); if (lifted) lifted.classList.remove('lifted'); lifted = null; if (ghost) ghost.remove(); ghost = null; $('#start').style.opacity = ''; document.body.classList.remove('dragpin', 'overtb'); $('#dropHint').classList.add('hidden'); ready = false; dragging = false; id = null; }
    const hold = () => { suppress = true; setTimeout(() => { suppress = false; }, 400); };
    root.addEventListener('pointerdown', e => {
      const n = e.target.closest(sel); if (!n || e.target.closest('.pinb')) return;
      end(); id = n.dataset.id; sx = e.clientX; sy = e.clientY; lifted = n;
      t = setTimeout(() => { ready = true; n.classList.add('lifted'); if (navigator.vibrate) navigator.vibrate(15); }, 350);
    });
    document.addEventListener('touchmove', e => { if (ready || dragging) e.preventDefault(); }, { passive: false });
    document.addEventListener('pointermove', e => {
      if (!id) return;
      const far = Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8;
      if (!ready && !dragging) { if (far) end(); return; }
      if (ready && !dragging && far) {
        dragging = true; ghost = document.createElement('div'); ghost.className = 'ghost'; ghost.innerHTML = ico(find(id)); document.body.append(ghost);
        document.body.classList.add('dragpin'); $('#dropHint').classList.remove('hidden');
      }
      if (dragging) {
        ghost.style.left = e.clientX - 28 + 'px'; ghost.style.top = e.clientY - 28 + 'px';
        const outside = !over($('#start').getBoundingClientRect(), e.clientX, e.clientY), ontb = over($('#taskbar').getBoundingClientRect(), e.clientX, e.clientY);
        $('#start').style.opacity = outside ? '0.12' : ''; document.body.classList.toggle('overtb', ontb);
        $('#dropHint').textContent = ontb ? 'Release to pin to the taskbar' : outside ? 'Release to pin to the desktop' : 'Drag out of the menu to pin';
      }
    });
    document.addEventListener('pointerup', e => {
      if (!id) return;
      const was = dragging, rdy = ready, i = id;
      if (was) {
        const ontb = over($('#taskbar').getBoundingClientRect(), e.clientX, e.clientY), outside = !over($('#start').getBoundingClientRect(), e.clientX, e.clientY);
        end(); hold();
        if (ontb || outside) { const k = ontb ? 'tbpins' : 'deskpins'; if (!pinned(k, i)) togglePin(k, i); toast((find(i) || {}).name + ' pinned to the ' + (ontb ? 'taskbar' : 'desktop')); closeStart(); }
      } else if (rdy) { end(); hold(); appMenu(i); } else end();
    });
    document.addEventListener('pointercancel', end);
    root.addEventListener('click', e => { if (suppress) { suppress = false; e.stopPropagation(); e.preventDefault(); } }, true);
    root.addEventListener('contextmenu', e => { if (e.target.closest(sel)) e.preventDefault(); });
  }

  function tick() {
    const d = new Date(), t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    $('#tbClock').innerHTML = `<span>${t}</span><span>${d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>`;
    $('#bigTime').textContent = t;
    $('#bigDate').textContent = d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function setupBack() {
    const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App; if (!App) return;
    App.addListener('backButton', () => {
      const m = document.querySelectorAll('.modal'); if (m.length) return m[m.length - 1].remove();
      const pn = document.querySelector('.panel.open'); if (pn) return pn.classList.remove('open');
      if ($('#lock') || $('#setup')) return;
      if (!$('#start').classList.contains('hidden')) return closeStart();
      if (active && wins[active]) { const c = wins[active].ctx; if (c && c.onBack && c.onBack()) return; return close(active); }
      const last = Object.keys(wins).pop(); if (last) return restore(last);
      if (App.minimizeApp) App.minimizeApp(); else App.exitApp();
    });
  }

  function start() {
    applyTheme(); renderIcons();
    $('#icons').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) open(b.dataset.id); });
    $('#startBtn').onclick = () => toggleStart(false);
    $('#searchBtn').onclick = () => toggleStart(true);
    $('#lockBtn').onclick = () => { if (OS.lockNow) OS.lockNow(); };
    $('#powerBtn').onclick = powerMenu;
    $('#userBtn').onclick = () => { closeStart(); OS.nextPage = 'accounts'; open('settings'); };
    $('#search').oninput = renderStart;
    $('#startBody').addEventListener('click', e => {
      const p = e.target.closest('[data-pin]'); if (p) { togglePin('favs', p.dataset.pin); return; }
      const s = e.target.closest('[data-s]'); if (s) { allMode = s.dataset.s === 'all'; renderStart(); return; }
      const t = e.target.closest('[data-id]'); if (t) open(t.dataset.id);
    });
    dragPin($('#startBody'), '[data-id]');
    longPress($('#icons'), '.dicon', n => appMenu(n.dataset.id));
    longPress($('#tbApps'), '.tbb', n => appMenu(n.dataset.id));
    $('#desktop').addEventListener('pointerdown', e => { if (!e.target.closest('#start,#startBtn,#searchBtn')) closeStart(); if (!e.target.closest('.panel,#widgetsBtn,#bellBtn')) document.querySelectorAll('.panel.open').forEach(p => p.classList.remove('open')); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeStart(); if (e.altKey && e.code === 'Space') { e.preventDefault(); toggleStart(true); } });
    $('#userName').textContent = userName(); $('#avatar').textContent = userName()[0].toUpperCase();
    tick(); setInterval(tick, 1000); renderTaskbar(); setupBack();
    measure(); addEventListener('resize', measure); setInterval(measure, 1500);
    const hr = new Date().getHours(); $('#bootMsg').textContent = (hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening') + '. Starting BrowOS...';
    setTimeout(() => $('#boot').classList.add('off'), store.get('bootAnim', 'on') === 'off' ? 150 : 2000);
    if (!store.get('setupDone', false)) { if (OS.setupRun) OS.setupRun(); } else if (OS.lockInit) OS.lockInit();
    if (OS.setFullscreen) { OS.setFullscreen(store.get('fullscreen', true)); document.addEventListener('visibilitychange', () => { if (!document.hidden) OS.setFullscreen(store.get('fullscreen', true)); }); }
    setTimeout(() => { if (store.get('setupDone') && !store.get('notifAsked') && sys.available()) { store.set('notifAsked', true); sys.ask(); } }, 4000);
  }

  // ---- Per-app preferences and notifications ----
  const appPref = (id, k, d) => { const p = store.get('appPrefs', {})[id]; return p && k in p && p[k] !== null ? p[k] : d; };
  function setAppPref(id, k, v) { const all = store.get('appPrefs', {}); all[id] = Object.assign({}, all[id], { [k]: v }); store.set('appPrefs', all); }
  const LN = () => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications;
  const sys = {
    available: () => !!LN(),
    async status() { try { return (await LN().checkPermissions()).display; } catch (e) { return 'unavailable'; } },
    async ask() { try { return (await LN().requestPermissions()).display; } catch (e) { return 'unavailable'; } },
    async show(title, body) { try { await LN().schedule({ notifications: [{ id: Math.floor(Math.random() * 2e9), title, body: body || '' }] }); } catch (e) {} },
    async at(id, title, body, when) { try { await LN().schedule({ notifications: [{ id, title, body: body || '', schedule: { at: new Date(when), allowWhileIdle: true } }] }); } catch (e) {} },
    async cancel(id) { try { await LN().cancel({ notifications: [{ id }] }); } catch (e) {} }
  };
  function notify(appId, title, body) {
    if (appPref(appId, 'notify', true) === false) return;
    const a = find(appId), list = store.get('notifs', []);
    list.unshift({ id: Date.now() + Math.random(), app: appId, name: a ? a.name : 'BrowOS', title, body: body || '', t: Date.now(), read: false });
    store.set('notifs', list.slice(0, 50)); toast((a ? a.name + ': ' : '') + title);
    if (store.get('sysNotify', true)) sys.show((a ? a.name + ': ' : '') + title, body);
    if (OS.notifsChanged) OS.notifsChanged();
  }
  function unregister(id) { close(id); unpinEverywhere(id); const i = apps.findIndex(a => a.id === id); if (i >= 0) apps.splice(i, 1); }
  const OS = { register, start, store, applyTheme, toast, esc, VERSION, apps, open, close, show: restore, list, refresh, sheet, modal, unregister, isCovered, togglePin, pinned, appMenu, confirmUninstall, uninstallApp, userName, appPref, setAppPref, notify, accounts, keys, sys };
  return OS;
})();
