import { useState } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Plus, MoreVertical, CandlestickChart, ArrowDownToLine, ArrowUpFromLine,
  ChevronDown, ChevronUp, RefreshCw, Copy, Wallet, TrendingUp,
} from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Card } from '@project/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@project/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { cn } from '@project/components/lib/utils';
import { useTrading, Account, pnl } from '../lib/store';
import { money } from '../lib/symbols';
import PositionsPanel from '../components/PositionsPanel';
import OpenAccountDialog from '../components/OpenAccountDialog';

export default function Accounts() {
  const t = useTrading();
  const [tab, setTab] = useState<'Real' | 'Demo'>('Real');
  const [openNew, setOpenNew] = useState(false);
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const list = t.state.accounts.filter((a) => a.type === tab);

  const refreshAccounts = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await t.refresh();
      toast.success('Account balances refreshed');
    } catch (e: any) {
      toast.error(e?.message || 'Unable to refresh balances');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl text-slate-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">My accounts</h1>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">Manage your BIGBULLS trading accounts.</p>
        </div>
        <Button onClick={() => setOpenNew(true)} className="h-9 rounded-full bg-[#0066FF] px-3 text-xs font-semibold hover:bg-[#0052CC]">
          <Plus className="mr-1.5 h-4 w-4" /> Open new account
        </Button>
      </div>

      <div className="mb-4 flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-5" role="tablist" aria-label="Account mode">
          {(['Real', 'Demo'] as const).map((x) => (
            <button key={x} type="button" role="tab" aria-selected={tab === x} onClick={() => setTab(x)}
              className={cn('relative -mb-px border-b-2 pb-3 text-sm font-bold transition-colors', tab === x ? 'border-[#0066FF] text-[#0066FF]' : 'border-transparent text-slate-500 hover:text-slate-800')}>
              {x}
            </button>
          ))}
        </div>
        <Button type="button" variant="outline" size="icon" aria-label="Refresh balances" title="Refresh balances"
          onClick={refreshAccounts} disabled={refreshing}
          className="mb-2 h-8 w-8 rounded-full border-slate-200 bg-white text-slate-600 hover:text-[#0066FF]">
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin text-[#0066FF]')} />
        </Button>
      </div>

      <div className="space-y-4">
        {list.map((a) => (
          <AccountCard
            key={a.id}
            a={a}
            expanded={expandedAccountId === a.id}
            onSelect={() => t.setActive(a.id)}
            onToggleTrades={() => {
              const next = expandedAccountId === a.id ? null : a.id;
              setExpandedAccountId(next);
              if (next) t.setActive(next);
            }}
          />
        ))}
        {list.length === 0 && (
          <Card className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-slate-500">No {tab.toLowerCase()} accounts yet.</p>
            <Button className="mt-4 rounded-xl bg-[#0066FF] hover:bg-[#0052CC]" onClick={() => setOpenNew(true)}>Open account</Button>
          </Card>
        )}
      </div>
      <OpenAccountDialog open={openNew} onOpenChange={setOpenNew} defaultType={tab} />
    </div>
  );
}

