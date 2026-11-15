import { useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
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

// Android WebView must use hash-based routing: BrowserRouter changes the WebView
// pathname and can leave Capacitor deep links / restored sessions on an empty route.
const AppRouter = Capacitor.isNativePlatform() ? HashRouter : BrowserRouter;

function ClientRoutes() {
  return (
    <AppRouter>
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
    </AppRouter>
  );
}

export default function App() {
  const { user, isLoading } = useAuth();
  useEffect(() => {
    if (!isLoading && !user) loginWithRedirect();
  }, [isLoading, user]);

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><div className="animate-pulse"><Logo /></div></div>;
  }
  if (!user) return <AuthScreen />;

  return (
    <TradingProvider>
      <PortalProvider>
        <AppLock>
          <ClientRoutes />
        </AppLock>
        <Toaster />
      </PortalProvider>
    </TradingProvider>
  );
}
