package com.browos.app;

import android.app.Activity;
import android.view.Window;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.util.Collections;
import java.util.HashSet;

// Optional extras. If this file does not compile, the build drops it and everything else still works.
public class Extras {

  // Runs before the page scripts, in every frame. It only makes the browser report itself consistently
  // (a normal Chrome-like environment) so sites do not mistake a real person for a bot.
  private static final String ENV_JS =
    "(function(){try{var ua=navigator.userAgent||'';var desk=ua.indexOf('X11; Linux x86_64')>=0;"
    + "if(!window.chrome){window.chrome={runtime:{},app:{isInstalled:false},loadTimes:function(){return{}},csi:function(){return{}}};}"
    + "var def=function(o,k,v){try{Object.defineProperty(o,k,{get:function(){return v},configurable:true})}catch(e){}};"
    + "if(desk){def(navigator,'platform','Linux x86_64');"
    + "var i=ua.indexOf('Chrome/');var v=i>=0?ua.substr(i+7).split(' ')[0]:'126.0.0.0';var major=v.split('.')[0];"
    + "var brands=[{brand:'Chromium',version:major},{brand:'Google Chrome',version:major},{brand:'Not.A/Brand',version:'24'}];"
    + "def(navigator,'userAgentData',{brands:brands,mobile:false,platform:'Linux',"
    + "getHighEntropyValues:function(h){return Promise.resolve({brands:brands,mobile:false,platform:'Linux',platformVersion:'6.5.0',architecture:'x86',bitness:'64',model:'',uaFullVersion:v,fullVersionList:brands})},"
    + "toJSON:function(){return{brands:brands,mobile:false,platform:'Linux'}}});}"
    + "}catch(e){}})();";

  private static final String VOICE_JS = "function tabosVoice(stream, preset, AC) { var P = { deep: { r: 0.72 }, high: { r: 1.3 }, chipmunk: { r: 1.7 }, monster: { r: 0.58 }, robot: { r: 1, ring: 55 }, alien: { r: 1.15, ring: 140 } }; var cfg = P[preset]; if (!cfg || !stream.getAudioTracks().length) return stream; var ctx = new AC(); if (ctx.resume) ctx.resume(); var src = ctx.createMediaStreamSource(new MediaStream([stream.getAudioTracks()[0]])); var sr = ctx.sampleRate, N = Math.floor(sr * 0.05), size = N * 4, buf = new Float32Array(size), w = 0, ph = [0, 0.5]; var node = ctx.createScriptProcessor(2048, 1, 1); node.onaudioprocess = function (e) { var inp = e.inputBuffer.getChannelData(0), out = e.outputBuffer.getChannelData(0), step = (1 - cfg.r) / N; for (var i = 0; i < inp.length; i++) { buf[w] = inp[i]; var y = 0; for (var h = 0; h < 2; h++) { ph[h] += step; if (ph[h] >= 1) ph[h] -= 1; else if (ph[h] < 0) ph[h] += 1; var rp = w - ph[h] * N; if (rp < 0) rp += size; var i0 = Math.floor(rp), fr = rp - i0, i1 = i0 + 1 >= size ? 0 : i0 + 1; var g = Math.sin(Math.PI * ph[h]); y += (buf[i0] * (1 - fr) + buf[i1] * fr) * g * g; } out[i] = y; w++; if (w >= size) w = 0; } }; var last = node; src.connect(node); if (cfg.ring) { var rg = ctx.createGain(); rg.gain.value = 0; var osc = ctx.createOscillator(); osc.frequency.value = cfg.ring; osc.connect(rg.gain); osc.start(); node.connect(rg); last = rg; } var dest = ctx.createMediaStreamDestination(); last.connect(dest); var outStream = new MediaStream(); dest.stream.getAudioTracks().forEach(function (t) { outStream.addTrack(t); }); stream.getVideoTracks().forEach(function (t) { outStream.addTrack(t); }); outStream.__tabosCtx = ctx; outStream.__tabosNode = node; return outStream; } (function () { try { var md = navigator.mediaDevices; if (!md || !md.getUserMedia || window.__tabosVoiceOn) return; window.__tabosVoiceOn = 1; var orig = md.getUserMedia.bind(md); md.getUserMedia = function (c) { var p = orig(c); try { var pr = (window.BrowOSVoice && BrowOSVoice.preset && BrowOSVoice.preset()) || 'off'; if (pr === 'off' || !c || !c.audio) return p; var AC = window.AudioContext || window.webkitAudioContext; return p.then(function (s) { try { return tabosVoice(s, pr, AC); } catch (e) { return s; } }); } catch (e) { return p; } }; } catch (e) {} })();";

  public static void stealth(WebView w, boolean unused) {
    try {
      // Stops the WebView from telling every website which app is browsing (the X-Requested-With header).
      if (WebViewFeature.isFeatureSupported(WebViewFeature.REQUESTED_WITH_HEADER_ALLOW_LIST)) {
        WebSettingsCompat.setRequestedWithHeaderOriginAllowList(w.getSettings(), new HashSet<String>());
      }
    } catch (Throwable ignored) {
    }
    try {
      if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
        WebViewCompat.addDocumentStartJavaScript(w, ENV_JS, Collections.singleton("*"));
      }
    } catch (Throwable ignored) {
    }
    try {
      if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
        WebViewCompat.addDocumentStartJavaScript(w, VOICE_JS, Collections.singleton("*"));
      }
    } catch (Throwable ignored) {
    }
  }

  // Hides or shows the Android status and navigation bars. Swiping from the screen edge shows them briefly.
  public static void fullscreen(Activity a, boolean on) {
    Window win = a.getWindow();
    WindowInsetsControllerCompat c = WindowCompat.getInsetsController(win, win.getDecorView());
    if (on) {
      c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
      c.hide(WindowInsetsCompat.Type.systemBars());
    } else {
      c.show(WindowInsetsCompat.Type.systemBars());
    }
  }
}
