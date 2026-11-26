import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

type UpdateInfo = {
  version: string;
  versionCode: number;
  apkUrl: string;
  mandatory?: boolean;
  message?: string;
};

const MANIFEST_URL = 'https://raw.githubusercontent.com/sardarjfd5403-bot/Bigbulls-Ai-application-apk-Building-setup-reposity/main/app-update.json';
const FALLBACK_VERSION = '3.5.9';

function compareVersions(a: string, b: string) {
  const aa = a.split('.').map(Number);
  const bb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(aa.length, bb.length); i++) {
    const diff = (aa[i] || 0) - (bb[i] || 0);
    if (diff) return diff;
  }
  return 0;
}

export default function AppUpdateNotice() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [currentVersion, setCurrentVersion] = useState(FALLBACK_VERSION);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let active = true;
    const check = async () => {
      setChecking(true);
      try {
        let installedVersion = FALLBACK_VERSION;
        if (Capacitor.isNativePlatform()) {
          try {
            const info = await App.getInfo();
            installedVersion = info.version || FALLBACK_VERSION;
          } catch { /* Keep safe fallback for older native wrappers. */ }
        }
        const response = await fetch(MANIFEST_URL, { cache: 'no-store' });
        if (!response.ok) throw new Error('Update information unavailable');
        const latest: UpdateInfo = await response.json();
        if (!latest.version || !latest.apkUrl) return;
        if (!active) return;
        setCurrentVersion(installedVersion);
        if (compareVersions(latest.version, installedVersion) > 0) {
          setUpdate(latest);
        }
      } catch {
        // Update checking is best-effort; never block login or normal app use.
      } finally {
        if (active) setChecking(false);
      }
    };
    void check();
    const timer = window.setInterval(check, 6 * 60 * 60 * 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  if (!update) return null;
  const dismissed = localStorage.getItem('bigbulls-dismissed-update');
  const isMandatory = update.mandatory === true;
  if (!isMandatory && dismissed === update.version) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="bb-update-title">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-slate-900 shadow-2xl">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white">B</div>
          <div>
            <h2 id="bb-update-title" className="text-lg font-bold">BIGBULLS Update Available</h2>
            <p className="text-xs text-slate-500">Current version v{currentVersion}</p>
          </div>
        </div>
        <p className="mb-4 text-sm text-slate-600">{update.message || 'A newer version of BIGBULLS is ready. Update for the latest improvements.'}</p>
        <div className="mb-4 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">Latest version v{update.version}</div>
        <a href={update.apkUrl} target="_blank" rel="noopener noreferrer" className="block w-full rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white">Download latest APK</a>
        {!isMandatory && <button type="button" onClick={() => { localStorage.setItem('bigbulls-dismissed-update', update.version); setUpdate(null); }} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600">Later</button>}
        {isMandatory && <p className="mt-3 text-center text-xs text-amber-700">Please update to continue using the latest BIGBULLS app.</p>}
      </div>
    </div>
  );
}
