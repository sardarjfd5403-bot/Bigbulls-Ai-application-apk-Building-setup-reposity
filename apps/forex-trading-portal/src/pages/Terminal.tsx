import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ListFilter, ChevronLeft } from 'lucide-react';
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

export default function Terminal() {
  const t=useTrading();
  const [symbol,setSymbol]=useState('EURUSD');
  const [tabs,setTabs]=useState(['EURUSD','XAUUSD','BTCUSD']);
  const [mobileMarkets,setMobileMarkets]=useState(true);
  const select=(s:string)=>{setSymbol(s);if(!tabs.includes(s))setTabs(x=>[...x.slice(-4),s]);setMobileMarkets(false);};
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <header className="z-20 flex min-h-12 shrink-0 flex-nowrap items-center gap-1 border-b bg-card px-1.5 py-1.5 sm:min-h-14 sm:gap-2 sm:px-3 sm:py-2">
        <Link to="/" className="flex h-8 w-5 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground sm:w-6" aria-label="Back"><ArrowLeft className="h-[18px] w-[18px] sm:h-5 sm:w-5"/></Link>
        <div className="w-[82px] min-w-0 shrink-0 sm:w-auto"><Logo compact/></div>
        <div className="ml-2 hidden gap-1 md:flex">
          {tabs.map(s=><button key={s} onClick={()=>setSymbol(s)} className={cn('rounded-md px-3 py-1.5 text-xs font-bold',s===symbol?'bg-accent text-accent-foreground':'text-muted-foreground hover:bg-muted')}>{s}</button>)}
        </div>
        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1 sm:gap-4">
          <div className="hidden sm:block"><Stat k="Balance" v={money(t.account.balance)}/></div>
          <div className="hidden md:block"><Stat k="Equity" v={money(t.equity)}/></div>
          <Select value={t.account.id} onValueChange={t.setActive}>
            <SelectTrigger className="h-9 w-[104px] min-w-0 shrink-0 gap-0.5 overflow-hidden px-1.5 text-[9px] font-semibold min-[360px]:w-[112px] min-[400px]:w-[124px] sm:w-[190px] sm:gap-2 sm:px-3 sm:text-xs">
              <div className="flex min-w-0 flex-1 flex-col items-start leading-tight">
                <SelectValue placeholder="Account" className="max-w-full truncate text-[9px] sm:text-xs"/>
                <span className="num whitespace-nowrap text-[8px] font-bold text-primary min-[360px]:text-[8.5px] sm:text-[10px]">Equity {money(t.equity)}</span>
              </div>
            </SelectTrigger>
            <SelectContent>{t.state.accounts.map(a=><SelectItem key={a.id} value={a.id}><span className={cn('mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold',a.type==='Real'?'bg-primary text-primary-foreground':'bg-muted')}>{a.type}</span>#{a.number}</SelectItem>)}</SelectContent>
          </Select>
          <Button asChild size="sm" className="hidden sm:inline-flex"><Link to="/deposit">Deposit</Link></Button>
          <Button size="sm" variant="outline" className="h-8 w-[58px] shrink-0 gap-0.5 whitespace-nowrap px-1 text-[9px] sm:w-auto sm:gap-1 sm:h-9 sm:px-2 sm:text-xs lg:hidden" onClick={()=>setMobileMarkets(v=>!v)}>
            {mobileMarkets?<><ChevronLeft className="h-3.5 w-3.5"/>Chart</>:<><ListFilter className="h-3.5 w-3.5"/>Markets</>}
          </Button>
        </div>
      </header>
      <div className="hidden min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)_300px] lg:grid">
        <aside className="min-h-0 border-r bg-card"><Watchlist selected={symbol} onSelect={select}/></aside>
        <main className="grid min-h-0 grid-rows-[minmax(320px,1fr)_260px]">
          <div className="min-h-0 bg-card"><PriceChart symbol={symbol}/></div>
          <div className="min-h-0 border-t bg-card"><PositionsPanel/></div>
        </main>
        <aside className="min-h-0 border-l bg-card"><OrderPanel symbol={symbol}/></aside>
      </div>
      <div className="flex min-h-0 flex-1 flex-col lg:hidden">
        {mobileMarkets ? (
          <div className="min-h-0 flex-1 bg-card"><Watchlist selected={symbol} onSelect={select}/></div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="h-[44vh] min-h-[300px] border-b bg-card"><PriceChart symbol={symbol}/></div>
            <div className="border-b bg-card"><OrderPanel symbol={symbol}/></div>
            <div className="h-[280px] bg-card"><PositionsPanel/></div>
          </div>
        )}
      </div>
    </div>
  );
}
const Stat=({k,v}:{k:string;v:string})=><div className="text-right"><div className="text-[10px] font-semibold uppercase text-muted-foreground">{k}</div><div className="num text-sm font-bold">{v}</div></div>;
