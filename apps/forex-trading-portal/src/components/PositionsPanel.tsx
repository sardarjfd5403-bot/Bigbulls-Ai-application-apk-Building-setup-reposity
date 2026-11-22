import { useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@project/components/ui/dropdown-menu';
import { cn } from '@project/components/lib/utils';
import { pnl, positionPips, useTrading, Position } from '../lib/store';
import { SYM, money } from '../lib/symbols';

const TABS = ['Open', 'Pending', 'Closed'] as const;
const positionsCountLabel = (n: number) => `${n} open trade${n === 1 ? '' : 's'}`;

export default function PositionsPanel() {
  const t = useTrading();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Open');
  const [edit, setEdit] = useState<Position | null>(null);
  const [closeTarget, setCloseTarget] = useState<Position | null>(null);
  const [closeFilter, setCloseFilter] = useState<'all' | 'profit' | 'loss' | null>(null);
  const counts = { Open: t.positions.length, Pending: t.pending.length, Closed: t.history.length };
  const runningTotal = t.positions.reduce((sum, position) => sum + pnl(position, t.quotes), 0);

  return (
    <div className="flex h-full flex-col">
      {tab === 'Open' && <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
        <div><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total running P&L</div>
          <div className={cn('num text-lg font-extrabold', runningTotal >= 0 ? 'text-up' : 'text-destructive')}>{money(runningTotal)}</div></div>
        <div className="text-right"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Open trades</div>
          <div className="num text-sm font-bold">{counts.Open}</div></div>
      </div>}
      <div className="flex items-center gap-1 border-b px-3">
        {TABS.map((x) => (
          <button key={x} onClick={() => setTab(x)} className={cn('border-b-2 px-3 py-2 text-xs font-bold', tab === x ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}>
            {x} <span className="ml-1 rounded bg-muted px-1.5 text-[10px]">{counts[x]}</span>
          </button>
        ))}
        {tab === 'Open' && t.positions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" className="ml-auto h-7 text-xs">Close all ▾</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setCloseFilter('all')}>Close all positions</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCloseFilter('profit')}>Close profitable</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCloseFilter('loss')}>Close losing</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[760px] text-xs">
          <thead className="sticky top-0 bg-muted/80 text-[10px] uppercase text-muted-foreground backdrop-blur">
            <tr className="text-left">{['Symbol', 'Type', 'Volume', 'Open price', tab === 'Closed' ? 'Close price' : 'Current', 'S/L', 'T/P', 'Time', tab === 'Pending' ? '' : 'Running P&L / Pips', ''].map((h, i) => <th key={i} className="px-3 py-1.5 font-bold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {tab === 'Open' && t.positions.map((p) => {
              const pr = pnl(p, t.quotes ?? {}); const pips = positionPips(p, t.quotes ?? {}); const info = SYM[p.symbol] ?? SYM.EURUSD; const d = info.digits; const q = t.quotes?.[p.symbol] ?? { bid: info.start, ask: info.start + info.spread };
              return (
                <tr key={p.id} className="border-b hover:bg-muted/40">
                  <td className="px-3 py-2 font-bold">{p.symbol}</td><td className={cn('px-3 font-bold', p.side === 'buy' ? 'text-primary' : 'text-destructive')}>{p.side.toUpperCase()}</td>
                  <td className="num px-3">{p.volume}</td><td className="num px-3">{p.openPrice.toFixed(d)}</td>
                  <td className="num px-3">{(p.side === 'buy' ? q.bid : q.ask).toFixed(d)}</td>
                  <td className="num px-3">{p.sl?.toFixed(d) ?? '—'}</td><td className="num px-3">{p.tp?.toFixed(d) ?? '—'}</td>
                  <td className="px-3 text-muted-foreground">{format(p.openTime, 'MMM d HH:mm:ss')}</td>
                  <td className={cn('num px-3 font-bold', pr >= 0 ? 'text-up' : 'text-destructive')}><div>{money(pr)}</div><div className="text-[10px] font-medium opacity-80">{pips >= 0 ? '+' : ''}{pips.toFixed(1)} pips</div></td>
                  <td className="whitespace-nowrap px-3 text-right">
                    <button onClick={() => setEdit(p)} className="mr-2 text-muted-foreground hover:text-primary" aria-label="Modify"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setCloseTarget(p)} className="text-muted-foreground hover:text-destructive" aria-label="Close"><X className="h-4 w-4" /></button>
                  </td>
                </tr>
              );
            })}
            {tab === 'Pending' && t.pending.map((o) => {
              const info = SYM[o.symbol] ?? SYM.EURUSD; const d = info.digits; const q = t.quotes?.[o.symbol] ?? { bid: info.start, ask: info.start + info.spread };
              return (
                <tr key={o.id} className="border-b hover:bg-muted/40">
                  <td className="px-3 py-2 font-bold">{o.symbol}</td><td className={cn('px-3 font-bold', o.side === 'buy' ? 'text-primary' : 'text-destructive')}>{o.side.toUpperCase()} {o.kind.toUpperCase()}</td>
                  <td className="num px-3">{o.volume}</td><td className="num px-3">{o.price.toFixed(d)}</td>
                  <td className="num px-3">{q.bid.toFixed(d)}</td>
                  <td className="num px-3">{o.sl?.toFixed(d) ?? '—'}</td><td className="num px-3">{o.tp?.toFixed(d) ?? '—'}</td>
                  <td className="px-3 text-muted-foreground">{format(o.created, 'MMM d HH:mm:ss')}</td><td />
                  <td className="px-3 text-right"><button onClick={() => t.cancelPending(o.id)} className="text-muted-foreground hover:text-destructive" aria-label="Cancel"><X className="h-4 w-4" /></button></td>
                </tr>
              );
            })}
            {tab === 'Closed' && t.history.slice(0, 200).map((c) => {
              const d = (SYM[c.symbol] ?? SYM.EURUSD).digits;
              return (
                <tr key={c.id} className="border-b hover:bg-muted/40">
                  <td className="px-3 py-2 font-bold">{c.symbol}</td><td className={cn('px-3 font-bold', c.side === 'buy' ? 'text-primary' : 'text-destructive')}>{c.side.toUpperCase()}</td>
                  <td className="num px-3">{c.volume}</td><td className="num px-3">{c.openPrice.toFixed(d)}</td><td className="num px-3">{c.closePrice.toFixed(d)}</td>
                  <td className="num px-3">{c.sl?.toFixed(d) ?? '—'}</td><td className="num px-3">{c.tp?.toFixed(d) ?? '—'}</td>
                  <td className="px-3 text-muted-foreground">{format(c.closeTime, 'MMM d HH:mm:ss')}</td>
                  <td className={cn('num px-3 font-bold', c.profit >= 0 ? 'text-up' : 'text-destructive')}>{money(c.profit)}</td>
                  <td className="px-3 text-right text-[10px] text-muted-foreground">{c.reason}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {counts[tab] === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No {tab.toLowerCase()} orders</p>}
      </div>
      {edit && <ModifyDialog p={edit} onClose={() => setEdit(null)} />}
      <Dialog open={!!closeTarget || !!closeFilter} onOpenChange={(open) => { if (!open) { setCloseTarget(null); setCloseFilter(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{closeTarget ? `Close ${closeTarget.side.toUpperCase()} ${closeTarget.volume} ${closeTarget.symbol}?` : closeFilter === 'all' ? 'Close all open trades?' : closeFilter === 'profit' ? 'Close all profitable trades?' : 'Close all losing trades?'}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{closeTarget ? 'This trade will be sent to the BIGBULLS execution engine for closing.' : `This will submit close requests for ${closeFilter === 'all' ? positionsCountLabel(counts.Open) : closeFilter === 'profit' ? 'profitable open trades' : 'losing open trades'}.`}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCloseTarget(null); setCloseFilter(null); }}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (closeTarget) t.closePosition(closeTarget.id); else if (closeFilter) t.closeAll(closeFilter); setCloseTarget(null); setCloseFilter(null); }}>Confirm close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ModifyDialog({ p, onClose }: { p: Position; onClose: () => void }) {
  const t = useTrading(); const d = (SYM[p.symbol] ?? SYM.EURUSD).digits;
  const [sl, setSl] = useState(p.sl?.toFixed(d) ?? ''); const [tp, setTp] = useState(p.tp?.toFixed(d) ?? '');
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Modify {p.side.toUpperCase()} {p.volume} {p.symbol}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold">Stop Loss<Input className="num mt-1" value={sl} onChange={(e) => setSl(e.target.value)} placeholder="Not set" /></label>
          <label className="text-xs font-semibold">Take Profit<Input className="num mt-1" value={tp} onChange={(e) => setTp(e.target.value)} placeholder="Not set" /></label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { t.modifyPosition(p.id, sl ? Number(sl) : undefined, tp ? Number(tp) : undefined); onClose(); }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
