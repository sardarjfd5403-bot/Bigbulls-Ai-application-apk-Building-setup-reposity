import { useEffect, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Link } from 'react-router-dom';
import { ArrowLeft, BrainCircuit, CandlestickChart, LayoutGrid, PieChart, UserCircle, ListPlus, X } from 'lucide-react';
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
  const [pendingOpen, setPendingOpen] = useState(false);
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
  const select = (nextSymbol: string) => setSymbol(nextSymbol);

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
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-card px-2 sm:h-14 sm:gap-3 sm:px-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground" aria-label="Back"><ArrowLeft className="h-5 w-5" /></Link>
        <Logo />
        <Select value={symbol} onValueChange={setSymbol}>
          <SelectTrigger className="ml-1 h-8 w-[108px] shrink-0 px-1 text-[11px] font-bold sm:ml-2 sm:h-9 sm:w-[168px] sm:text-sm">
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
        <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-4">
          <Stat k="Balance" v={money(t.account.balance)} className="block [&_div:last-child]:text-[10px] sm:[&_div:last-child]:text-sm" />
          <Stat k="Equity" v={money(t.equity)} className="block [&_div:last-child]:text-[11px] sm:[&_div:last-child]:text-sm" />
          <Stat k="Margin" v={money(t.margin)} className="hidden lg:block" />
          <Stat k="Free margin" v={money(t.free)} className="hidden lg:block" />
          <Stat k="Margin level" v={t.margin ? `${t.level.toFixed(0)}%` : '—'} className="hidden xl:block" />
          {t.account.type === 'Real' && <div className="hidden items-center gap-2 rounded-lg border px-2.5 py-1.5 sm:flex"><BrainCircuit className="h-4 w-4 text-primary" /><div className="leading-tight"><div className="text-[10px] font-bold">{aiEnabled ? 'AI MODE' : 'MANUAL MODE'}</div><div className="text-[9px] text-muted-foreground">Account trading mode</div></div><Switch checked={aiEnabled} disabled={aiSaving || (!aiEnabled && t.account.balance <= 0)} onCheckedChange={changeAiMode} aria-label="Enable AI trading mode" /></div>}
          <Select value={t.account.id} onValueChange={t.setActive}>
            <SelectTrigger className="h-8 max-w-[84px] gap-1 px-1.5 text-[10px] font-semibold sm:h-9 sm:max-w-none sm:gap-2 sm:text-xs">
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
      {t.account.type === 'Real' && <div className="flex items-center justify-between border-b bg-card px-3 py-2 sm:hidden"><span className="flex items-center gap-2 text-xs font-semibold"><BrainCircuit className="h-4 w-4 text-primary" />{aiEnabled ? 'AI Trading' : 'Manual Trading'}</span><Switch checked={aiEnabled} disabled={aiSaving || (!aiEnabled && t.account.balance <= 0)} onCheckedChange={changeAiMode} aria-label="Enable AI trading mode" /></div>}
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_auto] lg:grid-rows-1 lg:grid-cols-[300px_minmax(0,1fr)_300px]">
        <aside className="hidden min-h-0 border-r bg-card lg:block"><Watchlist selected={symbol} onSelect={select} /></aside>
        <main className="order-1 grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)] lg:order-1 lg:grid-rows-[minmax(0,1fr)_260px]">
          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-card">
            <div className="flex h-9 shrink-0 items-center justify-end border-b bg-card px-2">
              <Button type="button" size="sm" variant={pendingOpen ? "default" : "outline"} className="h-7 gap-1.5 px-3 text-[11px] font-bold" onClick={() => setPendingOpen(v => !v)}>
                {pendingOpen ? <X className="h-3.5 w-3.5" /> : <ListPlus className="h-3.5 w-3.5" />}
                {pendingOpen ? 'Close pending' : 'Pending Order'}
              </Button>
            </div>
            <div className="min-h-0 min-w-0 flex-1"><ErrorBoundary fallback={<div className="grid h-full place-items-center bg-[#0b1220] p-4 text-center text-sm text-slate-200"><div><p className="font-semibold">Chart temporarily unavailable</p><p className="mt-1 text-xs text-slate-400">Trading controls remain available. Change the symbol or reopen the chart.</p></div></div>}><PriceChart symbol={symbol} /></ErrorBoundary></div>
          </div>
          <div className="hidden min-h-0 border-t bg-card lg:block"><PositionsPanel /></div>
        </main>
        <aside className="relative order-2 h-[58px] min-h-0 overflow-visible border-t bg-card lg:order-2 lg:h-auto lg:border-t-0 lg:border-l"><OrderPanel symbol={symbol} pendingOpen={pendingOpen} onPendingOpenChange={setPendingOpen} /></aside>
      </div>
      <nav className="flex h-14 shrink-0 border-t bg-card lg:hidden">
        {[
          {to:'/',label:'Accounts',Icon:LayoutGrid},
          {to:'/terminal',label:'Trade',Icon:CandlestickChart},
          {to:'/analytics',label:'Performance',Icon:PieChart},
          {to:'/wallet',label:'Profile',Icon:UserCircle},
        ].map(({to,label,Icon}) => <Link key={to} to={to} className={cn('flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-bold', to==='/terminal' ? 'text-primary' : 'text-muted-foreground')}><Icon className="h-5 w-5"/>{label}</Link>)}
      </nav>
    </div>
  );
}

const Stat = ({ k, v, className }: { k: string; v: string; className?: string }) => (
  <div className={cn('text-right', className)}><div className="text-[10px] font-semibold uppercase text-muted-foreground">{k}</div><div className="num text-sm font-bold">{v}</div></div>
);
