import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Check, ChevronDown, Crosshair, Activity, Radio, Minus, Plus } from 'lucide-react';
import { Input } from '@project/components/ui/input';
import { Button } from '@project/components/ui/button';
import { pnl, useTrading, Position } from '../lib/store';
import { fetchCandles, initialQuotes } from '../lib/feed';
import { SYM, money } from '../lib/symbols';
import { cn } from '@project/components/lib/utils';

const TIMEFRAMES = ['1m','5m','15m','30m','1h','4h','1d','1w','1M'];
const INDICATORS = [
  { id:'EMA', label:'EMA 20', detail:'Exponential moving average', color:'#F59E0B' },
  { id:'SMA', label:'SMA 20', detail:'Simple moving average', color:'#2563EB' },
  { id:'BB', label:'Bollinger Bands', detail:'20 period · 2 deviations', color:'#8B5CF6' },
  { id:'VOL', label:'Volume', detail:'Provider-reported volume', color:'#94A3B8' },
  { id:'RSI', label:'RSI 14', detail:'Relative strength index', color:'#0D9488' },
] as const;
type IndicatorId = typeof INDICATORS[number]['id'];
type Candle = { t:number; o:number; h:number; l:number; c:number; v?:number; tv?:number };
type Zoom = { x:number; y:number; panX:number; panY:number };
type Point = { x:number; y:number };
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const ema=(values:number[],period:number)=>{const out:(number|null)[]=Array(values.length).fill(null);if(!values.length)return out;const k=2/(period+1);let prev=values[0];out[0]=prev;for(let i=1;i<values.length;i++){prev=values[i]*k+prev*(1-k);out[i]=prev;}return out;};
const sma=(values:number[],period:number)=>values.map((_,i)=>i+1<period?null:values.slice(i-period+1,i+1).reduce((a,b)=>a+b,0)/period);
const bollinger=(values:number[],period=20)=>{const mid=sma(values,period);return {mid,upper:mid.map((v,i)=>v===null?null:v+2*Math.sqrt(values.slice(i-period+1,i+1).reduce((a,b)=>a+(b-v)**2,0)/period)),lower:mid.map((v,i)=>v===null?null:v-2*Math.sqrt(values.slice(i-period+1,i+1).reduce((a,b)=>a+(b-v)**2,0)/period))};};
const rsi=(values:number[],period=14)=>{const out:number[]=Array(values.length).fill(50);let gain=0,loss=0;for(let i=1;i<values.length;i++){const d=values[i]-values[i-1];if(i<=period){gain+=Math.max(d,0);loss+=Math.max(-d,0);if(i===period){gain/=period;loss/=period;}}else{gain=(gain*(period-1)+Math.max(d,0))/period;loss=(loss*(period-1)+Math.max(-d,0))/period;}if(i>=period)out[i]=loss===0?100:100-100/(1+gain/loss);}return out;};
const linePath=(values:(number|null)[],xAt:(i:number)=>number,yAt:(v:number)=>number)=>values.map((v,i)=>v===null?'':(i===0||values[i-1]===null?'M':'L')+xAt(i).toFixed(2)+','+yAt(v).toFixed(2)).filter(Boolean).join(' ');

