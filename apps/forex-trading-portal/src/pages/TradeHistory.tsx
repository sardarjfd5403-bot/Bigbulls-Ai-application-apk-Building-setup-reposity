import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Search } from 'lucide-react';
import { Card } from '@project/components/ui/card';
import { Input } from '@project/components/ui/input';
import { Button } from '@project/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@project/components/ui/table';
import { cn } from '@project/components/lib/utils';
import { useTrading } from '../lib/store';
import { getSymbolInfo, money } from '../lib/symbols';

const PAGE = 20;

export default function TradeHistory() {
  const t = useTrading();
  const [acc, setAcc] = useState('all'); const [q, setQ] = useState(''); const [page, setPage] = useState(0);
  const accNo = (id: string) => t.state.accounts.find((a) => a.id === id)?.number ?? '—';
  const rows = useMemo(() => t.state.history
    .filter((h) => (acc === 'all' || h.accountId === acc) && h.symbol.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.closeTime - a.closeTime), [t.state.history, acc, q]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const total = rows.reduce((s, r) => s + r.profit, 0);

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Trade history</h1>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Select value={acc} onValueChange={(v) => { setAcc(v); setPage(0); }}><SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All accounts</SelectItem>{t.state.accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.type} #{a.number}</SelectItem>)}</SelectContent></Select>
        <div className="relative w-full sm:w-56"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" placeholder="Symbol" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /></div>
        <div className="ml-auto text-sm">Net result: <b className={cn('num', total >= 0 ? 'text-up' : 'text-destructive')}>{money(total)}</b></div>
      </div>
      <Card className="mt-4 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>{['Closed', 'Account', 'Symbol', 'Type', 'Volume', 'Open', 'Close', 'Reason', 'Profit'].map((h) => <TableHead key={h} className={h === 'Profit' ? 'text-right' : ''}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {rows.slice(page * PAGE, page * PAGE + PAGE).map((r) => {
              const d = getSymbolInfo(r.symbol).digits;
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground">{format(r.closeTime, 'MMM d, HH:mm')}</TableCell><TableCell>#{accNo(r.accountId)}</TableCell>
                  <TableCell className="font-bold">{r.symbol}</TableCell><TableCell className={cn('font-bold', r.side === 'buy' ? 'text-primary' : 'text-destructive')}>{r.side.toUpperCase()}</TableCell>
                  <TableCell className="num">{r.volume}</TableCell><TableCell className="num">{r.openPrice.toFixed(d)}</TableCell><TableCell className="num">{r.closePrice.toFixed(d)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.reason}</TableCell>
                  <TableCell className={cn('num text-right font-bold', r.profit >= 0 ? 'text-up' : 'text-destructive')}>{money(r.profit)}</TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">No closed trades yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
      {pages > 1 && <div className="mt-3 flex items-center justify-end gap-2 text-sm"><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button><span>{page + 1} / {pages}</span><Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</Button></div>}
    </div>
  );
}
