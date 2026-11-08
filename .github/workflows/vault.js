/* BrowOS Vault: password manager. Everything is encrypted (AES-GCM) with a key made from your master password. */
(function () {
  const OS = window.BrowOS, esc = OS.esc, KEY = OS.keys.vault, ITER = 250000;
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = b => { let s = ''; new Uint8Array(b).forEach(x => { s += String.fromCharCode(x); }); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function deriveKey(pw, salt, iter = ITER) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function seal(key, obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
    return { iv: b64(iv), data: b64(ct) };
  }
  async function openRec(key, rec) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(rec.iv) }, key, unb64(rec.data));
    return JSON.parse(dec.decode(pt));
  }
  function rnd(n) { const lim = Math.floor(4294967296 / n) * n; let x; do { x = crypto.getRandomValues(new Uint32Array(1))[0]; } while (x >= lim); return x % n; }
  function genPassword(len = 20, o = { l: 1, u: 1, d: 1, s: 1 }) {
    const sets = [];
    if (o.l) sets.push('abcdefghijkmnopqrstuvwxyz'); if (o.u) sets.push('ABCDEFGHJKLMNPQRSTUVWXYZ'); if (o.d) sets.push('23456789'); if (o.s) sets.push('!@#$%^&*-_=+?');
    if (!sets.length) sets.push('abcdefghijkmnopqrstuvwxyz');
    const all = sets.join(''), out = sets.map(s => s[rnd(s.length)]);
    while (out.length < len) out.push(all[rnd(all.length)]);
    for (let i = out.length - 1; i > 0; i--) { const j = rnd(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
    return out.join('');
  }
  OS.vaultCrypto = { deriveKey, seal, openRec, genPassword };

  // ---- shared vault state (used by the Vault app, the "save password?" prompt and autofill) ----
  const loadRec = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const V = { rec: loadRec(), key: null, data: null, timer: null, onLock: [] };
  const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  function lockVault() { V.key = null; V.data = null; clearTimeout(V.timer); V.onLock.forEach(f => { try { f(); } catch (e) {} }); }
  const bump = () => { clearTimeout(V.timer); if (V.key) V.timer = setTimeout(lockVault, 120000); };
  document.addEventListener('visibilitychange', () => { if (document.hidden && V.key) lockVault(); });
  async function save() { const s = await seal(V.key, V.data); V.rec = { ...V.rec, iv: s.iv, data: s.data }; localStorage.setItem(KEY, JSON.stringify(V.rec)); }
  OS.vault = {
    exists: () => !!V.rec, unlocked: () => !!V.key, lock: lockVault,
    async create(pw) { const salt = crypto.getRandomValues(new Uint8Array(16)); V.key = await deriveKey(pw, salt); V.rec = { v: 1, iter: ITER, salt: b64(salt) }; V.data = { items: [] }; await save(); bump(); },
    async unlock(pw) { try { const k = await deriveKey(pw, unb64(V.rec.salt), V.rec.iter); V.data = await openRec(k, V.rec); V.key = k; bump(); return true; } catch (e) { return false; } },
    forHost(h) { return V.data ? V.data.items.filter(i => { const ih = hostOf(i.url); return ih && (ih === h || h.endsWith('.' + ih) || ih.endsWith('.' + h)); }) : []; },
    find(h, user) { return this.forHost(h).find(i => (i.user || '') === (user || '')); },
    async add(e) {
      const ex = this.find(hostOf(e.url), e.user);
      if (ex) { ex.pass = e.pass; ex.t = Date.now(); } else V.data.items.push({ id: String(Date.now()), title: e.title, user: e.user || '', pass: e.pass, url: e.url, note: '', t: Date.now() });
      await save(); bump();
      const hh = hostOf(e.url); if (hh) { const l = OS.store.get('vaultHosts', []); if (!l.includes(hh)) OS.store.set('vaultHosts', [...l, hh]); }
    }
  };

  // ---- "Save password?" prompt (called by the browser when you sign in to a site) ----
  OS.vaultPrompt = function (c) {
    const host = hostOf(c.url); if (!host || !c.pass) return;
    if (OS.store.get('savePrompt', true) === false || OS.store.get('neverSave', []).includes(host)) return;
    const V2 = OS.vault; let upd = false;
    if (V2.unlocked()) { const ex = V2.find(host, c.user); if (ex && ex.pass === c.pass) return; upd = !!ex; }
    if (document.querySelector('.modal.vp')) return;
    const need = !V2.exists() ? 'create' : !V2.unlocked() ? 'unlock' : 'none';
    const m = OS.modal(`<h3>${upd ? 'Update saved password?' : 'Save password to Vault?'}</h3><p class="muted"><b>${esc(host)}</b>${c.user ? '<br>' + esc(c.user) : ''}</p>
      ${need === 'create' ? '<p class="muted small">You do not have a Vault yet. Choose a master password (8+ characters). If you forget it, nobody can recover your passwords.</p><input class="field" type="password" data-f="p1" placeholder="New master password"><input class="field" type="password" data-f="p2" placeholder="Repeat master password">' : ''}
      ${need === 'unlock' ? '<input class="field" type="password" data-f="p1" placeholder="Vault master password">' : ''}
      <div class="err"></div><div class="col"><button class="btn pri" data-m="save">${upd ? 'Update' : 'Save'}</button><button class="btn" data-m="no">Not now</button><button class="btn" data-m="never">Never for this site</button></div>`);
    m.classList.add('vp');
    const f = k => { const n = m.querySelector(`[data-f=${k}]`); return n ? n.value : ''; }, er = m.querySelector('.err');
    m.onclick = async e => {
      const k = e.target.dataset.m; if (!k) return;
      if (k === 'no') return m.remove();
      if (k === 'never') { OS.store.set('neverSave', [...OS.store.get('neverSave', []), host]); return m.remove(); }
      er.textContent = '';
      if (need === 'create') { if (f('p1').length < 8 || f('p1') !== f('p2')) return er.textContent = 'Use 8+ characters and make both match.'; er.textContent = 'Creating vault...'; await V2.create(f('p1')); }
      else if (need === 'unlock') { er.textContent = 'Unlocking...'; if (!(await V2.unlock(f('p1')))) return er.textContent = 'Wrong master password.'; }
      let origin = c.url; try { origin = new URL(c.url).origin; } catch (x) {}
      await V2.add({ title: host, user: c.user, pass: c.pass, url: origin });
      m.remove(); OS.toast('Saved to Vault');
    };
  };

  // ---- Fill saved logins into the page (key button in the browser) ----
  OS.vaultFillMenu = function (pageUrl, fill) {
    const V2 = OS.vault, host = hostOf(pageUrl);
    const m = OS.modal('<div></div>'), box = m.querySelector('.mbox');
    function draw(msg) {
      if (!V2.exists()) { box.innerHTML = '<h3>Vault</h3><p class="muted">No Vault yet. After you sign in to a website, BrowOS offers to save the password here.</p><button class="btn" data-m="x">Close</button>'; return; }
      if (!V2.unlocked()) { box.innerHTML = `<h3>Unlock Vault</h3><input class="field" type="password" data-f="p" placeholder="Master password"><div class="err">${esc(msg || '')}</div><div class="col"><button class="btn pri" data-m="unlock">Unlock</button><button class="btn" data-m="x">Cancel</button></div>`; return; }
      const mine = V2.forHost(host), all = (OS.vault.all ? OS.vault.all() : []);
      box.innerHTML = `<h3>Fill a saved login</h3>${mine.length ? mine.map(i => `<button class="btn" data-fill="${i.id}">${esc(i.title)}${i.user ? ' · ' + esc(i.user) : ''}</button>`).join('') : '<p class="muted">Nothing saved for ' + esc(host || 'this page') + ' yet.</p>'}<button class="btn" data-m="x">Close</button>`;
    }
    m.onclick = async e => {
      const t = e.target; if (t === m) return m.remove();
      if (t.dataset.m === 'x') return m.remove();
      if (t.dataset.m === 'unlock') { const ok = await V2.unlock(box.querySelector('[data-f=p]').value); return draw(ok ? '' : 'Wrong master password.'); }
      if (t.dataset.fill) { const it = V2.forHost(host).find(i => i.id === t.dataset.fill); m.remove(); if (it) { fill(it.user, it.pass); OS.toast('Filled'); } }
    };
    draw();
  };
  OS.vault.all = () => V.data ? V.data.items : [];
  const offered = new Set();
  OS.vaultSuggest = function (e) {
    if (OS.store.get('suggestLogins', true) === false || !OS.vault.exists()) return;
    const host = hostOf(e.url); if (!host || offered.has(host) || document.querySelector('.modal')) return;
    const known = OS.store.get('vaultHosts', []).some(h => host === h || host.endsWith('.' + h));
    if (!known && !(OS.vault.unlocked() && OS.vault.forHost(host).length)) return;
    offered.add(host);
    OS.vaultFillMenu(e.url, (u, p) => OS.nbFill(e.id, u, p));
  };

  OS.register({
    id: 'vault', name: 'Vault', icon: '🔐', color: '#16a34a', cat: 'Security', w: 420, h: 580,
    build(el, ctx) {
      let q = '';
      const root = () => el.querySelector('.vault');
      const unlockedNow = () => !!V.key;
      const relock = () => lockScreen();
      V.onLock.push(relock);
      function copy(text, what) {
        if (!navigator.clipboard) return ctx.toast('Copy is not available here.');
        navigator.clipboard.writeText(text).then(() => { ctx.toast(what + ' copied. I will try to clear it in 30 seconds.'); setTimeout(() => navigator.clipboard.writeText('').catch(() => {}), 30000); }).catch(() => ctx.toast('Copy failed.'));
      }
      function lockScreen() {
        const setup = !V.rec;
        el.innerHTML = `<div class="vault vlock"><div class="logo" style="width:84px;height:84px;border-radius:24px"></div><h3>${setup ? 'Create your vault' : 'Vault is locked'}</h3>
          <p class="muted">${setup ? 'Choose a master password (at least 8 characters). If you forget it, nobody can recover your passwords, not even the app maker.' : 'Enter your master password.'}</p>
          <input class="field" type="password" data-f="pw" placeholder="Master password" autocomplete="off">${setup ? '<input class="field" type="password" data-f="pw2" placeholder="Repeat master password" autocomplete="off">' : ''}
          <button class="btn pri" data-a="${setup ? 'create' : 'unlock'}">${setup ? 'Create vault' : 'Unlock'}</button></div>`;
      }
      function list() {
        const items = V.data.items.filter(i => (i.title + ' ' + (i.user || '') + ' ' + (i.url || '')).toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.title.localeCompare(b.title));
        el.innerHTML = `<div class="vault"><div class="nrow"><input class="field" type="search" placeholder="Search..." value="${esc(q)}"><button class="btn pri" data-a="add">+ Add</button></div>
          <div class="nrow"><button class="btn" data-a="lock">🔒 Lock</button><button class="btn" data-a="menu">More</button><span class="muted">${V.data.items.length} saved</span></div>
          <div class="nitems">${items.map(i => `<button class="nitem" data-id="${i.id}"><b>${esc(i.title)}</b><span>${esc(i.user || '')}</span></button>`).join('') || '<div class="empty">Nothing saved yet. Tap + Add, or sign in to a website in the Browser.</div>'}</div></div>`;
        const inp = el.querySelector('input[type=search]');
        inp.oninput = () => { q = inp.value; const p = inp.selectionStart; list(); const n = el.querySelector('input[type=search]'); n.focus(); n.setSelectionRange(p, p); };
      }
      function detail(it) {
        let shown = false;
        const s = OS.sheet(root(), `<h3>${esc(it.title)}</h3><p class="muted">User: ${esc(it.user || '(none)')}<br>Password: <b data-pw>••••••••</b><br>${it.url ? 'Website: ' + esc(it.url) + '<br>' : ''}${it.note ? 'Note: ' + esc(it.note) : ''}</p>
          <div class="col"><button class="btn" data-s="show">Show / hide password</button><button class="btn" data-s="cu">Copy username</button><button class="btn" data-s="cp">Copy password</button><button class="btn" data-s="edit">Edit</button><button class="btn" data-s="del">Delete</button><button class="btn" data-s="x">Close</button></div>`);
        s.onclick = async e => {
          const a = e.target.dataset.s; if (!a) return; bump();
          if (a === 'show') { shown = !shown; s.querySelector('[data-pw]').textContent = shown ? it.pass : '••••••••'; }
          else if (a === 'cu') copy(it.user || '', 'Username');
          else if (a === 'cp') copy(it.pass, 'Password');
          else if (a === 'edit') { s.remove(); form(it); }
          else if (a === 'del') { if (confirm('Delete "' + it.title + '"?')) { V.data.items = V.data.items.filter(x => x.id !== it.id); await save(); list(); } }
          else if (a === 'x') s.remove();
        };
      }
      function form(it) {
        const s = OS.sheet(root(), `<h3>${it ? 'Edit' : 'New'} login</h3><input class="field" data-f="title" placeholder="Name (example: Gmail)" value="${esc(it ? it.title : '')}"><input class="field" data-f="user" placeholder="Username or email" autocapitalize="off" value="${esc(it ? it.user || '' : '')}">
          <input class="field" data-f="pass" placeholder="Password" autocapitalize="off" value="${esc(it ? it.pass : '')}"><button class="btn" data-s="gen">Generate a strong password</button>
          <input class="field" data-f="url" placeholder="Website, like https://example.com (optional)" autocapitalize="off" value="${esc(it ? it.url || '' : '')}"><input class="field" data-f="note" placeholder="Note (optional)" value="${esc(it ? it.note || '' : '')}">
          <button class="btn pri" data-s="save">Save</button><button class="btn" data-s="x">Cancel</button>`);
        const f = k => s.querySelector(`[data-f=${k}]`);
        s.onclick = async e => {
          const a = e.target.dataset.s; if (!a) return; bump();
          if (a === 'gen') f('pass').value = genPassword(20);
          else if (a === 'x') s.remove();
          else if (a === 'save') {
            if (!f('title').value.trim() || !f('pass').value) return ctx.toast('A name and a password are needed.');
            const v = { title: f('title').value.trim(), user: f('user').value.trim(), pass: f('pass').value, url: f('url').value.trim(), note: f('note').value.trim(), t: Date.now() };
            if (it) Object.assign(V.data.items.find(x => x.id === it.id), v); else V.data.items.push({ id: String(Date.now()), ...v });
            await save(); list();
          }
        };
      }
      function menu() {
        const s = OS.sheet(root(), '<h3>Vault options</h3><div class="col"><button class="btn" data-s="chg">Change master password</button><button class="btn" data-s="wipe">Delete the whole vault</button><button class="btn" data-s="x">Close</button></div>');
        s.onclick = async e => {
          const a = e.target.dataset.s; if (!a) return;
          if (a === 'x') return s.remove();
          if (a === 'wipe') { if (confirm('Delete ALL saved passwords? This cannot be undone.')) { localStorage.removeItem(KEY); V.rec = null; lockVault(); } return; }
          const s2 = OS.sheet(root(), '<h3>Change master password</h3><input class="field" type="password" data-f="old" placeholder="Current password"><input class="field" type="password" data-f="n1" placeholder="New password (8+ characters)"><input class="field" type="password" data-f="n2" placeholder="Repeat new password"><button class="btn pri" data-s="ok">Change</button><button class="btn" data-s="x">Cancel</button>');
          const f = k => s2.querySelector(`[data-f=${k}]`);
          s2.onclick = async ev => {
            const b = ev.target.dataset.s; if (!b) return; if (b === 'x') return s2.remove();
            if (f('n1').value.length < 8 || f('n1').value !== f('n2').value) return ctx.toast('New passwords must match and be 8+ characters.');
            try { await openRec(await deriveKey(f('old').value, unb64(V.rec.salt), V.rec.iter), V.rec); } catch (err) { return ctx.toast('Current password is wrong.'); }
            const salt = crypto.getRandomValues(new Uint8Array(16)); V.key = await deriveKey(f('n1').value, salt);
            V.rec = { ...V.rec, salt: b64(salt), iter: ITER }; await save(); s2.remove(); ctx.toast('Master password changed.');
          };
        };
      }
      el.onpointerdown = bump;
      el.onclick = async e => {
        const t = e.target.closest('button'); if (!t) return;
        const a = t.dataset.a, f = k => { const n = el.querySelector(`[data-f=${k}]`); return n ? n.value : ''; };
        if (t.dataset.id) { bump(); return detail(V.data.items.find(x => x.id === t.dataset.id)); }
        if (a === 'create') {
          if (f('pw').length < 8) return ctx.toast('Use at least 8 characters.');
          if (f('pw') !== f('pw2')) return ctx.toast('The two passwords do not match.');
          t.textContent = 'Creating...'; await OS.vault.create(f('pw')); list();
        } else if (a === 'unlock') {
          t.textContent = 'Unlocking...';
          if (await OS.vault.unlock(f('pw'))) list(); else { lockScreen(); ctx.toast('Wrong master password.'); }
        } else if (a === 'lock') lockVault();
        else if (a === 'add') form(null);
        else if (a === 'menu') menu();
      };
      el.onkeydown = e => { if (e.key === 'Enter' && e.target.matches('input[type=password]')) { const b = el.querySelector('[data-a=create],[data-a=unlock]'); if (b) b.click(); } };
      unlockedNow() ? list() : lockScreen();
      return () => { const i = V.onLock.indexOf(relock); if (i >= 0) V.onLock.splice(i, 1); lockVault(); };
    }
  });
})();
