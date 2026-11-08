package com.browos.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebStorage;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayInputStream;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// A real Chromium (Android WebView) window that BrowOS places inside its own windows.
@CapacitorPlugin(name = "NativeBrowser")
public class NativeBrowserPlugin extends Plugin {

  // A basic list of common advertising and tracking networks.
  private static final String[] BLOCK = {
    "doubleclick.net", "googlesyndication.com", "googleadservices.com", "adservice.google.com",
    "google-analytics.com", "analytics.google.com", "adnxs.com", "taboola.com", "outbrain.com",
    "criteo.com", "criteo.net", "scorecardresearch.com", "amazon-adsystem.com", "adsrvr.org",
    "pubmatic.com", "rubiconproject.com", "openx.net", "casalemedia.com", "moatads.com", "2mdn.net",
    "advertising.com", "adform.net", "smartadserver.com", "media.net", "revcontent.com", "mgid.com",
    "zedo.com", "serving-sys.com", "yieldmo.com", "teads.tv", "sharethrough.com", "adcolony.com",
    "applovin.com", "ads.yahoo.com", "quantserve.com", "hotjar.com", "ads-twitter.com",
    "ads.linkedin.com", "ads.pinterest.com", "analytics.tiktok.com", "bidswitch.net", "contextweb.com",
    "lijit.com", "sovrn.com", "indexww.com", "33across.com", "id5-sync.com", "liadm.com", "bluekai.com",
    "krxd.net", "demdex.net", "everesttech.net", "adtechus.com", "tapad.com", "rlcdn.com", "exelator.com",
    "agkn.com", "crwdcntrl.net", "adsymptotic.com", "popads.net", "propellerads.com", "exoclick.com"
  };

  private final Map<String, WebView> views = new HashMap<>();
  private final Map<String, Integer> blocked = new ConcurrentHashMap<>();
  private boolean desktop = true;
  private boolean adblock = true;
  private String lang = "en";
  private String voice = "off";
  private final Map<Integer, PermissionRequest> pendingPerm = new HashMap<>();
  private int permSeq = 1;
  private final Map<String, Boolean> deskOverride = new HashMap<>();
  private String baseUa = null;

  // Watches password fields so BrowOS can offer to save the login in Vault.
  private static final String CRED_JS =
    "(function(){if(window.__browosCred)return;window.__browosCred=1;"
    + "function st(){try{return window.sessionStorage}catch(e){return null}}"
    + "function isText(i){var t=(i.type||'text').toLowerCase();return t==='text'||t==='email'||t==='tel'||t==='username';}"
    + "document.addEventListener('input',function(e){var t=e.target;if(t&&t.tagName==='INPUT'&&isText(t)&&t.value){var s=st();if(s)s.setItem('__bu',t.value);}},true);"
    + "var last='';"
    + "function send(pw){try{var user='';var all=document.querySelectorAll('input');"
    + "for(var i=0;i<all.length;i++){var c=all[i];if(c!==pw&&isText(c)&&c.value&&(c.compareDocumentPosition(pw)&4)){user=c.value;}}"
    + "if(!user){var s=st();if(s)user=s.getItem('__bu')||'';}"
    + "var key=location.href+'|'+user+'|'+pw.value;if(key===last)return;last=key;BrowOSVault.cred(location.href,user,pw.value);}catch(e){}}"
    + "function check(){var p=document.querySelectorAll('input[type=password]');for(var i=0;i<p.length;i++){if(p[i].value){send(p[i]);return;}}}"
    + "document.addEventListener('submit',function(){check();},true);"
    + "document.addEventListener('click',function(e){var b=e.target&&e.target.closest?e.target.closest('button,input[type=submit],input[type=button],[role=button]'):null;"
    + "if(b&&(b.type==='submit'||(b.tagName==='BUTTON'&&b.type!=='button')||/sign|log|next|continue|submit/i.test(b.innerText||b.value||'')))check();},true);"
    + "document.addEventListener('keydown',function(e){if(e.key==='Enter')check();},true);"
    + "var fs=0;function scan(){if(fs)return;if(document.querySelector('input[type=password]')){fs=1;try{BrowOSVault.form(location.href)}catch(e){}}}"
    + "scan();document.addEventListener('DOMContentLoaded',scan);window.addEventListener('load',scan);setTimeout(scan,1500);setTimeout(scan,4000);"
    + "})();";

  private class VoiceBridge {
    @JavascriptInterface
    public String preset() {
      return voice;
    }
  }

  private class CredBridge {
    private final String id;

    CredBridge(String id) {
      this.id = id;
    }

