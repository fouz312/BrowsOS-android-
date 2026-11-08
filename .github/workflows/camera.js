/* BrowOS Camera: take photos, record video, switch cameras. Photos go to Gallery, videos to Videos. */
(function () {
  const OS = window.BrowOS;
  const FSP = () => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
  OS.askMedia = async function () {
    for (const c of [{ video: true, audio: true }, { video: true }, { audio: true }]) {
      try { const s = await navigator.mediaDevices.getUserMedia(c); s.getTracks().forEach(t => t.stop()); return true; } catch (e) {}
    }
    return false;
  };
  async function saveFile(path, b64) {
    const fs = FSP(); if (!fs) throw new Error('works in the Android app only');
    await fs.mkdir({ path: path.slice(0, path.lastIndexOf('/')), directory: 'DATA', recursive: true }).catch(() => {});
    await fs.writeFile({ path, directory: 'DATA', data: b64 });
  }
  const blobB64 = b => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = no; r.readAsDataURL(b); });
  OS.register({
    id: 'camera', name: 'Camera', icon: '📷', color: '#0ea5e9', cat: 'Media', w: 520, h: 600,
    build(el, ctx) {
      let stream = null, facing = 'user', rec = null, chunks = [];
      el.innerHTML = '<div class="cam"><video playsinline muted autoplay></video><div class="camb"><button class="btn" data-a="flip" aria-label="Switch camera">🔄</button><button class="btn pri camshot" data-a="shot" aria-label="Take photo">●</button><button class="btn" data-a="rec" aria-label="Record video">🎥</button></div><div class="muted camnote"></div></div>';
      const v = el.querySelector('video'), note = el.querySelector('.camnote');
      function stop() { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; }
      async function start() {
        stop();
        try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false }); v.srcObject = stream; note.textContent = ''; v.style.transform = facing === 'user' ? 'scaleX(-1)' : ''; }
        catch (e) { note.textContent = 'Camera not available. Allow Camera for BrowOS in Android settings.'; }
      }
      el.onclick = async e => {
        const t = e.target.closest('button'); if (!t) return; const a = t.dataset.a;
        if (a === 'flip') { facing = facing === 'user' ? 'environment' : 'user'; start(); }
        else if (a === 'shot' && stream) {
          const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0);
          try { await saveFile('BrowOS/Pictures/camera-' + Date.now() + '.jpg', c.toDataURL('image/jpeg', 0.92).split(',')[1]); ctx.toast('Photo saved. Find it in Gallery.'); } catch (err) { ctx.toast('Could not save: ' + err.message); }
        } else if (a === 'rec' && stream) {
          if (rec) { rec.stop(); return; }
          chunks = [];
          try { rec = new MediaRecorder(stream); } catch (err) { rec = null; return ctx.toast('Recording is not supported here.'); }
          rec.ondataavailable = ev => chunks.push(ev.data);
          rec.onstop = async () => { t.textContent = '🎥'; const b = new Blob(chunks, { type: 'video/webm' }); rec = null; try { await saveFile('BrowOS/Videos/camera-' + Date.now() + '.webm', await blobB64(b)); ctx.toast('Video saved. Find it in Videos.'); } catch (err) { ctx.toast('Could not save: ' + err.message); } };
          rec.start(); t.textContent = '⏹';
        }
      };
      start();
      return () => { if (rec) try { rec.stop(); } catch (e) {} stop(); };
    }
  });
})();
