import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, MoreVertical, CandlestickChart, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Card } from '@project/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@project/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { cn } from '@project/components/lib/utils';
import { useTrading, Account, Position, pnl } from '../lib/store';
import { money } from '../lib/symbols';
import OpenAccountDialog from '../components/OpenAccountDialog';
import LeverageDialog from '../components/LeverageDialog';

export default function Accounts() {
  const t = useTrading();
  const [tab, setTab] = useState<'Real' | 'Demo'>('Real');
  const [openNew, setOpenNew] = useState(false);
  const list = t.state.accounts.filter((a) => a.type === tab);
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-extrabold tracking-tight">My accounts</h1><p className="mt-1 text-sm text-muted-foreground">Manage your trading accounts and start trading.</p></div>
        <Button onClick={() => setOpenNew(true)}><Plus className="mr-2 h-4 w-4" />Open new account</Button>
      </div>
      <div className="mb-5 flex gap-6 border-b">
        {(['Real', 'Demo'] as const).map((x) => (
          <button key={x} onClick={() => setTab(x)} className={cn('-mb-px border-b-2 pb-3 text-sm font-bold', tab === x ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}>{x}</button>
        ))}
      </div>
      <div className="space-y-4">
        {list.map((a) => <AccountCard key={a.id} a={a} />)}
        {list.length === 0 && (
          <Card className="p-10 text-center"><p className="text-muted-foreground">No {tab.toLowerCase()} accounts yet.</p><Button className="mt-4" onClick={() => setOpenNew(true)}>Open account</Button></Card>
        )}
      </div>
      <OpenAccountDialog open={openNew} onOpenChange={setOpenNew} defaultType={tab} />
    </div>
  );
}

