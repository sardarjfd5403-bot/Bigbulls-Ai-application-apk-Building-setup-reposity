import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Search } from 'lucide-react';
import { Card } from '@project/components/ui/card';
import { Input } from '@project/components/ui/input';
import { Button } from '@project/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@project/components/ui/table';
import { cn } from '@project/components/lib/utils';
import { useTrading } from '../lib/store';
import { money } from '../lib/symbols';

const TYPES = ['All', 'Deposit', 'Withdrawal', 'Transfer'] as const;
const PAGE = 15;

export default function HistoryPage() {
  const t = useTrading();
  const [type, setType] = useState<(typeof TYPES)[number]>('All');
  const [q, setQ] = useState(''); const [page, setPage] = useState(0);
  const [desc, setDesc] = useState(true);
  const accNo = (id: string) => t.state.accounts.find((a) => a.id === id)?.number ?? '—';

  const rows = useMemo(() => t.state.txns
    .filter((x) => (type === 'All' || x.type === type) && (x.method + accNo(x.accountId)).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (desc ? b.time - a.time : a.time - b.time)), [t.state.txns, type, q, desc]); // eslint-disable-line react-hooks/exhaustive-deps
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Transaction history</h1>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {TYPES.map((x) => <Button key={x} size="sm" variant={type === x ? 'default' : 'outline'} onClick={() => { setType(x); setPage(0); }}>{x}</Button>)}
        <div className="relative ml-auto w-full sm:w-64"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" placeholder="Search method or account" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /></div>
      </div>
      <Card className="mt-4 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="cursor-pointer" onClick={() => setDesc(!desc)}>Date {desc ? '↓' : '↑'}</TableHead>
            <TableHead>Type</TableHead><TableHead>Account</TableHead><TableHead>Method</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.slice(page * PAGE, page * PAGE + PAGE).map((x) => (
              <TableRow key={x.id}>
                <TableCell className="text-muted-foreground">{format(x.time, 'MMM d, yyyy HH:mm')}</TableCell>
                <TableCell className="font-semibold">{x.type}</TableCell><TableCell>#{accNo(x.accountId)}</TableCell><TableCell>{x.method}</TableCell>
                <TableCell><span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', x.status === 'Done' ? 'bg-[hsl(var(--success)/0.12)] text-up' : 'bg-accent text-primary')}>{x.status}</span></TableCell>
                <TableCell className={cn('num text-right font-bold', x.type === 'Withdrawal' ? 'text-destructive' : 'text-up')}>{x.type === 'Withdrawal' ? '-' : '+'}{money(x.amount)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No transactions yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
      {pages > 1 && <div className="mt-3 flex items-center justify-end gap-2 text-sm"><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button><span>{page + 1} / {pages}</span><Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</Button></div>}
    </div>
  );
}
