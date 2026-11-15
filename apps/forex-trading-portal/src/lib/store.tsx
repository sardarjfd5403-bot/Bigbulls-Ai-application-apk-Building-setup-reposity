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
