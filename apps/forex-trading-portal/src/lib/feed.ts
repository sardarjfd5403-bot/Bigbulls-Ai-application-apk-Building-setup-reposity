import { SYM, SYMBOLS } from './symbols';
import { supabase } from './supabase';

export type Quote = { bid: number; ask: number; open: number; high: number; low: number; dir: 1 | -1 | 0; stale?: boolean; quoteTime?: number };
export type Quotes = Record<string, Quote>;

const providerName = (symbol: string) => ({
  EURUSD:'EUR/USD',GBPUSD:'GBP/USD',USDJPY:'USD/JPY',USDCAD:'USD/CAD',
  AUDUSD:'AUD/USD',NZDUSD:'NZD/USD',USDCHF:'USD/CHF',EURGBP:'EUR/GBP',
  EURJPY:'EUR/JPY',GBPJPY:'GBP/JPY',XAUUSD:'XAU/USD',XAGUSD:'XAG/USD',
  XPTUSD:'XPT/USD',XPDUSD:'XPD/USD',US30:'US30',USTEC:'NDX',US500:'SPX500',
  DE30:'GER40',UK100:'UK100',JP225:'JPN225',USOIL:'WTI/USD',UKOIL:'UKOIL',
  NATGAS:'NATGAS',BTCUSD:'BTCUSDT',ETHUSD:'ETHUSDT',SOLUSD:'SOLUSDT',
  XRPUSD:'XRPUSDT',BNBUSD:'BNBUSDT'
} as Record<string,string>)[symbol] || symbol;

export function initialQuotes(): Quotes {
  const q: Quotes = {};
  for (const s of SYMBOLS) {
    const mid = s.start;
    q[s.symbol] = { bid: mid, ask: mid + s.spread, open: mid, high: mid, low: mid, dir: 0, stale: true };
  }
  return q;
}

export function subscribePrices(onTick: (fn: (prev: Quotes) => Quotes) => void) {
  let active = true;
  const seenQuoteTime = new Map<string, number>();
  const symbols = SYMBOLS.map(s => providerName(s.symbol));
  const refresh = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('market-data', { body: { action: 'quotes', symbols } });
      if (error) throw error;
      const rows = Array.isArray(data?.quotes) ? data.quotes : [];
      if (!active) return;
      onTick(prev => {
        const next = { ...prev };
        let changed = false;
        for (const row of rows) {
          const entry = SYMBOLS.find(s => providerName(s.symbol) === row.symbol);
          if (!entry || !(Number(row.bid) > 0) || !(Number(row.ask) >= Number(row.bid))) continue;
          const old = prev[entry.symbol];
          const bid = Number(row.bid), ask = Number(row.ask);
          const quoteTime = Date.parse(String(row.quote_time || row.updated_at || ''));
          const lastTime = seenQuoteTime.get(entry.symbol) || 0;
          if (Number.isFinite(quoteTime) && quoteTime > 0 && quoteTime < lastTime) continue;
          if (Number.isFinite(quoteTime) && quoteTime > 0) seenQuoteTime.set(entry.symbol, quoteTime);
          if (old.bid === bid && old.ask === ask && old.stale === (row.stale === true || row.fallback === true)) continue;
          changed = true;
          next[entry.symbol] = {
            ...old, bid, ask, high: Math.max(old.high, bid), low: Math.min(old.low, bid),
            dir: bid > old.bid ? 1 : bid < old.bid ? -1 : 0,
            stale: row.stale === true || row.fallback === true,
            quoteTime: Number.isFinite(quoteTime) && quoteTime > 0 ? quoteTime : old.quoteTime
          };
        }
        return changed ? next : prev;
      });
    } catch (e) {
      console.warn('BIGBULLS live market feed unavailable; retaining last quote.', e);
    }
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const poll = async () => {
    await refresh();
    if (active) timer = setTimeout(poll, 5000);
  };
  void poll();
  return () => { active = false; if (timer) clearTimeout(timer); };
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

export async function fetchCandles(symbol: string, timeframe: string, outputsize = 500) {
  const { data, error } = await supabase.functions.invoke('market-data', {
    body: { action: 'candles', symbol: providerName(symbol), timeframe, outputsize }
  });
  if (error) throw error;
  const rows = Array.isArray(data?.candles) ? data.candles : [];
  return rows.map((c: any) => ({
    t: Math.floor(new Date(c.time).getTime() / 1000),
    o: Number(c.open), h: Number(c.high), l: Number(c.low), c: Number(c.close),
    v: Number(c.volume ?? 0), tv: Number(c.tickVolume ?? 0)
  })).filter((c: any) => Number.isFinite(c.t) && [c.o,c.h,c.l,c.c].every(Number.isFinite));
}

/** No synthetic/random candle generator is used in the production terminal. */
export function candleHistory() { return []; }
