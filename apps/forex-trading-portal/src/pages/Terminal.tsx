import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
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
  const t = useTrading();
  const [symbol, setSymbol] = useState('EURUSD');
  const [tabs, setTabs] = useState(['EURUSD', 'XAUUSD', 'BTCUSD']);
  const select = (s: string) => { setSymbol(s); if (!tabs.includes(s)) setTabs((x) => [...x.slice(-4), s]); };

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground" aria-label="Back"><ArrowLeft className="h-5 w-5" /></Link>
        <Logo />
        <div className="ml-2 hidden gap-1 md:flex">
          {tabs.map((s) => (
            <button key={s} onClick={() => setSymbol(s)} className={cn('rounded-md px-3 py-1.5 text-xs font-bold', s === symbol ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted')}>{s}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-4">
          <Stat k="Balance" v={money(t.account.balance)} />
          <Stat k="Equity" v={money(t.equity)} />
          <Stat k="Margin" v={money(t.margin)} className="hidden lg:block" />
          <Stat k="Free margin" v={money(t.free)} className="hidden lg:block" />
          <Stat k="Margin level" v={t.margin ? `${t.level.toFixed(0)}%` : '—'} className="hidden xl:block" />
          <Select value={t.account.id} onValueChange={t.setActive}>
            <SelectTrigger className="h-9 w-auto gap-2 font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {t.state.accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <span className={cn('mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold', a.type === 'Real' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>{a.type}</span>#{a.number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild size="sm" className="hidden sm:inline-flex"><Link to="/deposit">Deposit</Link></Button>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_1fr_300px]">
        <aside className="hidden min-h-0 border-r bg-card lg:block"><Watchlist selected={symbol} onSelect={select} /></aside>
        <main className="grid min-h-0 grid-rows-[1fr_260px]">
          <div className="min-h-[320px] bg-card"><PriceChart symbol={symbol} /></div>
          <div className="min-h-0 border-t bg-card"><PositionsPanel /></div>
        </main>
        <aside className="min-h-0 border-l bg-card"><OrderPanel symbol={symbol} /></aside>
      </div>
      <div className="h-[45vh] border-t bg-card lg:hidden"><Watchlist selected={symbol} onSelect={select} /></div>
    </div>
  );
}

const Stat = ({ k, v, className }: { k: string; v: string; className?: string }) => (
  <div className={cn('text-right', className)}><div className="text-[10px] font-semibold uppercase text-muted-foreground">{k}</div><div className="num text-sm font-bold">{v}</div></div>
);