function AccountCard({ a }: { a: Account }) {
  const t = useTrading(); const nav = useNavigate();
  const [lev, setLev] = useState(false); const [arch, setArch] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Position | null>(null);
  const [closeTradeDialogOpen, setCloseTradeDialogOpen] = useState(false);
  const [confirmCloseAll, setConfirmCloseAll] = useState(false);
  // Dialogs may only be opened by the explicit row/button handlers below. Ignore
  // unsolicited Radix open requests (for example during WebView focus restoration).
  const closeTradeDialog = () => { setCloseTradeDialogOpen(false); setSelectedTrade(null); };
  const closeAllDialog = () => setConfirmCloseAll(false);
  const [, setPnlSecond] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setPnlSecond((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const floating = t.state.positions.filter((p) => p.accountId === a.id).reduce((s, p) => s + pnl(p, t.quotes), 0);
  const trades = t.state.positions.filter((p) => p.accountId === a.id);
  const go = (path: string) => { t.setActive(a.id); nav(path); };
  // Open the close confirmation only from an explicit client tap on a trade row.
  const openTradeActions = (p: Position) => { t.setActive(a.id); setSelectedTrade(p); setCloseTradeDialogOpen(true); };
  const handleCloseTradeDialogChange = (open: boolean) => {
    if (!open) closeTradeDialog();
  };
  const handleCloseAllDialogChange = (open: boolean) => {
    if (!open) closeAllDialog();
  };
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-5 py-3 text-xs font-bold">
        <span className={cn('rounded px-2 py-0.5', a.type === 'Real' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground')}>{a.type}</span>
        <span className="rounded bg-card px-2 py-0.5 ring-1 ring-border">{a.platform}</span>
        <span className="rounded bg-card px-2 py-0.5 ring-1 ring-border">{a.kind}</span>
        <span className="text-muted-foreground">#{a.number}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="ml-auto h-7 w-7"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setLev(true)}>Change leverage</DropdownMenuItem>
            {a.type === 'Demo' && <DropdownMenuItem onClick={() => t.resetDemo(a.id)}>Set balance to $10,000</DropdownMenuItem>}
            {t.state.accounts.length > 1 && <DropdownMenuItem className="text-destructive" onClick={() => setArch(true)}>Archive account</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex flex-wrap items-center gap-6 p-5">
        <div>
          <div className="num text-3xl font-extrabold">{money(a.balance + floating)}</div>
          <div className="mt-1 text-xs text-muted-foreground">Leverage 1:{a.leverage} · Floating <span className={floating >= 0 ? 'text-up' : 'text-destructive'}>{money(floating)}</span></div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button onClick={() => go('/terminal')}><CandlestickChart className="mr-2 h-4 w-4" />Trade</Button>
          {a.type === 'Real' && <>
            <Button variant="outline" onClick={() => go('/deposit')}><ArrowDownToLine className="mr-2 h-4 w-4" />Deposit</Button>
            <Button variant="outline" onClick={() => go('/withdraw')}><ArrowUpFromLine className="mr-2 h-4 w-4" />Withdraw</Button>
          </>}
        </div>
      </div>
      <div className="border-t px-5 py-4">
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Running trades ({trades.length})</div>
            <div className="flex items-center gap-3">
              <div className="text-xs font-semibold">Total floating P/L <span className={cn('num font-extrabold tabular-nums', floating >= 0 ? 'text-up' : 'text-destructive')}>{money(floating)}</span><span className="ml-1 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"/>Live · 1s</span></div>
              {trades.length > 0 && <Button size="sm" variant="destructive" onClick={() => { t.setActive(a.id); setConfirmCloseAll(true); }}>Close all</Button>}
            </div>
          </div>
          {trades.length > 0 ? (
            <div className="mt-3 space-y-2">
              {trades.map((p) => {
                const profit = pnl(p, t.quotes);
                return <button type="button" key={p.id} onClick={() => openTradeActions(p)} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-3 text-left text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <div className="flex items-center gap-2"><span className="font-bold">{p.symbol}</span><span className={cn('rounded px-1.5 py-0.5 font-bold', p.side === 'buy' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive')}>{p.side.toUpperCase()}</span><span className="text-muted-foreground">{p.volume} lot</span><span className="text-muted-foreground">· Tap to manage</span></div>
                  <span className={cn('num font-bold tabular-nums', profit >= 0 ? 'text-up' : 'text-destructive')}>{money(profit)}</span>
                </button>;
              })}
            </div>
          ) : <p className="mt-2 text-xs text-muted-foreground">No running trades on this account.</p>}
        </>
      </div>
      <LeverageDialog account={a} open={lev} onOpenChange={setLev} />
      {closeTradeDialogOpen && <AlertDialog open={true} onOpenChange={handleCloseTradeDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this running trade?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedTrade ? <span>{selectedTrade.symbol} · {selectedTrade.side.toUpperCase()} · {selectedTrade.volume} lot · Current floating P/L {money(pnl(selectedTrade, t.quotes))}. This will send a close request to the BIGBULLS execution engine.</span> : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeTradeDialog}>Keep trade open</AlertDialogCancel>
            <AlertDialogAction disabled={!selectedTrade} onClick={() => { const tradeId = selectedTrade?.id; setCloseTradeDialogOpen(false); setSelectedTrade(null); if (tradeId) t.closePosition(tradeId); }}>Confirm close trade</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>}
      {confirmCloseAll && <AlertDialog open={true} onOpenChange={handleCloseAllDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close all running trades?</AlertDialogTitle>
            <AlertDialogDescription>All {trades.length} open trade(s) on account #{a.number} will receive close requests. This action cannot be undone. Pending orders are not included.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeAllDialog}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { t.setActive(a.id); closeAllDialog(); t.closeAll('all'); }}>Confirm close all</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>}
      <AlertDialog open={arch} onOpenChange={setArch}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Archive account #{a.number}?</AlertDialogTitle><AlertDialogDescription>Open positions and pending orders on this account will be removed.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => t.archive(a.id)}>Archive</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Link to="/terminal" className="hidden" />
    </Card>
  );
}
