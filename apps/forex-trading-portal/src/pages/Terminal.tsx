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
import { money, SYMBOLS } from '../lib/symbols';

export default function Terminal() {
  const t = useTrading();
  const [symbol, setSymbol] = useState('EURUSD');
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


  return (
    <div className="terminal-screen flex h-[100dvh] flex-col overflow-hidden bg-background">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground" aria-label="Back"><ArrowLeft className="h-5 w-5" /></Link>
        <Logo />
        <Select value={symbol} onValueChange={setSymbol}>
          <SelectTrigger className="ml-2 h-9 w-[132px] shrink-0 font-bold sm:w-[168px]">
            <SelectValue placeholder="Select pair" />
          </SelectTrigger>
          <SelectContent>
            {SYMBOLS.map((item) => (
              <SelectItem key={item.symbol} value={item.symbol}>
                {item.symbol} · {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_auto] lg:grid-rows-1 lg:grid-cols-[300px_minmax(0,1fr)_300px]">
        <aside className="hidden min-h-0 border-r bg-card lg:block"><Watchlist selected={symbol} onSelect={select} /></aside>
        <main className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_180px] lg:grid-rows-[minmax(0,1fr)_260px]">
          <div className="min-h-0 min-w-0 overflow-hidden bg-card"><PriceChart symbol={symbol} /></div>
          <div className="min-h-0 border-t bg-card"><PositionsPanel /></div>
        </main>
        <aside className="max-h-[230px] min-h-0 overflow-y-auto border-t bg-card lg:max-h-none lg:overflow-visible lg:border-l lg:border-t-0"><OrderPanel symbol={symbol} /></aside>
      </div>
    </div>
  );
}

const Stat = ({ k, v, className }: { k: string; v: string; className?: string }) => (
  <div className={cn('text-right', className)}><div className="text-[10px] font-semibold uppercase text-muted-foreground">{k}</div><div className="num text-sm font-bold">{v}</div></div>
);
