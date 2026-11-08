/* BrowOS lock screen: big clock, widgets, optional password. It guards the BrowOS screen only. */
(function () {
  const OS = window.BrowOS, st = OS.store, esc = OS.esc, KEY = OS.keys.lock, ITER = 200000;
  const enc = new TextEncoder();
  const b64 = b => { let s = ''; new Uint8Array(b).forEach(x => { s += String.fromCharCode(x); }); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function hash(pw, salt, iter) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, 256));
  }
  const rec = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  OS.lockHasPassword = () => !!rec();
  OS.lockSetPassword = async (pw, hint) => { const salt = crypto.getRandomValues(new Uint8Array(16)); localStorage.setItem(KEY, JSON.stringify({ salt: b64(salt), iter: ITER, hash: await hash(pw, salt, ITER), hint: hint || '' })); };
  OS.lockVerify = async pw => { const r = rec(); if (!r) return true; return (await hash(pw, unb64(r.salt), r.iter)) === r.hash; };
  OS.lockClearPassword = () => { try { localStorage.removeItem(KEY); } catch (e) {} };

  let timer = null, fails = 0, waitUntil = 0;
  const q = s => document.querySelector(s);

  function nextEvent() {
    const now = new Date(), today = now.toISOString().slice(0, 10), hm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    return st.get('events', []).filter(e => e.date > today || (e.date === today && (!e.time || e.time >= hm))).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))[0];
  }
  function widgets() {
    const ev = nextEvent(), notes = st.get('notes', []), n0 = notes.slice().sort((a, b) => b.t - a.t)[0], wx = st.get('wxCache');
    return `<div class="lkw" data-w="wx"><small>Weather</small>${wx ? `<b>${esc(wx.sym)} ${esc(wx.temp)}</b><span>${esc(wx.city)} · ${esc(wx.desc)}</span>` : '<b>—</b><span>Set a city in the Weather app</span>'}</div>
      <div class="lkw"><small>Next event</small>${ev ? `<b>${esc(ev.title)}</b><span>${new Date(ev.date + 'T00:00').toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}${ev.time ? ' · ' + esc(ev.time) : ''}</span>` : '<b>Nothing planned</b><span>Calendar is clear</span>'}</div>
      <div class="lkw"><small>Notes</small>${n0 ? `<b>${esc(n0.title || 'Untitled')}</b><span>${notes.length} note(s)</span>` : '<b>No notes</b><span>Open Notepad to write one</span>'}</div>
      <div class="lkw" data-w="bat" style="display:none"><small>Battery</small><b></b><span></span></div>`;
  }
  async function refreshWeather() {
    const p = st.get('wxPlace'); if (!p) return;
    try {
      const f = st.get('wxUnit', 'c') === 'f';
      const j = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=temperature_2m,weather_code&timezone=auto&temperature_unit=${f ? 'fahrenheit' : 'celsius'}`)).json();
      const w = OS.wxCode ? OS.wxCode(j.current.weather_code) : ['🌡️', ''];
      st.set('wxCache', { city: p.name, temp: Math.round(j.current.temperature_2m) + (f ? '°F' : '°C'), sym: w[0], desc: w[1] });
      const box = q('#lock .lk-widgets'); if (box) box.innerHTML = widgets(), battery();
    } catch (e) {}
  }
  async function battery() {
    try {
      if (!navigator.getBattery) return;
      const b = await navigator.getBattery(), w = q('#lock [data-w=bat]'); if (!w) return;
      w.style.display = ''; w.querySelector('b').textContent = Math.round(b.level * 100) + '%'; w.querySelector('span').textContent = b.charging ? 'Charging' : 'On battery';
    } catch (e) {}
  }
  OS.refreshWeather = refreshWeather;
  function tick() {
    const d = new Date();
    const t = q('#lock .lk-time'); if (!t) return clearInterval(timer);
    t.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    q('#lock .lk-date').textContent = d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function unlock() {
    const d = q('#lock'); if (!d) return;
    document.body.classList.remove('locked', 'signin'); d.classList.add('leaving'); clearInterval(timer);
    setTimeout(() => d.remove(), 450); fails = 0;
  }
  function show() {
    if (q('#lock')) return;
    const d = document.createElement('div'); d.id = 'lock';
    const r = rec();
    d.innerHTML = `<div class="lk-top"><div class="lk-time"></div><div class="lk-date"></div></div>
      <div class="lk-sign"><div class="avatar big">${esc(OS.userName()[0].toUpperCase())}</div><h2>${esc(OS.userName())}</h2>
      ${r ? `<input class="field" type="password" id="lkpw" placeholder="Password" autocomplete="off"><div class="lk-msg"></div>${r.hint ? `<small class="muted">Hint: ${esc(r.hint)}</small>` : ''}<button class="btn pri" id="lkgo">Sign in</button>` : '<button class="btn pri" id="lkgo">Continue</button>'}</div>
      <div class="lk-widgets">${widgets()}</div><div class="lk-hint">Swipe up or tap to continue</div>`;
    document.body.append(d); document.body.classList.add('locked'); document.body.classList.remove('signin');
    tick(); clearInterval(timer); timer = setInterval(tick, 1000); battery(); refreshWeather();
    let y0 = null;
    const goSign = () => {
      if (!rec()) return unlock();
      document.body.classList.add('signin'); const i = q('#lkpw'); if (i) setTimeout(() => i.focus(), 200);
    };
    d.addEventListener('pointerdown', e => { y0 = e.clientY; });
    d.addEventListener('pointerup', e => { if (e.target.closest('.lk-sign')) return; if (y0 !== null && (y0 - e.clientY > 50 || Math.abs(y0 - e.clientY) < 8)) goSign(); y0 = null; });
    const go = async () => {
      if (!rec()) return unlock();
      const msg = q('#lock .lk-msg'), now = Date.now();
      if (now < waitUntil) { msg.textContent = 'Too many tries. Wait ' + Math.ceil((waitUntil - now) / 1000) + ' seconds.'; return; }
      msg.textContent = 'Checking...';
      if (await OS.lockVerify(q('#lkpw').value)) return unlock();
      fails++; q('#lkpw').value = '';
      if (fails >= 5) { waitUntil = Date.now() + 30000; fails = 0; msg.textContent = 'Too many tries. Wait 30 seconds.'; }
      else { msg.textContent = 'Wrong password.'; d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake'); }
    };
    q('#lkgo').onclick = go;
    d.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'lkpw') go(); });
  }
  OS.lockNow = show;
  let hiddenAt = 0;
  OS.lockInit = () => {
    if (st.get('lockOn', true)) show();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { hiddenAt = Date.now(); return; }
      const m = st.get('lockLeave', 'never'); if (m === 'never' || !hiddenAt) return;
      if (Date.now() - hiddenAt >= (m === 'now' ? 0 : +m * 1000)) show();
    });
  };
})();
