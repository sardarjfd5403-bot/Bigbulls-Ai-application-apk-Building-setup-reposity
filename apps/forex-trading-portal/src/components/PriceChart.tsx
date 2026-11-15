import { useEffect, useMemo, useRef, useState } from 'react';
import { useTrading } from '../lib/store';
import { fetchCandles } from '../lib/feed';
import { SYM } from '../lib/symbols';
import { cn } from '@project/components/lib/utils';

const TFS: [string, number][] = [['1m', 60], ['5m', 300], ['15m', 900], ['1h', 3600], ['4h', 14400], ['1D', 86400]];
const TF_API: Record<number,string> = {60:'1m',300:'5m',900:'15m',3600:'1h',14400:'4h',86400:'1d'};
type Candle = { t: number; o: number; h: number; l: number; c: number };

export default function PriceChart({ symbol }: { symbol: string }) {
  const { quotes, positions } = useTrading();
  const [tf, setTf] = useState(900);
  const [candles, setCandles] = useState<Candle[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 400 });
  const bid = quotes[symbol].bid;
  const d = SYM[symbol].digits;

  useEffect(() => { let live = true; setCandles([]); fetchCandles(symbol, TF_API[tf] || '15m', 300).then(rows => { if (live) setCandles(rows); }).catch(err => console.warn('Live OHLC unavailable:', err)); return () => { live = false; }; }, [symbol, tf]);

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
      <div ref={ref} className="relative min-h-0 flex-1 overflow-hidden bg-[#0b1220]">
        <svg width={size.w} height={size.h} className="absolute inset-0">
          <rect x={0} y={0} width={size.w} height={size.h} fill="#0b1220" />
          {Array.from({ length: 9 }, (_, i) => <line key={'v'+i} x1={W*i/8} x2={W*i/8} y1={0} y2={H} stroke="#263449" strokeWidth={0.7} strokeDasharray="2 5" />)}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={0} x2={W} y1={y(t)} y2={y(t)} stroke="#263449" strokeWidth={0.7} strokeDasharray="3 5" />
              <text x={W + 6} y={y(t) + 4} fill="#9aaac0" fontSize="10" className="num">{t.toFixed(d)}</text>
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
              <line x1={0} x2={W} y1={y(p.openPrice)} y2={y(p.openPrice)} stroke="#60a5fa" strokeWidth={1.2} strokeDasharray="6 4" />
              <text x={5} y={y(p.openPrice) - 5} fill="#93c5fd" fontSize="10" fontWeight="700">{p.side.toUpperCase()} {p.volume} · OPEN</text>
              {p.sl != null && <><line x1={0} x2={W} y1={y(p.sl)} y2={y(p.sl)} stroke="#fb7185" strokeWidth={1} strokeDasharray="4 3" /><text x={5} y={y(p.sl)-4} fill="#fb7185" fontSize="10" fontWeight="700">SL {p.sl.toFixed(d)}</text></>}
              {p.tp != null && <><line x1={0} x2={W} y1={y(p.tp)} y2={y(p.tp)} stroke="#34d399" strokeWidth={1} strokeDasharray="4 3" /><text x={5} y={y(p.tp)-4} fill="#34d399" fontSize="10" fontWeight="700">TP {p.tp.toFixed(d)}</text></>}
            </g>
          ))}
          <line x1={0} x2={W} y1={y(bid)} y2={y(bid)} stroke="#38bdf8" strokeWidth={1} />
          <rect x={W} y={y(bid) - 10} width={axisW} height={20} fill="#0284c7" rx={3} />
          <text x={W + 6} y={y(bid) + 4} fill="#ffffff" className="num" fontSize="10" fontWeight="700">{bid.toFixed(d)}</text>
          {Array.from({ length: 5 }, (_, i) => <text key={'time'+i} x={W*i/4+4} y={H+16} fill="#8092aa" fontSize="9">{new Date((candles[Math.min(candles.length-1, Math.floor(i*(candles.length-1)/4))]?.t || Date.now()/1000)*1000).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</text>)}
        </svg>
      </div>
    </div>
  );
}
