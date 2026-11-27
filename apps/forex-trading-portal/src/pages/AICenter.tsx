import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Activity, AlertTriangle, Bot, ExternalLink, Newspaper, RefreshCw, ShieldCheck } from 'lucide-react';
import { Card } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import AIAutoTradeControl from '../components/AIAutoTradeControl';
import { useTrading } from '../lib/store';
import { supabase } from '../lib/supabase';
import { money } from '../lib/symbols';

type Signal={id:string;symbol:string;direction:string;score:number;generated_at:string;expires_at:string;signal_data:any};
type EventItem={id:string;timestamp:number;currency:string;impact:string;title:string;forecast:string;previous:string;actual:string;status:string};
type ActivityItem={id:string;symbol:string;direction:string;status:string;reason:string;quantity:number|null;risk_amount:number|null;created_at:string};
const calendarUrl='https://showmytrades.com/tools/economic-calendar';

export default function AICenter(){
 const t=useTrading();
 const [signals,setSignals]=useState<Signal[]>([]);
 const [events,setEvents]=useState<EventItem[]>([]);
 const [activity,setActivity]=useState<ActivityItem[]>([]);
 const [signalError,setSignalError]=useState('');
 const [newsError,setNewsError]=useState('');
 const [activityError,setActivityError]=useState('');
 const [refreshing,setRefreshing]=useState(false);
 const realAccounts=t.state.accounts.filter(a=>a.type==='Real');

 const loadSignals=useCallback(async()=>{
  const {data,error}=await supabase.from('bb_market_signal_feed').select('id,symbol,direction,score,signal_data,generated_at,expires_at')
   .eq('published',true).gt('expires_at',new Date().toISOString()).order('generated_at',{ascending:false}).limit(12);
  if(error){setSignalError(error.message);return;}
  setSignalError('');setSignals((data||[]) as Signal[]);
 },[]);
 const loadNews=useCallback(async()=>{
  const {data,error}=await supabase.functions.invoke('economic-calendar',{body:{}});
  if(error){setNewsError(error.message||'Economic calendar unavailable');return;}
  setNewsError('');setEvents(Array.isArray(data?.events)?data.events:[]);
 },[]);
 const loadActivity=useCallback(async()=>{
  if(!t.account.id||t.account.type!=='Real'){setActivity([]);setActivityError('Select a Real account to view AI execution activity.');return;}
  const {data,error}=await supabase.functions.invoke('ai-client-activity',{body:{account_id:t.account.id}});
  if(error){setActivityError(error.message||'AI activity unavailable');return;}
  setActivityError('');setActivity(Array.isArray(data?.activity)?data.activity:[]);
 },[t.account.id,t.account.type]);
 const refreshAll=useCallback(async()=>{
  setRefreshing(true);
  try{await Promise.all([loadSignals(),loadNews(),loadActivity()]);}
  finally{setRefreshing(false);}
 },[loadSignals,loadNews,loadActivity]);

 useEffect(()=>{
  void loadSignals();
  const channel=supabase.channel('bb-ai-signal-feed').on('postgres_changes',{event:'*',schema:'public',table:'bb_market_signal_feed'},()=>void loadSignals()).subscribe();
  const timer=window.setInterval(()=>void loadSignals(),30000);
  return()=>{window.clearInterval(timer);void supabase.removeChannel(channel);};
 },[loadSignals]);
 useEffect(()=>{void loadNews();const timer=window.setInterval(()=>void loadNews(),5*60*1000);return()=>window.clearInterval(timer);},[loadNews]);
 useEffect(()=>{void loadActivity();const timer=window.setInterval(()=>void loadActivity(),30000);return()=>window.clearInterval(timer);},[loadActivity]);

 const sortedEvents=useMemo(()=>events.filter(e=>Number.isFinite(Number(e.timestamp))).sort((a,b)=>a.timestamp-b.timestamp).slice(0,18),[events]);
 const accountLabel=t.account.type==='Real'?'Real #'+t.account.number:'Demo #'+t.account.number;
 return <div className="space-y-5">
  <div className="flex flex-wrap items-end justify-between gap-3">
   <div><h1 className="text-3xl font-extrabold tracking-tight">AI Centre</h1><p className="mt-1 text-sm text-muted-foreground">Live market signals, automated execution and economic news.</p></div>
   <Button variant="outline" onClick={()=>void refreshAll()} disabled={refreshing}><RefreshCw className={'mr-2 h-4 w-4 '+(refreshing?'animate-spin':'')}/>{refreshing?'Refreshing…':'Refresh data'}</Button>
  </div>
  <Card className="space-y-3 p-5">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="flex items-center gap-2 font-bold"><Bot className="h-5 w-5 text-primary"/>AI Auto-Execution</div>
    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><ShieldCheck className="h-4 w-4"/>Server-side risk controls</div>
   </div>
   <div className="grid gap-3 sm:grid-cols-2">
    <div><div className="mb-1 text-xs font-semibold text-muted-foreground">Execution account</div>
     <Select value={t.account.type==='Real'?t.account.id:''} onValueChange={t.setActive}>
      <SelectTrigger className="h-10"><SelectValue placeholder="Select an approved Real account"/></SelectTrigger>
      <SelectContent>{realAccounts.map(a=><SelectItem key={a.id} value={a.id}>Real #{a.number} · {money(a.balance)}</SelectItem>)}</SelectContent>
     </Select>
    </div>
    <div className="flex items-end"><AIAutoTradeControl/></div>
   </div>
   <p className="text-xs leading-5 text-muted-foreground">When enabled and platform readiness checks pass, the scheduled AI executor evaluates fresh published signals, validates current executable quotes, equity, margin, daily loss and aggregate risk, then submits eligible orders through the in-house B-Book gateway. KYC and platform safety controls remain enforced.</p>
  </Card>
  <section className="space-y-3">
   <div className="flex items-center justify-between"><div><h2 className="text-lg font-extrabold">AI market signals</h2><p className="text-xs text-muted-foreground">Twelve Data candles with macro-event confluence.</p></div><span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold">{signals.length} active</span></div>
   {signalError&&<Card className="p-4 text-sm text-destructive">{signalError}</Card>}
   {signals.length===0&&!signalError&&<Card className="p-8 text-center text-sm text-muted-foreground">No published signals are available. Approved KYC is required to view the client signal feed; new scans publish on the scheduled cycle.</Card>}
   <div className="grid gap-3 md:grid-cols-2">
    {signals.map(s=>{
     const d=s.signal_data||{},buy=s.direction==='BUY',wait=s.direction==='WAIT',digits=Number(d.digits)||5;
     const price=(v:any)=>Number.isFinite(Number(v))&&v!==null?Number(v).toFixed(digits):'—';
     return <Card key={s.id} className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-2"><div><div className="font-extrabold">{s.symbol}</div><div className="text-xs text-muted-foreground">{d.category||'Market'} · {d.setup_status||'AI setup'}</div></div>
       <span className={'rounded-full px-2.5 py-1 text-xs font-extrabold '+(wait?'bg-accent text-muted-foreground':buy?'bg-emerald-500/10 text-emerald-600':'bg-red-500/10 text-red-600')}>{s.direction}</span>
      </div>
      <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Signal score</span><b>{Number(s.score)||0}/100</b></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{width:String(Math.max(0,Math.min(100,Number(s.score)||0)))+'%'}}/></div>
      <div className="grid grid-cols-2 gap-2 text-xs">
       <Metric label="Market price" value={price(d.price)}/><Metric label="News bias" value={d.news_bias||'—'}/>
       <Metric label="Entry range" value={d.entry_low==null?'—':price(d.entry_low)+' – '+price(d.entry_high)}/>
       <Metric label="Stop loss" value={price(d.stop_loss)}/><Metric label="Take profit" value={price(d.take_profit)}/><Metric label="Data status" value={d.data_status||'—'}/>
      </div>
      <div className="text-[11px] text-muted-foreground">Updated {s.generated_at?format(new Date(s.generated_at),'MMM d, HH:mm:ss'):'—'} · Expires {s.expires_at?format(new Date(s.expires_at),'HH:mm'):'—'} UTC</div>
      {Array.isArray(d.reasons)&&d.reasons.length>0&&<p className="border-t pt-2 text-xs leading-5 text-muted-foreground">{d.reasons.slice(0,2).join(' ')}</p>}
     </Card>;
    })}
   </div>
  </section>
  <section className="space-y-3">
   <div className="flex items-center justify-between gap-2"><div><h2 className="text-lg font-extrabold">AI execution activity</h2><p className="text-xs text-muted-foreground">{accountLabel} · refreshes every 30 seconds</p></div><Activity className="h-5 w-5 text-primary"/></div>
   {activityError&&<Card className="p-4 text-xs text-muted-foreground">{activityError}</Card>}
   <Card className="overflow-hidden">
    {activity.length===0?<div className="p-8 text-center text-sm text-muted-foreground">No AI execution attempts recorded for this account yet.</div>:
     <div className="divide-y">{activity.map(x=><div key={x.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0"><div className="flex items-center gap-2 font-bold">{x.symbol}<span className={x.direction==='BUY'?'text-xs text-emerald-600':'text-xs text-red-600'}>{x.direction}</span><span className="rounded bg-accent px-2 py-0.5 text-[10px] font-bold">{x.status}</span></div><p className="mt-1 max-w-xl text-xs text-muted-foreground">{x.reason||'Execution status updated'}</p></div>
      <div className="text-right text-xs text-muted-foreground"><div>{x.quantity?String(x.quantity)+' lots':''}{x.risk_amount?' · Risk '+money(x.risk_amount):''}</div><div>{x.created_at?format(new Date(x.created_at),'MMM d, HH:mm:ss'):''}</div></div>
     </div>)}</div>}
   </Card>
  </section>
  <section className="space-y-3">
   <div className="flex items-center justify-between gap-2"><div><h2 className="text-lg font-extrabold">Forex news & economic calendar</h2><p className="text-xs text-muted-foreground">Scheduled macro releases and actual-versus-forecast updates.</p></div><Newspaper className="h-5 w-5 text-primary"/></div>
   {newsError&&<Card className="p-4 text-sm text-muted-foreground"><AlertTriangle className="mr-2 inline h-4 w-4"/>{newsError}</Card>}
   <Card className="overflow-hidden">
    {sortedEvents.length===0?<div className="p-8 text-center text-sm text-muted-foreground">No calendar events loaded.</div>:
     <div className="divide-y">{sortedEvents.map(e=><div key={e.id||e.currency+e.timestamp+e.title} className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded bg-accent px-2 py-0.5 text-[10px] font-extrabold">{e.currency}</span><span className={'text-[10px] font-extrabold uppercase '+(e.impact==='high'?'text-red-600':e.impact==='medium'?'text-amber-600':'text-muted-foreground')}>{e.impact} impact</span></div><div className="mt-1 text-sm font-semibold">{e.title}</div><div className="mt-1 text-xs text-muted-foreground">Forecast: {e.forecast||'—'} · Previous: {e.previous||'—'} · Actual: {e.actual||'—'}</div></div>
      <div className="text-right text-xs text-muted-foreground"><div className="font-semibold">{format(new Date(e.timestamp*1000),'MMM d, HH:mm')} UTC</div><div>{e.status}</div></div>
     </div>)}</div>}
   </Card>
   <a className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline" href={calendarUrl} target="_blank" rel="noreferrer">Source: ShowMyTrades Economic Calendar <ExternalLink className="h-3 w-3"/></a>
  </section>
  <p className="text-[11px] leading-5 text-muted-foreground">Signals and calendar data are informational and may be delayed or incomplete. AI Auto-Execution remains subject to account eligibility, current quotes, market hours and server-side risk controls. Not financial advice.</p>
 </div>;
}
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-lg bg-muted/60 p-2"><div className="text-[10px] font-semibold text-muted-foreground">{label}</div><div className="mt-0.5 truncate font-bold">{value}</div></div>;}
