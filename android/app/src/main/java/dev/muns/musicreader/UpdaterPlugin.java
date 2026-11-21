package dev.muns.musicreader;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Self-update for sideloaded builds: fetch the release manifest, download the APK,
 * check its SHA-256 and hand it to the Android package installer.
 * Requests go through native code so GitHub's download redirects work without CORS.
 */
@CapacitorPlugin(name = "Updater")
public class UpdaterPlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private HttpURLConnection open(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setInstanceFollowRedirects(true);
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        c.setRequestProperty("User-Agent", "MusicReader-Updater");
        int code = c.getResponseCode();
        // Follow redirects manually in case they cross hosts.
        int hops = 0;
        while ((code == 301 || code == 302 || code == 303 || code == 307 || code == 308) && hops++ < 5) {
            String next = c.getHeaderField("Location");
            c.disconnect();
            c = (HttpURLConnection) new URL(new URL(url), next).openConnection();
            c.setConnectTimeout(15000);
            c.setReadTimeout(30000);
            c.setRequestProperty("User-Agent", "MusicReader-Updater");
            code = c.getResponseCode();
        }
        if (code != 200) throw new Exception("HTTP " + code);
        return c;
    }

    @PluginMethod
    public void fetchText(PluginCall call) {
        String url = call.getString("url");
        if (url == null) {
            call.reject("Missing url");
            return;
        }
        executor.execute(() -> {
            try {
                HttpURLConnection c = open(url);
                try (InputStream in = c.getInputStream()) {
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                    JSObject ret = new JSObject();
                    ret.put("text", out.toString("UTF-8"));
                    call.resolve(ret);
                } finally {
                    c.disconnect();
                }
            } catch (Exception e) {
                call.reject("network", e);
            }
        });
    }

    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url");
        String sha256 = call.getString("sha256", "");
        if (url == null) {
            call.reject("Missing url");
            return;
        }
        executor.execute(() -> {
            try {
                File dir = new File(getContext().getCacheDir(), "updates");
                if (!dir.exists() && !dir.mkdirs()) throw new Exception("Cannot create cache dir");
                File apk = new File(dir, "music-reader-update.apk");
                HttpURLConnection c = open(url);
                long total = c.getContentLengthLong();
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                long done = 0;
                long lastEmit = 0;
                try (InputStream in = c.getInputStream(); FileOutputStream out = new FileOutputStream(apk)) {
                    byte[] buf = new byte[65536];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n);
                        digest.update(buf, 0, n);
                        done += n;
                        long now = System.currentTimeMillis();
                        if (total > 0 && now - lastEmit > 150) {
                            lastEmit = now;
                            JSObject p = new JSObject();
                            p.put("fraction", (double) done / total);
                            notifyListeners("progress", p);
                        }
                    }
                } finally {
                    c.disconnect();
                }
                StringBuilder hex = new StringBuilder();
                for (byte b : digest.digest()) hex.append(String.format("%02x", b));
                if (!sha256.isEmpty() && !sha256.equalsIgnoreCase(hex.toString())) {
                    apk.delete();
                    call.reject("checksum");
                    return;
                }
                JSObject ret = new JSObject();
                ret.put("path", apk.getAbsolutePath());
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("network", e);
            }
        });
    }

    @PluginMethod
    public void canInstall(PluginCall call) {
        boolean allowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.O
            || getContext().getPackageManager().canRequestPackageInstalls();
        JSObject ret = new JSObject();
        ret.put("allowed", allowed);
        call.resolve(ret);
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        }
        call.resolve();
    }

    @PluginMethod
    public void install(PluginCall call) {
        String path = call.getString("path");
        if (path == null) {
            call.reject("Missing path");
            return;
        }
        File apk = new File(path);
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(uri, "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }
}
