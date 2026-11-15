import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
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

export default function App() {
  const { user, isLoading } = useAuth();
  useEffect(() => { if (!isLoading && !user) loginWithRedirect(); }, [isLoading, user]);

  if (isLoading || !user) {
    return <div className="flex h-screen items-center justify-center"><div className="animate-pulse"><Logo /></div></div>;
  }

  return (
    <TradingProvider>
      <PortalProvider>
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
        <Toaster />
      </PortalProvider>
    </TradingProvider>
  );
}
