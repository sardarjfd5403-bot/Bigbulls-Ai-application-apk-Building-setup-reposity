import { useState } from 'react';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, MoreVertical, CandlestickChart, ArrowDownToLine, ArrowUpFromLine, ChevronDown, ChevronUp } from 'lucide-react';
import PositionsPanel from '../components/PositionsPanel';
import { Button } from '@project/components/ui/button';
import { Card } from '@project/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@project/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { cn } from '@project/components/lib/utils';
import { useTrading, Account, pnl } from '../lib/store';
import { money } from '../lib/symbols';
import OpenAccountDialog from '../components/OpenAccountDialog';

export default function Accounts() {
  const t = useTrading();
  const [tab, setTab] = useState<'Real' | 'Demo'>('Real');
  const [openNew, setOpenNew] = useState(false);
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
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
        {list.map((a) => <AccountCard key={a.id} a={a} expanded={expandedAccountId === a.id} onToggleTrades={() => { const next = expandedAccountId === a.id ? null : a.id; setExpandedAccountId(next); if (next) t.setActive(next); }} />)}
        {list.length === 0 && (
          <Card className="p-10 text-center"><p className="text-muted-foreground">No {tab.toLowerCase()} accounts yet.</p><Button className="mt-4" onClick={() => setOpenNew(true)}>Open account</Button></Card>
        )}
      </div>
      <OpenAccountDialog open={openNew} onOpenChange={setOpenNew} defaultType={tab} />
    </div>
  );
}

function AccountCard({ a, expanded, onToggleTrades }: { a: Account; expanded: boolean; onToggleTrades: () => void }) {
  const t = useTrading(); const nav = useNavigate();
  const [arch, setArch] = useState(false);
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
            {a.type === 'Demo' && <>
              <DropdownMenuItem onClick={() => { const raw = window.prompt('Amount to ADD to this Demo balance (USD):'); if (raw === null) return; const amount = Number(raw); if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000 || Math.round(amount * 100) !== amount * 100) { toast.error('Enter a valid amount (up to 2 decimals).'); return; } void t.adjustDemoBalance(a.id, amount, 'topup'); }}>＋ Add Demo balance</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { const raw = window.prompt('Set this Demo balance to (USD):'); if (raw === null) return; const amount = Number(raw); if (!Number.isFinite(amount) || amount < 0 || amount > 100000000 || Math.round(amount * 100) !== amount * 100) { toast.error('Enter a valid amount (up to 2 decimals).'); return; } void t.adjustDemoBalance(a.id, amount, 'set'); }}>Set Demo balance</DropdownMenuItem>
            </>}
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
      <div className="border-t bg-card">
        <button type="button" onClick={onToggleTrades} aria-expanded={expanded} className="flex w-full items-center justify-between px-5 py-3 text-sm font-bold hover:bg-muted/40">
          <span>Running trades &amp; trade history</span>
          <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">{expanded ? 'Hide' : 'Show'} {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
        </button>
        {expanded && <div className="h-[320px] min-h-[240px] border-t bg-card"><PositionsPanel /></div>}
      </div>
      <AlertDialog open={arch} onOpenChange={setArch}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Archive account #{a.number}?</AlertDialogTitle><AlertDialogDescription>This account will be archived from your active account list. Existing financial and trade history is retained.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => t.archive(a.id)}>Archive</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Link to="/terminal" className="hidden" />
    </Card>
  );
}
