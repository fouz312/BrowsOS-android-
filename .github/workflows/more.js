/* BrowOS extra apps: Videos, Terminal, Weather, PDF Reader. */
(function () {
  const OS = window.BrowOS, esc = OS.esc;
  const FS = () => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
  const DIR = 'DATA', ROOT = 'BrowOS';
  const NEED = '<div class="empty">This app needs the Android app.<br>It cannot run in a normal browser.</div>';
  const fsrc = f => window.Capacitor.convertFileSrc(f.uri);

  /* ---------- Videos ---------- */
  OS.register({
    id: 'video', name: 'Videos', icon: '🎬', color: '#ef4444', cat: 'Media', w: 480, h: 560,
    build(el, ctx) {
      if (!FS()) { el.innerHTML = NEED; return; }
      let list = [];
      el.innerHTML = '<div class="vid"><video controls playsinline controlsList="nofullscreen"></video><div class="nrow"><button class="btn pri" data-a="add">+ Add videos</button><span class="muted" data-n></span></div><div class="nitems"></div></div>';
      const v = el.querySelector('video');
      v.onerror = () => ctx.toast('This video format is not supported.');
      async function load() {
        list = (await OS.media.scan(['mp4', 'webm', 'm4v', '3gp', 'mov', 'mkv', 'ogv'])).sort((a, b) => a.name.localeCompare(b.name));
        el.querySelector('[data-n]').textContent = list.length + ' video(s)';
        el.querySelector('.nitems').innerHTML = list.map((f, k) => `<button class="nitem" data-i="${k}"><b>${esc(f.name)}</b><span>${OS.humanSize(f.size || 0)}</span></button>`).join('') || '<div class="empty">No videos yet. Tap Add videos.</div>';
      }
      el.onclick = e => {
        const t = e.target.closest('button'); if (!t) return;
        if (t.dataset.i !== undefined) { v.src = fsrc(list[+t.dataset.i]); v.play().catch(() => {}); }
        else if (t.dataset.a === 'add') OS.media.pick('video/*', async fl => { ctx.toast('Importing...'); await OS.media.importInto(ROOT + '/Videos', fl); load(); });
      };
      load();
      return () => { v.pause(); v.removeAttribute('src'); v.load(); };
    }
  });

  /* ---------- Terminal ---------- */
  function normPath(cwd, p) {
    const parts = p.startsWith('/') ? [] : cwd.split('/').filter(Boolean);
    for (const s of p.split('/')) { if (!s || s === '.') continue; if (s === '..') parts.pop(); else parts.push(s); }
    return '/' + parts.join('/');
  }
  OS.termPath = normPath;
  OS.register({
    id: 'terminal', name: 'Terminal', icon: '⌨️', color: '#334155', cat: 'System', w: 480, h: 520,
    build(el, ctx) {
      let cwd = '/', hist = [], hi = 0;
      el.innerHTML = '<div class="term"><div class="tout"></div><div class="tline"><span class="tp"></span><input class="tin2" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="type help"></div></div>';
      const out = el.querySelector('.tout'), inp = el.querySelector('input'), pr = el.querySelector('.tp');
      const print = (t, c) => { const d = document.createElement('div'); d.textContent = t; if (c) d.className = c; out.append(d); out.scrollTop = out.scrollHeight; };
      const prompt_ = () => { pr.textContent = 'browos:' + cwd + '$'; };
      const real = v => v === '/' ? ROOT : ROOT + v;
      const fs = () => FS();
      const stat = async v => { try { return await fs().stat({ path: real(v), directory: DIR }); } catch (e) { return null; } };
      const abs = p => normPath(cwd, p || '.');
      async function dest(src, dst) { const s = await stat(dst); return s && s.type === 'directory' ? normPath(dst, src.split('/').pop()) : dst; }
      const HELP = ['help          show this list', 'clear         clear the screen', 'date, version, whoami, history', 'echo TEXT [> file | >> file]', 'pwd, ls [-l] [dir], cd dir', 'cat file, touch file, mkdir dir', 'rm [-r] item, mv from to, cp from to', 'apps          list apps', 'open NAME     open an app, close NAME closes it', 'theme dark|light, wall night|aurora|sunset, accent #hex'];
      async function run(line) {
        const t = (line.match(/"[^"]*"|'[^']*'|\S+/g) || []).map(s => s.replace(/^["']|["']$/g, ''));
        if (!t.length) return;
        const [c, ...a] = t;
        const needFs = ['ls', 'cd', 'cat', 'touch', 'mkdir', 'rm', 'mv', 'cp'].includes(c) || (c === 'echo' && a.some(x => x === '>' || x === '>>'));
        if (needFs && !fs()) return print('File commands need the Android app.', 'err');
        switch (c) {
          case 'help': HELP.forEach(h => print(h)); break;
          case 'clear': out.innerHTML = ''; break;
          case 'date': print(new Date().toString()); break;
          case 'version': print('BrowOS ' + OS.VERSION); break;
          case 'whoami': print('user'); break;
          case 'pwd': print(cwd); break;
          case 'history': hist.forEach((h, i) => print((i + 1) + '  ' + h)); break;
          case 'echo': {
            const i = a.findIndex(x => x === '>' || x === '>>');
            if (i < 0) return print(a.join(' '));
            const f = a[i + 1]; if (!f) return print('echo: missing file name', 'err');
            const p = real(abs(f)), text = a.slice(0, i).join(' ') + '\n';
            if (a[i] === '>') await fs().writeFile({ path: p, directory: DIR, data: text, encoding: 'utf8' });
            else await fs().appendFile({ path: p, directory: DIR, data: text, encoding: 'utf8' });
            break;
          }
          case 'ls': {
            const long = a.includes('-l'), d = abs(a.find(x => x !== '-l') || '.');
            const r = await fs().readdir({ path: real(d), directory: DIR });
            if (!r.files.length) return print('(empty)');
            r.files.sort((x, y) => x.name.localeCompare(y.name)).forEach(f => print((long ? String(f.size || 0).padStart(9) + '  ' : '') + f.name + (f.type === 'directory' ? '/' : '')));
            break;
          }
          case 'cd': { const d = abs(a[0] || '/'), s = await stat(d); if (!s || s.type !== 'directory') return print('cd: no such folder', 'err'); cwd = d; prompt_(); break; }
          case 'cat': {
            if (!a[0]) return print('cat: missing file', 'err');
            const r = await fs().readFile({ path: real(abs(a[0])), directory: DIR, encoding: 'utf8' });
            String(r.data).split('\n').slice(0, 200).forEach(l => print(l)); break;
          }
          case 'touch': { const d = abs(a[0] || ''); if (!a[0]) return print('touch: missing name', 'err'); if (!(await stat(d))) await fs().writeFile({ path: real(d), directory: DIR, data: '', encoding: 'utf8' }); break; }
          case 'mkdir': { if (!a[0]) return print('mkdir: missing name', 'err'); await fs().mkdir({ path: real(abs(a[0])), directory: DIR, recursive: true }); break; }
          case 'rm': {
            const rec = a.includes('-r'), n = a.find(x => x !== '-r'); if (!n) return print('rm: missing name', 'err');
            const d = abs(n), s = await stat(d); if (!s) return print('rm: not found', 'err');
            if (d === '/') return print('rm: refusing to delete the main folder', 'err');
            if (s.type === 'directory') { if (!rec) return print('rm: that is a folder, use rm -r', 'err'); await fs().rmdir({ path: real(d), directory: DIR, recursive: true }); }
            else await fs().deleteFile({ path: real(d), directory: DIR });
            break;
          }
          case 'mv': case 'cp': {
            if (a.length < 2) return print(c + ': need two names', 'err');
            const from = abs(a[0]), to = await dest(from, abs(a[1]));
            if (!(await stat(from))) return print(c + ': not found', 'err');
            const o = { from: real(from), to: real(to), directory: DIR, toDirectory: DIR };
            c === 'mv' ? await fs().rename(o) : await fs().copy(o); break;
          }
          case 'apps': OS.apps.filter(x => !x.hidden || ctx.store.get('secretUnlocked')).forEach(x => print(x.id + '  (' + x.name + ')')); break;
          case 'open': case 'close': {
            const q = (a[0] || '').toLowerCase(), x = OS.apps.find(z => (z.id === q || z.name.toLowerCase() === q) && (!z.hidden || ctx.store.get('secretUnlocked')));
            if (!x) return print('No app called "' + (a[0] || '') + '". Type apps to see the list.', 'err');
            c === 'open' ? OS.open(x.id) : OS.close(x.id); break;
          }
          case 'theme': if (!['dark', 'light'].includes(a[0])) return print('theme dark|light', 'err'); ctx.store.set('theme', a[0]); OS.applyTheme(); break;
          case 'wall': if (!['night', 'aurora', 'sunset'].includes(a[0])) return print('wall night|aurora|sunset', 'err'); ctx.store.set('wall', a[0]); OS.applyTheme(); break;
          case 'accent': if (!/^#[0-9a-f]{6}$/i.test(a[0] || '')) return print('accent #rrggbb (example: accent #22d3ee)', 'err'); ctx.store.set('accent', a[0]); OS.applyTheme(); break;
          case 'Fouz_312': ctx.store.set('secretUnlocked', true); OS.refresh(); print('Access granted. Something new is waiting in Start > All apps.'); OS.toast('Secret unlocked'); break;
          default: print(c + ': command not found. Type help.', 'err');
        }
      }
      inp.onkeydown = async e => {
        if (e.key === 'ArrowUp') { if (hi > 0) inp.value = hist[--hi]; e.preventDefault(); }
        else if (e.key === 'ArrowDown') { inp.value = hi < hist.length - 1 ? hist[++hi] : ''; hi = Math.min(hi + 1, hist.length); e.preventDefault(); }
        else if (e.key === 'Enter') {
          const line = inp.value.trim(); inp.value = ''; print('browos:' + cwd + '$ ' + line, 'cmd');
          if (line) { hist.push(line); hi = hist.length; try { await run(line); } catch (err) { print((err && err.message) || 'Command failed', 'err'); } }
        }
      };
      el.querySelector('.term').onclick = () => inp.focus();
      print('BrowOS Terminal. Type help. Files here are inside BrowOS storage only.'); prompt_();
    }
  });

  /* ---------- Weather (data from Open-Meteo.com, needs internet) ---------- */
  function wxCode(c) {
    if (c === 0) return ['☀️', 'Clear']; if (c === 1) return ['🌤️', 'Mostly clear']; if (c === 2) return ['⛅', 'Partly cloudy']; if (c === 3) return ['☁️', 'Overcast'];
    if (c === 45 || c === 48) return ['🌫️', 'Fog']; if (c >= 51 && c <= 57) return ['🌦️', 'Drizzle']; if (c >= 61 && c <= 67) return ['🌧️', 'Rain'];
    if (c >= 71 && c <= 77) return ['❄️', 'Snow']; if (c >= 80 && c <= 82) return ['🌦️', 'Showers']; if (c === 85 || c === 86) return ['🌨️', 'Snow showers']; if (c >= 95) return ['⛈️', 'Thunderstorm'];
    return ['🌡️', 'Unknown'];
  }
  OS.wxCode = wxCode;
  OS.register({
    id: 'weather', name: 'Weather', icon: '⛅', color: '#38bdf8', cat: 'Internet', w: 420, h: 560,
    build(el, ctx) {
      const st = ctx.store; let unit = st.get('wxUnit', 'c');
      el.innerHTML = '<div class="wx"><div class="nrow"><input class="field" type="search" placeholder="Search a city..." data-q><button class="btn pri" data-a="go">Search</button></div><div class="nitems" data-res></div><div data-out><p class="muted">Search for a city to see its weather.</p></div><div class="nrow"><button class="btn" data-a="unit"></button><span class="muted">Data: Open-Meteo.com (needs internet)</span></div></div>';
      const q = el.querySelector('[data-q]'), res = el.querySelector('[data-res]'), outEl = el.querySelector('[data-out]'), ub = el.querySelector('[data-a=unit]');
      let found = [];
      const setU = () => { ub.textContent = unit === 'c' ? 'Show °F' : 'Show °C'; }; setU();
      const getJson = async u => { const r = await fetch(u); if (!r.ok) throw new Error('bad'); return r.json(); };
      async function search() {
        const text = q.value.trim(); if (!text) return;
        res.innerHTML = '<p class="muted">Searching...</p>';
        try {
          const j = await getJson('https://geocoding-api.open-meteo.com/v1/search?count=5&name=' + encodeURIComponent(text));
          found = j.results || [];
          res.innerHTML = found.length ? found.map((p, i) => `<button class="nitem" data-c="${i}"><b>${esc(p.name)}</b><span>${esc([p.admin1, p.country].filter(Boolean).join(', '))}</span></button>`).join('') : '<p class="muted">No city found.</p>';
        } catch (e) { res.innerHTML = '<p class="muted">Could not search. Check your internet.</p>'; }
      }
      async function show() {
        const p = st.get('wxPlace'); if (!p) return;
        outEl.innerHTML = '<p class="muted">Loading...</p>';
        try {
          const u = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5&temperature_unit=${unit === 'c' ? 'celsius' : 'fahrenheit'}`;
          const j = await getJson(u), c = j.current, d = j.daily, sym = unit === 'c' ? '°C' : '°F', w = wxCode(c.weather_code);
          outEl.innerHTML = `<div class="wnow"><b>${esc(p.name)}</b><div class="wbig">${w[0]} ${Math.round(c.temperature_2m)}${sym}</div><div>${w[1]} · feels like ${Math.round(c.apparent_temperature)}${sym}</div><div class="muted">Humidity ${c.relative_humidity_2m}% · Wind ${Math.round(c.wind_speed_10m)} km/h</div></div>
            <div class="wdays">${d.time.map((t, i) => `<div class="wday"><div>${new Date(t + 'T00:00').toLocaleDateString([], { weekday: 'short' })}</div><div>${wxCode(d.weather_code[i])[0]}</div><b>${Math.round(d.temperature_2m_max[i])}°</b><div class="muted">${Math.round(d.temperature_2m_min[i])}°</div></div>`).join('')}</div>`;
        } catch (e) { outEl.innerHTML = '<p class="muted">Could not load the weather. Check your internet.</p>'; }
      }
      el.onclick = e => {
        const t = e.target.closest('button'); if (!t) return;
        if (t.dataset.c !== undefined) { const p = found[+t.dataset.c]; st.set('wxPlace', { name: p.name, lat: p.latitude, lon: p.longitude }); res.innerHTML = ''; show(); }
        else if (t.dataset.a === 'go') search();
        else if (t.dataset.a === 'unit') { unit = unit === 'c' ? 'f' : 'c'; st.set('wxUnit', unit); setU(); show(); }
      };
      q.onkeydown = e => { if (e.key === 'Enter') { q.blur(); search(); } };
      show();
    }
  });

  /* ---------- PDF Reader (uses the pdf.js engine, loaded from the internet) ---------- */
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  async function loadPdfLib() {
    if (window.pdfjsLib) return window.pdfjsLib;
    await new Promise((ok, no) => { const s = document.createElement('script'); s.src = PDFJS + 'pdf.min.js'; s.onload = ok; s.onerror = () => no(new Error('offline')); document.head.append(s); });
    const code = await (await fetch(PDFJS + 'pdf.worker.min.js')).text();
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    return window.pdfjsLib;
  }
  OS.register({
    id: 'pdf', name: 'PDF Reader', icon: '📕', color: '#b91c1c', cat: 'Productivity', w: 480, h: 600,
    build(el, ctx) {
      if (!FS()) { el.innerHTML = NEED; return; }
      let list = [], doc = null, page = 1, zoom = 1, token = 0;
      async function load() { list = (await OS.media.scan(['pdf'])).sort((a, b) => a.name.localeCompare(b.name)); draw(); }
      function draw() {
        if (doc) { doc.destroy(); doc = null; }
        el.innerHTML = `<div class="mus"><div class="nrow"><button class="btn pri" data-a="add">+ Add PDFs</button><span class="muted">${list.length} PDF(s)</span></div><div class="nitems">${list.map((f, k) => `<button class="nitem" data-i="${k}"><b>${esc(f.name)}</b><span>${OS.humanSize(f.size || 0)}</span></button>`).join('') || '<div class="empty">No PDFs yet. Tap Add PDFs.</div>'}</div><p class="muted">The PDF engine loads from the internet when you open your first PDF.</p></div>`;
      }
      async function openPdf(f) {
        el.innerHTML = '<div class="empty">Loading PDF...</div>';
        try {
          const lib = await loadPdfLib(), buf = await (await fetch(fsrc(f))).arrayBuffer();
          doc = await lib.getDocument({ data: buf }).promise; page = 1; zoom = 1; viewer();
        } catch (e) { ctx.toast('Could not open the PDF. Check your internet.'); draw(); }
      }
      function viewer() {
        el.innerHTML = '<div class="pdfv"><div class="pbar"><button class="btn" data-a="back">&larr; List</button><button class="btn" data-a="prev">&#9664;</button><span data-pg></span><button class="btn" data-a="next">&#9654;</button><button class="btn" data-a="zo">&minus;</button><button class="btn" data-a="zi">+</button></div><div class="pscroll"><canvas></canvas></div></div>';
        render();
      }
      async function render() {
        const my = ++token, p = await doc.getPage(page), sc = el.querySelector('.pscroll'), cv = el.querySelector('canvas'); if (!cv) return;
        const base = p.getViewport({ scale: 1 }), dpr = window.devicePixelRatio || 1;
        const vp = p.getViewport({ scale: ((sc.clientWidth - 16) / base.width) * zoom * dpr });
        cv.width = vp.width; cv.height = vp.height; cv.style.width = vp.width / dpr + 'px'; cv.style.height = vp.height / dpr + 'px';
        el.querySelector('[data-pg]').textContent = page + ' / ' + doc.numPages;
        if (my === token) await p.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      }
      el.onclick = e => {
        const t = e.target.closest('button'); if (!t) return;
        if (t.dataset.i !== undefined) return openPdf(list[+t.dataset.i]);
        const a = t.dataset.a;
        if (a === 'add') OS.media.pick('application/pdf', async fl => { ctx.toast('Importing...'); await OS.media.importInto(ROOT + '/Documents', fl); load(); });
        else if (a === 'back') draw();
        else if (a === 'prev' && page > 1) { page--; render(); }
        else if (a === 'next' && doc && page < doc.numPages) { page++; render(); }
        else if (a === 'zi') { zoom = Math.min(4, zoom + 0.25); render(); }
        else if (a === 'zo') { zoom = Math.max(0.5, zoom - 0.25); render(); }
      };
      load();
      return () => { if (doc) doc.destroy(); };
    }
  });
})();
