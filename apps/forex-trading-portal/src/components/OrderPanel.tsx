import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Input } from '@project/components/ui/input';
import { Button } from '@project/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@project/components/ui/dialog';
import { cn } from '@project/components/lib/utils';
import { useTrading, Side } from '../lib/store';
import { SYM, money } from '../lib/symbols';
import { initialQuotes } from '../lib/feed';
import AIAutoTradeControl from './AIAutoTradeControl';

type OrderType='Market'|'Limit'|'Stop';
export default function OrderPanel({symbol}:{symbol:string}) {
 const t=useTrading();const s=SYM[symbol]??SYM.EURUSD;const q=t.quotes?.[symbol]??initialQuotes()[symbol]??initialQuotes().EURUSD;
 const [side,setSide]=useState<Side>('buy');const [type,setType]=useState<OrderType>('Market');const [lots,setLots]=useState('0.01');const [price,setPrice]=useState('');const [confirm,setConfirm]=useState<Side|null>(null);
 const volume=Number(lots);const valid=Number.isFinite(volume)&&volume>=0.01&&volume<=200&&Math.round(volume*100)===volume*100;
 const pending=type!=='Market';const quote=side==='buy'?q.ask:q.bid;const target=Number(price);
 const submit=async()=>{const action=confirm;setConfirm(null);if(!action||!valid||t.busy||!t.account.id)return;if(type==='Market'){await t.openPosition({symbol,side:action,volume});return;}if(t.account.type!=='Real'){return;}if(!Number.isFinite(target)||target<=0)return;await t.placePending({symbol,side:action,kind:type,volume,price:target});setPrice('');};
 const step=(n:number)=>setLots(Math.min(200,Math.max(.01,Math.round(((Number(lots)||.01)+n)*100)/100)).toFixed(2));
 return <div className="flex h-full min-w-0 flex-col gap-3 overflow-y-auto bg-white p-3 sm:p-4">
  <div className="flex items-start justify-between"><div><div className="text-base font-extrabold text-slate-900">{symbol}</div><div className="text-[11px] text-slate-500">{s.name}</div></div><div className="text-right"><div className="text-[9px] font-bold uppercase text-slate-400">Spread</div><div className="num text-xs font-bold text-slate-700">{((q.ask-q.bid)/(s.digits>=3?Math.pow(10,-(s.digits-1)):Math.pow(10,-s.digits))).toFixed(1)} pips</div></div></div>
  <AIAutoTradeControl/>
  <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">{(['Market','Limit','Stop'] as OrderType[]).map(x=><button key={x} onClick={()=>setType(x)} className={cn('rounded-lg py-2 text-[11px] font-extrabold',type===x?'bg-white text-blue-600 shadow-sm':'text-slate-500')}>{x}</button>)}</div>
  {pending&&<div className="rounded-lg border border-slate-200 bg-slate-50 p-2"><label className="mb-1 block text-[10px] font-bold text-slate-500">{type} entry price</label><Input value={price} onChange={e=>setPrice(e.target.value)} inputMode="decimal" placeholder={quote.toFixed(s.digits)} className="num h-9 border-0 bg-transparent text-sm font-bold"/></div>}
  <div className="grid grid-cols-[minmax(0,1fr)_94px_minmax(0,1fr)] items-stretch gap-1.5">
   <button type="button" onClick={()=>{setSide('sell');setConfirm('sell');}} className={cn('flex min-w-0 flex-col items-center justify-center rounded-xl border-2 px-1 py-3',side==='sell'?'border-red-500 bg-red-500 text-white':'border-red-200 bg-white text-red-500')}><span className="text-[10px] font-extrabold">SELL</span><span className="num truncate text-sm font-extrabold">{q.bid.toFixed(s.digits)}</span><span className="text-[9px] font-bold opacity-80">BID</span></button>
   <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-1"><span className="mb-1 text-[9px] font-extrabold text-slate-500">LOTS</span><div className="flex w-full items-center gap-0.5"><button onClick={()=>step(-.01)} disabled={!valid||volume<=.01} className="rounded-md bg-white p-1 text-blue-600"><Minus className="h-3 w-3"/></button><Input aria-label="Lots" value={lots} onChange={e=>setLots(e.target.value)} inputMode="decimal" className="num h-8 min-w-0 border-0 bg-transparent px-0 text-center text-xs font-extrabold"/><button onClick={()=>step(.01)} disabled={volume>=200} className="rounded-md bg-white p-1 text-blue-600"><Plus className="h-3 w-3"/></button></div><span className="mt-1 text-[8px] text-slate-400">0.01–200</span></div>
   <button type="button" onClick={()=>{setSide('buy');setConfirm('buy');}} className={cn('flex min-w-0 flex-col items-center justify-center rounded-xl border-2 px-1 py-3',side==='buy'?'border-blue-600 bg-blue-600 text-white':'border-blue-200 bg-white text-blue-600')}><span className="text-[10px] font-extrabold">BUY</span><span className="num truncate text-sm font-extrabold">{q.ask.toFixed(s.digits)}</span><span className="text-[9px] font-bold opacity-80">ASK</span></button>
  </div>
  <div className="text-center text-[10px] text-slate-400">Execution quote · {t.account.type} account · {t.account.number?'#'+t.account.number:'No account selected'}</div>
  {pending&&t.account.type==='Demo'&&<p className="rounded-lg bg-amber-50 px-3 py-2 text-[10px] font-semibold text-amber-700">Pending orders are not enabled in the current Demo paper-execution service. Use Market orders on Demo; Limit/Stop are available on Real B-Book accounts.</p>}
  {!valid&&<p className="text-center text-[10px] font-semibold text-red-500">Enter a lot size from 0.01 to 200, in 0.01 steps.</p>}
  <Dialog open={!!confirm} onOpenChange={open=>{if(!open)setConfirm(null);}}><DialogContent><DialogHeader><DialogTitle>Confirm {confirm?.toUpperCase()} {type} order</DialogTitle><DialogDescription>Review the order details before sending it to the BIGBULLS execution service.</DialogDescription></DialogHeader><div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs"><div className="flex justify-between"><span className="text-slate-500">Account</span><b>{t.account.type} #{t.account.number}</b></div><div className="flex justify-between"><span className="text-slate-500">Instrument</span><b>{symbol}</b></div><div className="flex justify-between"><span className="text-slate-500">Direction / Volume</span><b>{confirm?.toUpperCase()} · {lots} lots</b></div><div className="flex justify-between"><span className="text-slate-500">Reference price</span><b className="num">{pending?target.toFixed(s.digits):quote.toFixed(s.digits)}</b></div><div className="flex justify-between"><span className="text-slate-500">Execution</span><b>{t.account.type==='Real'?'In-house B-Book':'Demo paper engine'}</b></div></div><DialogFooter><Button variant="outline" onClick={()=>setConfirm(null)}>Cancel</Button><Button onClick={()=>void submit()} disabled={t.busy}>Confirm & place</Button></DialogFooter></DialogContent></Dialog>
 </div>;
}
