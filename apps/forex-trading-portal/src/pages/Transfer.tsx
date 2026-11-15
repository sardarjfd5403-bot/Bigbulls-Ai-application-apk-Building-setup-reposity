import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown } from 'lucide-react';
import { Card } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { useTrading } from '../lib/store';
import { money } from '../lib/symbols';

export default function Transfer() {
  const t = useTrading();
  const real = t.state.accounts.filter((a) => a.type === 'Real');
  const [from, setFrom] = useState(real[0]?.id ?? ''); const [to, setTo] = useState(real[1]?.id ?? '');
  const [amount, setAmount] = useState('');
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
          <Button className="h-11 w-full font-bold" disabled={!n || !!err || !to} onClick={() => { t.transfer(from, to, n); toast.success(`${money(n)} transferred`); setAmount(''); }}>Transfer</Button>
        </>}
      </Card>
    </div>
  );
}
