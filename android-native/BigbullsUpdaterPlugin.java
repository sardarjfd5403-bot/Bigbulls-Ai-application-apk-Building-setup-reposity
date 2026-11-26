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
    if (url == null || !URLUtil.isHttpsUrl(url)) {
      call.reject("A secure HTTPS APK URL is required"); return;
    }
    if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
      Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
        Uri.parse("package:" + getContext().getPackageName()));
      getActivity().startActivity(settings);
      JSObject result = new JSObject(); result.put("permissionRequired", true);
      call.resolve(result); return;
    }
    try {
      DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
      if (manager == null) { call.reject("Android download service is unavailable"); return; }

      DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
      request.setTitle("BIGBULLS update");
      request.setDescription("Downloading the latest BIGBULLS app");
      request.setMimeType("application/vnd.android.package-archive");
      request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
      request.setAllowedOverMetered(true);
      request.setAllowedOverRoaming(false);
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
          boolean successful = false;
          try {
            successful = cursor != null && cursor.moveToFirst() &&
              cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)) == DownloadManager.STATUS_SUCCESSFUL;
          } catch (Exception ignored) {
            successful = false;
          } finally {
            if (cursor != null) cursor.close();
          }

          if (successful) {
            Uri apkUri = manager.getUriForDownloadedFile(downloadId);
            if (apkUri != null) {
              // Android blocks launching the package installer from a background
              // BroadcastReceiver on many OS versions. Post a user-tappable
              // notification whose PendingIntent opens the system installer.
              try {
                android.app.NotificationManager notifications =
                  (android.app.NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                String channelId = "bigbulls_app_updates";
                if (Build.VERSION.SDK_INT >= 26) {
                  android.app.NotificationChannel channel = new android.app.NotificationChannel(
                    channelId, "BIGBULLS app updates", android.app.NotificationManager.IMPORTANCE_HIGH);
                  channel.setDescription("Install downloaded BIGBULLS app updates");
                  notifications.createNotificationChannel(channel);
                }

                Intent install = new Intent(Intent.ACTION_VIEW);
                install.setDataAndType(apkUri, "application/vnd.android.package-archive");
                install.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);

                int pendingFlags = android.app.PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= 23) pendingFlags |= android.app.PendingIntent.FLAG_IMMUTABLE;
                android.app.PendingIntent pendingInstall = android.app.PendingIntent.getActivity(
                  context, (int) (downloadId & 0x7fffffff), install, pendingFlags);

                android.app.Notification.Builder builder = Build.VERSION.SDK_INT >= 26
                  ? new android.app.Notification.Builder(context, channelId)
                  : new android.app.Notification.Builder(context);
                builder.setSmallIcon(context.getApplicationInfo().icon)
                  .setContentTitle("BIGBULLS update ready")
                  .setContentText("Tap here to install the latest version")
                  .setAutoCancel(true)
                  .setContentIntent(pendingInstall);

                if (Build.VERSION.SDK_INT < 33 ||
                    context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) ==
                      android.content.pm.PackageManager.PERMISSION_GRANTED) {
                  notifications.notify((int) (downloadId & 0x7fffffff), builder.build());
                }
              } catch (Exception ignored) {
                // DownloadManager's completed-download notification remains available
                // as a fallback if notification permission/channel setup is unavailable.
              }
            }
          }
          try { context.unregisterReceiver(this); } catch (Exception ignored) {}
          if (receiver == this) receiver = null;
        }
      };

      IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
      if (Build.VERSION.SDK_INT >= 33) getContext().registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED);
      else getContext().registerReceiver(receiver, filter);

      // Resolve as soon as Android accepts the download; don't leave the UI spinner
      // waiting for the full APK transfer. DownloadManager shows its own progress notification.
      JSObject result = new JSObject();
      result.put("permissionRequired", false);
      result.put("downloadStarted", true);
      result.put("downloadId", downloadId);
      call.resolve(result);
    } catch (Exception e) {
      call.reject("Unable to start BIGBULLS update download", e);
    }
  }
}
