import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useAuth } from '../lib/previewAuth';
import { Card } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Switch } from '@project/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { cn } from '@project/components/lib/utils';
import { usePortal, COUNTRIES, Profile as P } from '../lib/portal';

const schema = z.object({
  firstName: z.string().min(2, 'Required'), lastName: z.string().min(2, 'Required'),
  phone: z.string().regex(/^\+?[0-9 ]{8,16}$/, 'Enter a valid phone number'),
  country: z.string().min(1), dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  city: z.string().min(2, 'Required'), address: z.string().min(5, 'Required'), postal: z.string().min(3, 'Required'),
});

const TABS = ['Personal info', 'Security', 'Trading terminal', 'Notifications'] as const;

export default function ProfilePage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Personal info');
  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Settings</h1>
      <div className="mb-6 mt-5 flex gap-6 overflow-x-auto border-b">
        {TABS.map((x) => <button key={x} onClick={() => setTab(x)} className={cn('-mb-px whitespace-nowrap border-b-2 pb-3 text-sm font-bold', tab === x ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}>{x}</button>)}
      </div>
      {tab === 'Personal info' && <PersonalInfo />}
      {tab === 'Security' && <Security />}
      {tab === 'Trading terminal' && <Prefs kind="terminal" />}
      {tab === 'Notifications' && <Prefs kind="notify" />}
    </div>
  );
}

function PersonalInfo() {
  const p = usePortal(); const { user } = useAuth();
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<P>({ resolver: zodResolver(schema), defaultValues: p.profile });
  const F = (name: keyof P, label: string, ph?: string) => (
    <label key={name} className="block text-xs font-semibold">{label}
      <Input className={cn('mt-1', errors[name] && 'border-destructive')} placeholder={ph} {...register(name)} />
      {errors[name] && <span className="mt-1 block text-xs text-destructive">{errors[name]?.message}</span>}
    </label>
  );
  return (
    <Card className="max-w-2xl p-6">
      <form onSubmit={handleSubmit((v) => { p.saveProfile(v); toast.success('Profile saved'); })} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 text-xs font-semibold">Email<div className="mt-1 rounded-md border bg-muted px-3 py-2 text-sm">{user?.email}</div></div>
        {F('firstName', 'First name')}{F('lastName', 'Last name')}
        {F('phone', 'Phone', '+92 300 1234567')}{F('dob', 'Date of birth', '1995-06-21')}
        <label className="block text-xs font-semibold">Country
          <Select value={watch('country')} onValueChange={(v) => setValue('country', v)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
        </label>
        {F('city', 'City')}<div className="sm:col-span-2">{F('address', 'Street address')}</div>{F('postal', 'Postal code')}
        <div className="sm:col-span-2"><Button type="submit">Save changes</Button></div>
      </form>
    </Card>
  );
}

function Security() {
  const p = usePortal(); const { user } = useAuth();
  return (
    <div className="max-w-2xl space-y-3">
      <Row title="Sign-in method" desc={`One-time code sent to ${user?.email}`} />
      <Row title="Two-step verification" desc="Require a code for withdrawals and security changes"><Switch checked={p.twoFA} onCheckedChange={(v) => { p.setTwoFA(v); toast.success(v ? '2-step enabled' : '2-step disabled'); }} /></Row>
      <Row title="Active session" desc={`This device · ${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'} browser`} />
    </div>
  );
}

function Prefs({ kind }: { kind: 'terminal' | 'notify' }) {
  const p = usePortal();
  const items = kind === 'terminal'
    ? ([['oneClick', 'One-click trading', 'Open orders instantly without confirmation'], ['confirmClose', 'Confirm on close', 'Ask before closing a position'], ['sounds', 'Trade sounds', 'Play a sound when orders fill']] as const)
    : ([['email', 'Email notifications', 'Deposits, withdrawals and account updates'], ['push', 'Browser notifications', 'Margin calls and order fills'], ['news', 'Market news & offers', 'Analysis, promotions and BIGBULLS news']] as const);
  return (
    <div className="max-w-2xl space-y-3">
      {items.map(([k, t, d]) => (
        <Row key={k} title={t} desc={d}>
          <Switch checked={kind === 'terminal' ? p.terminal[k as keyof typeof p.terminal] : p.notify[k as keyof typeof p.notify]}
            onCheckedChange={(v) => (kind === 'terminal' ? p.setTerminal(k as keyof typeof p.terminal, v) : p.setNotify(k as keyof typeof p.notify, v))} />
        </Row>
      ))}
    </div>
  );
}

const Row = ({ title, desc, children }: { title: string; desc: string; children?: React.ReactNode }) => (
  <Card className="flex items-center gap-4 p-5"><div className="flex-1"><div className="font-bold">{title}</div><div className="text-xs text-muted-foreground">{desc}</div></div>{children}</Card>
);
