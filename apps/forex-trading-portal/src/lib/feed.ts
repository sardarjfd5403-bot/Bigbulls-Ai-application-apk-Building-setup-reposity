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
