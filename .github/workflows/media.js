/* BrowOS Gallery and Music Player. They use the files inside BrowOS's private storage. */
(function () {
  const OS = window.BrowOS, esc = OS.esc, DIR = 'DATA', ROOT = 'BrowOS';
  const FS = () => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
  const IMG = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'], AUD = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'];
  const ext = n => (n.split('.').pop() || '').toLowerCase();
  const src = f => window.Capacitor.convertFileSrc(f.uri);
  const NEED = '<div class="empty">This app needs the Android app.<br>It cannot run in a normal browser.</div>';
  async function scan(exts, dir = ROOT, depth = 0, out = []) {
    let r; try { r = await FS().readdir({ path: dir, directory: DIR }); } catch (e) { return out; }
    for (const f of r.files) {
      if (f.type === 'directory') { if (depth < 5 && !(dir === ROOT && f.name === 'Wallpapers')) await scan(exts, dir + '/' + f.name, depth + 1, out); }
      else if (exts.includes(ext(f.name))) out.push({ ...f, path: dir + '/' + f.name });
    }
    return out;
  }
  async function importInto(folder, files) {
    const fs = FS(); let n = 0;
    await fs.mkdir({ path: folder, directory: DIR, recursive: true }).catch(() => {});
    for (const f of files) {
      try {
        const data = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = no; r.readAsDataURL(f); });
        let path = folder + '/' + f.name;
        try { await fs.stat({ path, directory: DIR }); path = folder + '/' + Date.now() + '-' + f.name; } catch (e) {}
        await fs.writeFile({ path, directory: DIR, data }); n++;
      } catch (e) { OS.toast('Could not import ' + f.name); }
    }
    return n;
  }
  function pick(accept, cb) { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.multiple = true; i.onchange = () => cb([...i.files]); i.click(); }
  OS.media = { scan, importInto, pick };
  const mmss = s => isFinite(s) ? Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') : '0:00';

  /* ---------- Gallery ---------- */
  OS.register({
    id: 'gallery', name: 'Gallery', icon: '🖼️', color: '#10b981', cat: 'Media', w: 480, h: 560,
    build(el, ctx) {
      if (!FS()) { el.innerHTML = NEED; return; }
      let items = [], view = -1;
      async function load() { items = (await scan(IMG)).sort((a, b) => (b.mtime || 0) - (a.mtime || 0)); draw(); }
      function draw() {
        el.innerHTML = `<div class="gal"><div class="nrow"><button class="btn pri" data-a="add">+ Add photos</button><span class="muted">${items.length} image(s)</span></div>
          <div class="gg">${items.map((f, i) => `<button data-i="${i}"><img loading="lazy" alt="" src="${src(f)}"></button>`).join('') || '<div class="empty">No images yet.<br>Tap Add photos, or put images in Files.</div>'}</div></div>`;
      }
      function show(i) {
        view = (i + items.length) % items.length; const f = items[view];
        const old = el.querySelector('.viewer'); if (old) old.remove();
        const v = document.createElement('div'); v.className = 'viewer';
        v.innerHTML = `<div class="vbar"><button data-a="close">&#10005; Close</button><span>${esc(f.name)}</span><button data-a="info">&#9432;</button></div><img alt="" src="${src(f)}"><div class="vnav"><button data-a="prev">&#8249;</button><button data-a="next">&#8250;</button></div><div class="vinfo hidden"></div>`;
        el.querySelector('.gal').append(v);
      }
      el.onclick = e => {
        const t = e.target.closest('button'); if (!t) return;
        if (t.dataset.i !== undefined) return show(+t.dataset.i);
        const a = t.dataset.a;
        if (a === 'add') pick('image/*', async fl => { ctx.toast('Importing...'); await importInto(ROOT + '/Pictures', fl); load(); });
        else if (a === 'close') { const v = el.querySelector('.viewer'); if (v) v.remove(); }
        else if (a === 'prev') show(view - 1);
        else if (a === 'next') show(view + 1);
        else if (a === 'info') {
          const f = items[view], img = el.querySelector('.viewer img'), box = el.querySelector('.vinfo');
          box.innerHTML = `<b>${esc(f.name)}</b><br>Size: ${OS.humanSize(f.size || 0)}<br>Dimensions: ${img.naturalWidth} × ${img.naturalHeight}<br>Modified: ${f.mtime ? new Date(f.mtime).toLocaleString() : 'unknown'}<br>Location: ${esc(f.path.replace(ROOT, 'Home'))}`;
          box.classList.toggle('hidden');
        }
      };
      load();
    }
  });

  /* ---------- Music Player ---------- */
  OS.register({
    id: 'music', name: 'Music', icon: '🎵', color: '#f43f5e', cat: 'Media', w: 400, h: 560,
    build(el, ctx) {
      if (!FS()) { el.innerHTML = NEED; return; }
      let list = [], i = -1, seeking = false;
      const au = new Audio(); au.volume = ctx.store.get('vol', 0.8);
      const name = f => f.name.replace(/\.[^.]+$/, '');
      async function load() { list = (await scan(AUD)).sort((a, b) => a.name.localeCompare(b.name)); draw(); }
      function draw() {
        el.innerHTML = `<div class="mus"><div class="now"><div class="disc">🎵</div><b data-t>Nothing playing</b><small data-m class="muted">Pick a track below</small>
          <input type="range" class="rng" data-seek min="0" max="1000" value="0"><div class="tt"><span data-c>0:00</span><span data-d>0:00</span></div>
          <div class="row"><button class="btn" data-a="prev">&#9198;</button><button class="btn pri" data-a="play" data-p>&#9654;</button><button class="btn" data-a="next">&#9197;</button></div>
          <label class="vol">🔈<input type="range" class="rng" data-vol min="0" max="100" value="${Math.round(au.volume * 100)}"></label></div>
          <div class="nrow"><button class="btn" data-a="add">+ Add songs</button><span class="muted">${list.length} track(s)</span></div>
          <div class="nitems">${list.map((f, k) => `<button class="nitem ${k === i ? 'on' : ''}" data-i="${k}"><b>${esc(name(f))}</b><span>${OS.humanSize(f.size || 0)}</span></button>`).join('') || '<div class="empty">No songs yet. Tap Add songs.</div>'}</div></div>`;
        upd();
      }
      function upd() {
        const q = s => el.querySelector(s); if (!q('[data-t]')) return;
        const f = list[i];
        q('[data-t]').textContent = f ? name(f) : 'Nothing playing';
        q('[data-m]').textContent = f ? `${ext(f.name).toUpperCase()} · ${OS.humanSize(f.size || 0)}` : 'Pick a track below';
        q('[data-c]').textContent = mmss(au.currentTime); q('[data-d]').textContent = mmss(au.duration);
        q('[data-p]').innerHTML = au.paused ? '&#9654;' : '&#9208;';
        if (!seeking && au.duration) q('[data-seek]').value = Math.round(au.currentTime / au.duration * 1000);
        el.querySelectorAll('.nitem').forEach((n, k) => n.classList.toggle('on', k === i));
      }
      function play(k) {
        if (!list.length) return ctx.toast('Add some songs first.');
        i = (k + list.length) % list.length; au.src = window.Capacitor.convertFileSrc(list[i].uri);
        au.play().catch(() => ctx.toast('Cannot play this file')); upd();
      }
      ['timeupdate', 'loadedmetadata', 'play', 'pause'].forEach(ev => au.addEventListener(ev, upd));
      au.addEventListener('ended', () => play(i + 1));
      el.onclick = e => {
        const t = e.target.closest('button'); if (!t) return;
        if (t.dataset.i !== undefined) return play(+t.dataset.i);
        const a = t.dataset.a;
        if (a === 'play') { if (i < 0) play(0); else au.paused ? au.play() : au.pause(); }
        else if (a === 'next') play(i + 1); else if (a === 'prev') play(i - 1);
        else if (a === 'add') pick('audio/*', async fl => { ctx.toast('Importing...'); await importInto(ROOT + '/Music', fl); load(); });
      };
      el.oninput = e => {
        if (e.target.matches('[data-vol]')) { au.volume = e.target.value / 100; ctx.store.set('vol', au.volume); }
        if (e.target.matches('[data-seek]') && au.duration) au.currentTime = e.target.value / 1000 * au.duration;
      };
      el.onpointerdown = e => { if (e.target.matches('[data-seek]')) seeking = true; };
      el.onpointerup = () => { seeking = false; };
      load();
      return () => { au.pause(); au.removeAttribute('src'); au.load(); };
    }
  });
})();
