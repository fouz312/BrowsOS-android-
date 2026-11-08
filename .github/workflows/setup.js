/* BrowOS first-run setup: welcome, account, look, privacy. */
(function () {
  const OS = window.BrowOS, st = OS.store, esc = OS.esc;
  const walls = [['night', 'Night City', 'radial-gradient(ellipse at 50% 105%,#d01aa5,#241049 70%)'], ['aurora', 'Aurora', 'linear-gradient(135deg,#14b8a6,#7c3aed)'], ['sunset', 'Sunset', 'linear-gradient(#6d2a8f,#ffb36b)'], ['ocean', 'Ocean', 'linear-gradient(160deg,#0ea5e9,#0b1b3a)'], ['rose', 'Rose', 'linear-gradient(160deg,#fb7185,#4c1d95)'], ['midnight', 'Midnight', 'linear-gradient(160deg,#111827,#000)']];
  const accents = ['#9b6bff', '#ec4899', '#22d3ee', '#34d399', '#fbbf24', '#f87171'];
  const sw = (k, on) => `<button class="sw ${on ? 'on' : ''}" data-tg="${k}" role="switch" aria-checked="${on}"><i></i></button>`;
  OS.setupRun = function () {
    if (document.getElementById('setup')) return;
    const d = document.createElement('div'); d.id = 'setup'; document.body.append(d);
    const s = { name: '', type: 'local', pw: '', pw2: '', hint: '', adblock: true, desktop: true, lock: true, notif: true };
    let step = 0, err = '';
    const steps = [
      () => `<div class="logo bootlogo"></div><h1>Welcome to BrowOS</h1><p class="muted">A desktop-style home on your Android device. Setup takes about a minute.</p><button class="btn noi18n" data-langopen="1">🌐 ${esc((OS.languages.find(l => l[0] === OS.lang()) || OS.languages[0])[1])}</button>`,
      () => `<h2>Your account</h2><p class="muted">Your account stays on this device.</p>
        <div class="seg"><button class="${s.type === 'local' ? 'on' : ''}" data-type="local">Create account</button><button class="${s.type === 'guest' ? 'on' : ''}" data-type="guest">Guest</button></div>
        ${s.type === 'local' ? `<input class="field" data-f="name" placeholder="Your name" maxlength="20" value="${esc(s.name)}">
        <input class="field" type="password" data-f="pw" placeholder="Lock screen password (optional)" value="${esc(s.pw)}" autocomplete="off">
        <input class="field" type="password" data-f="pw2" placeholder="Repeat password" value="${esc(s.pw2)}" autocomplete="off">
        <input class="field" data-f="hint" placeholder="Password hint (optional)" value="${esc(s.hint)}">` : '<p class="muted">You will be called "Guest". You can create an account later in Settings.</p>'}
        <button class="btn" disabled>Sign in with Google (not available yet)</button>
        <p class="muted small">Google sign-in needs a Google Cloud project that has not been set up, so it is switched off instead of pretending to work.</p>
        <div class="err">${esc(err)}</div>`,
      () => `<h2>Make it yours</h2><div class="row">${walls.map(([k, n, bg]) => `<button class="wp ${st.get('wall', 'night') === k ? 'on' : ''}" data-wall="${k}" aria-label="${n}" style="background:${bg}"></button>`).join('')}</div>
        <div class="seg"><button class="${st.get('theme', 'dark') === 'dark' ? 'on' : ''}" data-theme="dark">Dark</button><button class="${st.get('theme', 'dark') === 'light' ? 'on' : ''}" data-theme="light">Light</button></div>
        <div class="row">${accents.map(c => `<button class="swatch ${st.get('accent', '#9b6bff') === c ? 'on' : ''}" data-accent="${c}" aria-label="Accent ${c}" style="background:${c}"></button>`).join('')}</div>`,
      () => `<h2>Privacy and browsing</h2>
        <div class="srow"><span>Ad blocker<br><small class="muted">Blocks common ad and tracking networks in the BrowOS browser</small></span>${sw('adblock', s.adblock)}</div>
        <div class="srow"><span>Desktop sites<br><small class="muted">Websites load their desktop version</small></span>${sw('desktop', s.desktop)}</div>
        <div class="srow"><span>Lock screen at startup<br><small class="muted">Shows the clock first, and asks for your password if you set one</small></span>${sw('lock', s.lock)}</div>
        <div class="srow"><span>Phone notifications<br><small class="muted">Timers, reminders and new-message counts also appear on your phone. Android will ask for permission.</small></span>${sw('notif', s.notif)}</div>`,
      () => `<div class="logo bootlogo"></div><h1>You are all set</h1><p class="muted">Nothing is pinned yet. Open the Start menu, tap All apps, and star the apps you want.</p>`
    ];
    function draw() {
      d.innerHTML = `<div class="sbox"><div class="sdots">${steps.map((_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</div><div class="sbody">${steps[step]()}</div>
        <div class="snav">${step > 0 && step < steps.length - 1 ? '<button class="btn" data-n="back">Back</button>' : '<span></span>'}<button class="btn pri" data-n="next">${step === 0 ? 'Get started' : step === steps.length - 1 ? 'Start using BrowOS' : 'Next'}</button></div></div>`;
    }
    async function next() {
      err = '';
      if (step === 1 && s.type === 'local') {
        if (s.pw && s.pw.length < 4) err = 'Use at least 4 characters for the password.';
        else if (s.pw !== s.pw2) err = 'The two passwords do not match.';
        if (err) return draw();
      }
      if (step === steps.length - 1) {
        st.set('username', s.type === 'guest' ? 'Guest' : (s.name.trim() || 'User')); st.set('account', { type: s.type });
        if (s.type === 'local' && s.pw) await OS.lockSetPassword(s.pw, s.hint); else OS.lockClearPassword();
        st.set('adblock', s.adblock); st.set('desktopSite', s.desktop); st.set('lockOn', s.lock); st.set('sysNotify', s.notif); st.set('setupDone', true); if (s.notif) { st.set('notifAsked', true); OS.sys.ask(); }
        if (OS.nbConfigure) OS.nbConfigure();
        d.classList.add('leaving'); setTimeout(() => d.remove(), 450); OS.applyTheme(); OS.refresh(); return;
      }
      step++; draw();
    }
    d.onclick = e => {
      const t = e.target.closest('button'); if (!t || t.disabled) return; const x = t.dataset;
      if (x.langopen !== undefined) {
        const m = OS.modal('<h3>Language</h3><div class="col">' + OS.languages.map(l => `<button class="btn noi18n" data-l="${l[0]}">${l[1]}</button>`).join('') + '</div><p class="muted small">Language changes the BrowOS screens and the language websites are asked for. Some screens are still English only.</p>');
        m.onclick = ev => { const c = ev.target.dataset.l; if (!c) { if (ev.target === m) m.remove(); return; } OS.setLang(c, false); if (OS.nbConfigure) OS.nbConfigure(); m.remove(); draw(); };
        return;
      }
      if (x.n === 'next') return next();
      if (x.n === 'back') { step--; return draw(); }
      if (x.type) { s.type = x.type; return draw(); }
      if (x.wall) { st.set('wall', x.wall); st.set('wallUri', ''); OS.applyTheme(); return draw(); }
      if (x.theme) { st.set('theme', x.theme); OS.applyTheme(); return draw(); }
      if (x.accent) { st.set('accent', x.accent); OS.applyTheme(); return draw(); }
      if (x.tg) { s[x.tg] = !s[x.tg]; draw(); }
    };
    d.oninput = e => { const f = e.target.dataset.f; if (f) s[f] = e.target.value; };
    draw();
  };
})();
