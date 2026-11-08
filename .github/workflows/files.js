/* BrowOS File Manager. Works inside BrowOS's own private storage (no scary permissions needed). */
(function () {
  const OS = window.BrowOS, esc = OS.esc;
  const DIR = 'DATA', ROOT = 'BrowOS';
  const getFS = () => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
  const ext = n => (n.split('.').pop() || '').toLowerCase();
  const IMG = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'], AUD = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'], TXT = ['txt', 'md', 'json', 'csv', 'log', 'html', 'css', 'js', 'xml'];
  const iconOf = f => f.type === 'directory' ? '📁' : IMG.includes(ext(f.name)) ? '🖼️' : AUD.includes(ext(f.name)) ? '🎵' : TXT.includes(ext(f.name)) ? '📄' : '📎';
  const human = b => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : b < 1073741824 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1073741824).toFixed(2) + ' GB';
  const goodName = n => n && !/[\/\\]/.test(n) && n !== '.' && n !== '..';
  OS.humanSize = human;

  OS.register({
    id: 'files', name: 'Files', icon: '📁', color: '#f59e0b', cat: 'System', w: 460, h: 560,
    build(el, ctx) {
      const fs = getFS();
      if (!fs) { el.innerHTML = '<div class="empty">The File Manager needs the Android app.<br>It cannot run in a normal browser.</div>'; return; }
      let cwd = ROOT, q = '', clip = null, cur = [];
      const dirOf = p => p.slice(0, p.lastIndexOf('/'));
      const fail = (e, what) => ctx.toast(what + ' failed: ' + ((e && e.message) || 'unknown error'));

      async function exists(p) { try { await fs.stat({ path: p, directory: DIR }); return true; } catch (e) { return false; } }
      async function uniq(p) {
        if (!(await exists(p))) return p;
        const dot = p.lastIndexOf('.'), slash = p.lastIndexOf('/');
        const base = dot > slash ? p.slice(0, dot) : p, tail = dot > slash ? p.slice(dot) : '';
        for (let i = 1; i < 100; i++) { if (!(await exists(`${base} (${i})${tail}`))) return `${base} (${i})${tail}`; }
        return p;
      }
      async function search(dir, text, depth = 0, out = []) {
        const r = await fs.readdir({ path: dir, directory: DIR });
        for (const f of r.files) {
          const p = dir + '/' + f.name;
          if (f.name.toLowerCase().includes(text)) out.push({ ...f, path: p });
          if (f.type === 'directory' && depth < 4 && out.length < 200) await search(p, text, depth + 1, out);
        }
        return out;
      }
      async function dirSize(dir, depth = 0) {
        let t = 0; const r = await fs.readdir({ path: dir, directory: DIR });
        for (const f of r.files) t += f.type === 'directory' ? (depth < 6 ? await dirSize(dir + '/' + f.name, depth + 1) : 0) : (f.size || 0);
        return t;
      }

      async function render() {
        try {
          if (q) cur = await search(cwd, q.toLowerCase());
          else { const r = await fs.readdir({ path: cwd, directory: DIR }); cur = r.files.map(f => ({ ...f, path: cwd + '/' + f.name })); }
        } catch (e) { cur = []; fail(e, 'Opening folder'); }
        cur.sort((a, b) => (a.type === 'directory' ? 0 : 1) - (b.type === 'directory' ? 0 : 1) || a.name.localeCompare(b.name));
        el.innerHTML = `<div class="fm">
          <div class="nrow"><button class="btn" data-a="up" ${cwd === ROOT ? 'disabled' : ''}>&uarr;</button><div class="crumb">${esc(cwd.replace(ROOT, 'Home'))}</div></div>
          <div class="nrow"><input class="field" type="search" placeholder="Search here and in subfolders..." value="${esc(q)}"></div>
          <div class="nrow"><button class="btn" data-a="mkdir">+ Folder</button><button class="btn" data-a="import">Import files</button>${clip ? `<button class="btn pri" data-a="paste">Paste ${esc(clip.name)}</button>` : ''}</div>
          <div class="nitems">${cur.length ? cur.map((f, i) => `<div class="frow"><button class="fmain" data-i="${i}"><span class="fi">${iconOf(f)}</span><span class="fn"><b>${esc(f.name)}</b><small>${f.type === 'directory' ? 'Folder' : human(f.size || 0)}${f.mtime ? ' · ' + new Date(f.mtime).toLocaleDateString() : ''}</small></span></button><button class="fmore" data-m="${i}" aria-label="Actions">&#8942;</button></div>`).join('') : `<div class="empty">${q ? 'Nothing found.' : 'This folder is empty.<br>Tap Import files to add some.'}</div>`}</div>
          <div class="muted foot" data-foot>Calculating storage...</div></div><input type="file" multiple class="hidden" data-file>`;
        const inp = el.querySelector('input[type=search]');
        inp.onchange = () => { q = inp.value.trim(); render(); };
        inp.onkeydown = e => { if (e.key === 'Enter') inp.blur(); };
        el.querySelector('[data-file]').onchange = importFiles;
        footer();
      }
      async function footer() {
        try {
          const used = await dirSize(ROOT); let free = '';
          if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); if (e.quota) free = ' · Device space for apps: ' + human(e.quota - (e.usage || 0)) + ' free'; }
          const f = el.querySelector('[data-foot]'); if (f) f.textContent = `${cur.length} item(s) shown · BrowOS files use ${human(used)}${free}`;
        } catch (e) {}
      }

      async function importFiles(e) {
        const files = [...e.target.files]; let n = 0;
        for (const f of files) {
          try {
            const data = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = no; r.readAsDataURL(f); });
            await fs.writeFile({ path: await uniq(cwd + '/' + f.name), directory: DIR, data }); n++;
          } catch (err) { fail(err, 'Importing ' + f.name); }
        }
        ctx.toast(n + ' file(s) imported'); render();
      }

      async function info(f) {
        let body = '';
        try {
          const s = await fs.stat({ path: f.path, directory: DIR });
          body = `<p class="muted">Type: ${f.type === 'directory' ? 'Folder' : (ext(f.name) || 'file').toUpperCase() + ' file'}<br>Size: ${human(s.size || 0)}<br>Modified: ${s.mtime ? new Date(s.mtime).toLocaleString() : 'unknown'}<br>Location: ${esc(dirOf(f.path).replace(ROOT, 'Home') || 'Home')}</p>`;
          if (f.type !== 'directory' && IMG.includes(ext(f.name)) && s.size < 5e6) { const r = await fs.readFile({ path: f.path, directory: DIR }); body += `<img class="prev" alt="" src="data:image/${ext(f.name) === 'jpg' ? 'jpeg' : ext(f.name)};base64,${r.data}">`; }
          else if (f.type !== 'directory' && TXT.includes(ext(f.name)) && s.size < 2e5) { const r = await fs.readFile({ path: f.path, directory: DIR, encoding: 'utf8' }); body += `<pre class="prev">${esc(String(r.data).slice(0, 4000))}</pre>`; }
        } catch (e) { body = '<p class="muted">Could not read this item.</p>'; }
        sheet(`<h3>${esc(f.name)}</h3>${body}<button class="btn" data-s="close">Close</button>`);
      }
      function sheet(html) {
        const old = el.querySelector('.sheet'); if (old) old.remove();
        const s = document.createElement('div'); s.className = 'sheet'; s.innerHTML = `<div class="sheetbox">${html}</div>`; el.querySelector('.fm').append(s);
        return s;
      }
      function actions(f) {
        const s = sheet(`<h3>${esc(f.name)}</h3><div class="col"><button class="btn" data-s="info">Details / preview</button><button class="btn" data-s="rename">Rename</button><button class="btn" data-s="copy">Copy</button><button class="btn" data-s="cut">Move (cut)</button><button class="btn" data-s="del">Delete</button><button class="btn" data-s="close">Cancel</button></div>`);
        s.onclick = async e => {
          const a = e.target.dataset.s; if (!a) return;
          s.remove();
          if (a === 'info') info(f);
          else if (a === 'copy' || a === 'cut') { clip = { path: f.path, name: f.name, cut: a === 'cut' }; ctx.toast((a === 'cut' ? 'Ready to move ' : 'Copied ') + f.name); render(); }
          else if (a === 'rename') {
            const n = (prompt('New name:', f.name) || '').trim(); if (!n || n === f.name) return;
            if (!goodName(n)) return ctx.toast('That name is not allowed.');
            const to = dirOf(f.path) + '/' + n;
            if (await exists(to)) return ctx.toast('That name already exists.');
            try { await fs.rename({ from: f.path, to, directory: DIR, toDirectory: DIR }); } catch (err) { fail(err, 'Rename'); } render();
          } else if (a === 'del') {
            if (!confirm('Delete "' + f.name + '"?' + (f.type === 'directory' ? ' Everything inside it will be deleted too.' : ''))) return;
            try { f.type === 'directory' ? await fs.rmdir({ path: f.path, directory: DIR, recursive: true }) : await fs.deleteFile({ path: f.path, directory: DIR }); } catch (err) { fail(err, 'Delete'); } render();
          }
        };
      }

      el.onclick = async e => {
        const t = e.target.closest('button'); if (!t) return;
        if (t.dataset.s === 'close') { const s = el.querySelector('.sheet'); if (s) s.remove(); return; }
        if (t.dataset.i !== undefined) { const f = cur[+t.dataset.i]; if (f.type === 'directory') { cwd = f.path; q = ''; render(); } else info(f); }
        else if (t.dataset.m !== undefined) actions(cur[+t.dataset.m]);
        else if (t.dataset.a === 'up') { cwd = dirOf(cwd); q = ''; render(); }
        else if (t.dataset.a === 'import') el.querySelector('[data-file]').click();
        else if (t.dataset.a === 'mkdir') {
          const n = (prompt('Folder name:') || '').trim(); if (!n) return;
          if (!goodName(n)) return ctx.toast('That name is not allowed.');
          if (await exists(cwd + '/' + n)) return ctx.toast('That name already exists.');
          try { await fs.mkdir({ path: cwd + '/' + n, directory: DIR }); } catch (err) { fail(err, 'Create folder'); } render();
        } else if (t.dataset.a === 'paste' && clip) {
          if (cwd === clip.path || cwd.startsWith(clip.path + '/')) return ctx.toast('Cannot paste a folder into itself.');
          try {
            const to = await uniq(cwd + '/' + clip.name);
            if (clip.cut) await fs.rename({ from: clip.path, to, directory: DIR, toDirectory: DIR });
            else await fs.copy({ from: clip.path, to, directory: DIR, toDirectory: DIR });
            if (clip.cut) clip = null;
          } catch (err) { fail(err, 'Paste'); } render();
        }
      };
      fs.mkdir({ path: ROOT, directory: DIR, recursive: true }).catch(() => {}).then(render);
    }
  });
})();
