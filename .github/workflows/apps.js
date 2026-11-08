/* BrowOS built-in apps (Stage 2: Calculator, Notepad, Settings). */
(function () {
  const OS = window.BrowOS;
  const esc = OS.esc;

  /* ---------- Calculator ---------- */
  // A small, safe calculator engine (no eval): numbers, + - * / and unary minus.
  function evaluate(src) {
    const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s/g, '');
    let i = 0;
    function factor() {
      if (s[i] === '-') { i++; return -factor(); }
      const m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
      if (!m) throw new Error('bad');
      i += m[0].length; return parseFloat(m[0]);
    }
    function term() {
      let v = factor();
      while (s[i] === '*' || s[i] === '/') { const o = s[i++]; const r = factor(); v = o === '*' ? v * r : v / r; }
      return v;
    }
    function expr() {
      let v = term();
      while (s[i] === '+' || s[i] === '-') { const o = s[i++]; const r = term(); v = o === '+' ? v + r : v - r; }
      return v;
    }
    const v = expr();
    if (i < s.length) throw new Error('bad');
    if (!isFinite(v)) throw new Error('div0');
    return parseFloat(v.toPrecision(12));
  }
  OS.calcEval = evaluate;

  OS.register({
    id: 'calculator', name: 'Calculator', icon: '🧮', color: '#7c3aed', cat: 'Tools', w: 340, h: 520,
    build(el, ctx) {
      let expr = '', result = '';
      el.innerHTML = `<div class="calc"><div class="cdisp"><small></small><b>0</b></div>
        <div class="ckeys"></div><div class="chist hidden"></div></div>`;
      const keys = ['C', '⌫', 'H', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '='];
      const kb = el.querySelector('.ckeys'), small = el.querySelector('small'), big = el.querySelector('b'), hist = el.querySelector('.chist');
      kb.innerHTML = keys.map(k => `<button data-k="${k}" class="${'÷×−+'.includes(k) ? 'op' : ''}${k === '=' ? ' eq' : ''}">${k === 'H' ? '🕘' : k}</button>`).join('');
      const show = () => { small.textContent = result && expr ? expr : ''; big.textContent = result || expr || '0'; };
      function showHistory() {
        const h = ctx.store.get('calcHistory', []);
        hist.innerHTML = `<button class="btn" data-x="close">Close</button> <button class="btn" data-x="clear">Clear history</button>` +
          (h.length ? h.map(e => `<div>${esc(e.e)}<b>= ${esc(e.r)}</b></div>`).join('') : '<p class="empty">No calculations yet.</p>');
        hist.classList.remove('hidden');
      }
      hist.onclick = e => {
        const x = e.target.dataset.x;
        if (x === 'close') hist.classList.add('hidden');
        if (x === 'clear') { ctx.store.set('calcHistory', []); showHistory(); }
      };
      kb.onclick = e => {
        const k = e.target.dataset.k; if (!k) return;
        if (k === 'H') return showHistory();
        if (k === 'C') { expr = ''; result = ''; }
        else if (k === '⌫') { if (result) { expr = result; result = ''; } expr = expr.slice(0, -1); }
        else if (k === '=') {
          if (!expr) return;
          try {
            const r = String(evaluate(expr));
            const h = ctx.store.get('calcHistory', []); h.unshift({ e: expr, r }); ctx.store.set('calcHistory', h.slice(0, 30));
            result = r;
          } catch (err) { result = err.message === 'div0' ? "Can't divide by zero" : 'Error'; }
        } else {
          if (result && !'÷×−+'.includes(k) && !result.startsWith('Can') && result !== 'Error') expr = '';
          else if (result && !result.startsWith('Can') && result !== 'Error') expr = result;
          else if (result) expr = '';
          result = '';
          expr += k;
        }
        show();
      };
      show();
    }
  });

  /* ---------- Notepad ---------- */
  OS.register({
    id: 'notes', name: 'Notepad', icon: '📝', color: '#ec4899', cat: 'Productivity', w: 380, h: 520,
    build(el, ctx) {
      let q = '';
      const load = () => ctx.store.get('notes', []);
      const save = n => ctx.store.set('notes', n);
      function list() {
        const notes = load().filter(n => (n.title + ' ' + n.body).toLowerCase().includes(q.toLowerCase()));
        el.innerHTML = `<div class="nlist"><div class="nrow"><input class="field" type="search" placeholder="Search notes..." value="${esc(q)}"><button class="btn pri" data-a="new">+ New</button></div>
          <div class="nitems">${notes.length ? notes.map(n => `<button class="nitem" data-id="${n.id}"><b>${esc(n.title || 'Untitled')}</b><span>${new Date(n.t).toLocaleString()}</span></button>`).join('') : '<div class="empty">' + (q ? 'No matching notes.' : 'No notes yet. Tap + New.') + '</div>'}</div></div>`;
        const inp = el.querySelector('input');
        inp.oninput = () => { q = inp.value; const pos = inp.selectionStart; list(); const i2 = el.querySelector('input'); i2.focus(); i2.setSelectionRange(pos, pos); };
        el.querySelector('.nlist').onclick = e => {
          if (e.target.dataset.a === 'new') { const n = { id: String(Date.now()), title: '', body: '', t: Date.now() }; save([n, ...load()]); edit(n.id); }
          const it = e.target.closest('.nitem'); if (it) edit(it.dataset.id);
        };
      }
      function edit(id) {
        const note = load().find(n => n.id === id); if (!note) return list();
        el.innerHTML = `<div class="nedit"><div class="nrow"><button class="btn" data-a="back">&larr; Notes</button><input class="field" placeholder="Title (tap to rename)" value="${esc(note.title)}"><button class="btn" data-a="del">🗑</button></div><textarea placeholder="Start typing. Your note saves automatically.">${esc(note.body)}</textarea></div>`;
        const t = el.querySelector('input'), b = el.querySelector('textarea');
        let timer;
        const commit = () => { const all = load(), n = all.find(x => x.id === id); if (!n) return; n.title = t.value; n.body = b.value; n.t = Date.now(); save(all); };
        const later = () => { clearTimeout(timer); timer = setTimeout(commit, 300); };
        t.oninput = later; b.oninput = later;
        el.querySelector('.nedit').onclick = e => {
          const a = e.target.dataset.a;
          if (a === 'back') { commit(); list(); }
          if (a === 'del' && confirm('Delete this note?')) { save(load().filter(x => x.id !== id)); list(); }
        };
      }
      list();
    }
  });

})();