function AccountCard({ a, expanded, onSelect, onToggleTrades }: {
  a: Account;
  expanded: boolean;
  onSelect: () => void;
  onToggleTrades: () => void;
}) {
  const t = useTrading();
  const nav = useNavigate();
  const [arch, setArch] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const floating = t.state.positions.filter((p) => p.accountId === a.id).reduce((s, p) => s + pnl(p, t.quotes), 0);
  const equity = a.balance + floating;
  const equityPct = a.balance > 0 ? (floating / a.balance) * 100 : 0;
  const go = (path: string) => { t.setActive(a.id); nav(path); };
  const adjustDemo = async (operation: 'topup' | 'set') => {
    const raw = window.prompt(operation === 'topup' ? 'Amount to ADD to this Demo balance (USD):' : 'Set this Demo balance to (USD):');
    if (raw === null) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || (operation === 'topup' ? amount <= 0 : amount < 0) || amount > 100000000 || Math.round(amount * 100) !== amount * 100) {
      toast.error('Enter a valid amount (up to 2 decimals).');
      return;
    }
    setDemoBusy(true);
    try { await t.adjustDemoBalance(a.id, amount, operation); }
    finally { setDemoBusy(false); }
  };

  return (
    <Card className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_6px_24px_rgb(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 pb-3.5 pt-4">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white', a.type === 'Real' ? 'bg-[#0066FF]' : 'bg-emerald-600')}>{a.type}</span>
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{a.platform}</span>
          <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-[#0066FF]">{a.kind}</span>
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(a.number).then(() => toast.success('Account number copied')).catch(() => toast.error('Unable to copy account number')); }}
            className="ml-0.5 inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs font-semibold tabular-nums text-slate-500 hover:bg-slate-50 hover:text-[#0066FF]" title="Copy account number">
            #{a.number}<Copy className="h-3 w-3" />
          </button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Account options" className="h-8 w-8 shrink-0 rounded-full text-slate-500 hover:bg-slate-100"><MoreVertical className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {a.type === 'Demo' && <>
              <DropdownMenuItem disabled={demoBusy} onClick={() => void adjustDemo('topup')}>＋ Add Demo balance</DropdownMenuItem>
              <DropdownMenuItem disabled={demoBusy} onClick={() => void adjustDemo('set')}>Set Demo balance</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { void t.resetDemo(a.id); }}>Reset Demo balance ($10,000)</DropdownMenuItem>
            </>}
            {t.state.accounts.length > 1 && <DropdownMenuItem className="text-destructive" onClick={() => setArch(true)}>Archive account</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="px-4 pb-4 pt-4">
        <div className="grid grid-cols-2 divide-x divide-slate-200 rounded-2xl border border-slate-200/80 bg-slate-50/90">
          <div className="min-w-0 p-3.5">
            <div className="mb-1.5 text-xs font-medium text-slate-500">Balance</div>
            <div className="metric-amount truncate text-xl font-bold tracking-tight tabular-nums text-slate-900 sm:text-2xl">{money(a.balance)}</div>
          </div>
          <div className="min-w-0 p-3.5">
            <div className="mb-1.5 flex items-center justify-between gap-1">
              <span className="text-xs font-medium text-slate-500">Equity</span>
              <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums', floating > 0 ? 'bg-emerald-50 text-emerald-600' : floating < 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-200/70 text-slate-600')}>
                {floating > 0 ? '+' : ''}{equityPct.toFixed(2)}%
              </span>
            </div>
            <div className="metric-amount truncate text-xl font-bold tracking-tight tabular-nums text-slate-900 sm:text-2xl">{money(equity)}</div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between px-0.5 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500">Leverage <span className="rounded-md bg-slate-100 px-2 py-0.5 font-semibold tabular-nums text-slate-700">1:{a.leverage}</span></div>
          <div className="flex items-center gap-1.5"><span className="text-slate-500">Floating</span><span className={cn('rounded-md px-2 py-0.5 font-bold tabular-nums', floating > 0 ? 'bg-emerald-50 text-emerald-600' : floating < 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600')}>{money(floating)}</span></div>
        </div>

        <div className="mt-4 space-y-2.5">
          <Button onClick={() => go('/terminal')} className="h-11 w-full rounded-xl bg-[#0066FF] text-sm font-semibold text-white shadow-sm hover:bg-[#0052CC]">
            <CandlestickChart className="mr-2 h-4 w-4" /> Trade
          </Button>
          <div className="grid grid-cols-2 gap-2.5">
            {a.type === 'Real' ? <>
              <Button variant="outline" onClick={() => go('/deposit')} className="h-10 w-full rounded-xl border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 hover:bg-slate-100 sm:text-sm">
                <ArrowDownToLine className="mr-1.5 h-4 w-4 text-[#0066FF]" /> Deposit
              </Button>
              <Button variant="outline" onClick={() => go('/withdraw')} className="h-10 w-full rounded-xl border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 hover:bg-slate-100 sm:text-sm">
                <ArrowUpFromLine className="mr-1.5 h-4 w-4 text-slate-600" /> Withdraw
              </Button>
            </> : <>
              <Button variant="outline" onClick={() => void adjustDemo('topup')} disabled={demoBusy} className="h-10 w-full rounded-xl border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 hover:bg-slate-100 sm:text-sm">
                <Wallet className="mr-1.5 h-4 w-4 text-[#0066FF]" /> Add balance
              </Button>
              <Button variant="outline" onClick={() => { onSelect(); toast.info('Demo withdrawals are disabled.'); }} className="h-10 w-full rounded-xl border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 hover:bg-slate-100 sm:text-sm">
                <ArrowUpFromLine className="mr-1.5 h-4 w-4" /> Withdraw
              </Button>
            </>}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200/90 bg-white">
        <button type="button" onClick={onToggleTrades} aria-expanded={expanded}
          className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-slate-50/80">
          <span className="text-xs font-bold text-slate-900 sm:text-sm">Running trades &amp; trade history</span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
            {expanded ? 'Hide' : 'Show'} {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </button>
        {expanded && <div className="h-[360px] min-h-[280px] border-t border-slate-100 bg-white"><PositionsPanel /></div>}
      </div>

      <AlertDialog open={arch} onOpenChange={setArch}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Archive account #{a.number}?</AlertDialogTitle><AlertDialogDescription>This account will be archived from your active account list. Existing financial and trade history is retained.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => t.archive(a.id)}>Archive</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
