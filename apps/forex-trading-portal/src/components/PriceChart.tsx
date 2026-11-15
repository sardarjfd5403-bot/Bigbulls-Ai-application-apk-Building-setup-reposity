import { useEffect, useMemo, useRef, useState } from 'react';
import { useTrading } from '../lib/store';
import { fetchCandles } from '../lib/feed';
import { SYM } from '../lib/symbols';
import { cn } from '@project/components/lib/utils';

const TFS: [string, number][] = [['1m', 60], ['5m', 300], ['15m', 900], ['1h', 3600], ['4h', 14400], ['1D', 86400]];
const TF_API: Record<number,string> = {60:'1m',300:'5m',900:'15m',3600:'1h',14400:'4h',86400:'1d'};
type Candle = { t: number; o: number; h: number; l: number; c: number };
type ChartSize = { w: number; h: number };

export default function PriceChart({ symbol }: { symbol: string }) {
  const trading = useTrading();
  const info = SYM?.[symbol] ?? SYM?.EURUSD;
  const quote = trading?.quotes?.[symbol] ?? { bid: info?.start ?? 1, ask: (info?.start ?? 1) + (info?.spread ?? 0) };
  const bid = Number.isFinite(Number(quote?.bid)) ? Number(quote.bid) : (info?.start ?? 1);
  const digits = Number.isFinite(Number(info?.digits)) ? Number(info.digits) : 5;
  const positions = Array.isArray(trading?.positions) ? trading.positions : [];
  const [tf, setTf] = useState(900);
  const [candles, setCandles] = useState<Candle[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<ChartSize>({ w: 0, h: 0 });

  useEffect(() => {
    let live = true;
    setCandles([]);
    fetchCandles(symbol, TF_API[tf] || '15m', 300)
      .then((rows) => {
        if (!live || !Array.isArray(rows)) return;
        const safeRows = rows.filter((row: any) =>
          row && [row.t, row.o, row.h, row.l, row.c].every((v: unknown) => Number.isFinite(Number(v)))
        ).map((row: any) => ({ t: Number(row.t), o: Number(row.o), h: Number(row.h), l: Number(row.l), c: Number(row.c) }));
        setCandles(safeRows);
      })
      .catch((err) => console.warn('Live OHLC unavailable:', err));
    return () => { live = false; };
  }, [symbol, tf]);

  useEffect(() => {
    if (!Number.isFinite(bid) || bid <= 0) return;
    setCandles((current) => {
      if (!Array.isArray(current) || !current.length) return current;
      const last = current[current.length - 1];
      if (!last || !Number.isFinite(last.c)) return current;
      const now = Math.floor(Date.now() / 1000 / tf) * tf;
      if (now > last.t) return [...current.slice(1), { t: now, o: last.c, h: Math.max(last.c, bid), l: Math.min(last.c, bid), c: bid }];
      return [...current.slice(0, -1), { ...last, c: bid, h: Math.max(last.h, bid), l: Math.min(last.l, bid) }];
    });
  }, [bid, tf]);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof window === 'undefined') return;
    let frame = 0;
    const measure = (width?: number, height?: number) => {
      const rect = element.getBoundingClientRect?.();
      const w = Math.max(0, Number(width ?? rect?.width ?? window.innerWidth ?? 0) || 0);
      const h = Math.max(0, Number(height ?? rect?.height ?? window.innerHeight ?? 0) || 0);
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setSize({ w, h }));
    };
    measure();
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver((entries) => {
        const entry = entries?.[0];
        measure(entry?.contentRect?.width, entry?.contentRect?.height);
      });
      observer.observe(element);
    }
    window.addEventListener('resize', measure, { passive: true });
    window.addEventListener('orientationchange', measure, { passive: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const lines = positions.filter((position: any) => position?.symbol === symbol && position?.id);
  const { min, max } = useMemo(() => {
    const valid = (Array.isArray(candles) ? candles : []).filter((c) => c && Number.isFinite(c.h) && Number.isFinite(c.l));
    const highs = valid.map((c) => c.h);
    const lows = valid.map((c) => c.l);
    const mx = Math.max(...highs, bid);
    const mn = Math.min(...lows, bid);
    const pad = (mx - mn) * 0.08 || Math.max(Math.abs(mx) * 0.0005, 0.0001);
    return { min: mn - pad, max: mx + pad };
  }, [candles, bid]);

  const width = Math.max(0, size.w);
  const height = Math.max(0, size.h);
  const axisW = 64;
  const W = Math.max(width - axisW, 1);
  const H = Math.max(height - 24, 1);
  const range = Math.max(max - min, Number.EPSILON);
  const y = (value: number) => H - ((value - min) / range) * H;
  const cw = W / Math.max(candles.length, 1);
  const ticks = Array.from({ length: 6 }, (_, i) => min + (range * (i + 0.5)) / 6);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b px-2 py-1.5">
        {TFS.map(([label, value]) => (
          <button key={label} onClick={() => setTf(value)} className={cn('shrink-0 rounded px-2 py-1 text-xs font-semibold', tf === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>{label}</button>
        ))}
        <span className="ml-auto truncate pl-2 text-xs text-muted-foreground">{info?.name ?? symbol}</span>
      </div>
      <div ref={ref} className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[#0b1220]">
        {width > 0 && height > 0 && (
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="absolute inset-0 block">
            <rect x={0} y={0} width={width} height={height} fill="#0b1220" />
            {Array.from({ length: 9 }, (_, i) => <line key={'v'+i} x1={W*i/8} x2={W*i/8} y1={0} y2={H} stroke="#263449" strokeWidth={0.7} strokeDasharray="2 5" />)}
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={0} x2={W} y1={y(tick)} y2={y(tick)} stroke="#263449" strokeWidth={0.7} strokeDasharray="3 5" />
                <text x={W + 5} y={y(tick) + 4} fill="#9aaac0" fontSize="10">{tick.toFixed(digits)}</text>
              </g>
            ))}
            {candles.map((c, i) => {
              const up = c.c >= c.o;
              const x = i * cw + cw / 2;
              const cls = up ? 'fill-[hsl(var(--success))] stroke-[hsl(var(--success))]' : 'fill-destructive stroke-destructive';
              return <g key={c.t} className={cls}>
                <line x1={x} x2={x} y1={y(c.h)} y2={y(c.l)} strokeWidth={1} />
                <rect x={x - cw * 0.35} width={Math.max(0.5, cw * 0.7)} y={y(Math.max(c.o, c.c))} height={Math.max(1, Math.abs(y(c.o) - y(c.c)))} />
              </g>;
            })}
            {lines.map((position: any) => (
              <g key={position.id}>
                {Number.isFinite(Number(position.openPrice)) && <><line x1={0} x2={W} y1={y(Number(position.openPrice))} y2={y(Number(position.openPrice))} stroke="#60a5fa" strokeWidth={1.2} strokeDasharray="6 4" /><text x={5} y={y(Number(position.openPrice))-5} fill="#93c5fd" fontSize="10">{String(position.side ?? '').toUpperCase()} {Number(position.volume) || 0} · OPEN</text></>}
                {position.sl != null && Number.isFinite(Number(position.sl)) && <><line x1={0} x2={W} y1={y(Number(position.sl))} y2={y(Number(position.sl))} stroke="#fb7185" strokeWidth={1} strokeDasharray="4 3" /><text x={5} y={y(Number(position.sl))-4} fill="#fb7185" fontSize="10">SL {Number(position.sl).toFixed(digits)}</text></>}
                {position.tp != null && Number.isFinite(Number(position.tp)) && <><line x1={0} x2={W} y1={y(Number(position.tp))} y2={y(Number(position.tp))} stroke="#34d399" strokeWidth={1} strokeDasharray="4 3" /><text x={5} y={y(Number(position.tp))-4} fill="#34d399" fontSize="10">TP {Number(position.tp).toFixed(digits)}</text></>}
              </g>
            ))}
            {Number.isFinite(bid) && <><line x1={0} x2={W} y1={y(bid)} y2={y(bid)} stroke="#38bdf8" strokeWidth={1} /><rect x={W} y={y(bid)-10} width={axisW} height={20} fill="#0284c7" rx={3} /><text x={W+5} y={y(bid)+4} fill="#ffffff" fontSize="10" fontWeight="700">{bid.toFixed(digits)}</text></>}
            {Array.from({ length: 5 }, (_, i) => {
              const candle = candles[Math.min(Math.max(candles.length-1, 0), Math.floor(i*Math.max(candles.length-1, 0)/4))];
              const time = Number(candle?.t) > 0 ? Number(candle.t) * 1000 : Date.now();
              return <text key={'time'+i} x={W*i/4+4} y={H+16} fill="#8092aa" fontSize="9">{new Date(time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</text>;
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
