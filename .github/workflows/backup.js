/* BrowOS backup: save your settings, notes, Vault and lock password to a file, and bring them back later. */
(function () {
  const OS = window.BrowOS, esc = OS.esc;
  const P = n => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[n];
  const ymd = () => new Date().toISOString().slice(0, 10);
  const snapshot = () => ({ app: 'BrowOS', v: 1, created: new Date().toISOString(), data: { store: localStorage.getItem(OS.keys.store), vault: localStorage.getItem(OS.keys.vault), lock: localStorage.getItem(OS.keys.lock) } });
  const ITER = 200000;
  OS.backupExport = function () {
    const m = OS.modal(`<h3>Export a backup</h3><p class="muted">Saves your settings, notes, pins, Vault (still encrypted) and lock password. Photos, music and other files are not included yet.</p><input class="field" type="password" data-f="p" placeholder="Protect the file with a password (optional)" autocomplete="off"><div class="err"></div><div class="col"><button class="btn pri" data-m="go">Export</button><button class="btn" data-m="x">Cancel</button></div>`);
    m.onclick = async e => {
      const k = e.target.dataset.m; if (!k) return; if (k === 'x') return m.remove();
      const pw = m.querySelector('[data-f=p]').value; m.querySelector('.err').textContent = 'Working...';
      try {
        let file = snapshot();
        if (pw) { const salt = crypto.getRandomValues(new Uint8Array(16)), key = await OS.vaultCrypto.deriveKey(pw, salt, ITER), s = await OS.vaultCrypto.seal(key, file); file = { app: 'BrowOS', v: 1, enc: true, iter: ITER, salt: btoa(String.fromCharCode(...salt)), iv: s.iv, data: s.data }; }
        const text = JSON.stringify(file), name = 'BrowOS-backup-' + ymd() + '.browos', FS = P('Filesystem'), SH = P('Share');
        if (FS && SH) {
          const r = await FS.writeFile({ path: name, directory: 'CACHE', data: text, encoding: 'utf8' });
          m.remove(); await SH.share({ title: 'BrowOS backup', text: 'Keep this file safe.', files: [r.uri], dialogTitle: 'Save your BrowOS backup' });
        } else {
          m.querySelector('.mbox').innerHTML = `<h3>Your backup</h3><p class="muted">Copy this text and keep it somewhere safe.</p><textarea class="field" rows="8" readonly>${esc(text)}</textarea><button class="btn" data-m="x">Close</button>`;
          m.onclick = ev => { if (ev.target.dataset.m) m.remove(); };
        }
      } catch (err) { const n = m.querySelector('.err'); if (n) n.textContent = 'Could not export: ' + ((err && err.message) || 'cancelled'); }
    };
  };
  OS.backupImport = function () {
    const i = document.createElement('input'); i.type = 'file'; i.accept = '*/*';
    i.onchange = async () => {
      const f = i.files[0]; if (!f) return;
      let obj; try { obj = JSON.parse(await f.text()); } catch (e) { return OS.toast('That is not a BrowOS backup.'); }
      if (!obj || obj.app !== 'BrowOS') return OS.toast('That is not a BrowOS backup.');
      const apply = o => {
        if (!o || !o.data) return OS.toast('The backup is damaged.');
        const m = OS.modal('<h3>Restore this backup?</h3><p class="muted">This replaces the settings, notes, pins, Vault and lock password of the current account. BrowOS restarts afterwards.</p><div class="col"><button class="btn danger" data-m="ok">Restore</button><button class="btn" data-m="x">Cancel</button></div>');
        m.onclick = e => {
          const k = e.target.dataset.m; if (!k) return; if (k === 'x') return m.remove();
          [['store', OS.keys.store], ['vault', OS.keys.vault], ['lock', OS.keys.lock]].forEach(([r, key]) => { if (o.data[r]) localStorage.setItem(key, o.data[r]); else localStorage.removeItem(key); });
          location.reload();
        };
      };
      if (!obj.enc) return apply(obj);
      const m = OS.modal('<h3>Backup password</h3><input class="field" type="password" data-f="p" placeholder="Password"><div class="err"></div><div class="col"><button class="btn pri" data-m="ok">Open</button><button class="btn" data-m="x">Cancel</button></div>');
      m.onclick = async e => {
        const k = e.target.dataset.m; if (!k) return; if (k === 'x') return m.remove();
        try { const salt = Uint8Array.from(atob(obj.salt), c => c.charCodeAt(0)), key = await OS.vaultCrypto.deriveKey(m.querySelector('[data-f=p]').value, salt, obj.iter), o = await OS.vaultCrypto.openRec(key, obj); m.remove(); apply(o); }
        catch (err) { m.querySelector('.err').textContent = 'Wrong password.'; }
      };
    };
    i.click();
  };
})();
