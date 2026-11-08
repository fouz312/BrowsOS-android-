/* BrowOS Settings: sidebar on the left, cards with dropdowns and switches on the right. */
(function () {
  const OS = window.BrowOS, esc = OS.esc;
  const FS = () => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
  const accents = ['#3b9cff', '#9b6bff', '#ec4899', '#f43f5e', '#f59e0b', '#34d399', '#22d3ee'];
  const walls = [['night', 'Night City', 'radial-gradient(ellipse at 50% 105%,#d01aa5,#241049 70%)'], ['aurora', 'Aurora', 'linear-gradient(135deg,#14b8a6,#7c3aed)'], ['sunset', 'Sunset', 'linear-gradient(#6d2a8f,#ffb36b)'], ['ocean', 'Ocean', 'linear-gradient(160deg,#0ea5e9,#0b1b3a)'], ['rose', 'Rose', 'linear-gradient(160deg,#fb7185,#4c1d95)'], ['midnight', 'Midnight', 'linear-gradient(160deg,#111827,#000)']];
  const fmt = { dim: v => Math.round(v * 100) + '%', blur: v => v + 'px', glass: v => Math.round(v * 100) + '%', topfix: v => v + 'px' };
  const pages = [['personal', 'Personalization'], ['startup', 'Startup'], ['taskbar', 'Taskbar'], ['browser', 'Browser & privacy'], ['apps', 'Apps'], ['widgets', 'Widgets'], ['accounts', 'Accounts'], ['storage', 'Storage & reset'], ['about', 'About'], ['credits', 'Credits']];
  const keywords = { personal: 'wallpaper theme accent colour dark light transparency corners window buttons title bar desktop text icons clock', startup: 'lock password language animation setup status bar', taskbar: 'taskbar style windows floating', browser: 'chromium desktop site ad blocker search engine passwords cookies history', apps: 'apps pin notifications desktop site uninstall', widgets: 'weather calendar notes battery', accounts: 'name google sign in guest', storage: 'storage reset data', about: 'version', credits: 'created inspired youtube' };
  OS.register({
    id: 'settings', name: 'Settings', icon: '⚙️', color: '#475569', cat: 'System', system: true, w: 780, h: 640,
    build(el, ctx) {
      const st = ctx.store, src = u => window.Capacitor.convertFileSrc(u);
      let cur = OS.nextPage || null, q = '', lastWide = null; OS.nextPage = null;
      if (cur === 'themes') cur = 'personal';
      const wide = () => el.clientWidth >= 560;
      const sw = (k, def) => { const on = st.get(k, def); return `<button class="sw ${on ? 'on' : ''}" data-tg="${k}" data-def="${def ? 1 : 0}" role="switch" aria-checked="${on}"><i></i></button>`; };
      const sel = (k, def, opts) => { const v = String(st.get(k, def)); return `<select class="sel" data-sel="${k}">${opts.map(([val, n]) => `<option value="${val}" ${String(val) === v ? 'selected' : ''}>${n}</option>`).join('')}</select>`; };
      const sl = (k, label, min, max, step, def) => `<label class="sl"><span>${label}: <b data-v="${k}">${fmt[k](st.get(k, def))}</b></span><input type="range" class="rng" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${st.get(k, def)}"></label>`;
      const row = (title, sub, ctl) => `<div class="srow"><span>${title}${sub ? `<br><small class="muted">${sub}</small>` : ''}</span>${ctl}</div>`;
      const aid = id => OS.apps.find(a => a.id === id);

      const P = {
        personal() {
          const mine = st.get('walls', []), cw = st.get('wall', 'night');
          return `<h3 class="shead">Wallpaper</h3><div class="scard"><div class="row">${walls.map(([k, n, bg]) => `<button class="wp ${cw === k ? 'on' : ''}" data-wall="${k}" aria-label="${n}" style="background:${bg}"></button>`).join('')}</div></div>
            <h3 class="shead">Your private photos</h3><div class="scard"><div class="row">${mine.map(w => `<span class="wpw"><button class="wp ${cw === 'custom' && st.get('wallUri') === w.uri ? 'on' : ''}" data-cw="${w.id}" style="background-image:url('${src(w.uri)}')"></button><button class="wpx" data-dw="${w.id}" aria-label="Delete">&#10005;</button></span>`).join('')}<button class="btn" data-a="addwall">+ Add photo</button></div><p class="muted">Photos are copied into BrowOS's private storage, hidden from Gallery, and never uploaded.</p></div>
            <h3 class="shead">Accent color</h3><div class="scard"><div class="row">${accents.map(c => `<button class="swatch ${st.get('accent', '#9b6bff') === c ? 'on' : ''}" data-accent="${c}" aria-label="Accent ${c}" style="background:${c}"></button>`).join('')}<input type="color" class="swatch" data-accentc value="${st.get('accent', '#9b6bff')}" aria-label="Custom colour"></div></div>
            <h3 class="shead">Windows</h3><div class="scard">${row('Theme', '', sel('theme', 'dark', [['dark', 'Dark'], ['light', 'Light']]))}${row('Window corners', '', sel('wcorner', 'round', [['round', 'Rounded'], ['square', 'Square'], ['pill', 'Extra round']]))}${row('Window buttons', 'Where the minimise, maximise and close buttons go', sel('wbtn', 'win', [['win', 'Windows'], ['mac', 'Mac']]))}${row('Title bar', '', sel('tbar', 'light', [['light', 'Light'], ['dark', 'Dark']]))}${sl('glass', 'Transparency', 0.3, 1, 0.02, 0.74)}</div>
            <h3 class="shead">Wallpaper look</h3><div class="scard">${sl('dim', 'Darkness', 0, 0.7, 0.05, 0)}${sl('blur', 'Blur', 0, 20, 1, 0)}</div>
            <h3 class="shead">Desktop text</h3><div class="scard">${row('Show desktop text', 'Names under desktop icons', sw('icnames', true))}${row('Desktop clock', '', sw('clockOn', true))}${row('Icon size', '', sel('isz', 'm', [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']]))}</div>`;
        },
        startup() {
          const has = OS.lockHasPassword();
          return `<h3 class="shead">Language</h3><div class="scard">${row('Language', 'Screens and the language websites are asked for', `<select class="sel noi18n" data-lang="1">${OS.languages.map(l => `<option value="${l[0]}" ${OS.lang() === l[0] ? 'selected' : ''}>${l[1]}</option>`).join('')}</select>`)}<p class="muted">Some screens are still English only.</p></div>
            <h3 class="shead">Lock screen</h3><div class="scard">${row('Lock screen at startup', 'Shows the clock and widgets first', sw('lockOn', true))}${row('Lock again when I leave the app', '', sel('lockLeave', 'never', [['never', 'Never'], ['now', 'Right away'], ['60', 'After 1 minute'], ['300', 'After 5 minutes']]))}${row(has ? 'A password is set' : 'No password', has ? 'Asked on the lock screen' : 'Anyone can swipe up to continue', `<button class="btn" data-a="setpw">${has ? 'Change' : 'Set'}</button>`)}${has ? row('Remove password', '', '<button class="btn danger" data-a="rmpw">Remove</button>') : ''}<p class="muted">The lock screen keeps people out of the BrowOS screen. It does not encrypt your notes. Vault passwords are encrypted separately.</p></div>
            <h3 class="shead">Startup</h3><div class="scard">${row('Startup animation', '', sw('bootOn', true))}${sl('topfix', 'Space for the Android status bar', 0, 90, 2, 40)}<p class="muted">If buttons at the top of a window are hidden under the Android status bar, raise this.</p>${row('Full screen', 'Hides the Android bars while BrowOS is open. Swipe from the screen edge to see them.', sw('fullscreen', true))}${row('Run first-time setup again', '', '<button class="btn" data-a="setup">Run</button>')}</div>`;
        },
        taskbar() {
          return `<div class="scard">${row('Taskbar style', '', sel('tb', 'win', [['win', 'Windows style'], ['float', 'Floating']]))}</div><p class="muted">Pin apps to the taskbar from Start (press and hold an app) or in Settings, Apps.</p>`;
        },
        browser() {
          const nb = OS.nbAvailable();
          return `<div class="scard">${row('Desktop sites', 'Every website and web app loads its desktop version', sw('desktopSite', true))}${row('Ad blocker', 'Blocks common ad and tracking networks. It cannot block ads YouTube plays inside its own videos.', sw('adblock', true))}${row('Offer to save passwords', 'After you sign in, ask to save the login in Vault', sw('savePrompt', true))}${row('Suggest saved logins', 'Offer to fill a saved login when a page asks you to sign in', sw('suggestLogins', true))}</div>
            <h3 class="shead">Search and engine</h3><div class="scard">${row('Search engine', '', sel('searchEngine', 'google', [['google', 'Google'], ['ddg', 'DuckDuckGo'], ['bing', 'Bing']]))}${nb ? row('Page engine', 'Chromium window works with most websites', sel('engine', 'native', [['native', 'Chromium window'], ['frame', 'Frame']])) : '<p class="muted">The Chromium window, desktop sites, ad blocker and password saving work in the installed Android app.</p>'}${row('Frame-mode searches open in', '', sel('searchExt', true, [['true', 'Chrome tab'], ['false', 'BrowOS']]))}</div>
            <h3 class="shead">Data</h3><div class="scard">${row('Clear browsing data', 'History, cookies and logins', '<button class="btn danger" data-a="clrd">Clear</button>')}${row('Sites you chose "Never" for', (st.get('neverSave', []).length) + ' site(s)', '<button class="btn" data-a="clrnever">Reset</button>')}${row('Sites set to "Always open in Chrome"', (st.get('alwaysExt', []).length) + ' site(s)', '<button class="btn" data-a="clralways">Reset</button>')}${row('Camera and microphone allowed for', Object.keys(st.get('sitePerms', {})).length + ' site(s)', '<button class="btn" data-a="clrperm">Reset</button>')}</div>`;
        },
        apps() {
          const list = OS.apps.filter(a => !st.get('uninstalled', []).includes(a.id) && (!a.hidden || st.get('secretUnlocked'))).sort((a, b) => a.name.localeCompare(b.name));
          return `<div class="scard">${row('Phone notifications', 'Timers, reminders and new-message counts also show on your phone', '<span class="muted" data-ns>...</span> <button class="btn" data-a="askn">Allow</button>')}${row('Show alerts on my phone', '', sw('sysNotify', true))}${row('Camera and microphone', 'For the Camera, Voice Changer and calls on websites', '<button class="btn" data-a="askmedia">Allow</button>')}</div><p class="muted small">Calendar, Contacts, Nearby devices and Phone permissions are not requested because BrowOS has no feature that uses them yet.</p><div class="scard">${row('Get or remove apps', 'Uninstalled apps stay in BrowStore', '<button class="btn pri" data-a="store">BrowStore</button>')}</div>
            <h3 class="shead">Installed apps</h3><div class="scard">${list.map(a => `<button class="arow" data-app="${a.id}"><span class="ico" style="--g:${a.color}">${a.icon}</span><b>${esc(a.name)}</b><small class="muted">${OS.appPref(a.id, 'notify', true) ? '🔔' : '🔕'} ${OS.pinned('favs', a.id) ? 'Start ' : ''}${OS.pinned('tbpins', a.id) ? 'Taskbar ' : ''}${OS.pinned('deskpins', a.id) ? 'Desktop' : ''}</small></button>`).join('')}</div>
            <div class="scard">${row('Unpin everything', '', '<button class="btn" data-a="unpin">Unpin all</button>')}</div>`;
        },
        widgets() {
          return `<div class="scard">${row('Weather', '', sw('wgWeather', true))}${row('Calendar', '', sw('wgCalendar', true))}${row('Notes', '', sw('wgNotes', true))}${row('Battery', '', sw('wgBattery', true))}</div><p class="muted">Open the widgets board with the weather button on the left of the taskbar.</p>`;
        },
        accounts() {
          const acc = st.get('account', { type: 'local' });
          return `<div class="scard"><div class="srow"><span>Name</span><input class="field" style="max-width:200px" data-name maxlength="20" value="${esc(OS.userName())}"></div>${row('Account type', '', `<span class="muted">${acc.type === 'guest' ? 'Guest' : 'Local account'}</span>`)}</div>
            <h3 class="shead">All accounts on this device</h3><div class="scard">${OS.accounts.list().map(a => `<div class="srow"><span><b>${esc(a.name)}</b>${a.id === OS.accounts.current ? ' <small class="muted">(this one)</small>' : ''}</span><span>${a.id === OS.accounts.current ? '' : `<button class="btn" data-acc="${a.id}">Switch</button> ${a.id === 'main' ? '' : `<button class="btn danger" data-delacc="${a.id}">Delete</button>`}`}</span></div>`).join('')}<div class="srow"><span>Add another account<br><small class="muted">Own settings, notes, Vault and lock password. Files, photos and music are shared.</small></span><button class="btn pri" data-a="addacct">Add</button></div></div>
            <div class="scard"><div class="srow"><span>Sign in with Google<br><small class="muted">Not available yet. It needs a Google Cloud project, so it is switched off instead of pretending to work.</small></span><button class="btn" disabled>Off</button></div></div>`;
        },
        storage() {
          return `<div class="scard"><p class="muted">BrowOS settings, notes and history use about ${(st.size() / 1024).toFixed(1)} KB.</p><p class="muted" data-free></p></div>
            <h3 class="shead">Backup</h3><div class="scard">${row('Export a backup file', 'Settings, notes, pins, Vault (still encrypted) and lock password. Use it to move to a newer version. Photos and music are not included yet.', '<button class="btn pri" data-a="export">Export</button>')}${row('Restore from a backup file', '', '<button class="btn" data-a="import">Restore</button>')}</div>
            <div class="scard"><div class="srow"><span>Reset all BrowOS data<br><small class="muted">Notes, settings, pins, passwords in Vault and the lock password</small></span><button class="btn danger" data-reset="1">Reset</button></div></div>`;
        },
        about() {
          return `<div class="scard"><p>BrowOS ${OS.VERSION}</p><p class="muted">A desktop-style environment that runs inside an Android app. It does not replace Android.</p></div>`;
        },
        credits() {
          return `<div class="scard"><p>BrowOS was created by <b>Fouz_312</b> using Claude (Sonnet 5.5 High).</p><p class="muted">Inspired by the BrowOS project by Allysun · <a class="lnka" data-link="https://m.youtube.com/@YourAllyhere">Allysun on YouTube</a></p><p class="muted">Weather data from Open-Meteo.com. PDF engine: pdf.js by Mozilla. Built with Capacitor.</p></div>`;
        },
        app(id) {
          const a = aid(id); if (!a) return '<p class="muted">App not found.</p>';
          const web = a.web || id === 'browser', dv = OS.appPref(id, 'desktop', null);
          return `<div class="scard"><div class="srow"><span class="mhead"><span class="ico" style="--g:${a.color}">${a.icon}</span> ${esc(a.name)}</span><button class="btn pri" data-openapp="${id}">Open</button></div></div>
            <h3 class="shead">Notifications</h3><div class="scard">${row('Allow notifications', a.web ? 'Shows an alert when the page title shows new items, like (3) Inbox. Works while the app is open.' : 'Alerts from this app inside BrowOS', `<button class="sw ${OS.appPref(id, 'notify', true) ? 'on' : ''}" data-apptg="notify" data-id="${id}" role="switch"><i></i></button>`)}</div>
            ${web ? `<h3 class="shead">Website</h3><div class="scard">${row('Desktop site', 'Applies the next time you open it', `<select class="sel" data-appsel="desktop" data-id="${id}"><option value="global" ${dv === null ? 'selected' : ''}>Use global setting</option><option value="on" ${dv === true ? 'selected' : ''}>Always desktop</option><option value="off" ${dv === false ? 'selected' : ''}>Always mobile</option></select>`)}</div>` : ''}
            <h3 class="shead">Pins</h3><div class="scard">${row('Pin to Start', '', `<button class="sw ${OS.pinned('favs', id) ? 'on' : ''}" data-pin="favs" data-id="${id}" role="switch"><i></i></button>`)}${row('Pin to taskbar', '', `<button class="sw ${OS.pinned('tbpins', id) ? 'on' : ''}" data-pin="tbpins" data-id="${id}" role="switch"><i></i></button>`)}${row('Pin to desktop', '', `<button class="sw ${OS.pinned('deskpins', id) ? 'on' : ''}" data-pin="deskpins" data-id="${id}" role="switch"><i></i></button>`)}</div>
            ${a.system ? '' : `<div class="scard">${row(a.web ? 'Remove this app' : 'Uninstall', a.web ? '' : 'It stays in BrowStore', `<button class="btn danger" data-uninst="${id}">${a.web ? 'Remove' : 'Uninstall'}</button>`)}</div>`}`;
        }
      };
      const title = c => c && c.startsWith('app:') ? (aid(c.slice(4)) || { name: 'App' }).name : (pages.find(p => p[0] === c) || ['', ''])[1];
      function nav() {
        const ids = pages.filter(([id, n]) => !q || (n + ' ' + keywords[id]).toLowerCase().includes(q.toLowerCase()));
        return ids.map(([id, n]) => `<button class="snavb ${cur === id || (cur && cur.startsWith('app:') && id === 'apps') ? 'on' : ''}" data-p="${id}">${n}</button>`).join('') || '<p class="muted">No settings found.</p>';
      }
      function draw() {
        const w = wide(); lastWide = w;
        if (w && !cur) cur = 'personal';
        const left = `<div class="sxl"><h2>Settings</h2><input class="field" type="search" id="sq" placeholder="Search settings" value="${esc(q)}"><div id="snav">${nav()}</div></div>`;
        const isApp = cur && cur.startsWith('app:');
        const body = cur ? (isApp ? P.app(cur.slice(4)) : P[cur]()) : '';
        const right = cur ? `<div class="sxr">${w && !isApp ? '' : `<button class="back" data-back="${isApp ? 'apps' : '1'}">&#8249; ${isApp ? 'Apps' : 'Settings'}</button>`}<h2>${esc(title(cur))}</h2>${body}</div>` : '';
        el.innerHTML = `<div class="sx ${w ? '' : 'narrow'}">${w || !cur ? left : ''}${right}</div>`;
        const inp = el.querySelector('#sq'); if (inp) inp.oninput = () => { q = inp.value; el.querySelector('#snav').innerHTML = nav(); };
        if (cur === 'apps') OS.sys.status().then(x => { const n = el.querySelector('[data-ns]'); if (n) n.textContent = x === 'granted' ? 'Allowed' : x === 'denied' ? 'Blocked in Android settings' : x === 'unavailable' ? 'Android app only' : 'Not allowed yet'; });
        if (cur === 'storage' && navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(e => { const n = el.querySelector('[data-free]'); if (n && e.quota) n.textContent = 'Device space available to apps: ' + OS.humanSize(e.quota - (e.usage || 0)); });
      }
      async function addWall(files) {
        const f = files[0], fs = FS(); if (!f) return;
        if (!fs) return ctx.toast('Adding photos works inside the Android app.');
        ctx.toast('Saving wallpaper...');
        try {
          const bmp = await createImageBitmap(f), sc = Math.min(1, 1920 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
          c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
          await fs.mkdir({ path: 'BrowOS/Wallpapers', directory: 'DATA', recursive: true }).catch(() => {});
          const path = 'BrowOS/Wallpapers/wall-' + Date.now() + '.jpg';
          const r = await fs.writeFile({ path, directory: 'DATA', data: c.toDataURL('image/jpeg', 0.85).split(',')[1] });
          const list = st.get('walls', []); list.push({ id: String(Date.now()), path, uri: r.uri }); st.set('walls', list);
          st.set('wall', 'custom'); st.set('wallUri', r.uri); OS.applyTheme(); draw();
        } catch (e) { ctx.toast('Could not use that image.'); }
      }
      function pwModal() {
        const has = OS.lockHasPassword();
        const m = OS.modal(`<h3>${has ? 'Change' : 'Set'} lock password</h3>${has ? '<input class="field" type="password" data-f="old" placeholder="Current password">' : ''}<input class="field" type="password" data-f="n1" placeholder="New password (4+ characters)"><input class="field" type="password" data-f="n2" placeholder="Repeat password"><input class="field" data-f="hint" placeholder="Hint shown on the lock screen (optional)"><p class="muted">If you forget this password you will have to uninstall BrowOS, which deletes its data.</p><div class="err"></div><div class="col"><button class="btn pri" data-s="ok">Save</button><button class="btn" data-s="x">Cancel</button></div>`);
        const f = k => m.querySelector(`[data-f=${k}]`), er = m.querySelector('.err');
        m.onclick = async e => {
          const b = e.target.dataset.s; if (!b) return; if (b === 'x') return m.remove();
          if (f('n1').value.length < 4 || f('n1').value !== f('n2').value) return er.textContent = 'Use 4+ characters, and make both passwords match.';
          if (has && !(await OS.lockVerify(f('old').value))) return er.textContent = 'The current password is wrong.';
          await OS.lockSetPassword(f('n1').value, f('hint').value.trim()); m.remove(); ctx.toast('Password saved'); draw();
        };
      }
      function rmModal() {
        const m = OS.modal('<h3>Remove lock password</h3><input class="field" type="password" data-f="old" placeholder="Current password"><div class="err"></div><div class="col"><button class="btn danger" data-s="ok">Remove</button><button class="btn" data-s="x">Cancel</button></div>');
        m.onclick = async e => { const b = e.target.dataset.s; if (!b) return; if (b === 'x') return m.remove(); if (!(await OS.lockVerify(m.querySelector('[data-f=old]').value))) return m.querySelector('.err').textContent = 'Wrong password.'; OS.lockClearPassword(); m.remove(); ctx.toast('Password removed'); draw(); };
      }
      el.onclick = async e => {
        const t = e.target.closest('button,input,a'); if (!t) return; const d = t.dataset;
        if (d.link) return OS.openExt(d.link);
        if (d.p) { cur = d.p; return draw(); }
        if (d.back) { cur = d.back === '1' ? null : d.back; return draw(); }
        if (d.app) { cur = 'app:' + d.app; return draw(); }
        if (d.openapp) return OS.open(d.openapp);
        if (d.uninst) { OS.confirmUninstall(d.uninst, () => { cur = 'apps'; draw(); }); return; }
        if (d.apptg) { OS.setAppPref(d.id, d.apptg, !OS.appPref(d.id, d.apptg, true)); return draw(); }
        if (d.pin) { OS.togglePin(d.pin, d.id); return draw(); }
        if (d.tg) {
          const k = d.tg, now = !st.get(k, d.def === '1');
          st.set(k, now);
          if (k === 'fullscreen') OS.setFullscreen(now);
          if (k === 'clockOn') st.set('clock', now ? 'on' : 'off'); else if (k === 'bootOn') st.set('bootAnim', now ? 'on' : 'off');
          if (k === 'desktopSite' || k === 'adblock') OS.nbConfigure();
          OS.applyTheme(); return draw();
        }
        if (d.a === 'export') return OS.backupExport();
        if (d.a === 'import') return OS.backupImport();
        if (d.a === 'askn') { await OS.sys.ask(); return draw(); }
        if (d.a === 'askmedia') { const ok = await OS.askMedia(); ctx.toast(ok ? 'Camera and microphone allowed' : 'Not allowed. Open Android Settings, Apps, BrowOS, Permissions.'); return draw(); }
        if (d.a === 'addacct') { if (confirm('Create a new account? BrowOS restarts and starts its setup.')) OS.accounts.add(); return; }
        if (d.acc) return OS.accounts.switchTo(d.acc);
        if (d.delacc) { if (confirm('Delete this account and its notes, settings and Vault?')) { OS.accounts.remove(d.delacc); draw(); } return; }
        if (d.a === 'clrperm') { st.set('sitePerms', {}); ctx.toast('Reset'); return draw(); }
        if (d.wall) { st.set('wall', d.wall); }
        else if (d.cw) { const w = st.get('walls', []).find(x => x.id === d.cw); st.set('wall', 'custom'); st.set('wallUri', w.uri); }
        else if (d.dw) {
          const list = st.get('walls', []), w = list.find(x => x.id === d.dw);
          try { await FS().deleteFile({ path: w.path, directory: 'DATA' }); } catch (err) {}
          st.set('walls', list.filter(x => x.id !== d.dw)); if (st.get('wallUri') === w.uri) { st.set('wall', 'night'); st.set('wallUri', ''); }
        }
        else if (d.a === 'addwall') return OS.media.pick('image/*', addWall);
        else if (d.a === 'setpw') return pwModal(); else if (d.a === 'rmpw') return rmModal();
        else if (d.a === 'clrd') { if (confirm('Clear history, cookies and website data?')) { st.set('history', []); await OS.nbClearData(); ctx.toast('Browsing data cleared'); } return; }
        else if (d.a === 'clrnever') { st.set('neverSave', []); ctx.toast('Reset'); }
        else if (d.a === 'clralways') { st.set('alwaysExt', []); ctx.toast('Reset'); }
        else if (d.a === 'store') return OS.open('appstore');
        else if (d.a === 'unpin') { ['favs', 'tbpins', 'deskpins'].forEach(k => st.set(k, [])); OS.refresh(); ctx.toast('Everything unpinned'); }
        else if (d.a === 'setup') { st.set('setupDone', false); OS.setupRun(); return; }
        else if (d.accent) st.set('accent', d.accent);
        else if (d.reset) {
          if (!confirm('Delete all notes, settings, pins, Vault passwords and the lock password?')) return;
          st.reset(); try { localStorage.removeItem(OS.keys.vault); } catch (err) {} OS.lockClearPassword(); OS.applyTheme(); OS.refresh(); ctx.toast('BrowOS was reset.');
        }
        else return;
        OS.applyTheme(); OS.nbConfigure(); draw();
      };
      el.onchange = e => {
        const t = e.target, d = t.dataset;
        if (d.name !== undefined) { st.set('username', t.value.trim() || 'User'); OS.refresh(); ctx.toast('Name saved'); }
        else if (d.sel) { const v = t.value === 'true' ? true : t.value === 'false' ? false : t.value; st.set(d.sel, v); OS.applyTheme(); OS.nbConfigure(); draw(); }
        else if (d.lang) { OS.setLang(t.value, true); }
        else if (d.appsel) { OS.setAppPref(d.id, 'desktop', t.value === 'on' ? true : t.value === 'off' ? false : null); ctx.toast('Applies the next time you open it'); }
      };
      el.oninput = e => {
        const t = e.target;
        if (t.dataset.k) { const v = +t.value; st.set(t.dataset.k, v); OS.applyTheme(); const b = el.querySelector(`[data-v=${t.dataset.k}]`); if (b) b.textContent = fmt[t.dataset.k](v); }
        else if (t.dataset.accentc !== undefined) { st.set('accent', t.value); OS.applyTheme(); }
      };
      if (window.ResizeObserver) new ResizeObserver(() => { if (wide() !== lastWide) draw(); }).observe(el);
      draw();
    }
  });
})();
