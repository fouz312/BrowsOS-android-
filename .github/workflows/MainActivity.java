package com.browos.app;

import android.content.Context;
import android.content.res.Configuration;
import android.os.Bundle;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import java.util.Locale;

public class MainActivity extends BridgeActivity {

  // Always ask websites for English pages.
  @Override
  protected void attachBaseContext(Context base) {
    Locale.setDefault(Locale.US);
    Configuration c = new Configuration(base.getResources().getConfiguration());
    c.setLocale(Locale.US);
    super.attachBaseContext(base.createConfigurationContext(c));
  }

  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(NativeBrowserPlugin.class);
    super.onCreate(savedInstanceState);
    // If the main screen's rendering process dies (usually out of memory), restart the screen instead of crashing.
    try {
      getBridge().getWebView().setWebViewClient(new BridgeWebViewClient(getBridge()) {
        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
          runOnUiThread(() -> recreate());
          return true;
        }
      });
    } catch (Throwable ignored) {
    }
  }
}
