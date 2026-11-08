/* BrowOS Clock: digital clock, world clock, stopwatch, timer. */
(function () {
  const OS = window.BrowOS, esc = OS.esc;
  const p2 = n => String(n).padStart(2, '0');
  const fmtSW = ms => { const t = Math.floor(ms / 10); return p2(Math.floor(t / 6000)) + ':' + p2(Math.floor(t / 100) % 60) + '.' + p2(t % 100); };
  const fmtT = ms => { const s = Math.ceil(ms / 1000); return p2(Math.floor(s / 3600)) + ':' + p2(Math.floor(s / 60) % 60) + ':' + p2(s % 60); };
  OS.fmtSW = fmtSW; OS.fmtT = fmtT;
  const cities = [['Dubai', 'Asia/Dubai'], ['London', 'Europe/London'], ['Paris', 'Europe/Paris'], ['Cairo', 'Africa/Cairo'], ['Mumbai', 'Asia/Kolkata'], ['Tokyo', 'Asia/Tokyo'], ['Sydney', 'Australia/Sydney'], ['New York', 'America/New_York'], ['Los Angeles', 'America/Los_Angeles']];

  OS.register({
    id: 'clock', name: 'Clock', icon: '⏰', color: '#0ea5e9', cat: 'Tools', w: 380, h: 540,
    build(el, ctx) {
      let tab = 'clock', actx = null;
      const sw = { run: false, start: 0, acc: 0, laps: [] };
      const tm = { state: 'idle', end: 0, left: 0, h: 0, m: 5, s: 0 };
      const tabs = [['clock', 'Clock'], ['world', 'World'], ['stop', 'Stopwatch'], ['timer', 'Timer']];

      function beep() {
        try {
          if (actx) { let t = actx.currentTime; for (let i = 0; i < 3; i++) { const o = actx.createOscillator(), g = actx.createGain(); o.connect(g); g.connect(actx.destination); o.frequency.value = 880; g.gain.setValueAtTime(0.2, t + i * 0.4); g.gain.setValueAtTime(0, t + i * 0.4 + 0.25); o.start(t + i * 0.4); o.stop(t + i * 0.4 + 0.3); } }
        } catch (e) {}
        if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
      }

      function render() {
        let h = '';
        if (tab === 'clock') h = `<div class="center"><div class="bigt" data-d>--</div><div class="muted" data-s></div></div>`;
        else if (tab === 'world') h = cities.map(([n, tz]) => `<div class="wrow"><span>${esc(n)}<small data-day="${tz}"></small></span><b data-tz="${tz}"></b></div>`).join('');
        else if (tab === 'stop') h = `<div class="center"><div class="bigt" data-d>00:00.00</div><div class="row"><button class="btn pri" data-a="swtoggle">${sw.run ? 'Stop' : 'Start'}</button><button class="btn" data-a="swlap">Lap</button><button class="btn" data-a="swreset">Reset</button></div></div><div class="laps">${sw.laps.map((l, i) => `<div><span>Lap ${sw.laps.length - i}</span><b>${fmtSW(l)}</b></div>`).join('')}</div>`;
        else h = tm.state === 'idle'
          ? `<div class="center"><div class="row tin"><label>Hours<input class="field" type="number" min="0" max="99" inputmode="numeric" data-in="h" value="${tm.h}"></label><label>Min<input class="field" type="number" min="0" max="59" inputmode="numeric" data-in="m" value="${tm.m}"></label><label>Sec<input class="field" type="number" min="0" max="59" inputmode="numeric" data-in="s" value="${tm.s}"></label></div><button class="btn pri" data-a="tmstart">Start timer</button></div>`
          : `<div class="center"><div class="bigt" data-d>${fmtT(tm.left)}</div><div class="row"><button class="btn pri" data-a="tmpause">${tm.state === 'run' ? 'Pause' : 'Resume'}</button><button class="btn" data-a="tmreset">Cancel</button></div></div>`;
        el.innerHTML = `<div class="clk"><div class="seg">${tabs.map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}</div><div class="cbody">${h}</div></div>`;
        update();
      }

      function update() {
        const now = Date.now(), d = new Date();
        if (tm.state === 'run') {
          tm.left = Math.max(0, tm.end - now);
          if (tm.left === 0) { tm.state = 'idle'; beep(); OS.sys.cancel(777001); OS.notify('clock', 'Timer finished!'); return render(); }
        }
        const big = el.querySelector('[data-d]');
        if (tab === 'clock' && big) {
          big.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          el.querySelector('[data-s]').textContent = d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' · ' + Intl.DateTimeFormat().resolvedOptions().timeZone;
        } else if (tab === 'world') {
          el.querySelectorAll('[data-tz]').forEach(b => { b.textContent = d.toLocaleTimeString([], { timeZone: b.dataset.tz, hour: '2-digit', minute: '2-digit' }); });
          el.querySelectorAll('[data-day]').forEach(s => {
            const tz = s.dataset.day, a = d.toLocaleDateString('en-CA', { timeZone: tz }), b = d.toLocaleDateString('en-CA');
            s.textContent = a === b ? 'Today' : a > b ? 'Tomorrow' : 'Yesterday';
          });
        } else if (tab === 'stop' && big) big.textContent = fmtSW(sw.acc + (sw.run ? now - sw.start : 0));
        else if (tab === 'timer' && big) big.textContent = fmtT(tm.left);
      }

      el.onclick = e => {
        const t = e.target.dataset.tab, a = e.target.dataset.a;
        if (t) { tab = t; return render(); }
        if (!a) return;
        const now = Date.now();
        if (a === 'swtoggle') { if (sw.run) { sw.acc += now - sw.start; sw.run = false; } else { sw.start = now; sw.run = true; } }
        else if (a === 'swlap') { if (sw.run || sw.acc) sw.laps.unshift(sw.acc + (sw.run ? now - sw.start : 0)); }
        else if (a === 'swreset') { sw.run = false; sw.acc = 0; sw.laps = []; }
        else if (a === 'tmstart') {
          const v = k => Math.max(0, Math.min(k === 'h' ? 99 : 59, parseInt(el.querySelector(`[data-in=${k}]`).value, 10) || 0));
          tm.h = v('h'); tm.m = v('m'); tm.s = v('s');
          const total = (tm.h * 3600 + tm.m * 60 + tm.s) * 1000;
          if (!total) return ctx.toast('Set a time first.');
          try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch (err) {}
          tm.left = total; tm.end = now + total; tm.state = 'run'; OS.sys.at(777001, 'Timer finished', 'Your BrowOS timer is done', tm.end);
        }
        else if (a === 'tmpause') { if (tm.state === 'run') { tm.left = tm.end - now; tm.state = 'pause'; OS.sys.cancel(777001); } else { tm.end = now + tm.left; tm.state = 'run'; OS.sys.at(777001, 'Timer finished', 'Your BrowOS timer is done', tm.end); } }
        else if (a === 'tmreset') { tm.state = 'idle'; OS.sys.cancel(777001); }
        render();
      };
      const iv = setInterval(update, 100);
      render();
      return () => clearInterval(iv);   // runs when the window is closed
    }
  });
})();
