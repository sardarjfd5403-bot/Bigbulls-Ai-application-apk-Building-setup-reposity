import { useState } from 'react';
import { toast } from 'sonner';
import { Landmark, CreditCard, Bitcoin, Wallet, Smartphone, CheckCircle2 } from 'lucide-react';
import { Card } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { cn } from '@project/components/lib/utils';
import { useTrading } from '../lib/store';
import { money } from '../lib/symbols';
import { usePortal } from '../lib/portal';
import { Link } from 'react-router-dom';

const METHODS = [
  { name: 'Bank Card', icon: CreditCard, time: 'Instant', fee: '0%', min: 10 },
  { name: 'Bank Transfer', icon: Landmark, time: '1–3 hours', fee: '0%', min: 50 },
  { name: 'USDT (TRC20)', icon: Bitcoin, time: 'Instant – 15 min', fee: '0%', min: 10 },
  { name: 'Bitcoin', icon: Bitcoin, time: 'Instant – 30 min', fee: '0%', min: 10 },
  { name: 'Skrill', icon: Wallet, time: 'Instant', fee: '0%', min: 10 },
  { name: 'JazzCash / Easypaisa', icon: Smartphone, time: 'Instant', fee: '0%', min: 10 },
];

export default function Funds({ mode }: { mode: 'Deposit' | 'Withdrawal' }) {
  const t = useTrading(); const kyc = usePortal();
  const depositedTotal = t.state.txns.filter((x) => x.type === 'Deposit').reduce((a, x) => a + x.amount, 0);
  const limitLeft = kyc.verified ? Infinity : Math.max(0, 2000 - depositedTotal);
  const real = t.state.accounts.filter((a) => a.type === 'Real');
  const [method, setMethod] = useState<string | null>(null);
  const [accId, setAccId] = useState(real[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const m = METHODS.find((x) => x.name === method);
  const acc = real.find((a) => a.id === accId);
  const n = Number(amount);
  const err = !amount ? '' : !(n > 0) ? 'Enter a valid amount' : m && n < m.min ? `Minimum is $${m.min}` : mode === 'Withdrawal' && acc && n > acc.balance ? 'Amount exceeds available balance' : mode === 'Deposit' && n > limitLeft ? `Unverified limit: you can deposit up to ${money(limitLeft)} more` : '';

  const submit = () => {
    if (!acc || !m || !n || err) return;
    t.transact(acc.id, mode, m.name, n);
    toast.success(mode === 'Deposit' ? `${money(n)} deposited to #${acc.number}` : `Withdrawal of ${money(n)} requested`);
    setAmount(''); setMethod(null);
  };

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">{mode}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{mode === 'Deposit' ? 'Choose a payment method to fund your account.' : 'Choose where to receive your funds.'}</p>
      {mode === 'Withdrawal' && !kyc.verified && <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl bg-accent p-4 text-sm text-accent-foreground"><span className="flex-1">Withdrawals are available once your account is fully verified.</span><Link to="/verification" className="font-bold text-primary underline">Verify now</Link></div>}
      {mode === 'Deposit' && !kyc.verified && <div className="mt-6 rounded-xl bg-accent p-4 text-sm text-accent-foreground">Unverified accounts can deposit up to $2,000 in total. Remaining: <b>{money(limitLeft)}</b>. <Link to="/verification" className="font-bold text-primary underline">Verify</Link> to remove the limit.</div>}
      {real.length === 0 && <Card className="mt-6 p-6 text-sm text-muted-foreground">Open a Real account first to {mode.toLowerCase()} funds.</Card>}
      {real.length > 0 && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="grid gap-3 sm:grid-cols-2">
            {METHODS.map((x) => (
              <button key={x.name} onClick={() => setMethod(x.name)} className={cn('flex items-start gap-3 rounded-xl border-2 bg-card p-4 text-left transition', method === x.name ? 'border-primary' : 'border-transparent shadow-sm hover:border-primary/40')}>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary"><x.icon className="h-5 w-5" /></div>
                <div className="flex-1">
                  <div className="font-bold">{x.name}</div>
                  <div className="mt-1 grid grid-cols-2 gap-x-2 text-[11px] text-muted-foreground"><span>Processing: {x.time}</span><span>Fee: {x.fee}</span><span>Min: ${x.min}</span></div>
                </div>
                {method === x.name && <CheckCircle2 className="h-5 w-5 text-primary" />}
              </button>
            ))}
          </div>
          <Card className="h-fit space-y-4 p-5">
            <div className="font-bold">{m ? m.name : 'Select a method'}</div>
            <label className="block text-xs font-semibold">{mode === 'Deposit' ? 'To account' : 'From account'}
              <Select value={accId} onValueChange={setAccId}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{real.map((a) => <SelectItem key={a.id} value={a.id}>#{a.number} · {money(a.balance)}</SelectItem>)}</SelectContent></Select>
            </label>
            <label className="block text-xs font-semibold">Amount (USD)
              <Input className={cn('num mt-1 h-11 text-lg', err && 'border-destructive')} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
              {err && <span className="mt-1 block text-xs text-destructive">{err}</span>}
            </label>
            <div className="flex gap-2">{[100, 500, 1000].map((v) => <Button key={v} variant="outline" size="sm" onClick={() => setAmount(String(v))}>${v}</Button>)}</div>
            <Button className="h-11 w-full font-bold" disabled={!m || !n || !!err || (mode === 'Withdrawal' && !kyc.verified)} onClick={submit}>{mode === 'Deposit' ? 'Deposit' : 'Withdraw'} {n > 0 && !err ? money(n) : ''}</Button>
          </Card>
        </div>
      )}
    </div>
  );
}
