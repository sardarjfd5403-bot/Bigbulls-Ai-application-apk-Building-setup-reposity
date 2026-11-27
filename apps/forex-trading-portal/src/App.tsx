import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import OneSignal from '@onesignal/capacitor-plugin';
import { Camera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { initializeBigbullsPush, syncBigbullsPushDevice } from './lib/oneSignal';
import { useAuth, loginWithRedirect } from './lib/previewAuth';
import { BigbullsUpdater } from './lib/bigbullsUpdater';
import { Toaster } from '@project/components/ui/sonner';
import { TradingProvider } from './lib/store';
import { PortalProvider } from './lib/portal';
import Layout from './components/Layout';
import Logo from './components/Logo';
import Accounts from './pages/Accounts';
import HtmlPortal from './pages/HtmlPortal';
import Funds from './pages/Funds';
import Transfer from './pages/Transfer';
import HistoryPage from './pages/HistoryPage';
import Terminal from './pages/Terminal';
import WalletPage from './pages/WalletPage';
import Verification from './pages/Verification';
import ProfilePage from './pages/ProfilePage';
import Partner from './pages/Partner';
import Analytics from './pages/Analytics';
import Support from './pages/Support';
import TradeHistory from './pages/TradeHistory';
import AuthScreen from './pages/AuthScreen';
import AppLock from './components/AppLock';

const UPDATE_MANIFEST = 'https://raw.githubusercontent.com/sardarjfd5403-bot/Bigbulls-Ai-application-apk-Building-setup-reposity/main/app-update.json';

type UpdateInfo = { version: string; build: number; apkUrl: string; mandatory?: boolean };
function versionParts(v: string) { return v.replace(/^v/i, '').split('.').map(n => Number.parseInt(n, 10) || 0); }
function isNewer(remote: string, local: string) {
  const a = versionParts(remote), b = versionParts(local);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return false;
}

function InAppUpdateNotice() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const response = await fetch(UPDATE_MANIFEST, { cache: 'no-store' });
        if (!response.ok) return;
        const remote: UpdateInfo = await response.json();
        if (!remote.version || !remote.apkUrl || !Number.isFinite(Number(remote.build))) return;
        let localVersion = '0.0.0';
        let localBuild = 0;
        if (Capacitor.isNativePlatform()) {
          const info = await BigbullsUpdater.getAppInfo();
          localVersion = info.version || localVersion;
          localBuild = Number(info.build) || 0;
        } else {
          const info = await NativeApp.getInfo().catch(() => null);
          localVersion = info?.version || '3.6.0';
        }
        const newer = Number(remote.build) > localBuild || (Number(remote.build) === localBuild && isNewer(remote.version, localVersion));
        if (alive && newer) setUpdate(remote);
      } catch (error) {
        console.warn('BIGBULLS update check unavailable:', error);
      }
    };
    void check();
    const interval = window.setInterval(() => void check(), 6 * 60 * 60 * 1000);
    return () => { alive = false; window.clearInterval(interval); };
  }, []);
  if (!update || dismissed) return null;

  const startUpdate = async () => {
    if (!Capacitor.isNativePlatform()) {
      window.open(update.apkUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    setBusy(true);
    setMessage('Preparing secure download…');
    try {
      const result = await BigbullsUpdater.installApk({ url: update.apkUrl });
      if (result.permissionRequired) {
        setMessage('Android ki “Install unknown apps” permission allow karein, phir Update Now dobara dabayein.');
      } else {
        setMessage(result.downloadStarted ? 'Download started. Progress notification mein dekhein; download complete hote hi installer khul jayega.' : 'Android installer mein update confirm karein.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Update download failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="bb-update-title">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-slate-900 shadow-2xl">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-xl font-black text-white">B</div>
        <h2 id="bb-update-title" className="text-lg font-bold">New BIGBULLS update available</h2>
        <p className="mt-1 text-sm text-slate-600">Version v{update.version} · Build {update.build}</p>
        <p className="mt-3 text-sm text-slate-600">A newer version of BIGBULLS is available. Update now to get the latest version.</p>
        <button type="button" onPointerUp={(event) => { event.preventDefault(); if (!busy) void startUpdate(); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!busy) void startUpdate(); } }} disabled={busy} style={{ touchAction: 'manipulation', pointerEvents: 'auto', position: 'relative', zIndex: 2 }} className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Please wait…' : 'Update Now'}</button>
        {message && <p className="mt-3 text-center text-xs text-slate-600">{message}</p>}
        {!update.mandatory && <button type="button" onPointerUp={(event) => { event.preventDefault(); if (!busy) setDismissed(true); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!busy) setDismissed(true); } }} disabled={busy} style={{ touchAction: 'manipulation', pointerEvents: 'auto', position: 'relative', zIndex: 2 }} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">Later</button>}
      </div>
    </div>
  );
}

export default function App() {
  const { user, isLoading } = useAuth();

  // Initialize OneSignal immediately on every native app launch. Do not
  // wait for camera/location onboarding or notification permission: even an
  // opted-out device should be associated with its signed-in BIGBULLS user.
  useEffect(() => {
    if (isLoading || !Capacitor.isNativePlatform()) return;
    let active = true;
    void (async () => {
      try {
        await initializeBigbullsPush();
        if (!active) return;
        if (user?.id) {
          await OneSignal.login(user.id);
          const registered = await syncBigbullsPushDevice(user.id);
          console.info('BIGBULLS Supabase push-device sync', { registered, userId: user.id });
        } else await OneSignal.logout();

        const [subscriptionId, token, optedIn] = await Promise.all([
          OneSignal.User.pushSubscription.getIdAsync(),
          OneSignal.User.pushSubscription.getTokenAsync(),
          OneSignal.User.pushSubscription.getOptedInAsync(),
        ]);
        console.info('BIGBULLS OneSignal registration state', {
          linkedUser: Boolean(user?.id),
          subscriptionReady: Boolean(subscriptionId),
          tokenReady: Boolean(token),
          optedIn,
        });
      } catch (error) {
        console.error('BIGBULLS OneSignal setup failed:', error);
      }
    })();
    return () => { active = false; };
  }, [user?.id, isLoading]);

  // Retry device persistence after notification permission flow. This also
  // covers SDK subscriptions that become available after the first login sync.
  useEffect(() => {
    if (isLoading || !user?.id || !Capacitor.isNativePlatform()) return;
    let disposed = false;
    let appStateListener: { remove: () => Promise<void> } | undefined;
    void NativeApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive && !disposed) {
        void syncBigbullsPushDevice(user.id).catch(error =>
          console.error('BIGBULLS push-device resume sync failed:', error),
        );
      }
    }).then(listener => {
      if (disposed) void listener.remove();
      else appStateListener = listener;
    }).catch(error => console.warn('BIGBULLS app-state listener unavailable:', error));
    return () => {
      disposed = true;
      void appStateListener?.remove();
    };
  }, [user?.id, isLoading]);

  // Ask for Android permissions independently; notification registration
  // above must not depend on the user accepting optional permission prompts.
  useEffect(() => {
    if (isLoading || !Capacitor.isNativePlatform()) return;
    const requestOnce = async (key: string, explanation: string, request: () => Promise<unknown>) => {
      if (localStorage.getItem(key) === 'done') return;
      try {
        if (window.confirm(explanation)) await request();
      } catch (error) {
        console.error('BIGBULLS permission request failed:', key, error);
      } finally {
        localStorage.setItem(key, 'done');
      }
    };
    void (async () => {
      await requestOnce(
        'bb-permission-notifications-v1',
        'Allow BIGBULLS notifications to receive important account, deposit, withdrawal and trading alerts?',
        async () => {
          const granted = await OneSignal.Notifications.hasPermission();
          if (!granted) await OneSignal.Notifications.requestPermission(true);
        },
      );
      if (user?.id) {
        try {
          const registered = await syncBigbullsPushDevice(user.id);
          console.info('BIGBULLS post-permission device sync', { registered });
        } catch (error) {
          console.error('BIGBULLS push-device save failed:', error);
        }
      }
      await requestOnce(
        'bb-permission-camera-v1',
        'Allow BIGBULLS to use your camera when you capture KYC verification documents?',
        async () => {
          const status = await Camera.checkPermissions();
          if (status.camera !== 'granted') await Camera.requestPermissions({ permissions: ['camera'] });
        },
      );
      await requestOnce(
        'bb-permission-location-v1',
        'Allow BIGBULLS to access your location for account security and location-based features? Location is not collected by this prompt alone.',
        async () => {
          const status = await Geolocation.checkPermissions();
          if (status.location !== 'granted') await Geolocation.requestPermissions();
        },
      );
    })();
  }, [isLoading, user?.id]);

  useEffect(() => { if (!isLoading && !user) loginWithRedirect(); }, [isLoading, user]);

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><div className="animate-pulse"><Logo /></div></div>;
  }
  if (!user) return <><AuthScreen /><InAppUpdateNotice /></>;

  return (
    <TradingProvider>
      <PortalProvider>
        <AppLock>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HtmlPortal />} />
            <Route path="/terminal" element={<Terminal />} />
            <Route element={<Layout />}>
              <Route path="/legacy/accounts" element={<Accounts />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/deposit" element={<Funds key="d" mode="Deposit" />} />
              <Route path="/withdraw" element={<Funds key="w" mode="Withdrawal" />} />
              <Route path="/transfer" element={<Transfer />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/trades" element={<TradeHistory />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/partner" element={<Partner />} />
              <Route path="/verification" element={<Verification />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/support" element={<Support />} />
              <Route path="*" element={<Accounts />} />
            </Route>
          </Routes>
        </BrowserRouter>
        </AppLock>
        <Toaster />
      </PortalProvider>
      <InAppUpdateNotice />
    </TradingProvider>
  );
}
