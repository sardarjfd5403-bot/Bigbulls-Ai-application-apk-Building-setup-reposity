# BIGBULLS Global Market — Full Frontend Code + Handoff for ChatGPT

## Prompt to paste into ChatGPT
You are given the complete frontend of a forex brokerage client portal named "BIGBULLS Global Market" (Exness-style UX, blue & white theme). Rebuild it EXACTLY with the same design, layout, tabs and flows, and wire it to our real systems:

1. Stack: React 18 + TypeScript + Vite + Tailwind CSS v3 + shadcn/ui components + react-router-dom + recharts + lucide-react + date-fns + sonner + react-hook-form + zod.
   - `@project/components/ui/*` imports = standard shadcn/ui components (install them with the shadcn CLI). `@project/components/lib/utils` = shadcn `cn` helper.
   - `zitejs/auth` (useAuth, loginWithRedirect, logout) = replace with OUR auth (client login/registration with email OTP or password).
   - `zitejs/upload` (useUpload) = replace with our file upload API (S3 or back-office endpoint) for KYC documents.
2. Replace the DEMO layers with real ones:
   - `src/lib/feed.ts` → `subscribePrices()` must connect to our REAL-TIME price feed (WebSocket) and emit bid/ask per symbol. `candleHistory()` must load real OHLC history from our API.
   - `src/lib/store.tsx` → all actions (openPosition, closePosition, closeAll, placePending, cancelPending, modifyPosition, transact (deposit/withdraw), transfer, walletMove, openAccount, setLeverage, archive) must call our BACK-OFFICE REST API. Positions, balances, equity, margin, pending orders and history must come from the server (live updates via WebSocket), not localStorage. SL/TP/pending triggering and stop-out must happen on the SERVER, not in the browser.
   - `src/lib/portal.tsx` → profile, KYC status/documents, wallet, IB/partner (referral code, clients, commissions, payouts) and support tickets must come from the back-office API. Remove the demo auto-approve of KYC and the fake IB clients.
3. Keep the same 4 main tabs: Accounts (My accounts, Deposit, Withdrawal, Transfer, Transaction history, Trade history), Trade (BigBulls Terminal), Performance, Profile (Wallet, KYC verification, Settings & security, IB/Partner, Support).
4. Keep KYC rules: unverified clients may deposit up to $2,000 total; withdrawals only when fully verified (enforce on server too).
5. Ask me for our API base URL, WebSocket URL, endpoint list and auth method before writing the integration code.

## Full source code

### `OVERVIEW.md`

```md
# BIGBULLS Global Market — Trading Portal

Client-facing forex brokerage portal for BIGBULLS Global Market, styled after Exness with a blue and white theme.

Clients sign in, manage Real/Demo trading accounts, deposit, withdraw and transfer funds, and trade forex, metals, crypto, energies, indices and stocks in a web trading terminal with live quotes, charts, market and pending orders, SL/TP, and position history.

The owner runs their own back-office and real-time price feed. The app currently uses a demo price feed and a demo trading engine, and both are set up to be replaced by those systems.

```

### `tailwind.config.ts`

```ts
import { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const tailwindConfig: Config = {
  darkMode: ['class'],
  content: [
    'src/**/*.{ts,tsx,css}',
    '../../packages/ui/**/*.{ts,tsx}',
    '../../packages/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
        serif: ['var(--font-serif)', ...defaultTheme.fontFamily.serif],
        mono: ['var(--font-mono)', ...defaultTheme.fontFamily.mono],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          // Alias so `bg-sidebar-background` resolves like `bg-sidebar` — see
          // ZITE_TAILWIND_THEME in packages/zite/src/apps.ts for the rationale.
          background: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
      },
      borderRadius: {
        '3xl': 'calc(var(--radius) + 16px)',
        '2xl': 'calc(var(--radius) + 8px)',
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        DEFAULT: 'calc(var(--radius) - 2px)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        '2xs': 'var(--shadow-2xs)',
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        '2xl': 'var(--shadow-2xl)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate'), require('@tailwindcss/typography')],
};

export default tailwindConfig;

```

### `src/index.css`

```css
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Auto-restored theme variables */
    --shadow-x: 0px;
    --shadow-y: 1px;
    --shadow-blur: 4px;
    --shadow-spread: 0px;
    --shadow-opacity: 0.2;
    --shadow-color: #000000;
    --shadow-2xs: var(--shadow-x) var(--shadow-y) color-mix(in srgb, var(--shadow-color) calc(var(--shadow-opacity) * 100%), transparent);
    --shadow-xs: var(--shadow-x) var(--shadow-y) var(--shadow-blur) var(--shadow-spread) color-mix(in srgb, var(--shadow-color) calc(var(--shadow-opacity) * 100%), transparent);
    --shadow-sm: var(--shadow-x) var(--shadow-y) calc(var(--shadow-blur) * 1.5) var(--shadow-spread) color-mix(in srgb, var(--shadow-color) calc(var(--shadow-opacity) * 100%), transparent);
    --shadow-md: calc(var(--shadow-x) * 2) calc(var(--shadow-y) * 2) calc(var(--shadow-blur) * 3) calc(var(--shadow-spread) - 1px) color-mix(in srgb, var(--shadow-color) calc(var(--shadow-opacity) * 100%), transparent);
    --shadow-lg: calc(var(--shadow-x) * 4) calc(var(--shadow-y) * 4) calc(var(--shadow-blur) * 5) calc(var(--shadow-spread) - 3px) color-mix(in srgb, var(--shadow-color) calc(var(--shadow-opacity) * 100%), transparent);
    --shadow-xl: calc(var(--shadow-x) * 6) calc(var(--shadow-y) * 6) calc(var(--shadow-blur) * 7) calc(var(--shadow-spread) - 5px) color-mix(in srgb, var(--shadow-color) calc(var(--shadow-opacity) * 100%), transparent);
    --shadow-2xl: calc(var(--shadow-x) * 8) calc(var(--shadow-y) * 8) calc(max(0px, var(--shadow-blur) * 9 - 8px)) calc(var(--shadow-spread) - 12px) color-mix(in srgb, var(--shadow-color) calc(var(--shadow-opacity) * 250%), transparent);
    --shadow: var(--shadow-md);

    --background: 216 33% 97%;
    --foreground: 220 45% 12%;
    --muted: 216 30% 94%;
    --muted-foreground: 218 14% 45%;
    --popover: 0 0% 100%;
    --popover-foreground: 220 45% 12%;
    --border: 216 25% 89%;
    --input: 216 25% 86%;
    --card: 0 0% 100%;
    --card-foreground: 220 45% 12%;
    --primary: 216 92% 46%;
    --primary-foreground: 0 0% 100%;
    --secondary: 216 60% 95%;
    --secondary-foreground: 216 80% 30%;
    --accent: 216 70% 95%;
    --accent-foreground: 216 85% 35%;
    --destructive: 356 75% 50%;
    --destructive-foreground: 0 0% 100%;
    --success: 152 70% 36%;
    --ring: 216 92% 46%;
    --radius: 0.625rem;
    --sidebar-background: 222 60% 14%;
    --sidebar-foreground: 216 30% 85%;
    --sidebar-primary: 216 92% 56%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 222 45% 20%;
    --sidebar-accent-foreground: 0 0% 100%;
    --sidebar-border: 222 40% 20%;
    --sidebar-ring: 216 92% 56%;
    --chart-1: 216 92% 46%;
    --chart-2: 152 70% 36%;
    --chart-3: 356 75% 50%;
    --chart-4: 200 85% 50%;
    --chart-5: 230 60% 60%;
    --font-sans: 'Manrope', 'Helvetica Neue', sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
  }

  .dark {
    --background: 222 47% 7%;
    --foreground: 213 31% 91%;
    --muted: 222 40% 12%;
    --muted-foreground: 215 16% 60%;
    --accent: 216 34% 17%;
    --accent-foreground: 210 40% 98%;
    --popover: 222 47% 9%;
    --popover-foreground: 213 31% 91%;
    --border: 216 34% 17%;
    --input: 216 34% 17%;
    --card: 222 47% 9%;
    --card-foreground: 213 31% 91%;
    --primary: 216 92% 56%;
    --primary-foreground: 0 0% 100%;
    --secondary: 222 47% 12%;
    --secondary-foreground: 210 40% 98%;
    --destructive: 0 84% 67%;
    --destructive-foreground: 0 63% 10%;
    --ring: 216 92% 56%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground font-sans antialiased;
  }
  .num {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }
  .text-up { color: hsl(var(--success)); }
  .bg-up { background-color: hsl(var(--success)); }
}

```

### `src/App.tsx`

```tsx
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAuth, loginWithRedirect } from 'zitejs/auth';
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

```

### `src/lib/feed.ts`

```ts
import { SYM, SYMBOLS } from './symbols';

/**
 * Price feed adapter.
 * Abhi yeh demo feed hai (random walk). Apna real-time feed jorne ke liye
 * sirf `subscribePrices` ko replace karein — baqi poori app isi se chalti hai.
 */
export type Quote = { bid: number; ask: number; open: number; high: number; low: number; dir: 1 | -1 | 0 };
export type Quotes = Record<string, Quote>;

const vol = (sym: string) => SYM[sym].start * (SYM[sym].category === 'Crypto' ? 0.0006 : 0.00012);

export function initialQuotes(): Quotes {
  const q: Quotes = {};
  for (const s of SYMBOLS) {
    const mid = s.start * (1 + (Math.random() - 0.5) * 0.004);
    q[s.symbol] = { bid: mid, ask: mid + s.spread, open: s.start, high: Math.max(mid, s.start), low: Math.min(mid, s.start), dir: 0 };
  }
  return q;
}

export function subscribePrices(onTick: (fn: (prev: Quotes) => Quotes) => void) {
  const id = setInterval(() => {
    onTick((prev) => {
      const next: Quotes = { ...prev };
      for (const s of SYMBOLS) {
        if (Math.random() > 0.45) continue;
        const p = prev[s.symbol];
        const delta = (Math.random() - 0.5) * 2 * vol(s.symbol);
        const bid = Math.max(p.bid + delta, s.start * 0.5);
        next[s.symbol] = {
          ...p, bid, ask: bid + s.spread,
          high: Math.max(p.high, bid), low: Math.min(p.low, bid),
          dir: delta >= 0 ? 1 : -1,
        };
      }
      return next;
    });
  }, 800);
  return () => clearInterval(id);
}

/** Converts an amount in a symbol's quote currency to USD */
export function quoteToUsd(symbol: string, q: Quotes): number {
  const s = SYM[symbol];
  if (s.category !== 'Forex' && !symbol.endsWith('EUR')) return 1;
  const quote = symbol.slice(-3);
  if (quote === 'USD') return 1;
  if (q['USD' + quote]) return 1 / q['USD' + quote].bid;
  if (q[quote + 'USD']) return q[quote + 'USD'].bid;
  return 1;
}

export function candleHistory(symbol: string, last: number, count: number, step: number) {
  const v = vol(symbol) * Math.sqrt(step / 60) * 4;
  const out: { t: number; o: number; h: number; l: number; c: number }[] = [];
  let c = last;
  const now = Math.floor(Date.now() / 1000 / step) * step;
  for (let i = 0; i < count; i++) {
    const o = c - (Math.random() - 0.5) * 2 * v;
    const h = Math.max(o, c) + Math.random() * v * 0.6;
    const l = Math.min(o, c) - Math.random() * v * 0.6;
    out.unshift({ t: now - i * step, o, h, l, c });
    c = o;
  }
  return out;
}

```

### `src/lib/portal.tsx`

```tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { toast } from 'sonner';

/**
 * Client profile, KYC, wallet, IB (partner) and support data.
 * Demo storage in the browser — replace these actions with your back-office API.
 */
export type KycStatus = 'Not started' | 'Under review' | 'Verified' | 'Rejected';
export type KycStep = 'email' | 'phone' | 'profile' | 'identity' | 'address';
export type Profile = { firstName: string; lastName: string; phone: string; country: string; dob: string; city: string; address: string; postal: string };
export type WalletTxn = { id: string; type: 'Credit' | 'Debit'; note: string; amount: number; time: number };
export type Ticket = { id: string; subject: string; category: string; message: string; status: 'Open' | 'Answered' | 'Closed'; time: number };
export type IbClient = { id: string; name: string; country: string; joined: number; lots: number; commission: number; status: 'Active' | 'Inactive' };

type State = {
  profile: Profile;
  kyc: Record<KycStep, KycStatus>;
  docs: Partial<Record<'identity' | 'address', { url: string; docType: string }>>;
  wallet: number;
  walletTxns: WalletTxn[];
  twoFA: boolean;
  notify: { email: boolean; push: boolean; news: boolean };
  terminal: { oneClick: boolean; confirmClose: boolean; sounds: boolean };
  ib: { joined: boolean; code: string; clients: IbClient[]; paid: number };
  tickets: Ticket[];
};

const uid = () => Math.random().toString(36).slice(2, 10);
const COUNTRIES = ['Pakistan', 'UAE', 'India', 'Bangladesh', 'Nigeria', 'Egypt', 'UK', 'Malaysia'];
const NAMES = ['Ahmed Raza', 'Sara Khan', 'Bilal Hussain', 'Ayesha Malik', 'Usman Tariq', 'Fatima Noor', 'Hamza Ali', 'Zainab Iqbal', 'Omar Farooq', 'Hira Javed'];

const seedClients = (): IbClient[] =>
  NAMES.map((name, i) => {
    const lots = Math.round(Math.random() * 120 * 100) / 100;
    return { id: uid(), name, country: COUNTRIES[i % COUNTRIES.length], joined: Date.now() - (i + 1) * 86400000 * 6, lots, commission: lots * 8, status: i % 4 === 3 ? 'Inactive' : 'Active' };
  });

const initial = (): State => ({
  profile: { firstName: '', lastName: '', phone: '', country: 'Pakistan', dob: '', city: '', address: '', postal: '' },
  kyc: { email: 'Verified', phone: 'Not started', profile: 'Not started', identity: 'Not started', address: 'Not started' },
  docs: {},
  wallet: 0,
  walletTxns: [],
  twoFA: false,
  notify: { email: true, push: true, news: false },
  terminal: { oneClick: false, confirmClose: true, sounds: true },
  ib: { joined: false, code: '', clients: [], paid: 0 },
  tickets: [],
});

const KEY = 'bigbulls-portal-v1';

function usePortalState() {
  const [s, set] = useState<State>(() => {
    try { const v = localStorage.getItem(KEY); if (v) return { ...initial(), ...JSON.parse(v) }; } catch { /* ignore */ }
    return initial();
  });
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(s)); }, [s]);

  // Demo only: documents under review get approved after 20s (your back-office does this for real)
  useEffect(() => {
    const steps = (Object.keys(s.kyc) as KycStep[]).filter((k) => s.kyc[k] === 'Under review');
    if (!steps.length) return;
    const id = setTimeout(() => {
      set((x) => ({ ...x, kyc: { ...x.kyc, ...Object.fromEntries(steps.map((k) => [k, 'Verified'])) } }));
      toast.success('Verification approved');
    }, 20000);
    return () => clearTimeout(id);
  }, [s.kyc]);

  const verified = s.kyc.identity === 'Verified' && s.kyc.address === 'Verified' && s.kyc.profile === 'Verified';
  const level = verified ? 'Fully verified' : s.kyc.profile === 'Verified' ? 'Partially verified' : 'Unverified';
  const ibEarned = s.ib.clients.reduce((a, c) => a + c.commission, 0);

  const walletLog = (x: State, type: WalletTxn['type'], note: string, amount: number): State => ({
    ...x, wallet: x.wallet + (type === 'Credit' ? amount : -amount),
    walletTxns: [{ id: uid(), type, note, amount, time: Date.now() }, ...x.walletTxns],
  });

  return {
    ...s, verified, level, ibEarned,
    saveProfile: (p: Profile) => set((x) => ({ ...x, profile: p, kyc: { ...x.kyc, profile: 'Verified', phone: p.phone ? 'Verified' : x.kyc.phone } })),
    submitDoc: (step: 'identity' | 'address', url: string, docType: string) =>
      set((x) => ({ ...x, docs: { ...x.docs, [step]: { url, docType } }, kyc: { ...x.kyc, [step]: 'Under review' } })),
    walletCredit: (note: string, amount: number) => set((x) => walletLog(x, 'Credit', note, amount)),
    walletDebit: (note: string, amount: number) => set((x) => walletLog(x, 'Debit', note, amount)),
    setTwoFA: (v: boolean) => set((x) => ({ ...x, twoFA: v })),
    setNotify: (k: keyof State['notify'], v: boolean) => set((x) => ({ ...x, notify: { ...x.notify, [k]: v } })),
    setTerminal: (k: keyof State['terminal'], v: boolean) => set((x) => ({ ...x, terminal: { ...x.terminal, [k]: v } })),
    joinIb: () => set((x) => ({ ...x, ib: { joined: true, code: 'BB' + Math.floor(100000 + Math.random() * 899999), clients: seedClients(), paid: 0 } })),
    withdrawCommission: () => set((x) => {
      const avail = x.ib.clients.reduce((a, c) => a + c.commission, 0) - x.ib.paid;
      if (avail <= 0) return x;
      return walletLog({ ...x, ib: { ...x.ib, paid: x.ib.paid + avail } }, 'Credit', 'IB commission payout', avail);
    }),
    createTicket: (t: Omit<Ticket, 'id' | 'status' | 'time'>) => set((x) => ({ ...x, tickets: [{ ...t, id: uid(), status: 'Open', time: Date.now() }, ...x.tickets] })),
    closeTicket: (id: string) => set((x) => ({ ...x, tickets: x.tickets.map((t) => (t.id === id ? { ...t, status: 'Closed' } : t)) })),
  };
}

type Portal = ReturnType<typeof usePortalState>;
const Ctx = createContext<Portal | null>(null);
export function PortalProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={usePortalState()}>{children}</Ctx.Provider>;
}
export const usePortal = () => { const c = useContext(Ctx); if (!c) throw new Error('usePortal outside provider'); return c; };
export { COUNTRIES };

```

### `src/lib/store.tsx`

```tsx
import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { toast } from 'sonner';
import { Quotes, initialQuotes, subscribePrices, quoteToUsd } from './feed';
import { SYM } from './symbols';

/**
 * Trading engine (client-side demo).
 * Aap ka back-office yahan connect hoga: openPosition / closePosition /
 * placePending / deposit / withdraw ko apni backend API calls se replace karein.
 */
export type Side = 'buy' | 'sell';
export type Account = { id: string; number: string; type: 'Real' | 'Demo'; platform: string; kind: 'Standard' | 'Pro' | 'Raw Spread' | 'Zero'; leverage: number; balance: number; currency: 'USD' };
export type Position = { id: string; accountId: string; symbol: string; side: Side; volume: number; openPrice: number; sl?: number; tp?: number; openTime: number };
export type Pending = { id: string; accountId: string; symbol: string; side: Side; kind: 'Limit' | 'Stop'; volume: number; price: number; sl?: number; tp?: number; created: number };
export type Closed = Position & { closePrice: number; closeTime: number; profit: number; reason: string };
export type Txn = { id: string; accountId: string; type: 'Deposit' | 'Withdrawal' | 'Transfer'; method: string; amount: number; status: 'Done' | 'Pending'; time: number };

type State = { accounts: Account[]; activeId: string; positions: Position[]; pending: Pending[]; history: Closed[]; txns: Txn[]; favorites: string[] };

const uid = () => Math.random().toString(36).slice(2, 10);
const accNo = () => String(Math.floor(10000000 + Math.random() * 89999999));

const initial = (): State => {
  const real: Account = { id: uid(), number: accNo(), type: 'Real', platform: 'BigBulls Terminal', kind: 'Standard', leverage: 500, balance: 0, currency: 'USD' };
  const demo: Account = { id: uid(), number: accNo(), type: 'Demo', platform: 'BigBulls Terminal', kind: 'Standard', leverage: 2000, balance: 10000, currency: 'USD' };
  return { accounts: [demo, real], activeId: demo.id, positions: [], pending: [], history: [], txns: [], favorites: ['EURUSD', 'XAUUSD', 'BTCUSD', 'USOIL', 'US30'] };
};

const KEY = 'bigbulls-state-v2';

export function pnl(p: { symbol: string; side: Side; volume: number; openPrice: number }, q: Quotes) {
  const quote = q[p.symbol];
  const close = p.side === 'buy' ? quote.bid : quote.ask;
  const diff = (close - p.openPrice) * (p.side === 'buy' ? 1 : -1);
  return diff * p.volume * SYM[p.symbol].contract * quoteToUsd(p.symbol, q);
}

export function marginFor(symbol: string, volume: number, leverage: number, q: Quotes) {
  const s = SYM[symbol];
  const notional = volume * s.contract * q[symbol].ask * quoteToUsd(symbol, q);
  const lev = s.category === 'Forex' || s.category === 'Metals' ? leverage : Math.min(leverage, s.category === 'Crypto' ? 400 : 200);
  return notional / lev;
}

function useEngine() {
  const [quotes, setQuotes] = useState<Quotes>(initialQuotes);
  const [state, setState] = useState<State>(() => {
    try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch { /* ignore */ }
    return initial();
  });

  useEffect(() => subscribePrices(setQuotes), []);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(state)); }, [state]);

  const account = state.accounts.find((a) => a.id === state.activeId) ?? state.accounts[0];
  const positions = state.positions.filter((p) => p.accountId === account.id);
  const pending = state.pending.filter((p) => p.accountId === account.id);
  const history = state.history.filter((p) => p.accountId === account.id);

  const floating = positions.reduce((s, p) => s + pnl(p, quotes), 0);
  const margin = positions.reduce((s, p) => s + marginFor(p.symbol, p.volume, account.leverage, quotes), 0);
  const equity = account.balance + floating;
  const free = equity - margin;
  const level = margin > 0 ? (equity / margin) * 100 : 0;

  const closeIds = (ids: string[], reason: string, st: State, q: Quotes): State => {
    const closing = st.positions.filter((p) => ids.includes(p.id));
    if (!closing.length) return st;
    const closed: Closed[] = closing.map((p) => ({
      ...p, closePrice: p.side === 'buy' ? q[p.symbol].bid : q[p.symbol].ask,
      closeTime: Date.now(), profit: pnl(p, q), reason,
    }));
    const byAcc: Record<string, number> = {};
    closed.forEach((c) => (byAcc[c.accountId] = (byAcc[c.accountId] ?? 0) + c.profit));
    return {
      ...st,
      positions: st.positions.filter((p) => !ids.includes(p.id)),
      history: [...closed, ...st.history],
      accounts: st.accounts.map((a) => (byAcc[a.id] ? { ...a, balance: a.balance + byAcc[a.id] } : a)),
    };
  };

  // SL / TP / pending trigger / stop-out checks on every tick
  useEffect(() => {
    setState((st) => {
      let next = st;
      const hits: { id: string; r: string }[] = [];
      for (const p of st.positions) {
        const q = quotes[p.symbol]; const px = p.side === 'buy' ? q.bid : q.ask;
        const up = p.side === 'buy';
        if (p.sl && (up ? px <= p.sl : px >= p.sl)) hits.push({ id: p.id, r: 'Stop Loss' });
        else if (p.tp && (up ? px >= p.tp : px <= p.tp)) hits.push({ id: p.id, r: 'Take Profit' });
      }
      for (const h of hits) { next = closeIds([h.id], h.r, next, quotes); toast(`${h.r} triggered`); }
      const fills = next.pending.filter((o) => {
        const q = quotes[o.symbol]; const px = o.side === 'buy' ? q.ask : q.bid;
        if (o.kind === 'Limit') return o.side === 'buy' ? px <= o.price : px >= o.price;
        return o.side === 'buy' ? px >= o.price : px <= o.price;
      });
      if (fills.length) {
        next = {
          ...next,
          pending: next.pending.filter((o) => !fills.includes(o)),
          positions: [...fills.map((o) => ({ id: uid(), accountId: o.accountId, symbol: o.symbol, side: o.side, volume: o.volume, openPrice: o.price, sl: o.sl, tp: o.tp, openTime: Date.now() })), ...next.positions],
        };
        fills.forEach((o) => toast.success(`${o.side.toUpperCase()} ${o.kind} ${o.symbol} filled`));
      }
      // Stop-out at 0% margin level
      for (const a of next.accounts) {
        const ps = next.positions.filter((p) => p.accountId === a.id);
        if (!ps.length) continue;
        const eq = a.balance + ps.reduce((s, p) => s + pnl(p, quotes), 0);
        if (eq <= 0) { next = closeIds(ps.map((p) => p.id), 'Stop Out', next, quotes); toast.error('Stop out: positions closed'); }
      }
      return next;
    });
  }, [quotes]);

  const actions = {
    setActive: (id: string) => setState((s) => ({ ...s, activeId: id })),
    toggleFav: (sym: string) => setState((s) => ({ ...s, favorites: s.favorites.includes(sym) ? s.favorites.filter((f) => f !== sym) : [...s.favorites, sym] })),
    openPosition: (o: { symbol: string; side: Side; volume: number; sl?: number; tp?: number }) => {
      const req = marginFor(o.symbol, o.volume, account.leverage, quotes);
      if (req > free) { toast.error('Not enough free margin'); return false; }
      const q = quotes[o.symbol];
      const pos: Position = { id: uid(), accountId: account.id, ...o, openPrice: o.side === 'buy' ? q.ask : q.bid, openTime: Date.now() };
      setState((s) => ({ ...s, positions: [pos, ...s.positions] }));
      toast.success(`${o.side === 'buy' ? 'Buy' : 'Sell'} ${o.volume} ${o.symbol} at ${pos.openPrice.toFixed(SYM[o.symbol].digits)}`);
      return true;
    },
    placePending: (o: Omit<Pending, 'id' | 'accountId' | 'created'>) => {
      setState((s) => ({ ...s, pending: [{ ...o, id: uid(), accountId: account.id, created: Date.now() }, ...s.pending] }));
      toast.success(`${o.side === 'buy' ? 'Buy' : 'Sell'} ${o.kind} placed`);
    },
    cancelPending: (id: string) => setState((s) => ({ ...s, pending: s.pending.filter((p) => p.id !== id) })),
    closePosition: (id: string) => { setState((s) => closeIds([id], 'Manual', s, quotes)); toast('Position closed'); },
    closeAll: (filter: 'all' | 'profit' | 'loss') => {
      const ids = positions.filter((p) => filter === 'all' || (filter === 'profit' ? pnl(p, quotes) > 0 : pnl(p, quotes) < 0)).map((p) => p.id);
      setState((s) => closeIds(ids, 'Manual', s, quotes));
      toast(`${ids.length} position(s) closed`);
    },
    modifyPosition: (id: string, sl?: number, tp?: number) => setState((s) => ({ ...s, positions: s.positions.map((p) => (p.id === id ? { ...p, sl, tp } : p)) })),
    transact: (accountId: string, type: Txn['type'], method: string, amount: number) =>
      setState((s) => ({
        ...s,
        txns: [{ id: uid(), accountId, type, method, amount, status: type === 'Withdrawal' ? 'Pending' : 'Done', time: Date.now() }, ...s.txns],
        accounts: s.accounts.map((a) => (a.id === accountId ? { ...a, balance: a.balance + (type === 'Withdrawal' ? -amount : amount) } : a)),
      })),
    transfer: (fromId: string, toId: string, amount: number) =>
      setState((s) => ({
        ...s,
        txns: [{ id: uid(), accountId: fromId, type: 'Transfer', method: `To #${s.accounts.find((a) => a.id === toId)?.number}`, amount, status: 'Done', time: Date.now() }, ...s.txns],
        accounts: s.accounts.map((a) => (a.id === fromId ? { ...a, balance: a.balance - amount } : a.id === toId ? { ...a, balance: a.balance + amount } : a)),
      })),
    openAccount: (a: Omit<Account, 'id' | 'number' | 'balance' | 'currency'>) => {
      const acc: Account = { ...a, id: uid(), number: accNo(), balance: a.type === 'Demo' ? 10000 : 0, currency: 'USD' };
      setState((s) => ({ ...s, accounts: [...s.accounts, acc], activeId: acc.id }));
      toast.success(`${a.type} account #${acc.number} opened`);
    },
    /** Wallet ↔ account movement. amount > 0 credits the account, < 0 debits it */
    walletMove: (accountId: string, amount: number) =>
      setState((s) => ({
        ...s,
        txns: [{ id: uid(), accountId, type: 'Transfer', method: amount > 0 ? 'From Wallet' : 'To Wallet', amount: Math.abs(amount), status: 'Done', time: Date.now() }, ...s.txns],
        accounts: s.accounts.map((a) => (a.id === accountId ? { ...a, balance: a.balance + amount } : a)),
      })),
    setLeverage: (id: string, leverage: number) => setState((s) => ({ ...s, accounts: s.accounts.map((a) => (a.id === id ? { ...a, leverage } : a)) })),
    resetDemo: (id: string) => setState((s) => ({ ...s, accounts: s.accounts.map((a) => (a.id === id ? { ...a, balance: 10000 } : a)) })),
    archive: (id: string) => setState((s) => {
      const accounts = s.accounts.filter((a) => a.id !== id);
      return { ...s, accounts, activeId: s.activeId === id ? accounts[0].id : s.activeId, positions: s.positions.filter((p) => p.accountId !== id), pending: s.pending.filter((p) => p.accountId !== id) };
    }),
  };

  return { quotes, state, account, positions, pending, history, floating, margin, equity, free, level, ...actions };
}

