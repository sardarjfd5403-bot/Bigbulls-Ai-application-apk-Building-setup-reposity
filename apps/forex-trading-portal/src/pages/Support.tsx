import { useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { MessageSquare, Plus } from 'lucide-react';
import { Card } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@project/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { cn } from '@project/components/lib/utils';
import { usePortal } from '../lib/portal';

const FAQ = [
  ['How long do withdrawals take?', 'Most withdrawals are processed instantly and automatically. Bank transfers may take 1–3 business hours.'],
  ['Why do I need to verify my account?', 'Regulations require us to confirm your identity and residence. Fully verified clients have no deposit limits and can withdraw at any time.'],
  ['What is the difference between account types?', 'Standard has no commission. Pro offers instant execution. Raw Spread and Zero offer the tightest spreads with a small commission per lot.'],
  ['How do I change my leverage?', 'Go to My accounts, open the ⋮ menu on an account and choose Change leverage.'],
  ['How does the partner program work?', 'Share your referral link. You earn a commission for every lot your referred clients trade, credited to your wallet.'],
];
const CATS = ['Deposits & withdrawals', 'Verification', 'Trading', 'Partner program', 'Other'];

export default function Support() {
  const p = usePortal();
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-extrabold tracking-tight">Help center</h1><p className="mt-1 text-sm text-muted-foreground">Support is available 24/7.</p></div>
        <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />New request</Button>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5"><div className="mb-2 font-bold">Frequently asked questions</div>
          <Accordion type="single" collapsible>{FAQ.map(([q, a]) => <AccordionItem key={q} value={q}><AccordionTrigger className="text-left text-sm">{q}</AccordionTrigger><AccordionContent className="text-sm text-muted-foreground">{a}</AccordionContent></AccordionItem>)}</Accordion>
        </Card>
        <Card><div className="border-b p-5 font-bold">My requests</div>
          {p.tickets.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No support requests yet</p>}
          {p.tickets.map((t) => (
            <div key={t.id} className="flex items-start gap-3 border-b p-4 last:border-0">
              <MessageSquare className="mt-0.5 h-4 w-4 text-primary" />
              <div className="min-w-0 flex-1"><div className="font-semibold">{t.subject}</div><div className="text-xs text-muted-foreground">{t.category} · {format(t.time, 'MMM d, HH:mm')}</div><p className="mt-1 line-clamp-2 text-sm">{t.message}</p></div>
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', t.status === 'Closed' ? 'bg-muted text-muted-foreground' : 'bg-accent text-primary')}>{t.status}</span>
              {t.status !== 'Closed' && <Button size="sm" variant="ghost" onClick={() => p.closeTicket(t.id)}>Close</Button>}
            </div>
          ))}
        </Card>
      </div>
      <NewTicket open={open} onOpenChange={setOpen} />
    </div>
  );
}

function NewTicket({ open, onOpenChange }: { open: boolean; onOpenChange: (b: boolean) => void }) {
  const p = usePortal();
  const [subject, setSubject] = useState(''); const [category, setCategory] = useState(CATS[0]); const [message, setMessage] = useState('');
  const [tried, setTried] = useState(false);
  const bad = subject.trim().length < 4 || message.trim().length < 10;
  const submit = () => { setTried(true); if (bad) return; p.createTicket({ subject, category, message }); toast.success('Request sent'); setSubject(''); setMessage(''); setTried(false); onOpenChange(false); };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New support request</DialogTitle></DialogHeader>
        <Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
        <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <Textarea rows={5} placeholder="Describe your issue" value={message} onChange={(e) => setMessage(e.target.value)} />
        {tried && bad && <p className="text-xs text-destructive">Add a subject (4+ characters) and a message (10+ characters).</p>}
        <DialogFooter><Button onClick={submit}>Send</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
