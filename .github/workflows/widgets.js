/* BrowOS widgets board (Windows-style) and notification center. */
(function () {
  const OS = window.BrowOS, st = OS.store, esc = OS.esc;
  const q = s => document.querySelector(s);
  const on = (k) => st.get(k, true);
  const hm = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');

  // ---- notification center ----
  function bell() { q('#bellDot').classList.toggle('on', st.get('notifs', []).some(n => !n.read)); }
  function drawNotifs() {
    const l = st.get('notifs', []);
    q('#notifs').innerHTML = `<h2>Notifications<button class="btn" data-a="clear">Clear all</button></h2>` + (l.length ? l.map(n => `<div class="nrow2"><div><b>${esc(n.title)}</b><small>${esc(n.name)} · ${new Date(n.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>${n.body ? `<div>${esc(n.body)}</div>` : ''}</div></div>`).join('') : '<p class="muted">No notifications</p>');
  }
  OS.notifsChanged = () => { bell(); if (q('#notifs').classList.contains('open')) { drawNotifs(); markRead(); } };
  function markRead() { const l = st.get('notifs', []); if (l.some(n => !n.read)) { l.forEach(n => { n.read = true; }); st.set('notifs', l); bell(); } }

  // ---- widgets board ----
  function upcoming() {
    const now = new Date(), today = now.toISOString().slice(0, 10), t = hm(now);
    return st.get('events', []).filter(e => e.date > today || (e.date === today && (!e.time || e.time >= t))).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))).slice(0, 3);
  }
  function drawWidgets() {
    const p = q('#widgets'), now = new Date(), wx = st.get('wxCache');
    let h = `<h2>Widgets</h2><div class="wcard"><div class="big">${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div><div class="muted">${now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</div></div>`;
    if (on('wgWeather')) h += `<div class="wcard" data-open="weather"><h4>Weather <button class="lnk" data-a="rw">Refresh</button></h4>${wx ? `<div class="big">${esc(wx.sym)} ${esc(wx.temp)}</div><div class="muted">${esc(wx.city)} · ${esc(wx.desc)}</div>` : '<div class="muted">Tap to open Weather and choose a city.</div>'}</div>`;
    if (on('wgCalendar')) { const ev = upcoming(); h += `<div class="wcard" data-open="calendar"><h4>Calendar</h4>${ev.length ? ev.map(e => `<div class="rowi"><b>${esc(e.title)}</b><br><small class="muted">${new Date(e.date + 'T00:00').toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}${e.time ? ' · ' + esc(e.time) : ''}</small></div>`).join('') : '<div class="muted">No upcoming events.</div>'}</div>`; }
    if (on('wgNotes')) { const n = st.get('notes', []).slice().sort((a, b) => b.t - a.t).slice(0, 3); h += `<div class="wcard"><h4>Notes <button class="lnk" data-o="notes">Open</button></h4>${n.map(x => `<div class="rowi" data-open="notes">${esc(x.title || 'Untitled')}</div>`).join('') || '<div class="muted">No notes yet.</div>'}<input class="field" data-qn placeholder="Quick note, press Enter"></div>`; }
    if (on('wgBattery')) h += '<div class="wcard"><h4>Battery</h4><div class="big" data-bat>—</div><div class="muted" data-bats></div></div>';
    p.innerHTML = h;
    if (on('wgBattery') && navigator.getBattery) navigator.getBattery().then(b => { const e = p.querySelector('[data-bat]'); if (e) { e.textContent = Math.round(b.level * 100) + '%'; p.querySelector('[data-bats]').textContent = b.charging ? 'Charging' : 'On battery'; } }).catch(() => {});
  }
  function toggle(id) {
    const el = q('#' + id), open = el.classList.contains('open');
    document.querySelectorAll('.panel.open').forEach(p => p.classList.remove('open'));
    if (open) return;
    if (id === 'widgets') { drawWidgets(); if (OS.refreshWeather && st.get('wxPlace')) OS.refreshWeather().then(() => { if (el.classList.contains('open')) drawWidgets(); }); }
    else { drawNotifs(); markRead(); }
    el.classList.add('open');
  }
  function init() {
    q('#widgetsBtn').onclick = () => toggle('widgets'); q('#bellBtn').onclick = () => toggle('notifs');
    q('#widgets').addEventListener('click', e => {
      const b = e.target.closest('[data-a]');
      if (b && b.dataset.a === 'rw') { e.stopPropagation(); if (OS.refreshWeather) OS.refreshWeather().then(drawWidgets); return; }
      const o = e.target.closest('[data-open],[data-o]'); if (o && !e.target.closest('input')) { q('#widgets').classList.remove('open'); OS.open(o.dataset.open || o.dataset.o); }
    });
    q('#widgets').addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.matches('[data-qn]') && e.target.value.trim()) {
        const l = st.get('notes', []); l.unshift({ id: String(Date.now()), title: e.target.value.trim(), body: '', t: Date.now() }); st.set('notes', l); drawWidgets(); OS.toast('Note added');
      }
    });
    q('#notifs').addEventListener('click', e => { if (e.target.closest('[data-a=clear]')) { st.set('notifs', []); drawNotifs(); bell(); } });
    bell();
    // calendar reminders (while BrowOS is open)
    setInterval(() => {
      const now = new Date(), today = now.toISOString().slice(0, 10), t = hm(now), done = st.get('evNotified', []);
      st.get('events', []).forEach(e => { if (e.date === today && e.time === t && !done.includes(e.id)) { done.push(e.id); st.set('evNotified', done.slice(-100)); OS.sys.cancel(Number(String(e.id).slice(-9)) % 2000000000); OS.notify('calendar', e.title, 'Starting now'); } });
    }, 20000);
  }
  init();
})();
