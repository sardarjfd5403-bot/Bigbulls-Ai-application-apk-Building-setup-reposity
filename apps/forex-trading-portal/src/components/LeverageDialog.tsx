import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { cn } from '@project/components/lib/utils';
import { useTrading, Account } from '../lib/store';
import { LEVERAGES } from './OpenAccountDialog';

export default function LeverageDialog({ account, open, onOpenChange }: { account: Account; open: boolean; onOpenChange: (b: boolean) => void }) {
  const t = useTrading();
  const [lev, setLev] = useState(account.leverage);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Change leverage · #{account.number}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          {LEVERAGES.map((l) => (
            <button key={l} onClick={() => setLev(l)} className={cn('rounded-lg border-2 py-2.5 text-sm font-bold', lev === l ? 'border-primary bg-accent text-primary' : 'hover:border-primary/40')}>1:{l}</button>
          ))}
        </div>
        <DialogFooter><Button onClick={() => { t.setLeverage(account.id, lev); onOpenChange(false); }}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
