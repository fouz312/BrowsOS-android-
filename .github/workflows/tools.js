/* BrowOS Calendar, Paint, Task Manager, App Store. */
(function () {
  const OS = window.BrowOS, esc = OS.esc, p2 = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());

  const evNum = id => Number(String(id).slice(-9)) % 2000000000;
  function schedEvent(e) { OS.sys.cancel(evNum(e.id)); if (e.time) { const at = new Date(e.date + 'T' + e.time).getTime(); if (at > Date.now()) OS.sys.at(evNum(e.id), e.title, 'Starting now', at); } }
  /* ---------- Calendar ---------- */
  OS.register({
    id: 'calendar', name: 'Calendar', icon: '📅', color: '#f97316', cat: 'Productivity', w: 400, h: 580,
    build(el, ctx) {
      const st = ctx.store, now = new Date(); let y = now.getFullYear(), m = now.getMonth(), sel = ymd(now);
      const evs = () => st.get('events', []);
      function draw() {
        const first = new Date(y, m, 1), lead = (first.getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate(), all = evs();
        let cells = '<i></i>'.repeat(lead);
        for (let d = 1; d <= days; d++) {
          const k = y + '-' + p2(m + 1) + '-' + p2(d);
          cells += `<button class="day ${k === ymd(now) ? 'today' : ''} ${k === sel ? 'sel' : ''} ${all.some(e => e.date === k) ? 'has' : ''}" data-d="${k}">${d}</button>`;
        }
        const day = all.filter(e => e.date === sel).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        el.innerHTML = `<div class="cal"><div class="nrow"><button class="btn" data-a="prev">&#8249;</button><b class="crumb" style="text-align:center">${first.toLocaleDateString([], { month: 'long', year: 'numeric' })}</b><button class="btn" data-a="next">&#8250;</button><button class="btn" data-a="today">Today</button></div>
          <div class="cgrid">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(w => `<small>${w}</small>`).join('')}${cells}</div>
          <div class="nrow"><b class="crumb">${new Date(sel + 'T00:00').toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</b><button class="btn pri" data-a="add">+ Event</button></div>
          <div class="nitems">${day.map(e => `<button class="nitem" data-e="${e.id}"><b>${esc(e.title)}</b><span>${esc(e.time || 'All day')}${e.note ? ' · ' + esc(e.note) : ''}</span></button>`).join('') || '<div class="empty">No events this day.</div>'}</div></div>`;
      }
      function form(ev) {
        const s = OS.sheet(el.querySelector('.cal'), `<h3>${ev ? 'Edit event' : 'New event'}</h3><input class="field" data-f="title" placeholder="Title" value="${esc(ev ? ev.title : '')}"><input class="field" type="time" data-f="time" value="${ev ? esc(ev.time || '') : ''}"><input class="field" data-f="note" placeholder="Note (optional)" value="${esc(ev ? ev.note || '' : '')}"><button class="btn pri" data-s="save">Save</button>${ev ? '<button class="btn" data-s="del">Delete</button>' : ''}<button class="btn" data-s="x">Cancel</button>`);
        s.onclick = e => {
          const a = e.target.dataset.s; if (!a) return;
          const f = k => s.querySelector(`[data-f=${k}]`).value.trim(), all = evs();
          if (a === 'save') {
            if (!f('title')) return ctx.toast('Please type a title.');
            if (ev) { Object.assign(all.find(x => x.id === ev.id), { title: f('title'), time: f('time'), note: f('note') }); }
            else all.push({ id: String(Date.now()), date: sel, title: f('title'), time: f('time'), note: f('note') });
            st.set('events', all); schedEvent(ev ? all.find(x => x.id === ev.id) : all[all.length - 1]);
          } else if (a === 'del') { OS.sys.cancel(evNum(ev.id)); st.set('events', all.filter(x => x.id !== ev.id)); }
          draw();
        };
      }
      el.onclick = e => {
        const t = e.target.closest('button'); if (!t) return;
        const a = t.dataset.a;
        if (t.dataset.d) { sel = t.dataset.d; draw(); }
        else if (t.dataset.e) form(evs().find(x => x.id === t.dataset.e));
        else if (a === 'prev') { m--; if (m < 0) { m = 11; y--; } draw(); }
        else if (a === 'next') { m++; if (m > 11) { m = 0; y++; } draw(); }
        else if (a === 'today') { y = now.getFullYear(); m = now.getMonth(); sel = ymd(now); draw(); }
        else if (a === 'add') form(null);
      };
      draw();
    }
  });

  /* ---------- Paint ---------- */
  OS.register({
    id: 'paint', name: 'Paint', icon: '🎨', color: '#a855f7', cat: 'Media', w: 460, h: 600,
    build(el, ctx) {
      el.innerHTML = `<div class="paint"><div class="ptools"><input type="color" value="#9b6bff" data-color aria-label="Colour">
        <button class="btn on" data-size="3">Thin</button><button class="btn" data-size="8">Medium</button><button class="btn" data-size="20">Thick</button>
        <button class="btn" data-a="eraser">Eraser</button><button class="btn" data-a="clear">Clear</button><button class="btn pri" data-a="save">Save</button></div>
        <div class="pwrap"><canvas></canvas></div></div>`;
      const cv = el.querySelector('canvas'), wrap = el.querySelector('.pwrap'), g = cv.getContext('2d');
      cv.width = Math.max(300, wrap.clientWidth || 360); cv.height = Math.max(300, wrap.clientHeight || 420);
      const blank = () => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv.width, cv.height); };
      blank();
      let color = '#9b6bff', size = 3, erase = false, last = null;
      const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
      cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); last = pos(e); dot(last); });
      cv.addEventListener('pointermove', e => {
        if (!last) return; const p = pos(e);
        g.strokeStyle = erase ? '#ffffff' : color; g.lineWidth = size; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(last[0], last[1]); g.lineTo(p[0], p[1]); g.stroke(); last = p;
      });
      const stop = () => { last = null; }; cv.addEventListener('pointerup', stop); cv.addEventListener('pointercancel', stop);
      function dot(p) { g.fillStyle = erase ? '#ffffff' : color; g.beginPath(); g.arc(p[0], p[1], size / 2, 0, 7); g.fill(); }
      el.querySelector('[data-color]').oninput = e => { color = e.target.value; erase = false; el.querySelector('[data-a=eraser]').classList.remove('on'); };
      el.querySelector('.ptools').onclick = async e => {
        const t = e.target.closest('button'); if (!t) return;
        if (t.dataset.size) { size = +t.dataset.size; el.querySelectorAll('[data-size]').forEach(b => b.classList.toggle('on', b === t)); }
        else if (t.dataset.a === 'eraser') { erase = !erase; t.classList.toggle('on', erase); }
        else if (t.dataset.a === 'clear') { if (confirm('Clear the whole drawing?')) blank(); }
        else if (t.dataset.a === 'save') {
          const fs = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
          if (!fs) return ctx.toast('Saving works inside the Android app.');
          try {
            await fs.mkdir({ path: 'BrowOS/Pictures', directory: 'DATA', recursive: true }).catch(() => {});
            await fs.writeFile({ path: 'BrowOS/Pictures/paint-' + Date.now() + '.png', directory: 'DATA', data: cv.toDataURL('image/png').split(',')[1] });
            ctx.toast('Saved. Find it in Gallery.');
          } catch (err) { ctx.toast('Save failed: ' + (err.message || 'unknown')); }
        }
      };
    }
  });

  /* ---------- Task Manager ---------- */
  OS.register({
    id: 'taskmanager', name: 'Tasks', icon: '📊', color: '#06b6d4', cat: 'System', system: true, w: 420, h: 520,
    build(el, ctx) {
      let sig = '';
      const ago = t => { const s = Math.floor((Date.now() - t) / 1000); return s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + (s % 60) + 's'; };
      function draw() {
        const l = OS.list(), s = l.map(a => a.id + a.min + a.active).join();
        if (s === sig) { el.querySelectorAll('[data-up]').forEach(x => { const a = l.find(z => z.id === x.dataset.up); if (a) x.textContent = ago(a.t); }); return; }
        sig = s;
        const mem = performance.memory ? ` · JS memory ${OS.humanSize(performance.memory.usedJSHeapSize)}` : '';
        el.innerHTML = `<div class="tm"><p class="muted">${l.length} app(s) running${mem}</p>${l.map(a => `<div class="frow"><div class="fmain"><span class="fi">${a.icon}</span><span class="fn"><b>${esc(a.name)}</b><small>${a.active ? 'Active' : a.min ? 'Minimised' : 'Running'} · open <span data-up="${a.id}">${ago(a.t)}</span> · ${esc(a.cat)}</small></span></div><button class="btn" data-sw="${a.id}">Switch</button><button class="btn" data-x="${a.id}">End</button></div>`).join('')}</div>`;
      }
      el.onclick = e => {
        const t = e.target.closest('button'); if (!t) return;
        if (t.dataset.sw) OS.show(t.dataset.sw); else if (t.dataset.x) OS.close(t.dataset.x);
        sig = ''; draw();
      };
      const iv = setInterval(draw, 1000); draw();
      return () => clearInterval(iv);
    }
  });

  /* ---------- Web apps (made from a website address) ---------- */
  const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };
  function appIcon(w) {
    const src = w.iconUrl || ('https://www.google.com/s2/favicons?sz=128&domain=' + encodeURIComponent(hostOf(w.url)));
    return `<img alt="" src="${esc(src)}" onerror="this.replaceWith(document.createTextNode('🌐'))">`;
  }
  function addWeb(w) {
    OS.register({
      id: w.id, name: w.name, icon: appIcon(w), color: '#1f2937', cat: 'Web Apps', web: true, url: w.url, w: 780, h: 640,
      build(el, ctx) {
        const h = hostOf(w.url);
        if (OS.nbAvailable && OS.nbAvailable()) {
          let canBack = false, lastN = 0, ready = false;
          el.innerHTML = '<div class="webapp"><div class="nbslot"></div></div>';
          const nv = OS.nbView({
            id: w.id, win: () => el.closest('.win'), slot: () => el.querySelector('.nbslot'), desktop: () => OS.appPref(w.id, 'desktop', null),
            onState: e => {
              canBack = !!e.canGoBack;
              const m = /^\((\d+)\)/.exec(e.title || ''), n = m ? +m[1] : 0;
              if (ready && n > lastN) OS.notify(w.id, n + ' new', e.title);
              lastN = n; if (!e.loading) ready = true;
            }
          });
          nv.open(w.url);
          const hdr = el.closest('.win') && el.closest('.win').querySelector('header'), wb = hdr && hdr.querySelector('.wb');
          if (hdr && wb) { const k = document.createElement('button'); k.className = 'hk'; k.textContent = '🔑'; k.title = 'Passwords'; k.onclick = ev => { ev.stopPropagation(); OS.vaultFillMenu(w.url, (u, p) => nv.fill(u, p)); }; hdr.insertBefore(k, wb); }
          ctx.onBack = () => { if (canBack) { nv.back(); return true; } return false; };
          return () => nv.destroy();
        }
        if (OS.store.get('alwaysExt', []).includes(h)) { el.innerHTML = '<div class="empty">This app opens in Chrome because you chose Always.</div>'; OS.openExt(w.url); return; }
        el.innerHTML = '<div class="webapp"><iframe sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation" allow="fullscreen; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe><div class="hint"><span>Page not showing?</span><span><button data-x>Open in a window</button> <button data-a>Always</button></span></div></div>';
        el.querySelector('iframe').src = w.url;
        el.querySelector('[data-x]').onclick = () => OS.openExt(w.url);
        el.querySelector('[data-a]').onclick = () => { OS.store.set('alwaysExt', [...OS.store.get('alwaysExt', []), h]); OS.openExt(w.url); ctx.toast('Always opens in Chrome'); };
      }
    });
  }
  OS.store.get('webapps', []).forEach(addWeb);
  OS.removeWebApp = id => { OS.unregister(id); OS.store.set('webapps', OS.store.get('webapps', []).filter(x => x.id !== id)); };

  /* ---------- BrowStore ---------- */
  const INFO = {
    calculator: 'Add, subtract, multiply and divide, with history.', notes: 'Write notes that save automatically.', settings: 'Wallpaper, theme, apps and privacy.',
    clock: 'Clock, world clock, stopwatch and timer.', files: 'Manage files in BrowOS storage.', browser: 'A Chromium browser with desktop sites and an ad blocker.', gallery: 'View your images full screen.',
    music: 'Play audio files you add.', calendar: 'Monthly calendar with events and reminders.', paint: 'Draw and save pictures.', taskmanager: 'See and close running apps.', appstore: 'Get and manage apps and websites.',
    video: 'Play video files you add.', terminal: 'A command window for BrowOS files and settings.', weather: 'Current weather and a 5-day forecast.', pdf: 'Read PDF files.', vault: 'Encrypted password manager.'
  };
  const SUGG = [['YouTube', 'https://www.youtube.com'], ['Photopea', 'https://www.photopea.com'], ['Wikipedia', 'https://en.wikipedia.org'], ['Gmail', 'https://mail.google.com'], ['Claude', 'https://claude.ai/new'], ['Teams', 'https://teams.microsoft.com'], ['Canva', 'https://www.canva.com'], ['Spotify', 'https://open.spotify.com']];
  OS.register({
    id: 'appstore', name: 'BrowStore', icon: '🛍️', color: '#8b5cf6', cat: 'System', system: true, w: 780, h: 600,
    build(el, ctx) {
      let page = 'discover', q = '', lastNarrow = null;
      const st = ctx.store, off = () => st.get('uninstalled', []), narrow = () => el.clientWidth < 560;
      const match = (a, n) => !q || (n + ' ' + (a.cat || '')).toLowerCase().includes(q.toLowerCase());
      const webs = () => OS.apps.filter(a => a.web);
      const builtins = () => OS.apps.filter(a => !a.web && (!a.hidden || st.get('secretUnlocked')));
      function card(a) {
        const inst = !off().includes(a.id), run = inst && !a.system ? `<button class="btn" data-un="${a.id}">${a.web ? 'Remove' : 'Uninstall'}</button>` : '';
        return `<div class="bcard"><span class="ico" style="--g:${a.color}">${a.icon}</span><b>${esc(a.name)}</b><small>${esc(a.web ? hostOf(a.url) : INFO[a.id] || 'BrowOS app')}</small><div class="btns">${inst ? `<button class="btn pri" data-open="${a.id}">Open</button>` : `<button class="btn pri" data-inst="${a.id}">Install</button>`}${run}</div></div>`;
      }
      function sugCard(s, i) {
        const have = webs().find(w => w.url === s[1]);
        return `<div class="bcard"><span class="ico" style="--g:#1f2937"><img alt="" src="https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(hostOf(s[1]))}" onerror="this.replaceWith(document.createTextNode('🌐'))"></span><b>${esc(s[0])}</b><small>${esc(hostOf(s[1]))}</small><div class="btns">${have ? `<button class="btn pri" data-open="${have.id}">Open</button>` : `<button class="btn pri" data-addsug="${i}">Add</button>`}</div></div>`;
      }
      function main() {
        if (page === 'discover') {
          const feat = ['browser', 'vault', 'weather', 'pdf', 'terminal', 'video'].map(id => OS.apps.find(a => a.id === id)).filter(a => a && match(a, a.name));
          const sg = SUGG.map((s, i) => [s, i]).filter(([s]) => match({}, s[0]));
          return `<h2>Discover</h2><div class="bgrid">${feat.map(card).join('')}</div><h2>Websites as apps</h2><div class="bgrid">${sg.map(([s, i]) => sugCard(s, i)).join('')}</div>`;
        }
        if (page === 'apps') return `<h2>BrowOS Apps</h2><div class="bgrid">${builtins().filter(a => match(a, a.name)).map(card).join('')}</div>`;
        const lib = OS.apps.filter(a => !off().includes(a.id) && (!a.hidden || st.get('secretUnlocked')) && match(a, a.name));
        return `<h2>Library</h2><div class="bgrid">${lib.map(card).join('') || '<p class="muted">Nothing here yet.</p>'}</div>`;
      }
      function draw() {
        const n = narrow(); lastNarrow = n;
        const nav = [['discover', 'Discover'], ['apps', 'BrowOS Apps'], ['library', 'Library']].map(([k, t]) => `<button class="bsn ${page === k ? 'on' : ''}" data-pg="${k}">${t}</button>`).join('');
        el.innerHTML = `<div class="bs ${n ? 'narrow' : ''}"><div class="bsl"><div class="brand"><span class="logo"></span>BrowStore</div>${nav}<span class="grow"></span><button class="addweb" data-a="addsite">+ Add a website</button><button class="addweb" data-a="more">&#8943;</button></div>
          <div class="bsm"><input class="field" type="search" placeholder="Search store" value="${esc(q)}">${main()}<p class="muted small">Installing or uninstalling only shows or hides apps already inside BrowOS. Websites are added as web apps and are not downloaded. Nothing is pinned automatically: pin from Start.</p></div></div>`;
        const inp = el.querySelector('input'); inp.oninput = () => { q = inp.value; const p = inp.selectionStart; draw(); const x = el.querySelector('input'); x.focus(); x.setSelectionRange(p, p); };
      }
      function addSite(pre) {
        const m = OS.modal(`<h3>Add a website</h3><div class="row">${SUGG.slice(0, 4).map((s, i) => `<button class="btn" data-p="${i}">${esc(s[0])}</button>`).join('')}</div><input class="field" data-f="u" placeholder="Website address" autocapitalize="off" value="${esc(pre ? pre[1] : '')}"><input class="field" data-f="n" placeholder="Name (optional)" maxlength="24" value="${esc(pre ? pre[0] : '')}"><input class="field" data-f="i" placeholder="Icon image address (optional)" autocapitalize="off"><div class="err"></div><div class="col"><button class="btn pri" data-m="ok">Add</button><button class="btn" data-m="x">Cancel</button></div>`);
        m.onclick = e => {
          const t = e.target.dataset; if (t.p !== undefined) { const s = SUGG[+t.p]; m.querySelector('[data-f=u]').value = s[1]; m.querySelector('[data-f=n]').value = s[0]; return; }
          if (!t.m) return; if (t.m === 'x') return m.remove();
          const raw = m.querySelector('[data-f=u]').value.trim(), er = m.querySelector('.err');
          if (/^http:\/\//i.test(raw)) return er.textContent = 'Only https:// addresses work.';
          const r = OS.normUrl(raw); if (!r || !r.url) return er.textContent = 'Type a web address, like youtube.com';
          const ic = m.querySelector('[data-f=i]').value.trim(), nm = m.querySelector('[data-f=n]').value.trim() || hostOf(r.url);
          const w = { id: 'web-' + Date.now(), name: nm, url: r.url }; if (/^https:\/\//i.test(ic)) w.iconUrl = ic;
          st.set('webapps', [...st.get('webapps', []), w]); addWeb(w); OS.refresh(); m.remove(); ctx.toast(nm + ' added. Pin it from Start.'); page = 'library'; draw();
        };
      }
      el.onclick = e => {
        const t = e.target.closest('button'); if (!t) return; const d = t.dataset;
        if (d.pg) page = d.pg;
        else if (d.open) { OS.open(d.open); return; }
        else if (d.inst) { st.set('uninstalled', off().filter(x => x !== d.inst)); OS.refresh(); ctx.toast('Installed. Find it in Start > All apps, then pin it.'); }
        else if (d.un) { OS.confirmUninstall(d.un, draw); return; }
        else if (d.addsug !== undefined) return addSite(SUGG[+d.addsug]);
        else if (d.a === 'addsite') return addSite();
        else if (d.a === 'more') { const m = OS.modal('<h3>BrowStore</h3><div class="col"><button class="btn" data-m="s">Open Settings, Apps</button><button class="btn" data-m="x">Close</button></div>'); m.onclick = ev => { const k = ev.target.dataset.m; if (!k) return; m.remove(); if (k === 's') { OS.nextPage = 'apps'; OS.open('settings'); } }; return; }
        else return;
        draw();
      };
      if (window.ResizeObserver) new ResizeObserver(() => { if (narrow() !== lastNarrow) draw(); }).observe(el);
      draw();
    }
  });
})();
