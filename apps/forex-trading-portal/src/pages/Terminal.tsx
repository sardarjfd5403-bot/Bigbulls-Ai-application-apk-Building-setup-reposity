import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ListFilter, ChevronLeft, Wallet, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Button } from '@project/components/ui/button';
import { cn } from '@project/components/lib/utils';
import Watchlist from '../components/Watchlist';
import PriceChart from '../components/PriceChart';
import OrderPanel from '../components/OrderPanel';
import PositionsPanel from '../components/PositionsPanel';
import Logo from '../components/Logo';
import { useTrading } from '../lib/store';
import { money } from '../lib/symbols';

type TradeView='Market Watch'|'Chart & Trade'|'Positions';
export default function Terminal() {
 const t=useTrading();const [symbol,setSymbol]=useState('EURUSD');const [tabs,setTabs]=useState(['EURUSD','XAUUSD','BTCUSD']);
 const [mode,setMode]=useState<'Real'|'Demo'>(t.account.type);const [view,setView]=useState<TradeView>('Market Watch');
 const [mobileMarkets,setMobileMarkets]=useState(false);
 const modeAccounts=t.state.accounts.filter(a=>a.type===mode);
 useEffect(()=>{if(t.account.id&&t.account.type!==mode){const next=t.state.accounts.find(a=>a.type===mode);if(next)t.setActive(next.id);}},[mode,t.account.id,t.account.type,t.state.accounts]);
 const select=(s:string)=>{setSymbol(s);if(!tabs.includes(s))setTabs(x=>[...x.slice(-4),s]);setView('Chart & Trade');setMobileMarkets(false);};
 const addDemoFunds=async()=>{const raw=window.prompt('Amount to ADD to this Demo account (virtual USD):');if(raw===null)return;const amount=Number(raw);if(!Number.isFinite(amount)||amount<=0||amount>100000000||Math.round(amount*100)!==amount*100){window.alert('Enter a valid amount up to 2 decimal places.');return;}await t.adjustDemoBalance(t.account.id,amount,'topup');};
 return <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
  <header className="z-20 flex min-h-12 shrink-0 items-center gap-1 border-b bg-card px-2 py-1.5 sm:min-h-14 sm:gap-2 sm:px-3">
   <Link to="/" className="flex h-8 w-6 shrink-0 items-center justify-center text-muted-foreground" aria-label="Back"><ArrowLeft className="h-4 w-4"/></Link>
   <div className="w-[72px] shrink-0 sm:w-auto"><Logo compact/></div>
   <div className="ml-1 flex shrink-0 rounded-lg border bg-muted p-0.5">
    {(['Real','Demo'] as const).map(x=><button key={x} onClick={()=>{setMode(x);const a=t.state.accounts.find(v=>v.type===x);if(a)t.setActive(a.id);}} className={cn('rounded-md px-2 py-1 text-[10px] font-extrabold sm:px-3 sm:text-xs',mode===x?'bg-primary text-primary-foreground shadow-sm':'text-muted-foreground')}>{x}</button>)}
   </div>
   <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
    <Select value={t.account.id} onValueChange={t.setActive}>
     <SelectTrigger className="h-9 w-[100px] min-w-0 px-2 text-[10px] font-bold sm:w-[170px] sm:text-xs"><SelectValue placeholder="Account"/></SelectTrigger>
     <SelectContent>{modeAccounts.map(a=><SelectItem key={a.id} value={a.id}>#{a.number} · {a.kind}</SelectItem>)}</SelectContent>
    </Select>
    {mode==='Real'?<><Button asChild size="sm" className="hidden h-8 px-2 text-[10px] sm:inline-flex"><Link to="/deposit"><ArrowDownToLine className="mr-1 h-3 w-3"/>Deposit</Link></Button><Button asChild size="sm" variant="outline" className="hidden h-8 px-2 text-[10px] sm:inline-flex"><Link to="/withdraw"><ArrowUpFromLine className="mr-1 h-3 w-3"/>Withdraw</Link></Button></>:<Button size="sm" variant="outline" className="hidden h-8 px-2 text-[10px] sm:inline-flex" onClick={()=>void addDemoFunds()} disabled={t.busy}><Wallet className="mr-1 h-3 w-3"/>Add Fund</Button>}
    <Button size="sm" variant="outline" className="h-8 w-8 p-0 lg:hidden" onClick={()=>setMobileMarkets(v=>!v)} aria-label="Toggle markets">{mobileMarkets?<ChevronLeft className="h-4 w-4"/>:<ListFilter className="h-4 w-4"/>}</Button>
   </div>
  </header>
  <div className="grid shrink-0 grid-cols-3 gap-1 border-b bg-card px-2 py-1.5 sm:gap-2 sm:px-3">
   <Metric label="Balance" value={money(t.account.balance)}/><Metric label="Equity" value={money(t.equity)}/><Metric label="Floating" value={money(t.floating)}/>
  </div>
  <nav className="flex shrink-0 gap-1 border-b bg-card px-2 py-1.5 sm:px-3">
   {(['Market Watch','Chart & Trade','Positions'] as TradeView[]).map(x=><button key={x} onClick={()=>{setView(x);setMobileMarkets(x==='Market Watch');}} className={cn('flex-1 rounded-lg border px-2 py-2 text-[10px] font-extrabold sm:text-xs',view===x?'border-primary bg-primary text-primary-foreground':'border-transparent bg-muted text-muted-foreground')}>{x}{x==='Positions'?<span className="ml-1 rounded-full bg-black/10 px-1.5">{t.positions.length}</span>:null}</button>)}
  </nav>
  <div className="hidden min-h-0 flex-1 lg:block">
   {view==='Market Watch'?<Watchlist selected={symbol} onSelect={select}/>:view==='Positions'?<PositionsPanel/>:
    <div className="grid h-full min-h-0 grid-cols-[250px_minmax(0,1fr)_290px]">
     <aside className="min-h-0 border-r bg-card"><Watchlist selected={symbol} onSelect={select}/></aside>
     <main className="grid min-h-0 grid-rows-[minmax(320px,1fr)_250px]"><div className="min-h-0 bg-white"><PriceChart symbol={symbol}/></div><div className="min-h-0 border-t bg-card"><PositionsPanel/></div></main>
     <aside className="min-h-0 border-l bg-card"><OrderPanel symbol={symbol}/></aside>
    </div>}
  </div>
  <div className="flex min-h-0 flex-1 flex-col lg:hidden">
   {view==='Market Watch'||mobileMarkets?<div className="min-h-0 flex-1 bg-card"><Watchlist selected={symbol} onSelect={select}/></div>:view==='Positions'?<div className="min-h-0 flex-1 bg-card"><PositionsPanel/></div>:
    <div className="min-h-0 flex-1 overflow-y-auto">
     <div className="h-[48vh] min-h-[300px] border-b bg-white"><PriceChart symbol={symbol}/></div>
     <div className="border-b bg-card"><OrderPanel symbol={symbol}/></div>
     <div className="h-[300px] bg-card"><PositionsPanel/></div>
    </div>}
  </div>
 </div>;
}
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-lg bg-muted/70 px-2 py-1"><div className="text-[8px] font-extrabold uppercase tracking-wide text-muted-foreground sm:text-[9px]">{label}</div><div className="num text-xs font-extrabold text-foreground sm:text-sm">{value}</div></div>;}