    @JavascriptInterface
    public void form(String url) {
      JSObject o = new JSObject();
      o.put("id", id);
      o.put("url", url);
      notifyListeners("loginform", o);
    }

    @JavascriptInterface
    public void cred(String url, String user, String pass) {
      JSObject o = new JSObject();
      o.put("id", id);
      o.put("url", url);
      o.put("user", user);
      o.put("pass", pass);
      notifyListeners("credential", o);
    }
  }

  private boolean callExtra(String name, Class<?>[] types, Object[] args) {
    try {
      Class.forName("com.browos.app.Extras").getMethod(name, types).invoke(null, args);
      return true;
    } catch (Throwable t) {
      return false;
    }
  }

  // Runs on the UI thread. If anything goes wrong the call still finishes and the app keeps running.
  private void ui(final PluginCall call, final Runnable r) {
    getActivity().runOnUiThread(() -> {
      try {
        r.run();
      } catch (Throwable t) {
        try {
          call.resolve();
        } catch (Throwable ignored) {
        }
      }
    });
  }

  private ViewGroup content() {
    return (ViewGroup) getActivity().findViewById(android.R.id.content);
  }

  private boolean isBlocked(String host) {
    if (host == null) return false;
    for (String d : BLOCK) {
      if (host.equals(d) || host.endsWith("." + d)) return true;
    }
    return false;
  }

  private String mobileUa() {
    return baseUa.replace("; wv", "").replace("Version/4.0 ", "");
  }

  private String desktopUa() {
    Matcher m = Pattern.compile("Chrome/([\\d.]+)").matcher(baseUa);
    String v = m.find() ? m.group(1) : "126.0.0.0";
    return "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/" + v + " Safari/537.36";
  }

  private void applyMode(WebView w, String id) {
    WebSettings s = w.getSettings();
    boolean d = deskOverride.containsKey(id) ? deskOverride.get(id) : desktop;
    s.setUserAgentString(d ? desktopUa() : mobileUa());
    s.setUseWideViewPort(true);
    s.setLoadWithOverviewMode(true);
  }

  private void emit(String id, WebView w, boolean loading, int progress) {
    try {
    JSObject o = new JSObject();
    o.put("id", id);
    o.put("url", w.getUrl() == null ? "" : w.getUrl());
    o.put("title", w.getTitle() == null ? "" : w.getTitle());
    o.put("canGoBack", w.canGoBack());
    o.put("canGoForward", w.canGoForward());
    o.put("loading", loading);
    o.put("progress", progress);
    Integer b = blocked.get(id);
    o.put("blocked", b == null ? 0 : b);
    notifyListeners("state", o);
    } catch (Throwable ignored) {
    }
  }

  @SuppressLint("SetJavaScriptEnabled")
  private WebView create(final String id) {
    final WebView w = new WebView(getActivity());
    if (baseUa == null) baseUa = w.getSettings().getUserAgentString();
    WebSettings s = w.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setMediaPlaybackRequiresUserGesture(false);
    s.setSupportZoom(true);
    s.setBuiltInZoomControls(true);
    s.setDisplayZoomControls(false);
    applyMode(w, id);
    callExtra("stealth", new Class<?>[] {WebView.class, boolean.class}, new Object[] {w, true});
    w.setBackgroundColor(0xFFFFFFFF);
    w.addJavascriptInterface(new CredBridge(id), "BrowOSVault");
    w.addJavascriptInterface(new VoiceBridge(), "BrowOSVoice");
    w.setNetworkAvailable(true);
    CookieManager.getInstance().setAcceptThirdPartyCookies(w, true);
    w.setWebViewClient(new WebViewClient() {
      @Override
      public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
        String u = r.getUrl().toString();
        return !(u.startsWith("http://") || u.startsWith("https://") || u.startsWith("about:"));
      }

      @Override
      public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
        try {
        if (adblock && isBlocked(r.getUrl().getHost())) {
          Integer n = blocked.get(id);
          blocked.put(id, n == null ? 1 : n + 1);
          return new WebResourceResponse("text/plain", "utf-8", new ByteArrayInputStream(new byte[0]));
        }
        } catch (Throwable ignored) {
        }
        return super.shouldInterceptRequest(v, r);
      }

      @Override
      public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail detail) {
        try {
          getActivity().runOnUiThread(() -> {
            try {
              WebView x = views.remove(id);
              if (x != null) {
                content().removeView(x);
                x.destroy();
              }
              JSObject o = new JSObject();
              o.put("id", id);
              notifyListeners("crashed", o);
            } catch (Throwable ignored) {
            }
          });
        } catch (Throwable ignored) {
        }
        return true;
      }

