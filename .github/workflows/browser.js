/* BrowOS Browser: Chrome-style. In the Android app it runs a real Chromium (Android WebView) window with desktop sites, an ad blocker and password saving. */
(function () {
  const OS = window.BrowOS, esc = OS.esc, HOME = 'about:home';
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };
  const fav = (u, s = 32) => `https://www.google.com/s2/favicons?sz=${s}&domain=${encodeURIComponent(host(u))}`;
  const kl = { en: 'us-en', ar: 'xa-ar', fr: 'fr-fr', es: 'es-es' };
  function searchUrl(text) {
    const l = OS.lang ? OS.lang() : 'en', e = OS.store.get('searchEngine', 'google'), t = encodeURIComponent(text);
    if (e === 'ddg') return `https://duckduckgo.com/?kl=${kl[l] || 'us-en'}&q=${t}`;
    if (e === 'bing') return `https://www.bing.com/search?setlang=${l}&q=${t}`;
    return `https://www.google.com/search?hl=${l}&q=${t}`;
  }
  function norm(s) {
    s = (s || '').trim(); if (!s) return null;
    if (/^https?:\/\//i.test(s)) return { url: s };
    if (!/\s/.test(s) && /^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(s)) return { url: 'https://' + s };
    return { search: s };
  }
  OS.normUrl = norm;
  function openExt(u) {
    const B = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser;
    if (B) B.open({ url: u }).catch(() => window.open(u, '_blank')); else window.open(u, '_blank');
  }
  OS.openExt = u => openExt(u);
  OS.favicon = fav;

  // ---- bridge to the native Chromium window (NativeBrowser plugin, added by the build) ----
  const NB = () => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.NativeBrowser;
  const handlers = {}, crashHandlers = {}; let listening = false;
  function listen() {
    const nb = NB(); if (!nb || listening) return; listening = true;
    nb.addListener('state', e => { const h = handlers[e.id]; if (h) h(e); });
    nb.addListener('credential', e => { if (OS.vaultPrompt) OS.vaultPrompt(e); });
    nb.addListener('loginform', e => { if (OS.vaultSuggest) OS.vaultSuggest(e); });
    nb.addListener('permission', e => OS.permPrompt(e));
    nb.addListener('crashed', e => { const h = crashHandlers[e.id]; if (h) h(); });
  }
  OS.nbAvailable = () => !!NB();
  OS.nbConfigure = () => { const nb = NB(); if (nb) nb.configure({ desktop: OS.store.get('desktopSite', true), adblock: OS.store.get('adblock', true), lang: OS.lang ? OS.lang() : 'en', voice: OS.store.get('voicePreset', 'off') }).catch(() => {}); };
  OS.setFullscreen = on => { const nb = NB(); if (!nb) return; nb.setFullscreen({ enabled: !!on }).then(r => { document.body.classList.toggle('fs', !!(r && r.ok && on)); }).catch(() => {}); };
  OS.nbFill = (id, u, p) => { const nb = NB(); if (nb) nb.fill({ id, user: u || '', pass: p || '' }).catch(() => {}); };
  OS.permPrompt = e => {
    const nb = NB(); if (!nb) return;
    const sp = OS.store.get('sitePerms', {}), host = (() => { try { return new URL(e.origin).hostname; } catch (x) { return e.origin; } })();
    const answer = allow => nb.answerPermission({ rid: e.rid, allow }).catch(() => {});
    if (sp[e.origin] === true) return answer(true);
    const what = (e.mic ? 'microphone' : '') + (e.mic && e.cam ? ' and ' : '') + (e.cam ? 'camera' : '');
    const m = OS.modal(`<h3>Allow ${OS.esc(host)}?</h3><p class="muted">This website wants to use your ${what}.</p><div class="col"><button class="btn pri" data-m="once">Allow</button><button class="btn" data-m="always">Always allow this site</button><button class="btn danger" data-m="no">Block</button></div>`);
    m.onclick = ev => { const k = ev.target.dataset.m; if (!k) return; m.remove(); if (k === 'always') { sp[e.origin] = true; OS.store.set('sitePerms', sp); } answer(k !== 'no'); };
  };
  OS.nbClearData = () => { const nb = NB(); return nb ? nb.clearData().catch(() => {}) : Promise.resolve(); };
  OS.nbView = function (o) {
    const nb = NB(); if (!nb) return null;
    listen();
    let created = false, shown = true, last = '', lastUrl = '', tries = 0;
    handlers[o.id] = e => { if (e.url) lastUrl = e.url; (o.onState || (() => {}))(e); };
    crashHandlers[o.id] = () => { created = false; last = ''; if (lastUrl && tries++ < 3) { OS.toast('A page ran out of memory and was closed. Reopening it...'); setTimeout(() => api.open(lastUrl), 1500); } else OS.toast('A page ran out of memory and was closed.'); };
    const pack = () => { const s = o.slot(); if (!s) return null; const r = s.getBoundingClientRect(), d = window.devicePixelRatio || 1; return { x: Math.round(r.left * d), y: Math.round(r.top * d), w: Math.round(r.width * d), h: Math.round(r.height * d) }; };
    const canShow = () => { const w = o.win(); return shown && created && w && w.classList.contains('active') && !w.classList.contains('hide') && !OS.isCovered() && !(o.covered && o.covered()); };
    function sync(force) {
      if (!created) return; const b = pack(); if (!b) return;
      const vis = canShow() && b.w > 10 && b.h > 10, key = [b.x, b.y, b.w, b.h, vis].join();
      if (key === last && !force) return; last = key;
      nb.setBounds({ id: o.id, x: b.x, y: b.y, w: Math.max(1, b.w), h: Math.max(1, b.h), visible: vis }).catch(() => {});
    }
    const iv = setInterval(sync, 200);
    const api = {
      open(url) {
        lastUrl = url;
        const b = pack() || { x: 0, y: 0, w: 1, h: 1 }, d = o.desktop ? o.desktop() : null, p = { id: o.id, url, x: b.x, y: b.y, w: b.w, h: b.h, visible: false };
        if (typeof d === 'boolean') p.desktop = d;
        created = true; last = '';
        return nb.open(p).then(() => sync(true)).catch(() => { created = false; });
      },
      load(url) { lastUrl = url; return nb.load({ id: o.id, url }); },
      back() { nb.back({ id: o.id }); }, forward() { nb.forward({ id: o.id }); },
      reload() { if (!created && lastUrl) return api.open(lastUrl); nb.reload({ id: o.id }); },
      fill(user, pass) { nb.fill({ id: o.id, user: user || '', pass: pass || '' }).catch(() => {}); },
      setDesktop(v) { if (created) nb.setDesktop({ id: o.id, desktop: v }).catch(() => {}); },
      setShown(v) { shown = v; sync(); },
      close() { created = false; last = ''; return nb.close({ id: o.id }).catch(() => {}); },
      destroy() { clearInterval(iv); delete handlers[o.id]; delete crashHandlers[o.id]; if (created) nb.close({ id: o.id }).catch(() => {}); created = false; }
    };
    return api;
  };

  const DEFAULT_SC = [{ title: 'Gmail', url: 'https://mail.google.com' }, { title: 'Calendar', url: 'https://calendar.google.com' }, { title: 'Drive', url: 'https://drive.google.com' }, { title: 'YouTube', url: 'https://www.youtube.com' }];

  OS.register({
    id: 'browser', name: 'Browser', icon: '🌐', color: '#2563eb', cat: 'Internet', w: 700, h: 640,
    build(el, ctx) {
      const st = ctx.store, tabs = [], closed = []; let act = 0, nid = 1, lt;
      const useNative = () => OS.nbAvailable() && st.get('engine', 'native') === 'native';
      const marks = () => st.get('bookmarks', []);
      const scuts = () => st.get('shortcuts', DEFAULT_SC);
      const newTab = () => { tabs.push({ id: nid++, mode: 'home', hist: [], idx: -1, url: '', title: '', back: false, fwd: false, loading: false, blocked: 0, nv: null }); act = tabs.length - 1; };
      const T = () => tabs[act];
      const urlOf = t => t.mode === 'native' ? t.url : t.mode === 'frame' ? t.hist[t.idx] : '';
      const label = t => t.mode === 'home' ? 'New Tab' : (t.title || host(urlOf(t)));
      const icon = t => t.mode === 'home' ? '<span class="tfi">✦</span>' : `<img alt="" src="${fav(urlOf(t), 32)}" onerror="this.style.visibility='hidden'">`;
      function record(u) { if (!u || u === 'about:blank') return; const h = st.get('history', []).filter(x => x.url !== u); h.unshift({ url: u, t: Date.now() }); st.set('history', h.slice(0, 200)); }
      function nvFor(t) {
        if (!t.nv) t.nv = OS.nbView({ id: 'b' + Date.now() + '-' + t.id, win: () => el.closest('.win'), slot: () => el.querySelector('.nbslot'), covered: () => !!el.querySelector('.sheet,.bmenu'), desktop: () => OS.appPref('browser', 'desktop', null), onState: e => onState(t, e) });
        return t.nv;
      }
      function onState(t, e) {
        t.url = e.url || t.url; t.title = e.title || ''; t.back = !!e.canGoBack; t.fwd = !!e.canGoForward; t.loading = !!e.loading; t.blocked = e.blocked || 0;
        if (!e.loading && t.url && t.url !== t._rec) { t._rec = t.url; record(t.url); }
        if (t === T()) chrome(); else labels();
      }
      function go(u) {
        const t = T();
        if (useNative()) {
          const nv = nvFor(t), first = t.mode !== 'native'; t.mode = 'native'; t.url = u; t.loading = true; t.blocked = 0;
          if (first) { render(); nv.open(u); } else { nv.load(u); chrome(); }
        } else {
          if (st.get('alwaysExt', []).includes(host(u))) { openExt(u); return ctx.toast('Opened in Chrome (you chose Always for this site)'); }
          if (t.nv) t.nv.close();
          t.mode = 'frame'; t.hist = t.hist.slice(0, t.idx + 1); t.hist.push(u); t.idx++; record(u); render();
        }
      }
      function goHome() { const t = T(); if (t.nv) t.nv.close(); t.mode = 'home'; t.url = ''; t.loading = false; render(); }
      function back() { const t = T(); if (t.mode === 'native') { t.back ? t.nv.back() : goHome(); } else if (t.mode === 'frame') { if (t.idx > 0) { t.idx--; render(); } else goHome(); } }
      function fwd() { const t = T(); if (t.mode === 'native') { if (t.fwd) t.nv.forward(); } else if (t.mode === 'frame' && t.idx < t.hist.length - 1) { t.idx++; render(); } }
      function submit(text) {
        const r = norm(text); if (!r) return;
        if (r.search) { const u = searchUrl(r.search); if (!useNative() && st.get('searchExt', true)) { openExt(u); return ctx.toast('Search opened in a Chrome tab'); } return go(u); }
        go(r.url);
      }
      const canFwd = t => t.mode === 'native' ? t.fwd : t.mode === 'frame' && t.idx < t.hist.length - 1;
      function labels() { tabs.forEach((t, i) => { const n = el.querySelector(`[data-tab="${i}"] span`); if (n) n.textContent = label(t); }); }
      function chrome() {
        const t = T(), a = el.querySelector('.addr'); if (!a) return;
        if (document.activeElement !== a) a.value = urlOf(t);
        el.querySelector('[data-a=back]').disabled = t.mode === 'home'; el.querySelector('[data-a=fwd]').disabled = !canFwd(t);
        const star = el.querySelector('[data-a=star]'); star.disabled = t.mode === 'home'; star.textContent = marks().some(b => b.url === urlOf(t)) ? '★' : '☆';
        const lb = el.querySelector('.lbar'); if (lb) lb.classList.toggle('on', t.loading);
        const blk = el.querySelector('[data-blk]'); if (blk) blk.textContent = st.get('adblock', true) && t.blocked ? '🛡 ' + t.blocked + ' blocked' : (t.mode === 'native' ? 'Chromium' : '');
        labels();
      }
      function render() {
        const t = T(), home = t.mode === 'home';
        el.innerHTML = `<div class="br">
          <div class="tabs">${tabs.map((x, i) => `<div class="tab ${i === act ? 'on' : ''}" data-tab="${i}">${icon(x)}<span>${esc(label(x))}</span><button data-close="${i}" aria-label="Close tab">&#10005;</button></div>`).join('')}<button class="tabnew" data-a="newtab" aria-label="New tab">+</button></div>
          <div class="tools"><button data-a="back" aria-label="Back">&#8592;</button><button data-a="fwd" aria-label="Forward">&#8594;</button><button data-a="reload" aria-label="Reload">&#10227;</button>
          <input class="field addr" data-submit placeholder="Search or type a URL" autocapitalize="off" autocorrect="off"><button data-a="star" aria-label="Bookmark">☆</button>${OS.nbAvailable() ? '<button data-a="key" aria-label="Passwords">🔑</button>' : ''}<button data-a="menu" aria-label="Menu">&#8942;</button></div>
          <div class="lbar"></div><div class="bview"></div></div>`;
        const view = el.querySelector('.bview');
        if (home) {
          const sc = scuts();
          view.innerHTML = `<div class="ntp"><div class="sc">${sc.map((s, i) => `<div class="scut"><button class="scm" data-sm="${i}" aria-label="Edit shortcut">&#8942;</button><button class="scb" data-sc="${i}"><span class="sci"><img alt="" src="${fav(s.url, 64)}" onerror="this.replaceWith(document.createTextNode('${esc((s.title || '?')[0].toUpperCase())}'))"></span><span>${esc(s.title)}</span></button></div>`).join('')}<div class="scut"><button class="scb" data-a="addsc"><span class="sci">+</span><span>Add shortcut</span></button></div></div>
            <p class="note">${useNative() ? 'Chromium' + (st.get('desktopSite', true) ? ' · desktop sites' : '') + (st.get('adblock', true) ? ' · ad blocker on' : '') : 'Frame mode: many sites refuse to load here. Install the Android app for the full Chromium browser.'}</p></div>`;
        } else if (t.mode === 'native') {
          view.innerHTML = '<div class="nbslot"></div>';
        } else {
          const f = document.createElement('iframe');
          f.setAttribute('sandbox', 'allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation'); f.setAttribute('allow', 'fullscreen; autoplay; encrypted-media; picture-in-picture'); f.allowFullscreen = true;
          const done = () => { const b = el.querySelector('.lbar'); if (b) b.classList.remove('on'); };
          f.onload = done; clearTimeout(lt); lt = setTimeout(done, 15000); t.loading = true;
          view.append(f); f.src = urlOf(t);
          view.insertAdjacentHTML('beforeend', '<div class="hint"><span>Page not showing?</span><span><button data-a="ext">Open in a window</button> <button data-a="always">Always</button></span></div>');
        }
        tabs.forEach(x => { if (x.nv) x.nv.setShown(x === t && x.mode === 'native'); });
        chrome();
      }
      const sheet = html => OS.sheet(el.querySelector('.br'), html);
      function scForm(i) {
        const cur = i >= 0 ? scuts()[i] : { title: '', url: '' };
        const m = OS.modal(`<h3>${i >= 0 ? 'Edit shortcut' : 'Add shortcut'}</h3><input class="field" data-f="t" placeholder="Name" maxlength="20" value="${esc(cur.title)}"><input class="field" data-f="u" placeholder="https://example.com" autocapitalize="off" value="${esc(cur.url)}"><div class="err"></div><div class="col"><button class="btn pri" data-m="ok">Save</button>${i >= 0 ? '<button class="btn danger" data-m="rm">Remove</button>' : ''}<button class="btn" data-m="x">Cancel</button></div>`);
        m.onclick = e => {
          const k = e.target.dataset.m; if (!k) return; const list = scuts().slice();
          if (k === 'x') return m.remove();
          if (k === 'rm') { list.splice(i, 1); st.set('shortcuts', list); m.remove(); return render(); }
          const r = norm(m.querySelector('[data-f=u]').value), name = m.querySelector('[data-f=t]').value.trim();
          if (!r || !r.url) return m.querySelector('.err').textContent = 'Type a web address.';
          const item = { title: name || host(r.url), url: r.url }; if (i >= 0) list[i] = item; else list.push(item);
          st.set('shortcuts', list); m.remove(); render();
        };
      }
      function menu() {
        const old = el.querySelector('.bmenu'); if (old) return old.remove();
        const nbOk = OS.nbAvailable(), on = k => st.get(k, true);
        const it = (id, ic, label, extra) => `<button class="bmi" data-mi="${id}"><span class="bmic">${ic}</span><span>${label}</span>${extra || ''}</button>`;
        const p = document.createElement('div'); p.className = 'bmenu';
        p.innerHTML = it('newtab', '➕', 'New tab') + it('hist', '🕘', 'History') + it('clrd', '🗑️', 'Delete browsing data') + '<hr>' + it('bm', '⭐', 'Bookmarks') + it('recent', '🗂️', 'Recent tabs') + '<hr>'
          + (nbOk ? it('desk', '🖥️', 'Desktop site', `<i class="bmck ${on('desktopSite') ? 'on' : ''}"></i>`) + it('ads', '🛡️', 'Ad blocker', `<i class="bmck ${on('adblock') ? 'on' : ''}"></i>`) + '<hr>' : '')
          + it('ext', '↗️', 'Open in Chrome') + it('sett', '⚙️', 'Settings') + it('cust', '✏️', 'Customise new tab page');
        el.querySelector('.br').append(p);
        p.onclick = async ev => {
          const b = ev.target.closest('[data-mi]'); if (!b) return; const a = b.dataset.mi;
          if (a === 'desk') { st.set('desktopSite', !on('desktopSite')); OS.nbConfigure(); p.remove(); return menu(); }
          if (a === 'ads') { st.set('adblock', !on('adblock')); OS.nbConfigure(); p.remove(); return menu(); }
          p.remove();
          if (a === 'newtab') { newTab(); render(); }
          else if (a === 'hist') history(); else if (a === 'bm') bookmarks();
          else if (a === 'recent') { const s2 = sheet(`<h3>Recent tabs</h3>${closed.slice(0, 8).map(u => `<div class="frow"><button class="fmain" data-o="${esc(u)}"><span class="fn"><b>${esc(host(u))}</b><small>${esc(u)}</small></span></button></div>`).join('') || '<p class="muted">No closed tabs yet.</p>'}<button class="btn" data-s="x">Close</button>`); s2.onclick = e2 => { const t2 = e2.target.closest('button'); if (!t2) return; if (t2.dataset.o) { s2.remove(); go(t2.dataset.o); } else s2.remove(); }; }
          else if (a === 'clrd') { if (confirm('Clear history, cookies and website data? You will be signed out of websites.')) { st.set('history', []); await OS.nbClearData(); ctx.toast('Browsing data cleared'); } }
          else if (a === 'ext') { T().mode === 'home' ? ctx.toast('Open a page first.') : openExt(urlOf(T())); }
          else if (a === 'sett') { OS.nextPage = 'browser'; OS.open('settings'); }
          else if (a === 'cust') scForm(-1);
        };
      }
      function bookmarks() {
        const s = sheet(`<h3>Bookmarks</h3>${marks().map((b, i) => `<div class="frow"><button class="fmain" data-o="${esc(b.url)}"><span class="fn"><b>${esc(b.title || host(b.url))}</b><small>${esc(b.url)}</small></span></button><button class="fmore" data-d="${i}">&#10005;</button></div>`).join('') || '<p class="muted">No bookmarks. Tap the star on a page.</p>'}<button class="btn" data-s="x">Close</button>`);
        s.onclick = e => {
          const t = e.target.closest('button'); if (!t) return;
          if (t.dataset.o) { s.remove(); go(t.dataset.o); }
          else if (t.dataset.d) { const m = marks().slice(); m.splice(+t.dataset.d, 1); st.set('bookmarks', m); bookmarks(); chrome(); }
          else if (t.dataset.s) s.remove();
        };
      }
      function history() {
        const h = st.get('history', []);
        const s = sheet(`<h3>History</h3>${h.map(x => `<div class="frow"><button class="fmain" data-o="${esc(x.url)}"><span class="fn"><b>${esc(host(x.url))}</b><small>${esc(x.url)} · ${new Date(x.t).toLocaleString()}</small></span></button></div>`).join('') || '<p class="muted">No history yet.</p>'}<button class="btn" data-s="x">Close</button>`);
        s.onclick = e => { const t = e.target.closest('button'); if (!t) return; if (t.dataset.o) { s.remove(); go(t.dataset.o); } else if (t.dataset.s) s.remove(); };
      }
      el.onclick = e => {
        if (!e.target.closest('.bmenu,[data-a=menu]')) { const mm = el.querySelector('.bmenu'); if (mm) mm.remove(); }
        const t = e.target.closest('button'), tab = e.target.closest('[data-tab]');
        if (t && t.dataset.close !== undefined) { const i = +t.dataset.close; if (urlOf(tabs[i])) closed.unshift(urlOf(tabs[i])); if (tabs[i].nv) tabs[i].nv.destroy(); tabs.splice(i, 1); if (!tabs.length) newTab(); act = Math.min(act, tabs.length - 1); return render(); }
        if (tab && !t) { act = +tab.dataset.tab; return render(); }
        if (!t || t.disabled) return;
        const a = t.dataset.a, tb = T();
        if (t.dataset.sc !== undefined) return go(scuts()[+t.dataset.sc].url);
        if (t.dataset.sm !== undefined) return scForm(+t.dataset.sm);
        if (a === 'addsc') return scForm(-1);
        if (a === 'newtab') { newTab(); render(); }
        else if (a === 'back') back(); else if (a === 'fwd') fwd();
        else if (a === 'reload') { if (tb.mode === 'native') tb.nv.reload(); else if (tb.mode === 'frame') render(); }
        else if (a === 'menu') menu();
        else if (a === 'key') { if (tb.mode === 'native') OS.vaultFillMenu(urlOf(tb), (u, p) => tb.nv.fill(u, p)); else ctx.toast('Open a page first.'); }
        else if (a === 'ext') openExt(urlOf(tb));
        else if (a === 'always') { const h = host(urlOf(tb)), l = st.get('alwaysExt', []); if (!l.includes(h)) st.set('alwaysExt', [...l, h]); openExt(urlOf(tb)); ctx.toast('BrowOS will always open ' + h + ' in Chrome'); }
        else if (a === 'star') {
          const m = marks().slice(), i = m.findIndex(b => b.url === urlOf(tb));
          if (i >= 0) m.splice(i, 1); else m.push({ title: tb.title || host(urlOf(tb)), url: urlOf(tb) });
          st.set('bookmarks', m); chrome(); ctx.toast(i >= 0 ? 'Bookmark removed' : 'Bookmark added');
        }
      };
      el.onkeydown = e => { if (e.key === 'Enter' && e.target.matches('input[data-submit]')) { e.target.blur(); submit(e.target.value); } };
      ctx.onBack = () => { const t = T(); if (t.mode === 'home') return false; back(); return true; };
      newTab(); render();
      return () => { tabs.forEach(t => t.nv && t.nv.destroy()); clearTimeout(lt); };
    }
  });
  try { OS.nbConfigure(); } catch (e) {}
})();
