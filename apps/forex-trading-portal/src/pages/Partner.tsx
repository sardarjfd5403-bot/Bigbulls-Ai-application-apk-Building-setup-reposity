import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Copy, Users, BarChart3, DollarSign, Wallet, Search, Handshake } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@project/components/ui/table';
import { cn } from '@project/components/lib/utils';
import { usePortal } from '../lib/portal';
import { fmt, money } from '../lib/symbols';

const TIERS = [['Bronze', '0 – 50 lots', '$6 / lot'], ['Silver', '50 – 250 lots', '$8 / lot'], ['Gold', '250 – 1,000 lots', '$10 / lot'], ['Platinum', '1,000+ lots', '$12 / lot']];

export default function Partner() {
  const p = usePortal();
  if (!p.ib.joined) {
    return (
      <div>
        <Card className="overflow-hidden">
          <div className="bg-primary p-10 text-primary-foreground">
            <Handshake className="h-10 w-10 opacity-80" />
            <h1 className="mt-4 text-3xl font-extrabold">Become a BIGBULLS Partner</h1>
            <p className="mt-2 max-w-xl opacity-80">Introduce traders and earn up to $12 per lot on every trade they make. Paid daily straight to your wallet.</p>
            <Button size="lg" variant="secondary" className="mt-6 font-bold" onClick={() => { p.joinIb(); toast.success('Welcome to the partner program'); }}>Join IB program</Button>
          </div>
          <div className="grid gap-px bg-border sm:grid-cols-4">{TIERS.map(([n, r, c]) => <div key={n} className="bg-card p-5"><div className="font-extrabold text-primary">{n}</div><div className="text-xs text-muted-foreground">{r}</div><div className="mt-2 font-bold">{c}</div></div>)}</div>
        </Card>
      </div>
    );
  }
  return <Dashboard />;
}

function Dashboard() {
  const p = usePortal();
  const [q, setQ] = useState('');
  const link = `${window.location.origin}/?ref=${p.ib.code}`;
  const lots = p.ib.clients.reduce((a, c) => a + c.lots, 0);
  const available = p.ibEarned - p.ib.paid;
  const tier = lots >= 1000 ? 'Platinum' : lots >= 250 ? 'Gold' : lots >= 50 ? 'Silver' : 'Bronze';
  const chart = useMemo(() => p.ib.clients.map((c) => ({ name: c.name.split(' ')[0], commission: Math.round(c.commission) })), [p.ib.clients]);
  const rows = p.ib.clients.filter((c) => (c.name + c.country).toLowerCase().includes(q.toLowerCase()));
  const copy = () => { navigator.clipboard.writeText(link); toast.success('Link copied'); };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-extrabold tracking-tight">Partner (IB)</h1><p className="mt-1 text-sm text-muted-foreground">Partner code <b className="text-primary">{p.ib.code}</b> · Tier <b className="text-primary">{tier}</b></p></div>
        <Button disabled={available <= 0} onClick={() => { p.withdrawCommission(); toast.success('Commission sent to wallet'); }}><Wallet className="mr-2 h-4 w-4" />Withdraw {money(available)} to wallet</Button>
      </div>
      <Card className="mt-5 flex flex-wrap items-center gap-3 p-4">
        <span className="text-xs font-bold text-muted-foreground">Referral link</span>
        <code className="num flex-1 truncate rounded bg-muted px-3 py-2 text-xs">{link}</code>
        <Button size="sm" variant="outline" onClick={copy}><Copy className="mr-2 h-4 w-4" />Copy</Button>
      </Card>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Users} label="Clients" v={String(p.ib.clients.length)} />
        <Kpi icon={BarChart3} label="Volume (lots)" v={fmt(lots)} />
        <Kpi icon={DollarSign} label="Total earned" v={money(p.ibEarned)} />
        <Kpi icon={Wallet} label="Available" v={money(available)} />
      </div>
      <Card className="mt-4 p-5">
        <div className="mb-3 font-bold">Commission by client</div>
        <div className="h-56"><ResponsiveContainer><BarChart data={chart}><XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} /><YAxis fontSize={11} tickLine={false} axisLine={false} /><Tooltip /><Bar dataKey="commission" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
      </Card>
      <Card className="mt-4 overflow-x-auto">
        <div className="flex items-center justify-between border-b p-4"><span className="font-bold">Referred clients</span>
          <div className="relative w-56"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
        <Table>
          <TableHeader><TableRow><TableHead>Client</TableHead><TableHead>Country</TableHead><TableHead>Joined</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Lots</TableHead><TableHead className="text-right">Commission</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-semibold">{c.name}</TableCell><TableCell>{c.country}</TableCell><TableCell className="text-muted-foreground">{format(c.joined, 'MMM d, yyyy')}</TableCell>
              <TableCell><span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', c.status === 'Active' ? 'bg-[hsl(var(--success)/0.12)] text-up' : 'bg-muted text-muted-foreground')}>{c.status}</span></TableCell>
              <TableCell className="num text-right">{fmt(c.lots)}</TableCell><TableCell className="num text-right font-bold text-up">{money(c.commission)}</TableCell>
            </TableRow>))}</TableBody>
        </Table>
      </Card>
    </div>
  );
}

const Kpi = ({ icon: I, label, v }: { icon: typeof Users; label: string; v: string }) => (
  <Card className="p-5"><I className="h-5 w-5 text-primary" /><div className="mt-3 text-xs font-semibold text-muted-foreground">{label}</div><div className="num mt-1 text-2xl font-extrabold">{v}</div></Card>
);
