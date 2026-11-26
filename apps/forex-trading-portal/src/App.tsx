import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { useAuth, loginWithRedirect } from './lib/previewAuth';
import { Toaster } from '@project/components/ui/sonner';
import { TradingProvider } from './lib/store';
import { PortalProvider } from './lib/portal';
import Layout from './components/Layout';
import Logo from './components/Logo';
import Accounts from './pages/Accounts';
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

function versionParts(v: string) { return v.replace(/^v/i, '').split('.').map(n => Number.parseInt(n, 10) || 0); }
function isNewer(remote: string, local: string) {
  const a = versionParts(remote), b = versionParts(local);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return false;
}

function InAppUpdateNotice() {
  const [update, setUpdate] = useState<{version:string; notes?:string; url:string; mandatory?:boolean} | null>(null);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const response = await fetch(UPDATE_MANIFEST, { cache: 'no-store' });
        if (!response.ok) return;
        const remote = await response.json();
        let localVersion = '0.0.0';
        if (Capacitor.isNativePlatform()) {
          const info = await NativeApp.getInfo();
          localVersion = info.version || localVersion;
        } else {
          localVersion = '3.6.0';
        }
        if (alive && remote.version && remote.apkUrl && isNewer(remote.version, localVersion)) {
          setUpdate({ version: remote.version, notes: remote.notes, url: remote.apkUrl, mandatory: !!remote.mandatory });
        }
      } catch (error) {
        console.warn('BIGBULLS update check unavailable:', error);
      }
    };
    void check();
    const interval = window.setInterval(() => void check(), 6 * 60 * 60 * 1000);
    return () => { alive = false; window.clearInterval(interval); };
  }, []);
  if (!update || dismissed) return null;
  const startUpdate = () => {
    if (Capacitor.isNativePlatform()) {
      window.open(update.url, '_system');
    } else {
      window.open(update.url, '_blank', 'noopener,noreferrer');
    }
  };
  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="bb-update-title">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-slate-900 shadow-2xl">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-xl font-black text-white">B</div>
        <h2 id="bb-update-title" className="text-lg font-bold">New BIGBULLS update available</h2>
        <p className="mt-1 text-sm text-slate-600">Version v{update.version} is ready.</p>
        {update.notes && <p className="mt-3 text-sm text-slate-600">{update.notes}</p>}
        <button onClick={startUpdate} className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white">Update Now</button>
        {!update.mandatory && <button onClick={() => setDismissed(true)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">Later</button>}
        <p className="mt-3 text-center text-xs text-slate-500">Your BIGBULLS account and trading data remain on the existing secure service.</p>
      </div>
    </div>
  );
}

export default function App() {
  const { user, isLoading } = useAuth();
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
            <Route path="/terminal" element={<Terminal />} />
            <Route element={<Layout />}>
              <Route path="/" element={<Accounts />} />
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