      @Override
      public void onPageStarted(WebView v, String url, Bitmap favicon) {
        v.setNetworkAvailable(true);
        blocked.put(id, 0);
        emit(id, v, true, 0);
      }

      @Override
      public void onPageFinished(WebView v, String url) {
        try {
          v.evaluateJavascript(CRED_JS, null);
        } catch (Throwable ignored) {
        }
        emit(id, v, false, 100);
      }

      @Override
      public void doUpdateVisitedHistory(WebView v, String url, boolean isReload) {
        try {
          if (v.getProgress() >= 100) v.evaluateJavascript(CRED_JS, null);
        } catch (Throwable ignored) {
        }
        emit(id, v, v.getProgress() < 100, v.getProgress());
      }
    });
    w.setWebChromeClient(new WebChromeClient() {
      @Override
      public void onPermissionRequest(final PermissionRequest request) {
        getActivity().runOnUiThread(() -> {
          try {
          boolean mic = false;
          boolean cam = false;
          for (String r : request.getResources()) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) mic = true;
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) cam = true;
          }
          if (!mic && !cam) {
            request.deny();
            return;
          }
          List<String> need = new ArrayList<>();
          if (mic && getActivity().checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) need.add(Manifest.permission.RECORD_AUDIO);
          if (cam && getActivity().checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) need.add(Manifest.permission.CAMERA);
          if (!need.isEmpty()) {
            getActivity().requestPermissions(need.toArray(new String[0]), 9001);
            request.deny();
            return;
          }
          int rid = permSeq++;
          pendingPerm.put(rid, request);
          JSObject o = new JSObject();
          o.put("id", id);
          o.put("rid", rid);
          o.put("origin", String.valueOf(request.getOrigin()));
          o.put("mic", mic);
          o.put("cam", cam);
          notifyListeners("permission", o);
          } catch (Throwable t) {
            try {
              request.deny();
            } catch (Throwable ignored) {
            }
          }
        });
      }

      @Override
      public void onProgressChanged(WebView v, int p) {
        emit(id, v, p < 100, p);
      }

      @Override
      public void onReceivedTitle(WebView v, String t) {
        emit(id, v, v.getProgress() < 100, v.getProgress());
      }
    });
    return w;
  }

  private void applyBounds(WebView w, PluginCall call) {
    int x = call.getInt("x", 0);
    int y = call.getInt("y", 0);
    int wd = call.getInt("w", 1);
    int ht = call.getInt("h", 1);
    boolean vis = call.getBoolean("visible", true);
    FrameLayout.LayoutParams p = new FrameLayout.LayoutParams(Math.max(1, wd), Math.max(1, ht));
    p.leftMargin = x;
    p.topMargin = y;
    w.setLayoutParams(p);
    w.setVisibility(vis ? View.VISIBLE : View.INVISIBLE);
  }

  private void load(WebView w, String url) {
    w.setNetworkAvailable(true);
    Map<String, String> headers = new HashMap<>();
    headers.put("Accept-Language", lang.equals("en") ? "en-US,en;q=0.9" : lang + ",en;q=0.7");
    w.loadUrl(url, headers);
  }

  @PluginMethod
  public void configure(final PluginCall call) {
    final boolean d = call.getBoolean("desktop", true);
    final boolean a = call.getBoolean("adblock", true);
    final String lg = call.getString("lang", "en");
    final String vc = call.getString("voice", "off");
    ui(call, () -> {
      boolean changed = d != desktop;
      desktop = d;
      adblock = a;
      lang = lg;
      voice = vc;
      if (changed && baseUa != null) {
        for (Map.Entry<String, WebView> e : views.entrySet()) {
          if (deskOverride.containsKey(e.getKey())) continue;
          applyMode(e.getValue(), e.getKey());
          e.getValue().reload();
        }
      }
      call.resolve();
    });
  }

  @PluginMethod
  public void open(final PluginCall call) {
    final String id = call.getString("id");
    final String url = call.getString("url");
    if (id == null || url == null) {
      call.reject("id and url are needed");
      return;
    }
    if (call.getData().has("desktop")) deskOverride.put(id, call.getBoolean("desktop", true));
    ui(call, () -> {
      try {
        WebView w = views.get(id);
        if (w == null) {
          w = create(id);
          views.put(id, w);
          content().addView(w, new FrameLayout.LayoutParams(1, 1));
        }
        applyBounds(w, call);
        load(w, url);
        call.resolve();
      } catch (Throwable t) {
        call.reject(String.valueOf(t.getMessage()));
      }
    });
  }

  @PluginMethod
  public void setFullscreen(final PluginCall call) {
    final boolean on = call.getBoolean("enabled", true);
    ui(call, () -> {
      boolean ok = callExtra("fullscreen", new Class<?>[] {android.app.Activity.class, boolean.class}, new Object[] {getActivity(), on});
      JSObject r = new JSObject();
      r.put("ok", ok);
      call.resolve(r);
    });
  }

  @PluginMethod
  public void answerPermission(final PluginCall call) {
    final int rid = call.getInt("rid", 0);
    final boolean allow = call.getBoolean("allow", false);
    ui(call, () -> {
      PermissionRequest r = pendingPerm.remove(rid);
      if (r != null) {
        if (allow) r.grant(r.getResources());
        else r.deny();
      }
      call.resolve();
    });
  }

  @PluginMethod
  public void setDesktop(final PluginCall call) {
    final String id = call.getString("id");
    final boolean d = call.getBoolean("desktop", true);
    ui(call, () -> {
      WebView w = id == null ? null : views.get(id);
      if (w != null) {
        deskOverride.put(id, d);
        applyMode(w, id);
        w.reload();
      }
      call.resolve();
    });
  }

  @PluginMethod
  public void fill(final PluginCall call) {
    final String id = call.getString("id");
    final String u = call.getString("user", "");
    final String p = call.getString("pass", "");
    ui(call, () -> {
      WebView w = id == null ? null : views.get(id);
      if (w != null) {
        String js = "(function(u,p){function setv(el,v){var d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');d.set.call(el,v);"
          + "el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}"
          + "var pw=document.querySelector('input[type=password]');"
          + "var inputs=[].slice.call(document.querySelectorAll('input[type=text],input[type=email],input[type=tel],input:not([type])')).filter(function(e){return e.offsetParent!==null;});"
          + "var user=null;if(pw){for(var i=0;i<inputs.length;i++){if(inputs[i].compareDocumentPosition(pw)&4)user=inputs[i];}}else if(inputs.length){user=inputs[0];}"
          + "if(user&&u)setv(user,u);if(pw&&p)setv(pw,p);})(" + JSONObject.quote(u) + "," + JSONObject.quote(p) + ");";
        w.evaluateJavascript(js, null);
      }
      call.resolve();
    });
  }

  @PluginMethod
  public void setBounds(final PluginCall call) {
    final String id = call.getString("id");
    ui(call, () -> {
      WebView w = id == null ? null : views.get(id);
      if (w != null) applyBounds(w, call);
      call.resolve();
    });
  }

  @PluginMethod
  public void load(final PluginCall call) {
    final String id = call.getString("id");
    final String url = call.getString("url");
    ui(call, () -> {
      WebView w = id == null ? null : views.get(id);
      if (w != null && url != null) load(w, url);
      call.resolve();
    });
  }

  @PluginMethod
  public void back(final PluginCall call) {
    final String id = call.getString("id");
    ui(call, () -> {
      WebView w = id == null ? null : views.get(id);
      if (w != null && w.canGoBack()) w.goBack();
      call.resolve();
    });
  }

  @PluginMethod
  public void forward(final PluginCall call) {
    final String id = call.getString("id");
    ui(call, () -> {
      WebView w = id == null ? null : views.get(id);
      if (w != null && w.canGoForward()) w.goForward();
      call.resolve();
    });
  }

  @PluginMethod
  public void reload(final PluginCall call) {
    final String id = call.getString("id");
    ui(call, () -> {
      WebView w = id == null ? null : views.get(id);
      if (w != null) {
        w.setNetworkAvailable(true);
        w.reload();
      }
      call.resolve();
    });
  }

  @PluginMethod
  public void close(final PluginCall call) {
    final String id = call.getString("id");
    ui(call, () -> {
      WebView w = id == null ? null : views.remove(id);
      if (w != null) {
        content().removeView(w);
        w.stopLoading();
        w.destroy();
      }
      if (id != null) {
        blocked.remove(id);
        deskOverride.remove(id);
      }
      call.resolve();
    });
  }

  @PluginMethod
  public void clearData(final PluginCall call) {
    ui(call, () -> {
      CookieManager.getInstance().removeAllCookies(null);
      CookieManager.getInstance().flush();
      WebStorage.getInstance().deleteAllData();
      for (WebView w : views.values()) {
        w.clearCache(true);
        w.clearHistory();
      }
      call.resolve();
    });
  }

  @Override
  protected void handleOnDestroy() {
    for (WebView w : views.values()) w.destroy();
    views.clear();
  }
}
