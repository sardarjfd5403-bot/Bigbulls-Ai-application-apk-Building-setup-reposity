import { useEffect, useMemo, useRef, useState } from 'react';
import { pnl, useTrading } from '../lib/store';
import { fetchCandles } from '../lib/feed';
import { SYM, money } from '../lib/symbols';
import { initialQuotes } from '../lib/feed';
import { cn } from '@project/components/lib/utils';

const TFS: [string, number][] = [['1m', 60], ['5m', 300], ['15m', 900], ['1h', 3600], ['4h', 14400], ['1D', 86400]];
const TF_API: Record<number,string> = {60:'1m',300:'5m',900:'15m',3600:'1h',14400:'4h',86400:'1d'};
type Candle = { t: number; o: number; h: number; l: number; c: number };
type Pointer = { x:number; y:number };

export default function PriceChart({ symbol }: { symbol: string }) {
  const trading = useTrading();
  const quotes = trading.quotes ?? initialQuotes();
  const positions = trading.positions ?? [];
  const [tf, setTf] = useState(900);
  const [candles, setCandles] = useState<Candle[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 400 });
  const [zoom, setZoom] = useState({ x: 1, y: 1, panX: 0, panY: 0 });
  const pointers = useRef(new Map<number, Pointer>());
  const gesture = useRef<{distance:number; midpoint:Pointer; startZoom:typeof zoom}|null>(null);
  const drag = useRef<{point:Pointer; startZoom:typeof zoom}|null>(null);
  const info = SYM[symbol] ?? SYM.EURUSD;
  const quote = quotes[symbol] ?? initialQuotes()[symbol] ?? initialQuotes().EURUSD;
  const bid = Number.isFinite(quote?.bid) ? quote.bid : info.start;
  const d = info.digits;

  useEffect(() => { let live = true; let retryTimer:ReturnType<typeof setTimeout>|undefined; setCandles([]); setZoom({x:1,y:1,panX:0,panY:0}); const load=async(attempt=0)=>{try{const rows=await fetchCandles(symbol,TF_API[tf]||'15m',300);if(live&&rows.length)setCandles(rows);else if(live&&attempt<3)retryTimer=setTimeout(()=>void load(attempt+1),1000*(attempt+1));}catch(err){if(live&&attempt<3)retryTimer=setTimeout(()=>void load(attempt+1),1000*(attempt+1));else if(live)console.warn('Live OHLC unavailable after retries:',err);}};void load();return()=>{live=false;if(retryTimer)clearTimeout(retryTimer);}; }, [symbol, tf]);

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
  const { min:baseMin, max:baseMax } = useMemo(() => {
    const hs = candles.map((c) => c.h), ls = candles.map((c) => c.l);
    const mx = Math.max(...hs, bid), mn = Math.min(...ls, bid), pad = (mx - mn) * 0.08 || 1;
    return { min: mn - pad, max: mx + pad };
  }, [candles, bid]);
  const range = baseMax-baseMin;
  const mid=(baseMax+baseMin)/2 + zoom.panY*range;
  const visibleRange=range/zoom.y;
  const min=mid-visibleRange/2, max=mid+visibleRange/2;
  const axisW = 72, W = Math.max(size.w - axisW, 100), H = Math.max(size.h - 24, 100);
  const y = (v: number) => H - ((v - min) / (max - min)) * H;
  const count=Math.max(candles.length,1);
  const visibleCount=Math.max(8,count/zoom.x);
  const center=(count-1)/2+zoom.panX*count;
  const first=center-visibleCount/2;
  const cw=W/visibleCount;
  const xAt=(i:number)=>((i-first)+0.5)*cw;
  const ticks = Array.from({ length: 6 }, (_, i) => min + ((max - min) * (i + 0.5)) / 6);

  const onWheel=(e:React.WheelEvent<HTMLDivElement>)=>{
    e.preventDefault();
    const rect=ref.current?.getBoundingClientRect(); if(!rect)return;
    const overAxis=e.clientX-rect.left>W;
    const factor=Math.exp(-e.deltaY*0.0015);
    setZoom(z=>overAxis?{...z,y:Math.min(12,Math.max(0.5,z.y*factor))}:{...z,x:Math.min(12,Math.max(0.5,z.x*factor)),y:Math.min(12,Math.max(0.5,z.y*factor))});
  };
  const onPointerDown=(e:React.PointerEvent<HTMLDivElement>)=>{
    e.currentTarget.setPointerCapture(e.pointerId);
    const p={x:e.clientX,y:e.clientY}; pointers.current.set(e.pointerId,p);
    if(pointers.current.size===2){
      const [a,b]=Array.from(pointers.current.values());
      gesture.current={distance:Math.hypot(a.x-b.x,a.y-b.y),midpoint:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},startZoom:zoom}; drag.current=null;
    }else drag.current={point:p,startZoom:zoom};
  };
  const onPointerMove=(e:React.PointerEvent<HTMLDivElement>)=>{
    if(!pointers.current.has(e.pointerId))return;
    pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.current.size===2&&gesture.current){
      const [a,b]=Array.from(pointers.current.values()); const dist=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y));
      const start=gesture.current; const factor=dist/Math.max(1,start.distance);
      setZoom({...start.startZoom,x:Math.min(12,Math.max(0.5,start.startZoom.x*factor)),y:Math.min(12,Math.max(0.5,start.startZoom.y*factor))});
    }else if(drag.current){
      const dx=e.clientX-drag.current.point.x,dy=e.clientY-drag.current.point.y, start=drag.current.startZoom;
      setZoom({...start,panX:start.panX-dx/Math.max(W,1)/start.x,panY:start.panY+dy/Math.max(H,1)/start.y});
    }
  };
  const onPointerUp=(e:React.PointerEvent<HTMLDivElement>)=>{
    pointers.current.delete(e.pointerId);
    if(pointers.current.size<2)gesture.current=null;
    if(pointers.current.size===0)drag.current=null;
  };

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b px-2 py-1.5">
        {TFS.map(([l, v]) => (
          <button key={l} onClick={() => setTf(v)} className={cn('shrink-0 rounded px-2 py-1 text-xs font-semibold', tf === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>{l}</button>
        ))}
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">{info.name}</span>
      </div>
      <div ref={ref} onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} className="relative min-h-0 flex-1 overflow-hidden select-none" style={{touchAction:'none'}}>
        <svg width={size.w} height={size.h} className="absolute inset-0 block">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={0} x2={W} y1={y(t)} y2={y(t)} className="stroke-border" strokeDasharray="2 4" />
              <text x={W + 6} y={y(t) + 4} className="num fill-muted-foreground text-[10px]">{t.toFixed(d)}</text>
            </g>
          ))}
          {candles.map((c, i) => {
            const x=xAt(i); if(x < -cw || x > W+cw)return null;
            const up = c.c >= c.o; const cls = up ? 'fill-[hsl(var(--success))] stroke-[hsl(var(--success))]' : 'fill-destructive stroke-destructive';
            return (
              <g key={c.t} className={cls}>
                <line x1={x} x2={x} y1={y(c.h)} y2={y(c.l)} strokeWidth={1} />
                <rect x={x - Math.max(1,cw*0.35)} width={Math.max(1,cw*0.7)} y={y(Math.max(c.o, c.c))} height={Math.max(1, Math.abs(y(c.o) - y(c.c)))} />
              </g>
            );
          })}
          {lines.map((p) => {
            const tradePnl = pnl(p, quotes);
            const sideClass = p.side === 'buy' ? 'stroke-primary' : 'stroke-destructive';
            const labelClass = p.side === 'buy' ? 'fill-primary' : 'fill-destructive';
            return (
              <g key={p.id}>
                <line x1={0} x2={W} y1={y(p.openPrice)} y2={y(p.openPrice)} className={sideClass} strokeDasharray="5 3" strokeWidth={1.25} />
                <text x={4} y={y(p.openPrice) - 5} className={cn(labelClass, 'text-[10px] font-semibold')}>
                  {p.side.toUpperCase()} @ {p.openPrice.toFixed(d)} · {money(tradePnl)}
                </text>
              </g>
            );
          })}
          <line x1={0} x2={W} y1={y(bid)} y2={y(bid)} className="stroke-primary" strokeWidth={0.75} />
          <rect x={W} y={y(bid) - 9} width={axisW} height={18} className="fill-primary" rx={3} />
          <text x={W + 6} y={y(bid) + 4} className="num fill-primary-foreground text-[10px] font-semibold">{bid.toFixed(d)}</text>
        </svg>
      </div>
    </div>
  );
}
