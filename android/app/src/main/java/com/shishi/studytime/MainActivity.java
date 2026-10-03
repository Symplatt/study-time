package com.shishi.studytime;

import android.app.Activity;
import android.os.Bundle;
import android.os.Build;
import android.content.ClipData;
import android.content.Intent;
import android.content.ClipboardManager;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.widget.FrameLayout;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.view.View;
import android.view.WindowInsets;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private WebView web;
    private static final int MAX_BACKUP = 10 * 1024 * 1024;
    public final class Store {
        private final SharedPreferences prefs = getSharedPreferences("study-records", MODE_PRIVATE);
        @JavascriptInterface public String read() { return prefs.getString("state", ""); }
        @JavascriptInterface public boolean write(String value) { return prefs.edit().putString("state", value).commit(); }
        @JavascriptInterface public void openReleases() {
            // Only this fixed release page opens externally; the local WebView stays offline.
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com/Symplatt/study-time/releases")));
                } catch (Exception e) { fileResult(false,"无法打开浏览器，请稍后重试"); }
            });
        }
        @JavascriptInterface public void exportData(String value) {
            runOnUiThread(() -> {
                if (value == null || value.getBytes(StandardCharsets.UTF_8).length > MAX_BACKUP) { fileResult(false,"备份不能超过 10 MB"); return; }
                try {
                    ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                    if (clipboard == null) throw new IllegalStateException("Clipboard unavailable");
                    clipboard.setPrimaryClip(ClipData.newPlainText("拾时学习记录 JSON", value));
                    fileResult(true,"数据已复制到剪切板");
                } catch (Exception e) { fileResult(false,"复制失败，请重试或减少备份数据量"); }
            });
        }
        @JavascriptInterface public void importData() {
            runOnUiThread(() -> {
                try {
                    ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                    if (clipboard == null) throw new IllegalStateException("Clipboard unavailable");
                    ClipData clip = clipboard.getPrimaryClip();
                    CharSequence value = clip == null || clip.getItemCount() == 0 ? null : clip.getItemAt(0).getText();
                    if (value == null || value.toString().trim().isEmpty()) { fileResult(false,"剪切板中没有文本，请先复制备份数据"); return; }
                    String text = value.toString();
                    if (text.getBytes(StandardCharsets.UTF_8).length > MAX_BACKUP) { fileResult(false,"备份不能超过 10 MB"); return; }
                    runScript("window.receiveStudyImport && window.receiveStudyImport("+JSONObject.quote(text)+")");
                } catch (Exception e) { fileResult(false,"无法读取剪切板，请重新复制备份数据后重试"); }
            });
        }
    }
    private void runScript(String script) {
        runOnUiThread(() -> { if (!isDestroyed() && web!=null) web.evaluateJavascript(script,null); });
    }
    private void fileResult(boolean success,String message) {
        runScript("window.studyFileResult && window.studyFileResult("+success+","+JSONObject.quote(message)+")");
    }
    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(247,248,242));
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setTextZoom(100);
        web.addJavascriptInterface(new Store(), "AndroidStore");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return true; }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]));
            }
        });
        // Size the WebView inside the system bars. WebView's own padding does not
        // reliably move its HTML viewport or fixed-position navigation.
        if(Build.VERSION.SDK_INT>=30)getWindow().setDecorFitsSystemWindows(false);
        else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        FrameLayout root=new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(247,248,242));
        root.addView(web,new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT,FrameLayout.LayoutParams.MATCH_PARENT));
        root.setOnApplyWindowInsetsListener((view,insets)->{
            if(Build.VERSION.SDK_INT>=30){
                int types=WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout();
                Insets safe=insets.getInsets(types);
                view.setPadding(safe.left,safe.top,safe.right,safe.bottom);
                return new WindowInsets.Builder(insets).setInsets(types,Insets.NONE).setInsetsIgnoringVisibility(types,Insets.NONE).setDisplayCutout(null).build();
            }
            int left=insets.getSystemWindowInsetLeft(),top=insets.getSystemWindowInsetTop(),right=insets.getSystemWindowInsetRight(),bottom=insets.getSystemWindowInsetBottom();
            if(Build.VERSION.SDK_INT>=28 && insets.getDisplayCutout()!=null){
                android.view.DisplayCutout cutout=insets.getDisplayCutout();
                left=Math.max(left,cutout.getSafeInsetLeft());top=Math.max(top,cutout.getSafeInsetTop());right=Math.max(right,cutout.getSafeInsetRight());bottom=Math.max(bottom,cutout.getSafeInsetBottom());
            }
            view.setPadding(left,top,right,bottom);
            WindowInsets remaining=insets.consumeSystemWindowInsets();
            return Build.VERSION.SDK_INT>=28?remaining.consumeDisplayCutout():remaining;
        });
        setContentView(root);
        root.requestApplyInsets();
        try (java.io.InputStream input = getAssets().open("index.html")) {
            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            byte[] buffer = new byte[8192]; int n;
            while ((n=input.read(buffer))!=-1) out.write(buffer,0,n);
            web.loadDataWithBaseURL("https://study.local/",out.toString("UTF-8"),"text/html","UTF-8",null);
        } catch (Exception e) { android.widget.TextView error=new android.widget.TextView(this);error.setText("界面加载失败，请重新打开拾时。");setContentView(error); }
    }
    @Override public void onBackPressed() {
        web.evaluateJavascript("(function(){var d=document.querySelector('dialog[open]');if(d){d.close();return true;}if(!document.getElementById('stats-view').hidden){document.getElementById('nav-home').click();return true;}return false;})()",value->{if(!"true".equals(value))moveTaskToBack(true);});
    }
    @Override protected void onDestroy() { if(web!=null){web.removeJavascriptInterface("AndroidStore");web.destroy();}super.onDestroy(); }
}
