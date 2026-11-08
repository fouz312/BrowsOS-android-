/* BrowOS Voice Changer: changes your voice in websites opened inside BrowOS (Discord, Meet and more). */
(function () {
  const OS = window.BrowOS, st = OS.store;
function tabosVoice(stream, preset, AC) {
  var P = { deep: { r: 0.72 }, high: { r: 1.3 }, chipmunk: { r: 1.7 }, monster: { r: 0.58 }, robot: { r: 1, ring: 55 }, alien: { r: 1.15, ring: 140 } };
  var cfg = P[preset];
  if (!cfg || !stream.getAudioTracks().length) return stream;
  var ctx = new AC();
  if (ctx.resume) ctx.resume();
  var src = ctx.createMediaStreamSource(new MediaStream([stream.getAudioTracks()[0]]));
  var sr = ctx.sampleRate, N = Math.floor(sr * 0.05), size = N * 4, buf = new Float32Array(size), w = 0, ph = [0, 0.5];
  var node = ctx.createScriptProcessor(2048, 1, 1);
  node.onaudioprocess = function (e) {
    var inp = e.inputBuffer.getChannelData(0), out = e.outputBuffer.getChannelData(0), step = (1 - cfg.r) / N;
    for (var i = 0; i < inp.length; i++) {
      buf[w] = inp[i];
      var y = 0;
      for (var h = 0; h < 2; h++) {
        ph[h] += step;
        if (ph[h] >= 1) ph[h] -= 1; else if (ph[h] < 0) ph[h] += 1;
        var rp = w - ph[h] * N;
        if (rp < 0) rp += size;
        var i0 = Math.floor(rp), fr = rp - i0, i1 = i0 + 1 >= size ? 0 : i0 + 1;
        var g = Math.sin(Math.PI * ph[h]);
        y += (buf[i0] * (1 - fr) + buf[i1] * fr) * g * g;
      }
      out[i] = y;
      w++;
      if (w >= size) w = 0;
    }
  };
  var last = node;
  src.connect(node);
  if (cfg.ring) {
    var rg = ctx.createGain();
    rg.gain.value = 0;
    var osc = ctx.createOscillator();
    osc.frequency.value = cfg.ring;
    osc.connect(rg.gain);
    osc.start();
    node.connect(rg);
    last = rg;
  }
  var dest = ctx.createMediaStreamDestination();
  last.connect(dest);
  var outStream = new MediaStream();
  dest.stream.getAudioTracks().forEach(function (t) { outStream.addTrack(t); });
  stream.getVideoTracks().forEach(function (t) { outStream.addTrack(t); });
  outStream.__tabosCtx = ctx;
  outStream.__tabosNode = node;
  return outStream;
}

  OS.register({
    id: 'voice', name: 'Voice Changer', icon: '🎙️', color: '#a855f7', cat: 'Media', w: 460, h: 560,
    build(el, ctx) {
      let testStream = null, audioEl = null;
      const presets = [['off', 'Off'], ['deep', 'Deep'], ['high', 'High'], ['chipmunk', 'Chipmunk'], ['monster', 'Monster'], ['robot', 'Robot'], ['alien', 'Alien']];
      function stopTest() { if (testStream) testStream.getTracks().forEach(t => t.stop()); testStream = null; if (audioEl) { audioEl.pause(); audioEl.srcObject = null; } }
      function draw() {
        const cur = st.get('voicePreset', 'off');
        el.innerHTML = `<div class="set"><p class="muted">Changes your voice in websites you open inside BrowOS, like Discord or Google Meet in the Browser or as a web app. It does not change your voice in other Android apps. Choose a voice, then join or rejoin the call.</p>
          <div class="row">${presets.map(([k, n]) => `<button class="btn ${cur === k ? 'pri' : ''}" data-p="${k}">${n}</button>`).join('')}</div>
          <div class="scard"><div class="srow"><span>Test my voice<br><small class="muted">Use headphones, or it will echo.</small></span><button class="btn" data-a="test">${testStream ? 'Stop' : 'Start'}</button></div></div></div>`;
      }
      async function test() {
        if (testStream) { stopTest(); return draw(); }
        try {
          const raw = await navigator.mediaDevices.getUserMedia({ audio: true }); testStream = raw;
          const out = tabosVoice(raw, st.get('voicePreset', 'off'), window.AudioContext || window.webkitAudioContext);
          audioEl = audioEl || new Audio(); audioEl.srcObject = out; await audioEl.play(); ctx.toast('Say something...');
        } catch (e) { ctx.toast('Microphone not available. Allow Microphone for BrowOS in Android settings.'); stopTest(); }
        draw();
      }
      el.onclick = e => {
        const t = e.target.closest('button'); if (!t) return;
        if (t.dataset.p) { stopTest(); st.set('voicePreset', t.dataset.p); OS.nbConfigure(); ctx.toast('Voice: ' + t.textContent); draw(); }
        else if (t.dataset.a === 'test') test();
      };
      draw();
      return stopTest;
    }
  });
})();
