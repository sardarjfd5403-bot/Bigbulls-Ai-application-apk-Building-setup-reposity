import { useEffect, useMemo, useRef, useState } from 'react';
import { useTrading, Position } from '../lib/store';
import { fetchCandles } from '../lib/feed';
import { SYM, getSymbolInfo } from '../lib/symbols';
import { cn } from '@project/components/lib/utils';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';

const TFS: [string, number][] = [['1m', 60], ['5m', 300], ['15m', 900], ['1h', 3600], ['4h', 14400], ['1D', 86400]];
const TF_API: Record<number,string> = {60:'1m',300:'5m',900:'15m',3600:'1h',14400:'4h',86400:'1d'};
type Candle = { t: number; o: number; h: number; l: number; c: number };
type ChartSize = { w: number; h: number };

export default function PriceChart({ symbol }: { symbol: string }) {
  const trading = useTrading();
  const info = SYM?.[symbol] ?? SYM?.EURUSD;
  const safeInfo = info ?? getSymbolInfo(symbol);
  const quote = trading?.quotes?.[symbol] ?? { bid: safeInfo.start, ask: safeInfo.start + safeInfo.spread };
  const bid = Number.isFinite(Number(quote?.bid)) ? Number(quote.bid) : safeInfo.start;
  const digits = Number.isFinite(Number(safeInfo?.digits)) ? Number(safeInfo.digits) : 5;
  const positions = Array.isArray(trading?.positions) ? trading.positions : [];
  const pending = Array.isArray(trading?.pending) ? trading.pending : [];
  const [tf, setTf] = useState(900);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [visibleCount, setVisibleCount] = useState(120);
  const [ma20, setMa20] = useState(false);
  const [ma50, setMa50] = useState(false);
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [selected, setSelected] = useState<Position | null>(null);
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<ChartSize>({ w: 0, h: 0 });

  useEffect(() => {
    let live = true;
    setCandles([]);
    fetchCandles(symbol, TF_API[tf] || '15m', 500)
      .then((rows) => {
        if (!live || !Array.isArray(rows)) return;
        const safeRows = rows.filter((row: any) => row && [row.t,row.o,row.h,row.l,row.c].every((v: unknown) => Number.isFinite(Number(v))))
          .map((row: any) => ({ t:Number(row.t), o:Number(row.o), h:Number(row.h), l:Number(row.l), c:Number(row.c) }));
        setCandles(safeRows);
      }).catch((err) => console.warn('Live OHLC unavailable:', err));
    return () => { live = false; };
  }, [symbol, tf]);

  useEffect(() => {
    if (!Number.isFinite(bid) || bid <= 0) return;
    setCandles((current) => {
      if (!Array.isArray(current) || !current.length) return current;
      const last = current[current.length - 1];
      if (!last || !Number.isFinite(last.c)) return current;
      const now = Math.floor(Date.now() / 1000 / tf) * tf;
      if (now > last.t) return [...current.slice(1), { t:now, o:last.c, h:Math.max(last.c,bid), l:Math.min(last.c,bid), c:bid }];
      return [...current.slice(0,-1), { ...last, c:bid, h:Math.max(last.h,bid), l:Math.min(last.l,bid) }];
    });
  }, [bid, tf]);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof window === 'undefined') return;
    let frame = 0;
    const measure = (width?: number, height?: number) => {
      const rect = element.getBoundingClientRect?.();
      const w = Math.max(0, Number(width ?? rect?.width ?? 0) || 0);
      const h = Math.max(0, Number(height ?? rect?.height ?? 0) || 0);
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setSize({w,h}));
    };
    measure();
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver((entries) => measure(entries?.[0]?.contentRect?.width, entries?.[0]?.contentRect?.height));
      observer.observe(element);
    }
    const onResize = () => measure();
    window.addEventListener('resize', onResize, {passive:true});
    window.addEventListener('orientationchange', onResize, {passive:true});
    return () => { observer?.disconnect(); window.removeEventListener('resize',onResize); window.removeEventListener('orientationchange',onResize); if(frame)window.cancelAnimationFrame(frame); };
  }, []);

  const lines = positions.filter((p) => p?.symbol === symbol && p?.id);
  const shownCandles = candles.slice(-visibleCount);
  const ma = (period: number) => shownCandles.map((c,i) => {
    const start = Math.max(0, i-period+1);
    const sample = shownCandles.slice(start,i+1);
    return sample.length < period ? null : sample.reduce((sum,x)=>sum+x.c,0)/period;
  });
  const ma20Values = useMemo(() => ma(20), [shownCandles]);
  const ma50Values = useMemo(() => ma(50), [shownCandles]);
  const { min, max } = useMemo(() => {
    const valid = shownCandles.filter(c => c && Number.isFinite(c.h) && Number.isFinite(c.l));
    const prices = [...valid.flatMap(c=>[c.h,c.l]), bid, ...lines.map(p=>Number(p.openPrice)).filter(Number.isFinite)];
    const mx = Math.max(...prices), mn = Math.min(...prices);
    const pad = (mx-mn)*0.1 || Math.max(Math.abs(mx)*0.0005,0.0001);
    return {min:mn-pad,max:mx+pad};
  }, [shownCandles,bid,lines]);
  const width = Math.max(0,size.w), height = Math.max(0,size.h), axisW=64;
  const W=Math.max(width-axisW,1), H=Math.max(height-24,1), range=Math.max(max-min,Number.EPSILON);
  const y=(v:number)=>H-((v-min)/range)*H;
  const cw=W/Math.max(shownCandles.length,1);
  const ticks=Array.from({length:6},(_,i)=>min+(range*(i+0.5))/6);
  const openEdit = (p: Position) => { setSelected(p); setSl(p.sl?.toFixed(digits) ?? ''); setTp(p.tp?.toFixed(digits) ?? ''); };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b px-2 py-1.5">
        {TFS.map(([label,value])=><button key={label} onClick={()=>setTf(value)} className={cn('shrink-0 rounded px-2 py-1 text-xs font-semibold',tf===value?'bg-primary text-primary-foreground':'text-muted-foreground hover:bg-muted')}>{label}</button>)}
        <span className="ml-auto truncate pl-2 text-xs text-muted-foreground">{safeInfo.name ?? symbol}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1 border-b bg-[#101a2b] px-2 py-1 text-white">
        <button className="rounded px-2 py-1 text-xs" onClick={()=>setVisibleCount(v=>Math.max(30,v-30))}>＋ Zoom</button>
        <button className="rounded px-2 py-1 text-xs" onClick={()=>setVisibleCount(v=>Math.min(500,v+30))}>－ Zoom</button>
        <button className={cn('rounded px-2 py-1 text-xs',ma20?'bg-blue-600':'bg-slate-700')} onClick={()=>setMa20(v=>!v)}>MA 20</button>
        <button className={cn('rounded px-2 py-1 text-xs',ma50?'bg-amber-600':'bg-slate-700')} onClick={()=>setMa50(v=>!v)}>MA 50</button>
        <button className="ml-auto rounded bg-slate-700 px-2 py-1 text-xs" onClick={()=>setIndicatorsOpen(v=>!v)}>Indicators ▾</button>
      </div>
      {indicatorsOpen && <div className="flex shrink-0 items-center gap-3 border-b bg-white px-3 py-1.5 text-xs text-slate-800"><label className="flex items-center gap-1"><input type="checkbox" checked={ma20} onChange={e=>setMa20(e.target.checked)}/> Simple MA 20</label><label className="flex items-center gap-1"><input type="checkbox" checked={ma50} onChange={e=>setMa50(e.target.checked)}/> Simple MA 50</label><span className="text-slate-500">Moving averages</span></div>}
      <div ref={ref} className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[#0b1220]">
        {width>0 && height>0 && <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="absolute inset-0 block">
          <rect width={width} height={height} fill="#0b1220"/>
          {Array.from({length:9},(_,i)=><line key={'v'+i} x1={W*i/8} x2={W*i/8} y1={0} y2={H} stroke="#263449" strokeWidth={0.7} strokeDasharray="2 5"/>)}
          {ticks.map(t=><g key={t}><line x1={0} x2={W} y1={y(t)} y2={y(t)} stroke="#263449" strokeWidth={0.7} strokeDasharray="3 5"/><text x={W+5} y={y(t)+4} fill="#9aaac0" fontSize="10">{t.toFixed(digits)}</text></g>)}
          {shownCandles.map((c,i)=>{const up=c.c>=c.o,x=i*cw+cw/2;return <g key={c.t} fill={up?'#22c55e':'#ef4444'} stroke={up?'#22c55e':'#ef4444'}><line x1={x} x2={x} y1={y(c.h)} y2={y(c.l)} strokeWidth={1}/><rect x={x-cw*.35} width={Math.max(.5,cw*.7)} y={y(Math.max(c.o,c.c))} height={Math.max(1,Math.abs(y(c.o)-y(c.c)))}/></g>;})}
          {ma20 && <polyline points={ma20Values.map((v,i)=>v==null?'':`${i*cw+cw/2},${y(v)}`).filter(Boolean).join(' ')} fill="none" stroke="#60a5fa" strokeWidth="1.5"/>}
          {ma50 && <polyline points={ma50Values.map((v,i)=>v==null?'':`${i*cw+cw/2},${y(v)}`).filter(Boolean).join(' ')} fill="none" stroke="#fbbf24" strokeWidth="1.5"/>}
          {lines.map(p=><g key={p.id} onClick={()=>openEdit(p)} style={{cursor:'pointer'}}><line x1={0} x2={W} y1={y(p.openPrice)} y2={y(p.openPrice)} stroke={p.side==='buy'?'#3b82f6':'#ef4444'} strokeWidth={2} strokeDasharray="7 3"/><rect x={4} y={y(p.openPrice)-15} width={145} height={14} rx={3} fill={p.side==='buy'?'#1d4ed8':'#b91c1c'}/><text x={9} y={y(p.openPrice)-5} fill="white" fontSize="10">{p.side.toUpperCase()} {p.volume} · {p.openPrice.toFixed(digits)} · EDIT</text><rect x={0} y={y(p.openPrice)-10} width={W} height={20} fill="transparent"/></g>)}
          {pending.filter(o=>o.symbol===symbol).map(o=><g key={o.id}><line x1={0} x2={W} y1={y(o.price)} y2={y(o.price)} stroke={o.side==='buy'?'#60a5fa':'#f87171'} strokeWidth={1.3} strokeDasharray="2 4"/><text x={5} y={y(o.price)-4} fill={o.side==='buy'?'#93c5fd':'#fca5a5'} fontSize="10">{o.side.toUpperCase()} {o.kind.toUpperCase()} {o.price.toFixed(digits)}</text></g>)}
          <line x1={0} x2={W} y1={y(bid)} y2={y(bid)} stroke="#38bdf8" strokeWidth={1}/><rect x={W} y={y(bid)-10} width={axisW} height={20} fill="#0284c7" rx={3}/><text x={W+5} y={y(bid)+4} fill="white" fontSize="10" fontWeight="700">{bid.toFixed(digits)}</text>
          {Array.from({length:5},(_,i)=>{const c=shownCandles[Math.min(Math.max(shownCandles.length-1,0),Math.floor(i*Math.max(shownCandles.length-1,0)/4))];return <text key={i} x={W*i/4+4} y={H+16} fill="#8092aa" fontSize="9">{new Date(Number(c?.t)>0?Number(c.t)*1000:Date.now()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</text>;})}
        </svg>}
        {lines.length>0 && <div className="absolute bottom-2 left-2 rounded bg-slate-900/80 px-2 py-1 text-[10px] text-white">Tap blue BUY / red SELL line to modify or close trade</div>}
      </div>
      {selected && <Dialog open onOpenChange={(open)=>!open&&setSelected(null)}><DialogContent><DialogHeader><DialogTitle>Modify {selected.side.toUpperCase()} {selected.volume} {selected.symbol}</DialogTitle></DialogHeader><div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold">Stop Loss<Input className="mt-1" value={sl} onChange={e=>setSl(e.target.value)}/></label><label className="text-xs font-semibold">Take Profit<Input className="mt-1" value={tp} onChange={e=>setTp(e.target.value)}/></label></div><DialogFooter><Button variant="outline" onClick={()=>{trading.closePosition(selected.id);setSelected(null);}}>Close trade</Button><Button onClick={()=>{trading.modifyPosition(selected.id,sl?Number(sl):undefined,tp?Number(tp):undefined);setSelected(null);}}>Save changes</Button></DialogFooter></DialogContent></Dialog>}
    </div>
  );
}
