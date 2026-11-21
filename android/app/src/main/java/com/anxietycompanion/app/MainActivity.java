package com.anxietycompanion.app;

import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NeuralVoicePlugin.class);
        super.onCreate(savedInstanceState);
        keepWebViewAboveKeyboard();
    }

    /**
     * Capacitor's edge-to-edge margins (adjustMarginsForEdgeToEdge 'force' in capacitor.config.ts) keep
     * the web view clear of the system bars, but not of the keyboard. From Android 15 the window is no
     * longer made shorter for the keyboard, so the keyboard would cover the bottom of the web view, and
     * the field being typed in with it. This takes the place of Capacitor's listener (installed while
     * the bridge was created in super.onCreate): the same margins, with the bottom one lifted above the
     * keyboard while it is up, so the web view gets shorter as it does on older Android versions.
     * Where the window itself is still resized (Android 14 and older), the web view is not given the
     * keyboard's inset and nothing changes.
     */
    private void keepWebViewAboveKeyboard() {
        if (getBridge() == null) return;
        View webView = getBridge().getWebView();
        if (webView == null) return;
        ViewCompat.setOnApplyWindowInsetsListener(webView, (v, windowInsets) -> {
            Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets keyboard = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
            ViewGroup.MarginLayoutParams mlp = (ViewGroup.MarginLayoutParams) v.getLayoutParams();
            mlp.leftMargin = bars.left;
            mlp.topMargin = bars.top;
            mlp.rightMargin = bars.right;
            mlp.bottomMargin = Math.max(bars.bottom, keyboard.bottom);
            v.setLayoutParams(mlp);
            // Don't pass window insets to children (as Capacitor's own listener).
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(webView);
    }
}
