import { useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Wallet as WalletIcon, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Card } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { cn } from '@project/components/lib/utils';
import { useTrading } from '../lib/store';
import { usePortal } from '../lib/portal';
import { money } from '../lib/symbols';

export default function WalletPage() {
  const t = useTrading(); const p = usePortal();
  const real = t.state.accounts.filter((a) => a.type === 'Real');
  const [dir, setDir] = useState<'to' | 'from'>('to');
  const [acc, setAcc] = useState(real[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const n = Number(amount); const a = real.find((x) => x.id === acc);
  const max = dir === 'to' ? p.wallet : a?.balance ?? 0;
  const err = !amount ? '' : !(n > 0) ? 'Enter a valid amount' : n > max ? 'Insufficient funds' : '';

  const go = () => {
    if (!a || !n || err) return;
    if (dir === 'to') { p.walletDebit(`To account #${a.number}`, n); t.walletMove(a.id, n); }
    else { t.walletMove(a.id, -n); p.walletCredit(`From account #${a.number}`, n); }
    toast.success('Transfer completed'); setAmount('');
  };

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Wallet</h1>
      <p className="mt-1 text-sm text-muted-foreground">Your BIGBULLS wallet holds funds outside trading accounts — commissions, bonuses and transfers.</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card className="relative overflow-hidden bg-primary p-6 text-primary-foreground">
            <WalletIcon className="absolute -right-4 -top-4 h-32 w-32 opacity-10" />
            <div className="text-sm font-semibold opacity-80">Wallet balance</div>
            <div className="num mt-2 text-4xl font-extrabold">{money(p.wallet)}</div>
            <div className="mt-1 text-xs opacity-70">USD · Main wallet</div>
          </Card>
          <Card>
            <div className="border-b px-5 py-3 font-bold">Wallet activity</div>
            {p.walletTxns.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No wallet activity yet</p>}
            {p.walletTxns.slice(0, 30).map((x) => (
              <div key={x.id} className="flex items-center gap-3 border-b px-5 py-3 last:border-0">
                <div className={cn('flex h-9 w-9 items-center justify-center rounded-full', x.type === 'Credit' ? 'bg-[hsl(var(--success)/0.12)] text-up' : 'bg-destructive/10 text-destructive')}>
                  {x.type === 'Credit' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                </div>
                <div className="flex-1"><div className="text-sm font-semibold">{x.note}</div><div className="text-xs text-muted-foreground">{format(x.time, 'MMM d, yyyy HH:mm')}</div></div>
                <div className={cn('num font-bold', x.type === 'Credit' ? 'text-up' : 'text-destructive')}>{x.type === 'Credit' ? '+' : '-'}{money(x.amount)}</div>
              </div>
            ))}
          </Card>
        </div>
        <Card className="h-fit space-y-4 p-5">
          <div className="grid grid-cols-2 rounded-lg bg-muted p-1">
            {(['to', 'from'] as const).map((d) => <button key={d} onClick={() => setDir(d)} className={cn('rounded-md py-2 text-xs font-bold', dir === d ? 'bg-card shadow-sm' : 'text-muted-foreground')}>{d === 'to' ? 'Wallet → Account' : 'Account → Wallet'}</button>)}
          </div>
          {real.length === 0 ? <p className="text-sm text-muted-foreground">Open a Real account to move funds.</p> : <>
            <label className="block text-xs font-semibold">Trading account
              <Select value={acc} onValueChange={setAcc}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{real.map((x) => <SelectItem key={x.id} value={x.id}>#{x.number} · {money(x.balance)}</SelectItem>)}</SelectContent></Select>
            </label>
            <label className="block text-xs font-semibold">Amount (USD)
              <Input className="num mt-1 h-11" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
              <span className={cn('mt-1 block text-xs', err ? 'text-destructive' : 'text-muted-foreground')}>{err || `Available: ${money(max)}`}</span>
            </label>
            <Button className="h-11 w-full font-bold" disabled={!n || !!err} onClick={go}>Transfer</Button>
          </>}
        </Card>
      </div>
    </div>
  );
}
