import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown } from 'lucide-react';
import { Card } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { useTrading } from '../lib/store';
import { bigbullsBackend } from '../lib/bigbullsBackend';
import { money } from '../lib/symbols';

export default function Transfer() {
  const t = useTrading();
  const real = t.state.accounts.filter((a) => a.type === 'Real');
  const [from, setFrom] = useState(real[0]?.id ?? ''); const [to, setTo] = useState(real[1]?.id ?? '');
  const [amount, setAmount] = useState(''); const [busy,setBusy] = useState(false);
  const src = real.find((a) => a.id === from); const n = Number(amount);
  const err = !amount ? '' : !(n > 0) ? 'Enter a valid amount' : src && n > src.balance ? 'Insufficient balance' : from === to ? 'Choose two different accounts' : '';
  const Pick = ({ v, set, label }: { v: string; set: (s: string) => void; label: string }) => (
    <label className="block text-xs font-semibold">{label}
      <Select value={v} onValueChange={set}><SelectTrigger className="mt-1 h-11"><SelectValue placeholder="Select account" /></SelectTrigger>
        <SelectContent>{real.map((a) => <SelectItem key={a.id} value={a.id}>#{a.number} · {a.kind} · {money(a.balance)}</SelectItem>)}</SelectContent></Select>
    </label>
  );
  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Transfer</h1>
      <p className="mt-1 text-sm text-muted-foreground">Move funds instantly between your Real accounts.</p>
      <Card className="mt-6 max-w-md space-y-4 p-6">
        {real.length < 2 ? <p className="text-sm text-muted-foreground">You need at least two Real accounts to transfer funds.</p> : <>
          <Pick v={from} set={setFrom} label="From" />
          <div className="flex justify-center"><ArrowDown className="h-5 w-5 text-primary" /></div>
          <Pick v={to} set={setTo} label="To" />
          <label className="block text-xs font-semibold">Amount (USD)
            <Input className="num mt-1 h-11" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            {err && <span className="mt-1 block text-xs text-destructive">{err}</span>}
          </label>
          <Button className="h-11 w-full font-bold" disabled={busy || !n || !!err || !to} onClick={async () => { setBusy(true); try { await bigbullsBackend.clientFundsTransfer({fromType:'account',fromAccountId:from,toType:'account',toAccountId:to,amount:n,note:'Real account to Real account transfer'}); toast.success(`${money(n)} transferred`); setAmount(''); await t.refresh(); } catch(e:any) { toast.error(e.message || 'Transfer rejected'); } finally { setBusy(false); } }}>{busy?'Processing…':'Transfer'}</Button>
        </>}
      </Card>
    </div>
  );
}