type Engine = ReturnType<typeof useEngine>;
const Ctx = createContext<Engine | null>(null);

export function TradingProvider({ children }: { children: ReactNode }) {
  const engine = useEngine();
  const value = useMemo(() => engine, [engine]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTrading = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTrading outside provider');
  return c;
};

```

### `src/lib/symbols.ts`

```ts
export type Category = 'Forex' | 'Metals' | 'Crypto' | 'Energies' | 'Indices' | 'Stocks';

export type SymbolInfo = {
  symbol: string;
  name: string;
  digits: number;
  contract: number;
  spread: number;
  start: number;
  category: Category;
};

// [symbol, name, start price, digits, contract size]
const fx: [string, string, number, number][] = [
  ['EURUSD', 'Euro vs US Dollar', 1.0852, 5], ['GBPUSD', 'Pound vs US Dollar', 1.271, 5],
  ['USDJPY', 'US Dollar vs Yen', 151.42, 3], ['USDCHF', 'US Dollar vs Swiss Franc', 0.884, 5],
  ['AUDUSD', 'Aussie vs US Dollar', 0.656, 5], ['USDCAD', 'US Dollar vs Canadian', 1.372, 5],
  ['NZDUSD', 'Kiwi vs US Dollar', 0.601, 5], ['EURGBP', 'Euro vs Pound', 0.8538, 5],
  ['EURJPY', 'Euro vs Yen', 164.31, 3], ['GBPJPY', 'Pound vs Yen', 192.45, 3],
  ['EURCHF', 'Euro vs Swiss Franc', 0.9592, 5], ['EURAUD', 'Euro vs Aussie', 1.6541, 5],
  ['EURCAD', 'Euro vs Canadian', 1.4889, 5], ['GBPCHF', 'Pound vs Swiss Franc', 1.1237, 5],
  ['GBPAUD', 'Pound vs Aussie', 1.9374, 5], ['AUDJPY', 'Aussie vs Yen', 99.33, 3],
  ['AUDNZD', 'Aussie vs Kiwi', 1.0915, 5], ['CADJPY', 'Canadian vs Yen', 110.36, 3],
  ['CHFJPY', 'Swiss Franc vs Yen', 171.28, 3], ['NZDJPY', 'Kiwi vs Yen', 91.0, 3],
  ['USDZAR', 'US Dollar vs Rand', 18.214, 4], ['USDTRY', 'US Dollar vs Lira', 34.25, 4],
  ['USDMXN', 'US Dollar vs Peso', 17.08, 4], ['USDSGD', 'US Dollar vs SGD', 1.3465, 5],
  ['USDHKD', 'US Dollar vs HKD', 7.8105, 5], ['USDPKR', 'US Dollar vs Rupee', 278.4, 2],
];

const make = (
  category: Category,
  list: [string, string, number, number, number?][],
): SymbolInfo[] =>
  list.map(([symbol, name, start, digits, contract]) => ({
    symbol, name, start, digits, category,
    contract: contract ?? 100000,
    spread: start * 0.00009,
  }));

export const SYMBOLS: SymbolInfo[] = [
  ...make('Forex', fx),
  ...make('Metals', [
    ['XAUUSD', 'Gold vs US Dollar', 2385.4, 2, 100], ['XAGUSD', 'Silver vs US Dollar', 28.42, 3, 5000],
    ['XPTUSD', 'Platinum vs US Dollar', 982.5, 2, 100], ['XPDUSD', 'Palladium vs US Dollar', 1021.3, 2, 100],
    ['XAUEUR', 'Gold vs Euro', 2198.2, 2, 100],
  ]),
  ...make('Crypto', [
    ['BTCUSD', 'Bitcoin', 68250, 2, 1], ['ETHUSD', 'Ethereum', 3540, 2, 1],
    ['SOLUSD', 'Solana', 172.4, 3, 1], ['XRPUSD', 'Ripple', 0.5231, 5, 1],
    ['LTCUSD', 'Litecoin', 84.2, 3, 1], ['BNBUSD', 'BNB', 592.1, 2, 1],
    ['ADAUSD', 'Cardano', 0.4512, 5, 1], ['DOGEUSD', 'Dogecoin', 0.1562, 5, 1],
  ]),
  ...make('Energies', [
    ['USOIL', 'WTI Crude Oil', 78.42, 3, 1000], ['UKOIL', 'Brent Crude Oil', 82.65, 3, 1000],
    ['XNGUSD', 'Natural Gas', 2.215, 4, 10000],
  ]),
  ...make('Indices', [
    ['US30', 'Dow Jones 30', 39120, 1, 1], ['US500', 'S&P 500', 5245.3, 1, 1],
    ['USTEC', 'Nasdaq 100', 18320.5, 1, 1], ['DE30', 'Germany 40', 18440, 1, 1],
    ['UK100', 'FTSE 100', 8210, 1, 1], ['JP225', 'Nikkei 225', 39800, 0, 1],
    ['HK50', 'Hang Seng 50', 17650, 0, 1],
  ]),
  ...make('Stocks', [
    ['AAPL', 'Apple Inc.', 189.5, 2, 1], ['TSLA', 'Tesla Inc.', 176.8, 2, 1],
    ['NVDA', 'NVIDIA Corp.', 902.3, 2, 1], ['AMZN', 'Amazon.com', 182.4, 2, 1],
    ['MSFT', 'Microsoft', 421.6, 2, 1], ['META', 'Meta Platforms', 492.1, 2, 1],
    ['GOOGL', 'Alphabet', 168.2, 2, 1],
  ]),
];

export const CATEGORIES: Category[] = ['Forex', 'Metals', 'Crypto', 'Energies', 'Indices', 'Stocks'];

export const SYM = Object.fromEntries(SYMBOLS.map((s) => [s.symbol, s])) as Record<string, SymbolInfo>;

export const fmt = (n: number, d = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

export const money = (n: number) => `${n < 0 ? '-' : ''}$${fmt(Math.abs(n))}`;

```

### `src/components/Layout.tsx`

```tsx
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { Wallet, LayoutGrid, LogOut, CandlestickChart, PieChart, UserCircle, AlertTriangle } from 'lucide-react';
import { logout, useAuth } from 'zitejs/auth';
import { Button } from '@project/components/ui/button';
import { cn } from '@project/components/lib/utils';
import Logo from './Logo';
import { usePortal } from '../lib/portal';
import { money } from '../lib/symbols';

type Section = { key: string; label: string; icon: typeof Wallet; to: string; subs: { to: string; label: string }[] };
const SECTIONS: Section[] = [
  { key: 'accounts', label: 'Accounts', icon: LayoutGrid, to: '/', subs: [
    { to: '/', label: 'My accounts' }, { to: '/deposit', label: 'Deposit' }, { to: '/withdraw', label: 'Withdrawal' },
    { to: '/transfer', label: 'Transfer' }, { to: '/history', label: 'Transaction history' }, { to: '/trades', label: 'Trade history' },
  ] },
  { key: 'trade', label: 'Trade', icon: CandlestickChart, to: '/terminal', subs: [] },
  { key: 'performance', label: 'Performance', icon: PieChart, to: '/analytics', subs: [] },
  { key: 'profile', label: 'Profile', icon: UserCircle, to: '/wallet', subs: [
    { to: '/wallet', label: 'Wallet' }, { to: '/verification', label: 'KYC verification' }, { to: '/profile', label: 'Settings & security' },
    { to: '/partner', label: 'IB / Partner' }, { to: '/support', label: 'Support' },
  ] },
];
const sectionOf = (path: string) => SECTIONS.find((s) => s.subs.some((x) => x.to === path) || s.to === path) ?? SECTIONS[0];

export default function Layout() {
  const { user } = useAuth(); const p = usePortal(); const { pathname } = useLocation();
  const current = sectionOf(pathname);
  const name = p.profile.firstName ? `${p.profile.firstName} ${p.profile.lastName}` : user?.name || user?.email;

  const tabLink = (s: Section, mobile?: boolean) => (
    <Link key={s.key} to={s.to} className={cn(
      mobile ? 'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold' : 'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition',
      current.key === s.key
        ? (mobile ? 'text-primary' : 'bg-[hsl(var(--sidebar-primary))] text-white')
        : (mobile ? 'text-muted-foreground' : 'text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]'),
    )}>
      <s.icon className={mobile ? 'h-5 w-5' : 'h-5 w-5'} />{s.label}
      {s.key === 'profile' && !p.verified && !mobile && <span className="ml-auto h-2 w-2 rounded-full bg-white/70" />}
    </Link>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-[hsl(var(--sidebar-background))] p-4 md:flex">
        <div className="mb-8 px-2"><Logo light /></div>
        <nav className="space-y-1">{SECTIONS.map((s) => tabLink(s))}</nav>
        <Link to="/wallet" className="mt-auto rounded-xl bg-[hsl(var(--sidebar-accent))] p-4 text-white">
          <div className="flex items-center gap-2 text-xs text-white/60"><Wallet className="h-4 w-4" />Wallet balance</div>
          <div className="num mt-1 text-xl font-extrabold">{money(p.wallet)}</div>
        </Link>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
        <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 md:px-8">
            <div className="md:hidden"><Logo /></div>
            <h2 className="hidden text-lg font-extrabold md:block">{current.label}</h2>
            <div className="ml-auto flex items-center gap-3">
              <Button asChild><Link to="/terminal"><CandlestickChart className="mr-2 h-4 w-4" />Trade</Link></Button>
              <Link to="/profile" className="hidden items-center gap-2 sm:flex">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{(name ?? '?')[0]?.toUpperCase()}</div>
                <div><div className="text-sm font-bold leading-tight">{name}</div><div className={cn('text-[11px] font-semibold', p.verified ? 'text-up' : 'text-muted-foreground')}>{p.level}</div></div>
              </Link>
              <Button variant="ghost" size="icon" onClick={() => logout()} aria-label="Log out"><LogOut className="h-4 w-4" /></Button>
            </div>
          </div>
          {current.subs.length > 0 && (
            <nav className="flex gap-1 overflow-x-auto px-2 md:px-6">
              {current.subs.map((n) => (
                <NavLink key={n.to} to={n.to} end className={({ isActive }) => cn('whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-bold', isActive ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>{n.label}</NavLink>
              ))}
            </nav>
          )}
        </header>
        {!p.verified && (
          <div className="flex items-center gap-3 border-b bg-accent px-4 py-2.5 text-sm md:px-8">
            <AlertTriangle className="h-4 w-4 shrink-0 text-primary" />
            <span className="flex-1 text-accent-foreground">Complete KYC verification to remove deposit limits and enable withdrawals.</span>
            <Button asChild size="sm" variant="outline"><Link to="/verification">Verify now</Link></Button>
          </div>
        )}
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8"><Outlet /></main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t bg-card md:hidden">{SECTIONS.map((s) => tabLink(s, true))}</nav>
    </div>
  );
}

```

### `src/components/LeverageDialog.tsx`

```tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { cn } from '@project/components/lib/utils';
import { useTrading, Account } from '../lib/store';
import { LEVERAGES } from './OpenAccountDialog';

export default function LeverageDialog({ account, open, onOpenChange }: { account: Account; open: boolean; onOpenChange: (b: boolean) => void }) {
  const t = useTrading();
  const [lev, setLev] = useState(account.leverage);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Change leverage · #{account.number}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          {LEVERAGES.map((l) => (
            <button key={l} onClick={() => setLev(l)} className={cn('rounded-lg border-2 py-2.5 text-sm font-bold', lev === l ? 'border-primary bg-accent text-primary' : 'hover:border-primary/40')}>1:{l}</button>
          ))}
        </div>
        <DialogFooter><Button onClick={() => { t.setLeverage(account.id, lev); onOpenChange(false); }}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

```

### `src/components/Logo.tsx`

```tsx
export default function Logo({ light }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-black text-primary-foreground">BB</div>
      <div className="leading-none">
        <div className={light ? 'text-sm font-extrabold text-white' : 'text-sm font-extrabold'}>BIGBULLS</div>
        <div className={light ? 'text-[9px] font-semibold tracking-[0.2em] text-white/70' : 'text-[9px] font-semibold tracking-[0.2em] text-primary'}>GLOBAL MARKET</div>
      </div>
    </div>
  );
}

```

### `src/components/OpenAccountDialog.tsx`

```tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { cn } from '@project/components/lib/utils';
import { useTrading, Account } from '../lib/store';

const KINDS: { kind: Account['kind']; desc: string; spread: string }[] = [
  { kind: 'Standard', desc: 'Most popular, no commission', spread: 'From 0.2 pips' },
  { kind: 'Pro', desc: 'Instant execution, low spreads', spread: 'From 0.1 pips' },
  { kind: 'Raw Spread', desc: 'Low raw spreads, fixed commission', spread: 'From 0.0 pips' },
  { kind: 'Zero', desc: '0 spread on top 30 instruments', spread: 'From 0.0 pips' },
];
export const LEVERAGES = [2, 10, 50, 100, 200, 400, 500, 1000, 2000];

export default function OpenAccountDialog({ open, onOpenChange, defaultType }: { open: boolean; onOpenChange: (b: boolean) => void; defaultType: 'Real' | 'Demo' }) {
  const t = useTrading();
  const [type, setType] = useState<'Real' | 'Demo'>(defaultType);
  const [kind, setKind] = useState<Account['kind']>('Standard');

  const [lev, setLev] = useState('500');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Open new account</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 rounded-lg bg-muted p-1">
          {(['Real', 'Demo'] as const).map((x) => <button key={x} onClick={() => setType(x)} className={cn('rounded-md py-2 text-sm font-bold', type === x ? 'bg-card shadow-sm' : 'text-muted-foreground')}>{x}</button>)}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {KINDS.map((k) => (
            <button key={k.kind} onClick={() => setKind(k.kind)} className={cn('rounded-xl border-2 p-4 text-left transition', kind === k.kind ? 'border-primary bg-accent' : 'hover:border-primary/40')}>
              <div className="font-extrabold">{k.kind}</div><div className="mt-1 text-xs text-muted-foreground">{k.desc}</div><div className="mt-2 text-xs font-bold text-primary">{k.spread}</div>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-xs font-semibold">Platform<div className="mt-1 flex h-10 items-center rounded-md border bg-muted px-3 text-sm font-bold text-primary">BigBulls Terminal</div></div>
          <label className="text-xs font-semibold">Leverage
            <Select value={lev} onValueChange={setLev}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{LEVERAGES.map((l) => <SelectItem key={l} value={String(l)}>1:{l}</SelectItem>)}</SelectContent></Select>
          </label>
        </div>
        <DialogFooter><Button onClick={() => { t.openAccount({ type, kind, platform: 'BigBulls Terminal', leverage: Number(lev) }); onOpenChange(false); }}>Create account</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

```

### `src/components/OrderPanel.tsx`

```tsx
import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Input } from '@project/components/ui/input';
import { Switch } from '@project/components/ui/switch';
import { Button } from '@project/components/ui/button';
import { cn } from '@project/components/lib/utils';
import { marginFor, useTrading, Side } from '../lib/store';
import { SYM, money } from '../lib/symbols';

type Mode = 'Market' | 'Pending';

export default function OrderPanel({ symbol }: { symbol: string }) {
  const t = useTrading();
  const s = SYM[symbol]; const q = t.quotes[symbol];
  const [side, setSide] = useState<Side>('buy');
  const [mode, setMode] = useState<Mode>('Market');
  const [vol, setVol] = useState('0.01');
  const [price, setPrice] = useState('');
  const [useSl, setUseSl] = useState(false); const [sl, setSl] = useState('');
  const [useTp, setUseTp] = useState(false); const [tp, setTp] = useState('');

  const v = Number(vol);
  const validVol = v >= 0.01 && v <= 200;
  const margin = validVol ? marginFor(symbol, v, t.account.leverage, t.quotes) : 0;
  const pip = s.digits >= 3 ? Math.pow(10, -(s.digits - 1)) : Math.pow(10, -s.digits);
  const pipValue = validVol ? pip * v * s.contract : 0;
  const ref = side === 'buy' ? q.ask : q.bid;

  const submit = () => {
    if (!validVol) return;
    const slN = useSl && sl ? Number(sl) : undefined, tpN = useTp && tp ? Number(tp) : undefined;
    if (mode === 'Market') { t.openPosition({ symbol, side, volume: v, sl: slN, tp: tpN }); return; }
    const p = Number(price); if (!p) return;
    const kind = side === 'buy' ? (p < q.ask ? 'Limit' : 'Stop') : (p > q.bid ? 'Limit' : 'Stop');
    t.placePending({ symbol, side, kind, volume: v, price: p, sl: slN, tp: tpN });
    setPrice('');
  };

  const step = (d: number) => setVol(Math.max(0.01, Math.round((v + d) * 100) / 100).toFixed(2));

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <div className="text-lg font-extrabold">{symbol}</div>
        <div className="text-xs text-muted-foreground">{s.name}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setSide('sell')} className={cn('rounded-lg border-2 p-2.5 text-left transition', side === 'sell' ? 'border-destructive bg-destructive text-destructive-foreground' : 'border-destructive/30 text-destructive')}>
          <div className="text-[10px] font-bold uppercase">Sell</div><div className="num text-base font-bold">{q.bid.toFixed(s.digits)}</div>
        </button>
        <button onClick={() => setSide('buy')} className={cn('rounded-lg border-2 p-2.5 text-left transition', side === 'buy' ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/30 text-primary')}>
          <div className="text-[10px] font-bold uppercase">Buy</div><div className="num text-base font-bold">{q.ask.toFixed(s.digits)}</div>
        </button>
      </div>
      <div className="num -mt-2 text-center text-[11px] text-muted-foreground">Spread {((q.ask - q.bid) / pip).toFixed(1)} pips</div>
      <div className="grid grid-cols-2 rounded-lg bg-muted p-1">
        {(['Market', 'Pending'] as Mode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={cn('rounded-md py-1.5 text-xs font-bold', mode === m ? 'bg-card shadow-sm' : 'text-muted-foreground')}>{m}</button>
        ))}
      </div>
      {mode === 'Pending' && (
        <Field label="Open price"><Input className="num" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={ref.toFixed(s.digits)} /></Field>
      )}
      <Field label="Volume (lots)">
        <div className="flex">
          <Button variant="outline" size="icon" className="rounded-r-none" onClick={() => step(-0.01)}><Minus className="h-4 w-4" /></Button>
          <Input className={cn('num rounded-none text-center', !validVol && 'border-destructive')} value={vol} onChange={(e) => setVol(e.target.value)} />
          <Button variant="outline" size="icon" className="rounded-l-none" onClick={() => step(0.01)}><Plus className="h-4 w-4" /></Button>
        </div>
        {!validVol && <p className="mt-1 text-xs text-destructive">Volume 0.01 – 200 lots</p>}
      </Field>
      <Toggle label="Take Profit" on={useTp} setOn={setUseTp} value={tp} setValue={setTp} ph={ref.toFixed(s.digits)} />
      <Toggle label="Stop Loss" on={useSl} setOn={setUseSl} value={sl} setValue={setSl} ph={ref.toFixed(s.digits)} />
      <div className="space-y-1.5 rounded-lg bg-muted/60 p-3 text-xs">
        <Row k="Margin" v={money(margin)} /><Row k="Free margin" v={money(t.free)} />
        <Row k="Pip value" v={money(pipValue)} /><Row k="Leverage" v={`1:${t.account.leverage}`} />
      </div>
      <Button size="lg" disabled={!validVol} onClick={submit} className={cn('mt-auto h-12 text-base font-bold', side === 'sell' && 'bg-destructive hover:bg-destructive/90')}>
        {mode === 'Market' ? `Confirm ${side === 'buy' ? 'Buy' : 'Sell'} ${vol} lots` : `Place ${side === 'buy' ? 'Buy' : 'Sell'} order`}
      </Button>
    </div>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><div className="mb-1.5 text-xs font-semibold text-muted-foreground">{label}</div>{children}</div>
);
const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="num font-semibold">{v}</span></div>
);
function Toggle({ label, on, setOn, value, setValue, ph }: { label: string; on: boolean; setOn: (b: boolean) => void; value: string; setValue: (s: string) => void; ph: string }) {
  return (
    <div>
      <div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{label}</span><Switch checked={on} onCheckedChange={setOn} /></div>
      {on && <Input className="num mt-1.5" value={value} onChange={(e) => setValue(e.target.value)} placeholder={ph} />}
    </div>
  );
}

```

### `src/components/PositionsPanel.tsx`

```tsx
import { useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@project/components/ui/dropdown-menu';
import { cn } from '@project/components/lib/utils';
import { pnl, useTrading, Position } from '../lib/store';
import { SYM, money } from '../lib/symbols';

const TABS = ['Open', 'Pending', 'Closed'] as const;

export default function PositionsPanel() {
  const t = useTrading();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Open');
  const [edit, setEdit] = useState<Position | null>(null);
  const counts = { Open: t.positions.length, Pending: t.pending.length, Closed: t.history.length };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b px-3">
        {TABS.map((x) => (
          <button key={x} onClick={() => setTab(x)} className={cn('border-b-2 px-3 py-2 text-xs font-bold', tab === x ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}>
            {x} <span className="ml-1 rounded bg-muted px-1.5 text-[10px]">{counts[x]}</span>
          </button>
        ))}
        {tab === 'Open' && t.positions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" className="ml-auto h-7 text-xs">Close all ▾</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => t.closeAll('all')}>Close all positions</DropdownMenuItem>
              <DropdownMenuItem onClick={() => t.closeAll('profit')}>Close profitable</DropdownMenuItem>
              <DropdownMenuItem onClick={() => t.closeAll('loss')}>Close losing</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[760px] text-xs">
          <thead className="sticky top-0 bg-muted/80 text-[10px] uppercase text-muted-foreground backdrop-blur">
            <tr className="text-left">{['Symbol', 'Type', 'Volume', 'Open price', tab === 'Closed' ? 'Close price' : tab === 'Pending' ? 'Current' : 'Current', 'S/L', 'T/P', 'Time', tab === 'Pending' ? '' : 'Profit', ''].map((h, i) => <th key={i} className="px-3 py-1.5 font-bold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {tab === 'Open' && t.positions.map((p) => {
              const pr = pnl(p, t.quotes); const d = SYM[p.symbol].digits; const q = t.quotes[p.symbol];
              return (
                <tr key={p.id} className="border-b hover:bg-muted/40">
                  <td className="px-3 py-2 font-bold">{p.symbol}</td><td className={cn('px-3 font-bold', p.side === 'buy' ? 'text-primary' : 'text-destructive')}>{p.side.toUpperCase()}</td>
                  <td className="num px-3">{p.volume}</td><td className="num px-3">{p.openPrice.toFixed(d)}</td>
                  <td className="num px-3">{(p.side === 'buy' ? q.bid : q.ask).toFixed(d)}</td>
                  <td className="num px-3">{p.sl?.toFixed(d) ?? '—'}</td><td className="num px-3">{p.tp?.toFixed(d) ?? '—'}</td>
                  <td className="px-3 text-muted-foreground">{format(p.openTime, 'MMM d HH:mm:ss')}</td>
                  <td className={cn('num px-3 font-bold', pr >= 0 ? 'text-up' : 'text-destructive')}>{money(pr)}</td>
                  <td className="whitespace-nowrap px-3 text-right">
                    <button onClick={() => setEdit(p)} className="mr-2 text-muted-foreground hover:text-primary" aria-label="Modify"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => t.closePosition(p.id)} className="text-muted-foreground hover:text-destructive" aria-label="Close"><X className="h-4 w-4" /></button>
                  </td>
                </tr>
              );
            })}
            {tab === 'Pending' && t.pending.map((o) => {
              const d = SYM[o.symbol].digits;
              return (
                <tr key={o.id} className="border-b hover:bg-muted/40">
                  <td className="px-3 py-2 font-bold">{o.symbol}</td><td className={cn('px-3 font-bold', o.side === 'buy' ? 'text-primary' : 'text-destructive')}>{o.side.toUpperCase()} {o.kind.toUpperCase()}</td>
                  <td className="num px-3">{o.volume}</td><td className="num px-3">{o.price.toFixed(d)}</td>
                  <td className="num px-3">{t.quotes[o.symbol].bid.toFixed(d)}</td>
                  <td className="num px-3">{o.sl?.toFixed(d) ?? '—'}</td><td className="num px-3">{o.tp?.toFixed(d) ?? '—'}</td>
                  <td className="px-3 text-muted-foreground">{format(o.created, 'MMM d HH:mm:ss')}</td><td />
                  <td className="px-3 text-right"><button onClick={() => t.cancelPending(o.id)} className="text-muted-foreground hover:text-destructive" aria-label="Cancel"><X className="h-4 w-4" /></button></td>
                </tr>
              );
            })}
            {tab === 'Closed' && t.history.slice(0, 200).map((c) => {
              const d = SYM[c.symbol].digits;
              return (
                <tr key={c.id} className="border-b hover:bg-muted/40">
                  <td className="px-3 py-2 font-bold">{c.symbol}</td><td className={cn('px-3 font-bold', c.side === 'buy' ? 'text-primary' : 'text-destructive')}>{c.side.toUpperCase()}</td>
                  <td className="num px-3">{c.volume}</td><td className="num px-3">{c.openPrice.toFixed(d)}</td><td className="num px-3">{c.closePrice.toFixed(d)}</td>
                  <td className="num px-3">{c.sl?.toFixed(d) ?? '—'}</td><td className="num px-3">{c.tp?.toFixed(d) ?? '—'}</td>
                  <td className="px-3 text-muted-foreground">{format(c.closeTime, 'MMM d HH:mm:ss')}</td>
                  <td className={cn('num px-3 font-bold', c.profit >= 0 ? 'text-up' : 'text-destructive')}>{money(c.profit)}</td>
                  <td className="px-3 text-right text-[10px] text-muted-foreground">{c.reason}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {counts[tab] === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No {tab.toLowerCase()} orders</p>}
      </div>
      {edit && <ModifyDialog p={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function ModifyDialog({ p, onClose }: { p: Position; onClose: () => void }) {
  const t = useTrading(); const d = SYM[p.symbol].digits;
  const [sl, setSl] = useState(p.sl?.toFixed(d) ?? ''); const [tp, setTp] = useState(p.tp?.toFixed(d) ?? '');
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Modify {p.side.toUpperCase()} {p.volume} {p.symbol}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold">Stop Loss<Input className="num mt-1" value={sl} onChange={(e) => setSl(e.target.value)} placeholder="Not set" /></label>
          <label className="text-xs font-semibold">Take Profit<Input className="num mt-1" value={tp} onChange={(e) => setTp(e.target.value)} placeholder="Not set" /></label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { t.modifyPosition(p.id, sl ? Number(sl) : undefined, tp ? Number(tp) : undefined); onClose(); }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

```

### `src/components/PriceChart.tsx`

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTrading } from '../lib/store';
import { candleHistory } from '../lib/feed';
import { SYM } from '../lib/symbols';
import { cn } from '@project/components/lib/utils';

const TFS: [string, number][] = [['1m', 60], ['5m', 300], ['15m', 900], ['1h', 3600], ['4h', 14400], ['1D', 86400]];
type Candle = { t: number; o: number; h: number; l: number; c: number };

export default function PriceChart({ symbol }: { symbol: string }) {
  const { quotes, positions } = useTrading();
  const [tf, setTf] = useState(900);
  const [candles, setCandles] = useState<Candle[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 400 });
  const bid = quotes[symbol].bid;
  const d = SYM[symbol].digits;

  useEffect(() => { setCandles(candleHistory(symbol, quotes[symbol].bid, 90, tf)); }, [symbol, tf]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setCandles((cs) => {
      if (!cs.length) return cs;
      const now = Math.floor(Date.now() / 1000 / tf) * tf;
      const last = cs[cs.length - 1];
      if (now > last.t) return [...cs.slice(1), { t: now, o: last.c, h: Math.max(last.c, bid), l: Math.min(last.c, bid), c: bid }];
      return [...cs.slice(0, -1), { ...last, c: bid, h: Math.max(last.h, bid), l: Math.min(last.l, bid) }];
    });
  }, [bid, tf]);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  const lines = positions.filter((p) => p.symbol === symbol);
  const { min, max } = useMemo(() => {
    const hs = candles.map((c) => c.h), ls = candles.map((c) => c.l);
    const mx = Math.max(...hs, bid), mn = Math.min(...ls, bid), pad = (mx - mn) * 0.08 || 1;
    return { min: mn - pad, max: mx + pad };
  }, [candles, bid]);

  const axisW = 72, W = Math.max(size.w - axisW, 100), H = Math.max(size.h - 24, 100);
  const y = (v: number) => H - ((v - min) / (max - min)) * H;
  const cw = W / Math.max(candles.length, 1);
  const ticks = Array.from({ length: 6 }, (_, i) => min + ((max - min) * (i + 0.5)) / 6);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b px-3 py-1.5">
        {TFS.map(([l, v]) => (
          <button key={l} onClick={() => setTf(v)} className={cn('rounded px-2 py-1 text-xs font-semibold', tf === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>{l}</button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">{SYM[symbol].name}</span>
      </div>
      <div ref={ref} className="relative min-h-0 flex-1">
        <svg width={size.w} height={size.h} className="absolute inset-0">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={0} x2={W} y1={y(t)} y2={y(t)} className="stroke-border" strokeDasharray="2 4" />
              <text x={W + 6} y={y(t) + 4} className="num fill-muted-foreground text-[10px]">{t.toFixed(d)}</text>
            </g>
          ))}
          {candles.map((c, i) => {
            const up = c.c >= c.o; const x = i * cw + cw / 2;
            const cls = up ? 'fill-[hsl(var(--success))] stroke-[hsl(var(--success))]' : 'fill-destructive stroke-destructive';
            return (
              <g key={c.t} className={cls}>
                <line x1={x} x2={x} y1={y(c.h)} y2={y(c.l)} strokeWidth={1} />
                <rect x={x - cw * 0.35} width={cw * 0.7} y={y(Math.max(c.o, c.c))} height={Math.max(1, Math.abs(y(c.o) - y(c.c)))} />
              </g>
            );
          })}
          {lines.map((p) => (
            <g key={p.id}>
              <line x1={0} x2={W} y1={y(p.openPrice)} y2={y(p.openPrice)} className="stroke-primary" strokeDasharray="5 3" />
              <text x={4} y={y(p.openPrice) - 4} className="fill-primary text-[10px] font-semibold">{p.side.toUpperCase()} {p.volume}</text>
            </g>
          ))}
          <line x1={0} x2={W} y1={y(bid)} y2={y(bid)} className="stroke-primary" strokeWidth={0.75} />
          <rect x={W} y={y(bid) - 9} width={axisW} height={18} className="fill-primary" rx={3} />
          <text x={W + 6} y={y(bid) + 4} className="num fill-primary-foreground text-[10px] font-semibold">{bid.toFixed(d)}</text>
        </svg>
      </div>
    </div>
  );
}

```

### `src/components/Watchlist.tsx`

```tsx
import { useState } from 'react';
import { Search, Star } from 'lucide-react';
import { Input } from '@project/components/ui/input';
import { cn } from '@project/components/lib/utils';
import { useTrading } from '../lib/store';
import { CATEGORIES, SYMBOLS } from '../lib/symbols';

export default function Watchlist({ selected, onSelect }: { selected: string; onSelect: (s: string) => void }) {
  const { quotes, state, toggleFav } = useTrading();
  const [tab, setTab] = useState<string>('Favorites');
  const [q, setQ] = useState('');

  const list = SYMBOLS.filter((s) =>
    (q ? true : tab === 'Favorites' ? state.favorites.includes(s.symbol) : s.category === tab) &&
    (s.symbol + s.name).toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="flex h-full flex-col">
      <div className="p-3 pb-2">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Instruments</div>
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-9 pl-8" />
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto px-3 pb-2">
        {['Favorites', ...CATEGORIES].map((c) => (
          <button key={c} onClick={() => { setTab(c); setQ(''); }} className={cn('whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold', tab === c && !q ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}>{c}</button>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-y bg-muted/50 px-3 py-1.5 text-[10px] font-bold uppercase text-muted-foreground">
        <span>Symbol</span><span className="w-[72px] text-right">Bid</span><span className="w-[72px] text-right">Ask</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {list.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No instruments</p>}
        {list.map((s) => {
          const qt = quotes[s.symbol]; const chg = ((qt.bid - qt.open) / qt.open) * 100;
          const fav = state.favorites.includes(s.symbol);
          return (
            <div key={s.symbol} onClick={() => onSelect(s.symbol)} className={cn('grid cursor-pointer grid-cols-[1fr_auto_auto] items-center gap-x-3 border-b px-3 py-2 hover:bg-accent', selected === s.symbol && 'bg-accent')}>
              <div className="flex min-w-0 items-center gap-2">
                <button onClick={(e) => { e.stopPropagation(); toggleFav(s.symbol); }} aria-label="Favorite">
                  <Star className={cn('h-3.5 w-3.5', fav ? 'fill-primary text-primary' : 'text-muted-foreground')} />
                </button>
                <div className="min-w-0">
                  <div className="text-sm font-bold">{s.symbol}</div>
                  <div className={cn('num text-[10px]', chg >= 0 ? 'text-up' : 'text-destructive')}>{chg >= 0 ? '+' : ''}{chg.toFixed(2)}%</div>
                </div>
              </div>
              <span className={cn('num w-[72px] text-right text-xs font-medium', qt.dir > 0 ? 'text-up' : qt.dir < 0 ? 'text-destructive' : '')}>{qt.bid.toFixed(s.digits)}</span>
              <span className={cn('num w-[72px] text-right text-xs font-medium', qt.dir > 0 ? 'text-up' : qt.dir < 0 ? 'text-destructive' : '')}>{qt.ask.toFixed(s.digits)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

```

### `src/pages/Accounts.tsx`

```tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, MoreVertical, CandlestickChart, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Card } from '@project/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@project/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { cn } from '@project/components/lib/utils';
import { useTrading, Account, pnl } from '../lib/store';
import { money } from '../lib/symbols';
import OpenAccountDialog from '../components/OpenAccountDialog';
import LeverageDialog from '../components/LeverageDialog';

export default function Accounts() {
  const t = useTrading();
  const [tab, setTab] = useState<'Real' | 'Demo'>('Real');
  const [openNew, setOpenNew] = useState(false);
  const list = t.state.accounts.filter((a) => a.type === tab);
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-extrabold tracking-tight">My accounts</h1><p className="mt-1 text-sm text-muted-foreground">Manage your trading accounts and start trading.</p></div>
        <Button onClick={() => setOpenNew(true)}><Plus className="mr-2 h-4 w-4" />Open new account</Button>
      </div>
      <div className="mb-5 flex gap-6 border-b">
        {(['Real', 'Demo'] as const).map((x) => (
          <button key={x} onClick={() => setTab(x)} className={cn('-mb-px border-b-2 pb-3 text-sm font-bold', tab === x ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}>{x}</button>
        ))}
      </div>
      <div className="space-y-4">
        {list.map((a) => <AccountCard key={a.id} a={a} />)}
        {list.length === 0 && (
          <Card className="p-10 text-center"><p className="text-muted-foreground">No {tab.toLowerCase()} accounts yet.</p><Button className="mt-4" onClick={() => setOpenNew(true)}>Open account</Button></Card>
        )}
      </div>
      <OpenAccountDialog open={openNew} onOpenChange={setOpenNew} defaultType={tab} />
    </div>
  );
}

function AccountCard({ a }: { a: Account }) {
  const t = useTrading(); const nav = useNavigate();
  const [lev, setLev] = useState(false); const [arch, setArch] = useState(false);
  const floating = t.state.positions.filter((p) => p.accountId === a.id).reduce((s, p) => s + pnl(p, t.quotes), 0);
  const go = (path: string) => { t.setActive(a.id); nav(path); };
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-5 py-3 text-xs font-bold">
        <span className={cn('rounded px-2 py-0.5', a.type === 'Real' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground')}>{a.type}</span>
        <span className="rounded bg-card px-2 py-0.5 ring-1 ring-border">{a.platform}</span>
        <span className="rounded bg-card px-2 py-0.5 ring-1 ring-border">{a.kind}</span>
        <span className="text-muted-foreground">#{a.number}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="ml-auto h-7 w-7"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setLev(true)}>Change leverage</DropdownMenuItem>
            {a.type === 'Demo' && <DropdownMenuItem onClick={() => t.resetDemo(a.id)}>Set balance to $10,000</DropdownMenuItem>}
            {t.state.accounts.length > 1 && <DropdownMenuItem className="text-destructive" onClick={() => setArch(true)}>Archive account</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex flex-wrap items-center gap-6 p-5">
        <div>
          <div className="num text-3xl font-extrabold">{money(a.balance + floating)}</div>
          <div className="mt-1 text-xs text-muted-foreground">Leverage 1:{a.leverage} · Floating <span className={floating >= 0 ? 'text-up' : 'text-destructive'}>{money(floating)}</span></div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button onClick={() => go('/terminal')}><CandlestickChart className="mr-2 h-4 w-4" />Trade</Button>
          {a.type === 'Real' && <>
            <Button variant="outline" onClick={() => go('/deposit')}><ArrowDownToLine className="mr-2 h-4 w-4" />Deposit</Button>
            <Button variant="outline" onClick={() => go('/withdraw')}><ArrowUpFromLine className="mr-2 h-4 w-4" />Withdraw</Button>
          </>}
        </div>
      </div>
      <LeverageDialog account={a} open={lev} onOpenChange={setLev} />
      <AlertDialog open={arch} onOpenChange={setArch}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Archive account #{a.number}?</AlertDialogTitle><AlertDialogDescription>Open positions and pending orders on this account will be removed.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => t.archive(a.id)}>Archive</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Link to="/terminal" className="hidden" />
    </Card>
  );
}

```

### `src/pages/Analytics.tsx`

```tsx
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Area, AreaChart, Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@project/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { useTrading } from '../lib/store';
import { fmt, money } from '../lib/symbols';

export default function Analytics() {
  const t = useTrading();
  const [acc, setAcc] = useState('all');
  const trades = useMemo(() => t.state.history.filter((h) => acc === 'all' || h.accountId === acc).sort((a, b) => a.closeTime - b.closeTime), [t.state.history, acc]);

  const stats = useMemo(() => {
    let run = 0;
    const curve = trades.map((x) => ({ time: format(x.closeTime, 'MMM d HH:mm'), pnl: Math.round((run += x.profit) * 100) / 100 }));
    const wins = trades.filter((x) => x.profit > 0);
    const bySym: Record<string, number> = {};
    trades.forEach((x) => (bySym[x.symbol] = (bySym[x.symbol] ?? 0) + x.profit));
    return {
      curve, net: run, count: trades.length,
      winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
      lots: trades.reduce((a, x) => a + x.volume, 0),
      best: Math.max(0, ...trades.map((x) => x.profit)),
      gross: wins.reduce((a, x) => a + x.profit, 0),
      loss: trades.filter((x) => x.profit < 0).reduce((a, x) => a + x.profit, 0),
      buys: trades.filter((x) => x.side === 'buy').length,
      bySym: Object.entries(bySym).map(([symbol, profit]) => ({ symbol, profit: Math.round(profit * 100) / 100 })),
    };
  }, [trades]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-extrabold tracking-tight">Performance</h1><p className="mt-1 text-sm text-muted-foreground">Results from your closed trades.</p></div>
        <Select value={acc} onValueChange={setAcc}><SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All accounts</SelectItem>{t.state.accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.type} #{a.number}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi l="Net profit" v={money(stats.net)} tone={stats.net} /><Kpi l="Closed trades" v={String(stats.count)} />
        <Kpi l="Win rate" v={`${stats.winRate.toFixed(1)}%`} /><Kpi l="Volume traded" v={`${fmt(stats.lots)} lots`} /><Kpi l="Best trade" v={money(stats.best)} />
        <Kpi l="Total profit" v={money(stats.gross)} tone={1} /><Kpi l="Total loss" v={money(stats.loss)} tone={-1} />
        <Kpi l="Winning trades" v={String(Math.round(stats.winRate * stats.count / 100))} /><Kpi l="Buy / Sell" v={`${stats.buys} / ${stats.count - stats.buys}`} /><Kpi l="Avg per trade" v={money(stats.count ? stats.net / stats.count : 0)} tone={stats.net} />
      </div>
      {stats.count === 0 ? <Card className="mt-4 p-10 text-center text-muted-foreground">No closed trades on this account yet. Open the terminal to start trading.</Card> : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="p-5"><div className="mb-3 font-bold">Cumulative profit</div>
            <div className="h-64"><ResponsiveContainer><AreaChart data={stats.curve}>
              <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} /><stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} /></linearGradient></defs>
              <XAxis dataKey="time" fontSize={10} tickLine={false} axisLine={false} /><YAxis fontSize={10} tickLine={false} axisLine={false} /><Tooltip />
              <Area dataKey="pnl" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#g)" />
            </AreaChart></ResponsiveContainer></div></Card>
          <Card className="p-5"><div className="mb-3 font-bold">Profit by instrument</div>
            <div className="h-64"><ResponsiveContainer><BarChart data={stats.bySym}>
              <XAxis dataKey="symbol" fontSize={10} tickLine={false} axisLine={false} /><YAxis fontSize={10} tickLine={false} axisLine={false} /><Tooltip />
              <Bar dataKey="profit" radius={[6, 6, 0, 0]}>{stats.bySym.map((s) => <Cell key={s.symbol} fill={s.profit >= 0 ? 'hsl(var(--chart-2))' : 'hsl(var(--chart-3))'} />)}</Bar>
            </BarChart></ResponsiveContainer></div></Card>
        </div>
      )}
    </div>
  );
}

const Kpi = ({ l, v, tone }: { l: string; v: string; tone?: number }) => (
  <Card className="p-5"><div className="text-xs font-semibold text-muted-foreground">{l}</div><div className={`num mt-1 text-xl font-extrabold ${tone === undefined ? '' : tone >= 0 ? 'text-up' : 'text-destructive'}`}>{v}</div></Card>
);

```

### `src/pages/Funds.tsx`

```tsx
import { useState } from 'react';
import { toast } from 'sonner';
import { Landmark, CreditCard, Bitcoin, Wallet, Smartphone, CheckCircle2 } from 'lucide-react';
import { Card } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { cn } from '@project/components/lib/utils';
import { useTrading } from '../lib/store';
import { money } from '../lib/symbols';
import { usePortal } from '../lib/portal';
import { Link } from 'react-router-dom';

const METHODS = [
  { name: 'Bank Card', icon: CreditCard, time: 'Instant', fee: '0%', min: 10 },
  { name: 'Bank Transfer', icon: Landmark, time: '1–3 hours', fee: '0%', min: 50 },
  { name: 'USDT (TRC20)', icon: Bitcoin, time: 'Instant – 15 min', fee: '0%', min: 10 },
  { name: 'Bitcoin', icon: Bitcoin, time: 'Instant – 30 min', fee: '0%', min: 10 },
  { name: 'Skrill', icon: Wallet, time: 'Instant', fee: '0%', min: 10 },
  { name: 'JazzCash / Easypaisa', icon: Smartphone, time: 'Instant', fee: '0%', min: 10 },
];

export default function Funds({ mode }: { mode: 'Deposit' | 'Withdrawal' }) {
  const t = useTrading(); const kyc = usePortal();
  const depositedTotal = t.state.txns.filter((x) => x.type === 'Deposit').reduce((a, x) => a + x.amount, 0);
  const limitLeft = kyc.verified ? Infinity : Math.max(0, 2000 - depositedTotal);
  const real = t.state.accounts.filter((a) => a.type === 'Real');
  const [method, setMethod] = useState<string | null>(null);
  const [accId, setAccId] = useState(real[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const m = METHODS.find((x) => x.name === method);
  const acc = real.find((a) => a.id === accId);
  const n = Number(amount);
  const err = !amount ? '' : !(n > 0) ? 'Enter a valid amount' : m && n < m.min ? `Minimum is $${m.min}` : mode === 'Withdrawal' && acc && n > acc.balance ? 'Amount exceeds available balance' : mode === 'Deposit' && n > limitLeft ? `Unverified limit: you can deposit up to ${money(limitLeft)} more` : '';

  const submit = () => {
    if (!acc || !m || !n || err) return;
    t.transact(acc.id, mode, m.name, n);
    toast.success(mode === 'Deposit' ? `${money(n)} deposited to #${acc.number}` : `Withdrawal of ${money(n)} requested`);
    setAmount(''); setMethod(null);
  };

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">{mode}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{mode === 'Deposit' ? 'Choose a payment method to fund your account.' : 'Choose where to receive your funds.'}</p>
      {mode === 'Withdrawal' && !kyc.verified && <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl bg-accent p-4 text-sm text-accent-foreground"><span className="flex-1">Withdrawals are available once your account is fully verified.</span><Link to="/verification" className="font-bold text-primary underline">Verify now</Link></div>}
      {mode === 'Deposit' && !kyc.verified && <div className="mt-6 rounded-xl bg-accent p-4 text-sm text-accent-foreground">Unverified accounts can deposit up to $2,000 in total. Remaining: <b>{money(limitLeft)}</b>. <Link to="/verification" className="font-bold text-primary underline">Verify</Link> to remove the limit.</div>}
      {real.length === 0 && <Card className="mt-6 p-6 text-sm text-muted-foreground">Open a Real account first to {mode.toLowerCase()} funds.</Card>}
      {real.length > 0 && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="grid gap-3 sm:grid-cols-2">
            {METHODS.map((x) => (
              <button key={x.name} onClick={() => setMethod(x.name)} className={cn('flex items-start gap-3 rounded-xl border-2 bg-card p-4 text-left transition', method === x.name ? 'border-primary' : 'border-transparent shadow-sm hover:border-primary/40')}>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary"><x.icon className="h-5 w-5" /></div>
                <div className="flex-1">
                  <div className="font-bold">{x.name}</div>
                  <div className="mt-1 grid grid-cols-2 gap-x-2 text-[11px] text-muted-foreground"><span>Processing: {x.time}</span><span>Fee: {x.fee}</span><span>Min: ${x.min}</span></div>
                </div>
                {method === x.name && <CheckCircle2 className="h-5 w-5 text-primary" />}
              </button>
            ))}
          </div>
          <Card className="h-fit space-y-4 p-5">
            <div className="font-bold">{m ? m.name : 'Select a method'}</div>
            <label className="block text-xs font-semibold">{mode === 'Deposit' ? 'To account' : 'From account'}
              <Select value={accId} onValueChange={setAccId}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{real.map((a) => <SelectItem key={a.id} value={a.id}>#{a.number} · {money(a.balance)}</SelectItem>)}</SelectContent></Select>
            </label>
            <label className="block text-xs font-semibold">Amount (USD)
              <Input className={cn('num mt-1 h-11 text-lg', err && 'border-destructive')} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
              {err && <span className="mt-1 block text-xs text-destructive">{err}</span>}
            </label>
            <div className="flex gap-2">{[100, 500, 1000].map((v) => <Button key={v} variant="outline" size="sm" onClick={() => setAmount(String(v))}>${v}</Button>)}</div>
            <Button className="h-11 w-full font-bold" disabled={!m || !n || !!err || (mode === 'Withdrawal' && !kyc.verified)} onClick={submit}>{mode === 'Deposit' ? 'Deposit' : 'Withdraw'} {n > 0 && !err ? money(n) : ''}</Button>
          </Card>
        </div>
      )}
    </div>
  );
}

```

### `src/pages/HistoryPage.tsx`

```tsx
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Search } from 'lucide-react';
import { Card } from '@project/components/ui/card';
import { Input } from '@project/components/ui/input';
import { Button } from '@project/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@project/components/ui/table';
import { cn } from '@project/components/lib/utils';
import { useTrading } from '../lib/store';
import { money } from '../lib/symbols';

const TYPES = ['All', 'Deposit', 'Withdrawal', 'Transfer'] as const;
const PAGE = 15;

export default function HistoryPage() {
  const t = useTrading();
  const [type, setType] = useState<(typeof TYPES)[number]>('All');
  const [q, setQ] = useState(''); const [page, setPage] = useState(0);
  const [desc, setDesc] = useState(true);
  const accNo = (id: string) => t.state.accounts.find((a) => a.id === id)?.number ?? '—';

  const rows = useMemo(() => t.state.txns
    .filter((x) => (type === 'All' || x.type === type) && (x.method + accNo(x.accountId)).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (desc ? b.time - a.time : a.time - b.time)), [t.state.txns, type, q, desc]); // eslint-disable-line react-hooks/exhaustive-deps
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Transaction history</h1>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {TYPES.map((x) => <Button key={x} size="sm" variant={type === x ? 'default' : 'outline'} onClick={() => { setType(x); setPage(0); }}>{x}</Button>)}
        <div className="relative ml-auto w-full sm:w-64"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" placeholder="Search method or account" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /></div>
      </div>
      <Card className="mt-4 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="cursor-pointer" onClick={() => setDesc(!desc)}>Date {desc ? '↓' : '↑'}</TableHead>
            <TableHead>Type</TableHead><TableHead>Account</TableHead><TableHead>Method</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.slice(page * PAGE, page * PAGE + PAGE).map((x) => (
              <TableRow key={x.id}>
                <TableCell className="text-muted-foreground">{format(x.time, 'MMM d, yyyy HH:mm')}</TableCell>
                <TableCell className="font-semibold">{x.type}</TableCell><TableCell>#{accNo(x.accountId)}</TableCell><TableCell>{x.method}</TableCell>
                <TableCell><span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', x.status === 'Done' ? 'bg-[hsl(var(--success)/0.12)] text-up' : 'bg-accent text-primary')}>{x.status}</span></TableCell>
                <TableCell className={cn('num text-right font-bold', x.type === 'Withdrawal' ? 'text-destructive' : 'text-up')}>{x.type === 'Withdrawal' ? '-' : '+'}{money(x.amount)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No transactions yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
      {pages > 1 && <div className="mt-3 flex items-center justify-end gap-2 text-sm"><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button><span>{page + 1} / {pages}</span><Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</Button></div>}
    </div>
  );
}

```

### `src/pages/Partner.tsx`

```tsx
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Copy, Users, BarChart3, DollarSign, Wallet, Search, Handshake } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@project/components/ui/table';
import { cn } from '@project/components/lib/utils';
import { usePortal } from '../lib/portal';
import { fmt, money } from '../lib/symbols';

const TIERS = [['Bronze', '0 – 50 lots', '$6 / lot'], ['Silver', '50 – 250 lots', '$8 / lot'], ['Gold', '250 – 1,000 lots', '$10 / lot'], ['Platinum', '1,000+ lots', '$12 / lot']];

export default function Partner() {
  const p = usePortal();
  if (!p.ib.joined) {
    return (
      <div>
        <Card className="overflow-hidden">
          <div className="bg-primary p-10 text-primary-foreground">
            <Handshake className="h-10 w-10 opacity-80" />
            <h1 className="mt-4 text-3xl font-extrabold">Become a BIGBULLS Partner</h1>
            <p className="mt-2 max-w-xl opacity-80">Introduce traders and earn up to $12 per lot on every trade they make. Paid daily straight to your wallet.</p>
            <Button size="lg" variant="secondary" className="mt-6 font-bold" onClick={() => { p.joinIb(); toast.success('Welcome to the partner program'); }}>Join IB program</Button>
          </div>
          <div className="grid gap-px bg-border sm:grid-cols-4">{TIERS.map(([n, r, c]) => <div key={n} className="bg-card p-5"><div className="font-extrabold text-primary">{n}</div><div className="text-xs text-muted-foreground">{r}</div><div className="mt-2 font-bold">{c}</div></div>)}</div>
        </Card>
      </div>
    );
  }
  return <Dashboard />;
}

function Dashboard() {
  const p = usePortal();
  const [q, setQ] = useState('');
  const link = `${window.location.origin}/?ref=${p.ib.code}`;
  const lots = p.ib.clients.reduce((a, c) => a + c.lots, 0);
  const available = p.ibEarned - p.ib.paid;
  const tier = lots >= 1000 ? 'Platinum' : lots >= 250 ? 'Gold' : lots >= 50 ? 'Silver' : 'Bronze';
  const chart = useMemo(() => p.ib.clients.map((c) => ({ name: c.name.split(' ')[0], commission: Math.round(c.commission) })), [p.ib.clients]);
  const rows = p.ib.clients.filter((c) => (c.name + c.country).toLowerCase().includes(q.toLowerCase()));
  const copy = () => { navigator.clipboard.writeText(link); toast.success('Link copied'); };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-extrabold tracking-tight">Partner (IB)</h1><p className="mt-1 text-sm text-muted-foreground">Partner code <b className="text-primary">{p.ib.code}</b> · Tier <b className="text-primary">{tier}</b></p></div>
        <Button disabled={available <= 0} onClick={() => { p.withdrawCommission(); toast.success('Commission sent to wallet'); }}><Wallet className="mr-2 h-4 w-4" />Withdraw {money(available)} to wallet</Button>
      </div>
      <Card className="mt-5 flex flex-wrap items-center gap-3 p-4">
        <span className="text-xs font-bold text-muted-foreground">Referral link</span>
        <code className="num flex-1 truncate rounded bg-muted px-3 py-2 text-xs">{link}</code>
        <Button size="sm" variant="outline" onClick={copy}><Copy className="mr-2 h-4 w-4" />Copy</Button>
      </Card>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Users} label="Clients" v={String(p.ib.clients.length)} />
        <Kpi icon={BarChart3} label="Volume (lots)" v={fmt(lots)} />
        <Kpi icon={DollarSign} label="Total earned" v={money(p.ibEarned)} />
        <Kpi icon={Wallet} label="Available" v={money(available)} />
      </div>
      <Card className="mt-4 p-5">
        <div className="mb-3 font-bold">Commission by client</div>
        <div className="h-56"><ResponsiveContainer><BarChart data={chart}><XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} /><YAxis fontSize={11} tickLine={false} axisLine={false} /><Tooltip /><Bar dataKey="commission" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
      </Card>
      <Card className="mt-4 overflow-x-auto">
        <div className="flex items-center justify-between border-b p-4"><span className="font-bold">Referred clients</span>
          <div className="relative w-56"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
        <Table>
          <TableHeader><TableRow><TableHead>Client</TableHead><TableHead>Country</TableHead><TableHead>Joined</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Lots</TableHead><TableHead className="text-right">Commission</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-semibold">{c.name}</TableCell><TableCell>{c.country}</TableCell><TableCell className="text-muted-foreground">{format(c.joined, 'MMM d, yyyy')}</TableCell>
              <TableCell><span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', c.status === 'Active' ? 'bg-[hsl(var(--success)/0.12)] text-up' : 'bg-muted text-muted-foreground')}>{c.status}</span></TableCell>
              <TableCell className="num text-right">{fmt(c.lots)}</TableCell><TableCell className="num text-right font-bold text-up">{money(c.commission)}</TableCell>
            </TableRow>))}</TableBody>
        </Table>
      </Card>
    </div>
  );
}

const Kpi = ({ icon: I, label, v }: { icon: typeof Users; label: string; v: string }) => (
  <Card className="p-5"><I className="h-5 w-5 text-primary" /><div className="mt-3 text-xs font-semibold text-muted-foreground">{label}</div><div className="num mt-1 text-2xl font-extrabold">{v}</div></Card>
);

```

### `src/pages/ProfilePage.tsx`

```tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useAuth } from 'zitejs/auth';
import { Card } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Switch } from '@project/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { cn } from '@project/components/lib/utils';
import { usePortal, COUNTRIES, Profile as P } from '../lib/portal';

const schema = z.object({
  firstName: z.string().min(2, 'Required'), lastName: z.string().min(2, 'Required'),
  phone: z.string().regex(/^\+?[0-9 ]{8,16}$/, 'Enter a valid phone number'),
  country: z.string().min(1), dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  city: z.string().min(2, 'Required'), address: z.string().min(5, 'Required'), postal: z.string().min(3, 'Required'),
});

const TABS = ['Personal info', 'Security', 'Trading terminal', 'Notifications'] as const;

export default function ProfilePage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Personal info');
  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Settings</h1>
      <div className="mb-6 mt-5 flex gap-6 overflow-x-auto border-b">
        {TABS.map((x) => <button key={x} onClick={() => setTab(x)} className={cn('-mb-px whitespace-nowrap border-b-2 pb-3 text-sm font-bold', tab === x ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}>{x}</button>)}
      </div>
      {tab === 'Personal info' && <PersonalInfo />}
      {tab === 'Security' && <Security />}
      {tab === 'Trading terminal' && <Prefs kind="terminal" />}
      {tab === 'Notifications' && <Prefs kind="notify" />}
    </div>
  );
}

function PersonalInfo() {
  const p = usePortal(); const { user } = useAuth();
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<P>({ resolver: zodResolver(schema), defaultValues: p.profile });
  const F = (name: keyof P, label: string, ph?: string) => (
    <label key={name} className="block text-xs font-semibold">{label}
      <Input className={cn('mt-1', errors[name] && 'border-destructive')} placeholder={ph} {...register(name)} />
      {errors[name] && <span className="mt-1 block text-xs text-destructive">{errors[name]?.message}</span>}
    </label>
  );
  return (
    <Card className="max-w-2xl p-6">
      <form onSubmit={handleSubmit((v) => { p.saveProfile(v); toast.success('Profile saved'); })} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 text-xs font-semibold">Email<div className="mt-1 rounded-md border bg-muted px-3 py-2 text-sm">{user?.email}</div></div>
        {F('firstName', 'First name')}{F('lastName', 'Last name')}
        {F('phone', 'Phone', '+92 300 1234567')}{F('dob', 'Date of birth', '1995-06-21')}
        <label className="block text-xs font-semibold">Country
          <Select value={watch('country')} onValueChange={(v) => setValue('country', v)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
        </label>
        {F('city', 'City')}<div className="sm:col-span-2">{F('address', 'Street address')}</div>{F('postal', 'Postal code')}
        <div className="sm:col-span-2"><Button type="submit">Save changes</Button></div>
      </form>
    </Card>
  );
}

function Security() {
  const p = usePortal(); const { user } = useAuth();
  return (
    <div className="max-w-2xl space-y-3">
      <Row title="Sign-in method" desc={`One-time code sent to ${user?.email}`} />
      <Row title="Two-step verification" desc="Require a code for withdrawals and security changes"><Switch checked={p.twoFA} onCheckedChange={(v) => { p.setTwoFA(v); toast.success(v ? '2-step enabled' : '2-step disabled'); }} /></Row>
      <Row title="Active session" desc={`This device · ${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'} browser`} />
    </div>
  );
}

function Prefs({ kind }: { kind: 'terminal' | 'notify' }) {
  const p = usePortal();
  const items = kind === 'terminal'
    ? ([['oneClick', 'One-click trading', 'Open orders instantly without confirmation'], ['confirmClose', 'Confirm on close', 'Ask before closing a position'], ['sounds', 'Trade sounds', 'Play a sound when orders fill']] as const)
    : ([['email', 'Email notifications', 'Deposits, withdrawals and account updates'], ['push', 'Browser notifications', 'Margin calls and order fills'], ['news', 'Market news & offers', 'Analysis, promotions and BIGBULLS news']] as const);
  return (
    <div className="max-w-2xl space-y-3">
      {items.map(([k, t, d]) => (
        <Row key={k} title={t} desc={d}>
          <Switch checked={kind === 'terminal' ? p.terminal[k as keyof typeof p.terminal] : p.notify[k as keyof typeof p.notify]}
            onCheckedChange={(v) => (kind === 'terminal' ? p.setTerminal(k as keyof typeof p.terminal, v) : p.setNotify(k as keyof typeof p.notify, v))} />
        </Row>
      ))}
    </div>
  );
}

const Row = ({ title, desc, children }: { title: string; desc: string; children?: React.ReactNode }) => (
  <Card className="flex items-center gap-4 p-5"><div className="flex-1"><div className="font-bold">{title}</div><div className="text-xs text-muted-foreground">{desc}</div></div>{children}</Card>
);

```

### `src/pages/Support.tsx`

```tsx
import { useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { MessageSquare, Plus } from 'lucide-react';
import { Card } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@project/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { cn } from '@project/components/lib/utils';
import { usePortal } from '../lib/portal';

const FAQ = [
  ['How long do withdrawals take?', 'Most withdrawals are processed instantly and automatically. Bank transfers may take 1–3 business hours.'],
  ['Why do I need to verify my account?', 'Regulations require us to confirm your identity and residence. Fully verified clients have no deposit limits and can withdraw at any time.'],
  ['What is the difference between account types?', 'Standard has no commission. Pro offers instant execution. Raw Spread and Zero offer the tightest spreads with a small commission per lot.'],
  ['How do I change my leverage?', 'Go to My accounts, open the ⋮ menu on an account and choose Change leverage.'],
  ['How does the partner program work?', 'Share your referral link. You earn a commission for every lot your referred clients trade, credited to your wallet.'],
];
const CATS = ['Deposits & withdrawals', 'Verification', 'Trading', 'Partner program', 'Other'];

export default function Support() {
  const p = usePortal();
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-extrabold tracking-tight">Help center</h1><p className="mt-1 text-sm text-muted-foreground">Support is available 24/7.</p></div>
        <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />New request</Button>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5"><div className="mb-2 font-bold">Frequently asked questions</div>
          <Accordion type="single" collapsible>{FAQ.map(([q, a]) => <AccordionItem key={q} value={q}><AccordionTrigger className="text-left text-sm">{q}</AccordionTrigger><AccordionContent className="text-sm text-muted-foreground">{a}</AccordionContent></AccordionItem>)}</Accordion>
        </Card>
        <Card><div className="border-b p-5 font-bold">My requests</div>
          {p.tickets.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No support requests yet</p>}
          {p.tickets.map((t) => (
            <div key={t.id} className="flex items-start gap-3 border-b p-4 last:border-0">
              <MessageSquare className="mt-0.5 h-4 w-4 text-primary" />
              <div className="min-w-0 flex-1"><div className="font-semibold">{t.subject}</div><div className="text-xs text-muted-foreground">{t.category} · {format(t.time, 'MMM d, HH:mm')}</div><p className="mt-1 line-clamp-2 text-sm">{t.message}</p></div>
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', t.status === 'Closed' ? 'bg-muted text-muted-foreground' : 'bg-accent text-primary')}>{t.status}</span>
              {t.status !== 'Closed' && <Button size="sm" variant="ghost" onClick={() => p.closeTicket(t.id)}>Close</Button>}
            </div>
          ))}
        </Card>
      </div>
      <NewTicket open={open} onOpenChange={setOpen} />
    </div>
  );
}

function NewTicket({ open, onOpenChange }: { open: boolean; onOpenChange: (b: boolean) => void }) {
  const p = usePortal();
  const [subject, setSubject] = useState(''); const [category, setCategory] = useState(CATS[0]); const [message, setMessage] = useState('');
  const [tried, setTried] = useState(false);
  const bad = subject.trim().length < 4 || message.trim().length < 10;
  const submit = () => { setTried(true); if (bad) return; p.createTicket({ subject, category, message }); toast.success('Request sent'); setSubject(''); setMessage(''); setTried(false); onOpenChange(false); };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New support request</DialogTitle></DialogHeader>
        <Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
        <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <Textarea rows={5} placeholder="Describe your issue" value={message} onChange={(e) => setMessage(e.target.value)} />
        {tried && bad && <p className="text-xs text-destructive">Add a subject (4+ characters) and a message (10+ characters).</p>}
        <DialogFooter><Button onClick={submit}>Send</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

```

### `src/pages/Terminal.tsx`

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Button } from '@project/components/ui/button';
import { cn } from '@project/components/lib/utils';
import Watchlist from '../components/Watchlist';
import PriceChart from '../components/PriceChart';
import OrderPanel from '../components/OrderPanel';
import PositionsPanel from '../components/PositionsPanel';
import Logo from '../components/Logo';
import { useTrading } from '../lib/store';
import { money } from '../lib/symbols';

export default function Terminal() {
  const t = useTrading();
  const [symbol, setSymbol] = useState('EURUSD');
  const [tabs, setTabs] = useState(['EURUSD', 'XAUUSD', 'BTCUSD']);
  const select = (s: string) => { setSymbol(s); if (!tabs.includes(s)) setTabs((x) => [...x.slice(-4), s]); };

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground" aria-label="Back"><ArrowLeft className="h-5 w-5" /></Link>
        <Logo />
        <div className="ml-2 hidden gap-1 md:flex">
          {tabs.map((s) => (
            <button key={s} onClick={() => setSymbol(s)} className={cn('rounded-md px-3 py-1.5 text-xs font-bold', s === symbol ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted')}>{s}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-4">
          <Stat k="Balance" v={money(t.account.balance)} />
          <Stat k="Equity" v={money(t.equity)} />
          <Stat k="Margin" v={money(t.margin)} className="hidden lg:block" />
          <Stat k="Free margin" v={money(t.free)} className="hidden lg:block" />
          <Stat k="Margin level" v={t.margin ? `${t.level.toFixed(0)}%` : '—'} className="hidden xl:block" />
          <Select value={t.account.id} onValueChange={t.setActive}>
            <SelectTrigger className="h-9 w-auto gap-2 font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {t.state.accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <span className={cn('mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold', a.type === 'Real' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>{a.type}</span>#{a.number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild size="sm" className="hidden sm:inline-flex"><Link to="/deposit">Deposit</Link></Button>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_1fr_300px]">
        <aside className="hidden min-h-0 border-r bg-card lg:block"><Watchlist selected={symbol} onSelect={select} /></aside>
        <main className="grid min-h-0 grid-rows-[1fr_260px]">
          <div className="min-h-[320px] bg-card"><PriceChart symbol={symbol} /></div>
          <div className="min-h-0 border-t bg-card"><PositionsPanel /></div>
        </main>
        <aside className="min-h-0 border-l bg-card"><OrderPanel symbol={symbol} /></aside>
      </div>
      <div className="h-[45vh] border-t bg-card lg:hidden"><Watchlist selected={symbol} onSelect={select} /></div>
    </div>
  );
}

const Stat = ({ k, v, className }: { k: string; v: string; className?: string }) => (
  <div className={cn('text-right', className)}><div className="text-[10px] font-semibold uppercase text-muted-foreground">{k}</div><div className="num text-sm font-bold">{v}</div></div>
);

```

### `src/pages/TradeHistory.tsx`

```tsx
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Search } from 'lucide-react';
import { Card } from '@project/components/ui/card';
import { Input } from '@project/components/ui/input';
import { Button } from '@project/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@project/components/ui/table';
import { cn } from '@project/components/lib/utils';
import { useTrading } from '../lib/store';
import { SYM, money } from '../lib/symbols';

const PAGE = 20;

export default function TradeHistory() {
  const t = useTrading();
  const [acc, setAcc] = useState('all'); const [q, setQ] = useState(''); const [page, setPage] = useState(0);
  const accNo = (id: string) => t.state.accounts.find((a) => a.id === id)?.number ?? '—';
  const rows = useMemo(() => t.state.history
    .filter((h) => (acc === 'all' || h.accountId === acc) && h.symbol.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.closeTime - a.closeTime), [t.state.history, acc, q]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const total = rows.reduce((s, r) => s + r.profit, 0);

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Trade history</h1>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Select value={acc} onValueChange={(v) => { setAcc(v); setPage(0); }}><SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All accounts</SelectItem>{t.state.accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.type} #{a.number}</SelectItem>)}</SelectContent></Select>
        <div className="relative w-full sm:w-56"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" placeholder="Symbol" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /></div>
        <div className="ml-auto text-sm">Net result: <b className={cn('num', total >= 0 ? 'text-up' : 'text-destructive')}>{money(total)}</b></div>
      </div>
      <Card className="mt-4 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>{['Closed', 'Account', 'Symbol', 'Type', 'Volume', 'Open', 'Close', 'Reason', 'Profit'].map((h) => <TableHead key={h} className={h === 'Profit' ? 'text-right' : ''}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {rows.slice(page * PAGE, page * PAGE + PAGE).map((r) => {
              const d = SYM[r.symbol].digits;
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground">{format(r.closeTime, 'MMM d, HH:mm')}</TableCell><TableCell>#{accNo(r.accountId)}</TableCell>
                  <TableCell className="font-bold">{r.symbol}</TableCell><TableCell className={cn('font-bold', r.side === 'buy' ? 'text-primary' : 'text-destructive')}>{r.side.toUpperCase()}</TableCell>
                  <TableCell className="num">{r.volume}</TableCell><TableCell className="num">{r.openPrice.toFixed(d)}</TableCell><TableCell className="num">{r.closePrice.toFixed(d)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.reason}</TableCell>
                  <TableCell className={cn('num text-right font-bold', r.profit >= 0 ? 'text-up' : 'text-destructive')}>{money(r.profit)}</TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">No closed trades yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
      {pages > 1 && <div className="mt-3 flex items-center justify-end gap-2 text-sm"><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button><span>{page + 1} / {pages}</span><Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</Button></div>}
    </div>
  );
}

```

### `src/pages/Transfer.tsx`

```tsx
import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown } from 'lucide-react';
import { Card } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { useTrading } from '../lib/store';
import { money } from '../lib/symbols';

export default function Transfer() {
  const t = useTrading();
  const real = t.state.accounts.filter((a) => a.type === 'Real');
  const [from, setFrom] = useState(real[0]?.id ?? ''); const [to, setTo] = useState(real[1]?.id ?? '');
  const [amount, setAmount] = useState('');
  const src = real.find((a) => a.id === from); const n = Number(amount);
  const err = !amount ? '' : !(n > 0) ? 'Enter a valid amount' : src && n > src.balance ? 'Insufficient balance' : from === to ? 'Choose two different accounts' : '';
  const Pick = ({ v, set, label }: { v: string; set: (s: string) => void; label: string }) => (
    <label className="block text-xs font-semibold">{label}
      <Select value={v} onValueChange={set}><SelectTrigger className="mt-1 h-11"><SelectValue placeholder="Select account" /></SelectTrigger>
        <SelectContent>{real.map((a) => <SelectItem key={a.id} value={a.id}>#{a.number} · {a.kind} · {money(a.balance)}</SelectItem>)}</SelectContent></Select>
    </label>
  );
  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Transfer</h1>
      <p className="mt-1 text-sm text-muted-foreground">Move funds instantly between your Real accounts.</p>
      <Card className="mt-6 max-w-md space-y-4 p-6">
        {real.length < 2 ? <p className="text-sm text-muted-foreground">You need at least two Real accounts to transfer funds.</p> : <>
          <Pick v={from} set={setFrom} label="From" />
          <div className="flex justify-center"><ArrowDown className="h-5 w-5 text-primary" /></div>
          <Pick v={to} set={setTo} label="To" />
          <label className="block text-xs font-semibold">Amount (USD)
            <Input className="num mt-1 h-11" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            {err && <span className="mt-1 block text-xs text-destructive">{err}</span>}
          </label>
          <Button className="h-11 w-full font-bold" disabled={!n || !!err || !to} onClick={() => { t.transfer(from, to, n); toast.success(`${money(n)} transferred`); setAmount(''); }}>Transfer</Button>
        </>}
      </Card>
    </div>
  );
}

```

### `src/pages/Verification.tsx`

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle2, Clock, Mail, Phone, User, IdCard, Home, Upload, ShieldCheck, Loader2, XCircle } from 'lucide-react';
import { useUpload } from 'zitejs/upload';
import { Card } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Progress } from '@project/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { cn } from '@project/components/lib/utils';
import { usePortal, KycStatus, KycStep } from '../lib/portal';

const STEPS: { key: KycStep; title: string; desc: string; icon: typeof Mail }[] = [
  { key: 'email', title: 'Email address', desc: 'Confirmed at sign-in', icon: Mail },
  { key: 'phone', title: 'Phone number', desc: 'Add your mobile number in your profile', icon: Phone },
  { key: 'profile', title: 'Profile details', desc: 'Name, date of birth and address', icon: User },
  { key: 'identity', title: 'Identity verification', desc: 'CNIC, passport or driving licence', icon: IdCard },
  { key: 'address', title: 'Proof of residence', desc: 'Utility bill or bank statement, last 6 months', icon: Home },
];

export default function Verification() {
  const p = usePortal();
  const done = STEPS.filter((s) => p.kyc[s.key] === 'Verified').length;
  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Verification</h1>
      <p className="mt-1 text-sm text-muted-foreground">Complete verification to unlock deposits without limits and withdrawals.</p>
      <Card className="mt-6 flex flex-wrap items-center gap-5 p-5">
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-full', p.verified ? 'bg-[hsl(var(--success)/0.12)] text-up' : 'bg-accent text-primary')}><ShieldCheck className="h-6 w-6" /></div>
        <div className="flex-1">
          <div className="font-extrabold">{p.level}</div>
          <div className="text-xs text-muted-foreground">{p.verified ? 'All features unlocked' : 'Deposit limit $2,000 · Withdrawals locked until fully verified'}</div>
          <Progress value={(done / STEPS.length) * 100} className="mt-2 h-2" />
        </div>
        <div className="num text-sm font-bold">{done}/{STEPS.length}</div>
      </Card>
      <div className="mt-4 space-y-3">
        {STEPS.map((s) => <StepCard key={s.key} step={s} status={p.kyc[s.key]} />)}
      </div>
    </div>
  );
}

function Badge({ status }: { status: KycStatus }) {
  const map = { Verified: ['bg-[hsl(var(--success)/0.12)] text-up', CheckCircle2], 'Under review': ['bg-accent text-primary', Clock], Rejected: ['bg-destructive/10 text-destructive', XCircle], 'Not started': ['bg-muted text-muted-foreground', Clock] } as const;
  const [cls, Icon] = map[status];
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold', cls)}><Icon className="h-3.5 w-3.5" />{status}</span>;
}

function StepCard({ step, status }: { step: (typeof STEPS)[number]; status: KycStatus }) {
  const p = usePortal(); const { upload, isUploading } = useUpload();
  const [docType, setDocType] = useState(step.key === 'identity' ? 'CNIC' : 'Utility bill');
  const isDoc = step.key === 'identity' || step.key === 'address';
  const locked = isDoc && p.kyc.profile !== 'Verified';

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { const { url } = await upload(f); p.submitDoc(step.key as 'identity' | 'address', url, docType); toast.success('Document submitted for review'); }
    catch { toast.error('Upload failed, please try again'); }
  };

  return (
    <Card className="flex flex-wrap items-center gap-4 p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary"><step.icon className="h-5 w-5" /></div>
      <div className="min-w-[180px] flex-1"><div className="font-bold">{step.title}</div><div className="text-xs text-muted-foreground">{step.desc}</div></div>
      <Badge status={status} />
      {(step.key === 'phone' || step.key === 'profile') && status !== 'Verified' && <Button asChild size="sm"><Link to="/profile">Complete</Link></Button>}
      {isDoc && status !== 'Verified' && status !== 'Under review' && (
        locked ? <span className="text-xs text-muted-foreground">Complete profile first</span> : (
          <div className="flex items-center gap-2">
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{(step.key === 'identity' ? ['CNIC', 'Passport', 'Driving licence'] : ['Utility bill', 'Bank statement', 'Tax document']).map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" asChild disabled={isUploading}>
              <label className="cursor-pointer">{isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Upload<input type="file" accept="image/*,.pdf" className="hidden" onChange={onFile} disabled={isUploading} /></label>
            </Button>
          </div>
        )
      )}
    </Card>
  );
}

```

### `src/pages/WalletPage.tsx`

```tsx
import { useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Wallet as WalletIcon, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Card } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { cn } from '@project/components/lib/utils';
import { useTrading } from '../lib/store';
import { usePortal } from '../lib/portal';
import { money } from '../lib/symbols';

export default function WalletPage() {
  const t = useTrading(); const p = usePortal();
  const real = t.state.accounts.filter((a) => a.type === 'Real');
  const [dir, setDir] = useState<'to' | 'from'>('to');
  const [acc, setAcc] = useState(real[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const n = Number(amount); const a = real.find((x) => x.id === acc);
  const max = dir === 'to' ? p.wallet : a?.balance ?? 0;
  const err = !amount ? '' : !(n > 0) ? 'Enter a valid amount' : n > max ? 'Insufficient funds' : '';

  const go = () => {
    if (!a || !n || err) return;
    if (dir === 'to') { p.walletDebit(`To account #${a.number}`, n); t.walletMove(a.id, n); }
    else { t.walletMove(a.id, -n); p.walletCredit(`From account #${a.number}`, n); }
    toast.success('Transfer completed'); setAmount('');
  };

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Wallet</h1>
      <p className="mt-1 text-sm text-muted-foreground">Your BIGBULLS wallet holds funds outside trading accounts — commissions, bonuses and transfers.</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card className="relative overflow-hidden bg-primary p-6 text-primary-foreground">
            <WalletIcon className="absolute -right-4 -top-4 h-32 w-32 opacity-10" />
            <div className="text-sm font-semibold opacity-80">Wallet balance</div>
            <div className="num mt-2 text-4xl font-extrabold">{money(p.wallet)}</div>
            <div className="mt-1 text-xs opacity-70">USD · Main wallet</div>
          </Card>
          <Card>
            <div className="border-b px-5 py-3 font-bold">Wallet activity</div>
            {p.walletTxns.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No wallet activity yet</p>}
            {p.walletTxns.slice(0, 30).map((x) => (
              <div key={x.id} className="flex items-center gap-3 border-b px-5 py-3 last:border-0">
                <div className={cn('flex h-9 w-9 items-center justify-center rounded-full', x.type === 'Credit' ? 'bg-[hsl(var(--success)/0.12)] text-up' : 'bg-destructive/10 text-destructive')}>
                  {x.type === 'Credit' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                </div>
                <div className="flex-1"><div className="text-sm font-semibold">{x.note}</div><div className="text-xs text-muted-foreground">{format(x.time, 'MMM d, yyyy HH:mm')}</div></div>
                <div className={cn('num font-bold', x.type === 'Credit' ? 'text-up' : 'text-destructive')}>{x.type === 'Credit' ? '+' : '-'}{money(x.amount)}</div>
              </div>
            ))}
          </Card>
        </div>
        <Card className="h-fit space-y-4 p-5">
          <div className="grid grid-cols-2 rounded-lg bg-muted p-1">
            {(['to', 'from'] as const).map((d) => <button key={d} onClick={() => setDir(d)} className={cn('rounded-md py-2 text-xs font-bold', dir === d ? 'bg-card shadow-sm' : 'text-muted-foreground')}>{d === 'to' ? 'Wallet → Account' : 'Account → Wallet'}</button>)}
          </div>
          {real.length === 0 ? <p className="text-sm text-muted-foreground">Open a Real account to move funds.</p> : <>
            <label className="block text-xs font-semibold">Trading account
              <Select value={acc} onValueChange={setAcc}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{real.map((x) => <SelectItem key={x.id} value={x.id}>#{x.number} · {money(x.balance)}</SelectItem>)}</SelectContent></Select>
            </label>
            <label className="block text-xs font-semibold">Amount (USD)
              <Input className="num mt-1 h-11" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
              <span className={cn('mt-1 block text-xs', err ? 'text-destructive' : 'text-muted-foreground')}>{err || `Available: ${money(max)}`}</span>
            </label>
            <Button className="h-11 w-full font-bold" disabled={!n || !!err} onClick={go}>Transfer</Button>
          </>}
        </Card>
      </div>
    </div>
  );
}

```