export default function PriceChart({ symbol, onOpenSymbols }: { symbol:string; onOpenSymbols?:()=>void }) {
  const t=useTrading(); const quotes=t.quotes??initialQuotes(); const quote=quotes[symbol]??initialQuotes()[symbol]??initialQuotes().EURUSD;
  const info=SYM[symbol]??SYM.EURUSD; const bid=Number.isFinite(quote.bid)?quote.bid:info.start; const ask=Number.isFinite(quote.ask)?quote.ask:bid+info.spread;
  const [tf,setTf]=useState('15m'); const [candles,setCandles]=useState<Candle[]>([]);
  const [zoom,setZoom]=useState<Zoom>({x:1,y:1,panX:0,panY:0}); const [cross,setCross]=useState(false);
  const [crossAt,setCrossAt]=useState<Point|null>(null); const [indicators,setIndicators]=useState<IndicatorId[]>(['EMA','SMA']);
  const [showIndicators,setShowIndicators]=useState(false); const [selected,setSelected]=useState<Position|null>(null);
  const [sl,setSl]=useState(''); const [tp,setTp]=useState(''); const [crossTime,setCrossTime]=useState<number|null>(null);
  const [size,setSize]=useState({w:800,h:440}); const [auto,setAuto]=useState(true); const [followLive,setFollowLive]=useState(true);
  const ref=useRef<HTMLDivElement>(null); const pointers=useRef(new Map<number,Point>());
  const drag=useRef<{point:Point;start:Zoom}|null>(null); const gesture=useRef<{distance:number;start:Zoom}|null>(null);
  const positions=t.positions.filter(p=>p.accountId===t.account.id&&p.symbol===symbol);
  const pending=t.pending.filter(p=>p.accountId===t.account.id&&p.symbol===symbol);

  useEffect(()=>{let active=true;let retry:ReturnType<typeof setTimeout>|undefined;const load=async(attempt=0)=>{try{const rows=await fetchCandles(symbol,tf,500);if(active&&rows.length){setCandles(rows as Candle[]);}else if(active&&attempt<2)retry=setTimeout(()=>void load(attempt+1),1200*(attempt+1));}catch(e){if(active&&attempt<2)retry=setTimeout(()=>void load(attempt+1),1200*(attempt+1));else if(active)console.warn('BIGBULLS OHLC request failed',e);}};void load();return()=>{active=false;if(retry)clearTimeout(retry);};},[symbol,tf]);
  useEffect(()=>{setZoom({x:1,y:1,panX:0,panY:0});setAuto(true);setFollowLive(true);setCrossAt(null);setCrossTime(null);setSelected(null);},[symbol,tf]);
  useEffect(()=>{setCandles(old=>{if(!old.length)return old;const now=Math.floor(Date.now()/1000);const seconds=({ '1m':60,'5m':300,'15m':900,'30m':1800,'1h':3600,'4h':14400,'1d':86400,'1w':604800,'1M':2592000 } as Record<string,number>)[tf]||900;const bucket=Math.floor(now/seconds)*seconds;const last=old[old.length-1];if(bucket>last.t)return [...old.slice(-499),{t:bucket,o:last.c,h:Math.max(last.c,bid),l:Math.min(last.c,bid),c:bid,v:0}];return [...old.slice(0,-1),{...last,c:bid,h:Math.max(last.h,bid),l:Math.min(last.l,bid)}];});},[bid,tf]);
  useEffect(()=>{const el=ref.current;if(!el)return;const ro=new ResizeObserver(entries=>{const e=entries[0];if(e)setSize({w:e.contentRect.width,h:e.contentRect.height});});ro.observe(el);return()=>ro.disconnect();},[]);
  const closes=candles.map(c=>c.c);const ema20=useMemo(()=>ema(closes,20),[candles]);const sma20=useMemo(()=>sma(closes,20),[candles]);const bb=useMemo(()=>bollinger(closes),[candles]);const rsi14=useMemo(()=>rsi(closes),[candles]);
  const axisW=66, topPad=94, bottomPad=indicators.includes('RSI')?82:indicators.includes('VOL')?62:34;
  const W=Math.max(100,size.w-axisW), H=Math.max(90,size.h-bottomPad);
  const count=Math.max(candles.length,1);const visible=Math.max(12,count/zoom.x);const center=count-1-(visible-1)/2+zoom.panX*count;const first=center-visible/2;const cw=W/visible;
  const xAt=(i:number)=>(i-first+.5)*cw;const xToIndex=(x:number)=>clamp(Math.round(x/Math.max(cw,1)+first-.5),0,Math.max(0,count-1));
  const visibleCandles=candles.filter((c,i)=>xAt(i)>=-cw&&xAt(i)<=W+cw);
  const lo=Math.min(bid,...visibleCandles.map(c=>c.l),...positions.flatMap(p=>[p.openPrice,p.sl??Infinity,p.tp??Infinity]).filter(Number.isFinite));
  const hi=Math.max(ask,...visibleCandles.map(c=>c.h),...positions.flatMap(p=>[p.openPrice,p.sl??-Infinity,p.tp??-Infinity]).filter(Number.isFinite));
  const raw=Math.max(hi-lo,Math.pow(10,-info.digits)*10);const baseMin=lo-raw*.08,baseMax=hi+raw*.08;
  const mid=(baseMin+baseMax)/2+zoom.panY*(baseMax-baseMin);const span=(baseMax-baseMin)/zoom.y;const min=auto?baseMin:mid-span/2;const max=auto?baseMax:mid+span/2;
  const plotTop=topPad,plotBottom=H-12,plotH=Math.max(60,plotBottom-plotTop);const yAt=(v:number)=>plotBottom-(v-min)/(max-min)*plotH;
  const ticks=Array.from({length:6},(_,i)=>min+(max-min)*(i+.5)/6);
  const toggleIndicator=(id:IndicatorId)=>setIndicators(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);
  const wheel=(e:React.WheelEvent<HTMLDivElement>)=>{e.preventDefault();const rect=ref.current?.getBoundingClientRect();if(!rect)return;const axis=e.clientX-rect.left>W;const factor=Math.exp(-e.deltaY*.0015);setAuto(false);setZoom(z=>axis?{...z,y:clamp(z.y*factor,.35,14)}:{...z,x:clamp(z.x*factor,.35,14)});};
  const pointerDown=(e:React.PointerEvent<HTMLDivElement>)=>{if((e.target as HTMLElement).closest('button,input'))return;e.currentTarget.setPointerCapture(e.pointerId);const p={x:e.clientX,y:e.clientY};pointers.current.set(e.pointerId,p);if(pointers.current.size===2){const [a,b]=Array.from(pointers.current.values());gesture.current={distance:Math.hypot(a.x-b.x,a.y-b.y),start:zoom};drag.current=null;}else drag.current={point:p,start:zoom};};
  const pointerMove=(e:React.PointerEvent<HTMLDivElement>)=>{const rect=ref.current?.getBoundingClientRect();if(!rect)return;const p={x:e.clientX,y:e.clientY};if(cross){const localX=clamp(p.x-rect.left,0,W);const i=xToIndex(localX);setCrossAt({x:localX,y:clamp(p.y-rect.top,plotTop,plotBottom)});setCrossTime(candles[i]?.t??null);return;}if(!pointers.current.has(e.pointerId))return;pointers.current.set(e.pointerId,p);if(pointers.current.size===2&&gesture.current){const [a,b]=Array.from(pointers.current.values());const dist=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y));setAuto(false);setZoom({...gesture.current.start,x:clamp(gesture.current.start.x*dist/Math.max(1,gesture.current.distance),.35,14),y:clamp(gesture.current.start.y*dist/Math.max(1,gesture.current.distance),.35,14)});}else if(drag.current){const dx=p.x-drag.current.point.x,dy=p.y-drag.current.point.y;setFollowLive(false);setAuto(false);setZoom({...drag.current.start,panX:drag.current.start.panX-dx/Math.max(W,1)/drag.current.start.x,panY:drag.current.start.panY+dy/Math.max(H,1)/drag.current.start.y});}};
  const pointerUp=(e:React.PointerEvent<HTMLDivElement>)=>{pointers.current.delete(e.pointerId);if(pointers.current.size<2)gesture.current=null;if(!pointers.current.size)drag.current=null;};
  const zoomBars=(factor:number)=>{setFollowLive(false);setZoom(z=>({...z,x:clamp(z.x*factor,.35,14)}));};
  const zoomPrice=(factor:number)=>{setAuto(false);setZoom(z=>({...z,y:clamp(z.y*factor,.35,14)}));};
  const saveSelected=async()=>{if(!selected)return;const sln=sl.trim()===''?undefined:Number(sl);const tpn=tp.trim()===''?undefined:Number(tp);if((sl.trim()!==''&&!Number.isFinite(sln))||(tp.trim()!==''&&!Number.isFinite(tpn)))return;await t.modifyPosition(selected.id,sln,tpn);setSelected(null);};
  const last=candles[candles.length-1];const change=last&&last.o?((bid-last.o)/last.o)*100:0;const crossIndex=crossTime===null?-1:candles.findIndex(c=>c.t===crossTime);const read=crossIndex>=0?candles[crossIndex]:last;const activeCross=crossAt&&crossIndex>=0?{x:xAt(crossIndex),y:crossAt.y}:null;
  const pathFor=(arr:(number|null)[])=>linePath(arr,xAt,yAt);
  return <div className="relative flex h-full min-h-0 min-w-0 flex-col bg-white text-slate-900">
    <div ref={ref} onWheel={wheel} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onPointerLeave={()=>{if(!cross)setCrossAt(null);}} className="relative min-h-0 flex-1 overflow-hidden select-none" style={{touchAction:'none'}}>
      <svg width={size.w} height={size.h} className="absolute inset-0 block">
        {ticks.map(v=><g key={v}><line x1={0} x2={W} y1={yAt(v)} y2={yAt(v)} stroke="#E8EDF4" strokeDasharray="3 4"/><text x={W+5} y={yAt(v)+3} fontSize="9" fill="#64748B">{v.toFixed(info.digits)}</text></g>)}
        {indicators.includes('BB')&&<><path d={pathFor(bb.upper)} fill="none" stroke="#8B5CF6" strokeWidth="1" opacity=".8"/><path d={pathFor(bb.lower)} fill="none" stroke="#8B5CF6" strokeWidth="1" opacity=".8"/></>}
        {indicators.includes('SMA')&&<path d={pathFor(sma20)} fill="none" stroke="#2563EB" strokeWidth="1.4"/>}
        {indicators.includes('EMA')&&<path d={pathFor(ema20)} fill="none" stroke="#F59E0B" strokeWidth="1.4"/>}
        {visibleCandles.map(c=>{const i=candles.indexOf(c);const x=xAt(i);const up=c.c>=c.o;const color=up?'#0D9B72':'#E34D59';return <g key={c.t} stroke={color} fill={color}><line x1={x} x2={x} y1={yAt(c.h)} y2={yAt(c.l)} strokeWidth="1"/><rect x={x-Math.max(1,cw*.32)} y={yAt(Math.max(c.o,c.c))} width={Math.max(1,cw*.64)} height={Math.max(1,Math.abs(yAt(c.o)-yAt(c.c)))} rx=".5"/></g>;})}
        {positions.map(p=>{const val=pnl(p,quotes);const color=p.side==='buy'?'#0066FF':'#E34D59';return <g key={p.id} onClick={()=>{setSelected(p);setSl(p.sl?.toFixed(info.digits)??'');setTp(p.tp?.toFixed(info.digits)??'');}} style={{cursor:'pointer'}}><line x1="0" x2={W} y1={yAt(p.openPrice)} y2={yAt(p.openPrice)} stroke={color} strokeDasharray="5 3" strokeWidth="1.5"/><text x="5" y={yAt(p.openPrice)-5} fontSize="10" fontWeight="700" fill={color}>{p.side.toUpperCase()} {p.volume.toFixed(2)} · {money(val)}</text>{p.sl!=null&&<g><line x1="0" x2={W} y1={yAt(p.sl)} y2={yAt(p.sl)} stroke="#E34D59" strokeDasharray="3 3"/><text x="5" y={yAt(p.sl)-3} fontSize="9" fill="#E34D59">SL {p.sl.toFixed(info.digits)}</text></g>}{p.tp!=null&&<g><line x1="0" x2={W} y1={yAt(p.tp)} y2={yAt(p.tp)} stroke="#0D9B72" strokeDasharray="3 3"/><text x="5" y={yAt(p.tp)-3} fontSize="9" fill="#0D9B72">TP {p.tp.toFixed(info.digits)}</text></g>}</g>;})}
        {pending.map(o=><g key={o.id}><line x1="0" x2={W} y1={yAt(o.price)} y2={yAt(o.price)} stroke="#8B5CF6" strokeDasharray="2 4"/><text x="5" y={yAt(o.price)-4} fontSize="9" fill="#8B5CF6">{o.side.toUpperCase()} {o.kind.toUpperCase()} {o.price.toFixed(info.digits)}</text></g>)}
        <line x1="0" x2={W} y1={yAt(bid)} y2={yAt(bid)} stroke="#0066FF" strokeWidth="1"/><rect x={W} y={yAt(bid)-9} width={axisW-2} height="18" rx="3" fill="#0066FF"/><text x={W+4} y={yAt(bid)+3} fontSize="9" fontWeight="700" fill="white">{bid.toFixed(info.digits)}</text>
        {indicators.includes('VOL')&&<g>{visibleCandles.map(c=>{const i=candles.indexOf(c);const maxV=Math.max(1,...candles.map(x=>x.v??x.tv??0));const v=c.v??c.tv??0;const h=v/maxV*34;return <rect key={c.t} x={xAt(i)-Math.max(1,cw*.3)} y={H-42-h} width={Math.max(1,cw*.6)} height={h} fill={c.c>=c.o?'#0D9B72':'#E34D59'} opacity=".35"/>;})}</g>}
        {indicators.includes('RSI')&&<g><line x1="0" x2={W} y1={H-68} y2={H-68} stroke="#DCE5EF" strokeDasharray="3 3"/><line x1="0" x2={W} y1={H-48} y2={H-48} stroke="#DCE5EF" strokeDasharray="3 3"/><path d={linePath(rsi14.map(v=>H-82+v/100*48),xAt,v=>v)} fill="none" stroke="#0D9488" strokeWidth="1.4"/><text x="5" y={H-70} fontSize="8" fill="#64748B">RSI 70</text><text x="5" y={H-50} fontSize="8" fill="#64748B">RSI 30</text></g>}
        {activeCross&&<g><line x1={activeCross.x} x2={activeCross.x} y1={plotTop} y2={plotBottom} stroke="#64748B" strokeDasharray="3 3"/><line x1="0" x2={W} y1={activeCross.y} y2={activeCross.y} stroke="#64748B" strokeDasharray="3 3"/><circle cx={activeCross.x} cy={activeCross.y} r="3" fill="#0066FF"/></g>}
      </svg>
      <div className="absolute left-2 right-[68px] top-2 z-10 flex flex-col gap-1.5 pointer-events-none">
        <div className="flex items-center justify-between gap-2 pointer-events-auto">
          <button onClick={onOpenSymbols} className="rounded-lg border border-blue-200 bg-white/90 px-2.5 py-1 text-xs font-extrabold text-blue-600 shadow-sm">{symbol} <ChevronDown className="inline h-3 w-3"/></button>
          <div className="flex gap-1">
            <button onClick={()=>{setCross(v=>!v);setCrossAt(null);setCrossIndex(null);}} className={cn('rounded-lg border px-2 py-1 text-[10px] font-bold shadow-sm',cross?'border-blue-300 bg-blue-50 text-blue-700':'border-slate-200 bg-white/90 text-slate-700')}><Crosshair className="mr-1 inline h-3 w-3"/>Cross</button>
            <button onClick={()=>setShowIndicators(true)} className="rounded-lg border border-slate-200 bg-white/90 px-2 py-1 text-[10px] font-bold text-slate-700 shadow-sm"><Activity className="mr-1 inline h-3 w-3"/>fx Indicators <span className="ml-1 rounded-full bg-blue-600 px-1.5 text-[9px] text-white">{indicators.length}</span></button>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto pointer-events-auto">{TIMEFRAMES.map(x=><button key={x} onClick={()=>setTf(x)} className={cn('shrink-0 rounded-md border px-2 py-1 text-[9px] font-extrabold',tf===x?'border-blue-600 bg-blue-600 text-white':'border-slate-200 bg-white/90 text-slate-600')}>{x}</button>)}</div>
        <div className="flex items-center gap-2 self-start rounded-md border border-slate-200/80 bg-white/85 px-2 py-1 text-[9px] font-bold text-slate-500 shadow-sm">
          {read?<><span>O:<b className="ml-0.5 text-slate-900">{read.o.toFixed(info.digits)}</b></span><span>H:<b className="ml-0.5 text-slate-900">{read.h.toFixed(info.digits)}</b></span><span>L:<b className="ml-0.5 text-slate-900">{read.l.toFixed(info.digits)}</b></span><span>C:<b className="ml-0.5 text-slate-900">{read.c.toFixed(info.digits)}</b></span><span className={change>=0?'text-emerald-600':'text-red-500'}>{change>=0?'+':''}{change.toFixed(2)}%</span></>:<span>Loading OHLC…</span>}
        </div>
        <div className="flex gap-1 overflow-x-auto pointer-events-auto">{indicators.map(id=>{const x=INDICATORS.find(v=>v.id===id)!;return <span key={id} className="rounded-full border border-slate-200 bg-white/85 px-2 py-0.5 text-[8px] font-extrabold text-slate-700"><i className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{background:x.color}}/>{x.label}</span>;})}</div>
      </div>
      <div className="absolute bottom-3 left-2 right-[68px] z-10 flex items-center justify-between gap-1 pointer-events-none">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white/90 p-1 shadow-sm pointer-events-auto"><span className="px-1 text-[8px] font-extrabold text-slate-500">Bars</span><button onClick={()=>zoomBars(1.2)} className="rounded bg-slate-100 p-1"><Minus className="h-3 w-3"/></button><button onClick={()=>zoomBars(.83)} className="rounded bg-slate-100 p-1"><Plus className="h-3 w-3"/></button></div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white/90 p-1 shadow-sm pointer-events-auto"><span className="px-1 text-[8px] font-extrabold text-slate-500">Price</span><button onClick={()=>zoomPrice(1.2)} className="rounded bg-slate-100 p-1"><Minus className="h-3 w-3"/></button><button onClick={()=>zoomPrice(.83)} className="rounded bg-slate-100 p-1"><Plus className="h-3 w-3"/></button></div>
        <button onClick={()=>{setAuto(true);setZoom(z=>({...z,y:1,panY:0}));}} className={cn('rounded-lg border px-2 py-1 text-[9px] font-extrabold shadow-sm pointer-events-auto',auto?'border-blue-600 bg-blue-600 text-white':'border-slate-200 bg-white/90 text-blue-600')}>Auto</button>
        <button onClick={()=>{setFollowLive(true);setZoom(z=>({...z,panX:0}));}} className={cn('rounded-lg border px-2 py-1 text-[9px] font-extrabold shadow-sm pointer-events-auto',followLive?'border-emerald-600 bg-emerald-600 text-white':'border-slate-200 bg-white/90 text-emerald-700')}><Radio className="inline h-3 w-3"/> Live</button>
      </div>
    </div>
    {selected&&<div className="flex shrink-0 items-center gap-2 border-t-2 border-blue-600 bg-white px-2 py-2">
      <div className="min-w-0 flex-1 text-[10px] font-extrabold text-blue-600">Modify {selected.side.toUpperCase()} {selected.volume.toFixed(2)} {selected.symbol}</div>
      <label className="flex h-8 min-w-0 items-center gap-1 rounded-md bg-slate-100 px-2 text-[9px] font-bold text-slate-500">SL<Input className="h-6 w-[74px] border-0 bg-transparent p-0 text-right text-[10px] font-bold" value={sl} onChange={e=>setSl(e.target.value)}/></label>
      <label className="flex h-8 min-w-0 items-center gap-1 rounded-md bg-slate-100 px-2 text-[9px] font-bold text-slate-500">TP<Input className="h-6 w-[74px] border-0 bg-transparent p-0 text-right text-[10px] font-bold" value={tp} onChange={e=>setTp(e.target.value)}/></label>
      <Button size="sm" className="h-8 px-2 text-[10px]" onClick={()=>void saveSelected()} disabled={t.busy}><Check className="mr-1 h-3 w-3"/>Save</Button>
      <button onClick={()=>setSelected(null)} className="rounded-md p-1 text-slate-500"><X className="h-4 w-4"/></button>
    </div>}
    {showIndicators&&<div className="absolute inset-0 z-30 flex items-end bg-slate-950/40" onClick={()=>setShowIndicators(false)}><div className="w-full rounded-t-2xl bg-white p-4 shadow-2xl" onClick={e=>e.stopPropagation()}><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-extrabold text-slate-900">Chart Indicators</h3><button onClick={()=>setShowIndicators(false)} className="rounded-full bg-slate-100 p-1"><X className="h-4 w-4"/></button></div>{INDICATORS.map(x=><button key={x.id} onClick={()=>toggleIndicator(x.id)} className="mb-2 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-left"><span><b className="block text-xs text-slate-900">{x.label}</b><small className="text-[10px] text-slate-500">{x.detail}</small></span><span className={cn('rounded-lg px-3 py-1 text-[10px] font-bold',indicators.includes(x.id)?'bg-blue-600 text-white':'bg-blue-50 text-blue-700')}>{indicators.includes(x.id)?'Added':'Add'}</span></button>)}<Button className="mt-1 w-full" onClick={()=>setShowIndicators(false)}>Done</Button></div></div>}
  </div>;
}
