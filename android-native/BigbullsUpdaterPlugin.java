package com.bigbulls.globalmarket;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.webkit.URLUtil;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BigbullsUpdater")
public class BigbullsUpdaterPlugin extends Plugin {
  private BroadcastReceiver receiver;

  @PluginMethod
  public void getAppInfo(PluginCall call) {
    try {
      PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
      JSObject result = new JSObject();
      result.put("version", info.versionName == null ? "0.0.0" : info.versionName);
      if (Build.VERSION.SDK_INT >= 28) result.put("build", info.getLongVersionCode());
      else result.put("build", info.versionCode);
      call.resolve(result);
    } catch (Exception e) { call.reject("Unable to read installed app version", e); }
  }

  @PluginMethod
  public void installApk(PluginCall call) {
    String url = call.getString("url");
    if (url == null || !url.startsWith("https://") || !URLUtil.isHttpsUrl(url)) {
      call.reject("A secure HTTPS APK URL is required"); return;
    }
    if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
      Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
        Uri.parse("package:" + getContext().getPackageName()));
      getActivity().startActivity(settings);
      JSObject result = new JSObject(); result.put("permissionRequired", true); call.resolve(result); return;
    }
    try {
      DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
      DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
      request.setTitle("BIGBULLS update");
      request.setDescription("Downloading the latest BIGBULLS app");
      request.setMimeType("application/vnd.android.package-archive");
      request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
      request.setDestinationInExternalFilesDir(getContext(), Environment.DIRECTORY_DOWNLOADS, "BIGBULLS-update.apk");
      long downloadId = manager.enqueue(request);
      if (receiver != null) {
        try { getContext().unregisterReceiver(receiver); } catch (Exception ignored) {}
      }
      receiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
          if (!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) return;
          long completedId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
          if (completedId != downloadId) return;
          DownloadManager.Query query = new DownloadManager.Query().setFilterById(downloadId);
          android.database.Cursor cursor = manager.query(query);
          try {
            if (cursor == null || !cursor.moveToFirst() ||
                cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)) != DownloadManager.STATUS_SUCCESSFUL) {
              call.reject("APK download failed. Please try again."); return;
            }
          } finally { if (cursor != null) cursor.close(); }
          Uri apkUri = manager.getUriForDownloadedFile(downloadId);
          if (apkUri == null) { call.reject("Downloaded APK could not be opened"); return; }
          Intent install = new Intent(Intent.ACTION_VIEW);
          install.setDataAndType(apkUri, "application/vnd.android.package-archive");
          install.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
          try {
            getContext().startActivity(install);
            JSObject done = new JSObject(); done.put("permissionRequired", false); call.resolve(done);
          } catch (Exception e) { call.reject("Android could not open the package installer", e); }
          try { getContext().unregisterReceiver(this); } catch (Exception ignored) {}
        }
      };
      IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
      if (Build.VERSION.SDK_INT >= 33) getContext().registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
      else getContext().registerReceiver(receiver, filter);
      call.setKeepAlive(true);
    } catch (Exception e) { call.reject("Unable to start BIGBULLS update download", e); }
  }
}
