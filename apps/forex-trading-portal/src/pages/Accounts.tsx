import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, MoreVertical, CandlestickChart, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Card } from '@project/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@project/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { cn } from '@project/components/lib/utils';
import { useTrading, Account, pnl } from '../lib/store';
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
  const floating = t.state.positions.filter((p) => p.accountId === a.id).reduce((s, p) => s + pnl(p, t.quotes), 0);
  const go = (path: string) => { t.setActive(a.id); nav(path); };
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
        {(() => {
          const trades = t.state.positions.filter((p) => p.accountId === a.id);
          return (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Running trades ({trades.length})</div>
                <div className="text-xs font-semibold">Total floating P/L <span className={cn('num font-extrabold', floating >= 0 ? 'text-up' : 'text-destructive')}>{money(floating)}</span></div>
              </div>
              {trades.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {trades.map((p) => {
                    const profit = pnl(p, t.quotes);
                    return <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2"><span className="font-bold">{p.symbol}</span><span className={cn('rounded px-1.5 py-0.5 font-bold', p.side === 'buy' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive')}>{p.side.toUpperCase()}</span><span className="text-muted-foreground">{p.volume} lot</span></div>
                      <span className={cn('num font-bold', profit >= 0 ? 'text-up' : 'text-destructive')}>{money(profit)}</span>
                    </div>;
                  })}
                </div>
              ) : <p className="mt-2 text-xs text-muted-foreground">No running trades on this account.</p>}
            </>
          );
        })()}
      </div>
      <LeverageDialog account={a} open={lev} onOpenChange={setLev} />
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
