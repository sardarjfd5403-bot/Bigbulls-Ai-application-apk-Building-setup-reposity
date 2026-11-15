import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BrainCircuit } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Button } from '@project/components/ui/button';
import { Switch } from '@project/components/ui/switch';
import { toast } from 'sonner';
import { bigbullsBackend } from '../lib/bigbullsBackend';
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
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  useEffect(() => {
    let active = true;
    setAiEnabled(false);
    if (t.account.type === 'Real' && t.account.id) {
      bigbullsBackend.aiTradeMode(t.account.id).then((mode) => {
        if (active) setAiEnabled(Boolean(mode.enabled));
      }).catch(() => { if (active) setAiEnabled(false); });
    }
    return () => { active = false; };
  }, [t.account.id, t.account.type]);
  const changeAiMode = async (enabled: boolean) => {
    if (!t.account.id || t.account.type !== 'Real' || aiSaving) return;
    setAiSaving(true);
    try {
      const mode = await bigbullsBackend.setAiTradeMode(t.account.id, enabled);
      setAiEnabled(Boolean(mode?.enabled));
      toast.success(enabled ? 'AI trading mode enabled for this Real account' : 'Manual trading mode enabled');
    } catch (error: any) {
      toast.error(error?.message || 'Unable to change AI trading mode');
    } finally { setAiSaving(false); }
  };
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
          {t.account.type === 'Real' && <div className="hidden items-center gap-2 rounded-lg border px-2.5 py-1.5 sm:flex"><BrainCircuit className="h-4 w-4 text-primary" /><div className="leading-tight"><div className="text-[10px] font-bold">{aiEnabled ? 'AI MODE' : 'MANUAL MODE'}</div><div className="text-[9px] text-muted-foreground">Account trading mode</div></div><Switch checked={aiEnabled} disabled={aiSaving || t.account.balance <= 0} onCheckedChange={changeAiMode} aria-label="Enable AI trading mode" /></div>}
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
      {t.account.type === 'Real' && <div className="flex items-center justify-between border-b bg-card px-3 py-2 sm:hidden"><span className="flex items-center gap-2 text-xs font-semibold"><BrainCircuit className="h-4 w-4 text-primary" />{aiEnabled ? 'AI Trading' : 'Manual Trading'}</span><Switch checked={aiEnabled} disabled={aiSaving || t.account.balance <= 0} onCheckedChange={changeAiMode} aria-label="Enable AI trading mode" /></div>}
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
