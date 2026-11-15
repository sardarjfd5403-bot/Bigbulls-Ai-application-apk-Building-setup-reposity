import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { cn } from '@project/components/lib/utils';
import { useTrading, Account } from '../lib/store';

const KINDS: { kind: Account['kind']; desc: string; spread: string }[] = [
  { kind: 'Standard', desc: 'Most popular, no commission', spread: 'From 0.2 pips' },
  { kind: 'Pro', desc: 'Instant execution, low spreads', spread: 'From 0.1 pips' },
  { kind: 'Raw Spread', desc: 'Low raw spreads, fixed commission', spread: 'From 0.0 pips' },
  { kind: 'Zero', desc: '0 spread on top 30 instruments', spread: 'From 0.0 pips' },
];
export const LEVERAGES = [100, 200, 500, 1000, 2000];

export default function OpenAccountDialog({ open, onOpenChange, defaultType }: { open: boolean; onOpenChange: (b: boolean) => void; defaultType: 'Real' | 'Demo' }) {
  const t = useTrading();
  const [type, setType] = useState<'Real' | 'Demo'>(defaultType);
  const [kind, setKind] = useState<Account['kind']>('Standard');

  const [lev, setLev] = useState('500');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Open new account</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 rounded-lg bg-muted p-1">
          {(['Real', 'Demo'] as const).map((x) => <button key={x} onClick={() => setType(x)} className={cn('rounded-md py-2 text-sm font-bold', type === x ? 'bg-card shadow-sm' : 'text-muted-foreground')}>{x}</button>)}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {KINDS.map((k) => (
            <button key={k.kind} onClick={() => setKind(k.kind)} className={cn('rounded-xl border-2 p-4 text-left transition', kind === k.kind ? 'border-primary bg-accent' : 'hover:border-primary/40')}>
              <div className="font-extrabold">{k.kind}</div><div className="mt-1 text-xs text-muted-foreground">{k.desc}</div><div className="mt-2 text-xs font-bold text-primary">{k.spread}</div>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-xs font-semibold">Platform<div className="mt-1 flex h-10 items-center rounded-md border bg-muted px-3 text-sm font-bold text-primary">BigBulls Terminal</div></div>
          <label className="text-xs font-semibold">Leverage
            <Select value={lev} onValueChange={setLev}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{LEVERAGES.map((l) => <SelectItem key={l} value={String(l)}>1:{l}</SelectItem>)}</SelectContent></Select>
          </label>
        </div>
        <DialogFooter><Button onClick={() => { t.openAccount({ type, kind, platform: 'BigBulls Terminal', leverage: Number(lev) }); onOpenChange(false); }}>Create account</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
