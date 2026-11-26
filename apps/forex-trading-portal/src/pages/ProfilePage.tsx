import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useAuth } from '../lib/previewAuth';
import { bigbullsBackend } from '../lib/bigbullsBackend';
import { Card } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Switch } from '@project/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { cn } from '@project/components/lib/utils';
import { usePortal, COUNTRIES, Profile as P } from '../lib/portal';
import { isNativeApp, readAppPin, saveAppPin, removeAppPin } from '../lib/appLock';

const schema = z.object({
  firstName: z.string().min(2, 'Required'),
  lastName: z.string().min(2, 'Required'),
  phone: z.string().regex(/^\\+?[0-9 ]{8,16}$/, 'Enter a valid phone number'),
  country: z.string().min(1),
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
      <div className="mt-8 border-t pt-4 text-center text-xs text-muted-foreground">BIGBULLS App Version v3.5.9</div>
    </div>
  );
}

function PersonalInfo() {
  const p = usePortal(); const { user } = useAuth();
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<Pick<P, 'firstName' | 'lastName' | 'phone' | 'country'>>({ resolver: zodResolver(schema), defaultValues: { firstName: p.profile.firstName, lastName: p.profile.lastName, phone: p.profile.phone, country: p.profile.country } });
  useEffect(() => { reset({ firstName: p.profile.firstName, lastName: p.profile.lastName, phone: p.profile.phone, country: p.profile.country }); }, [p.profile, reset]);
  const F = (name: 'firstName' | 'lastName' | 'phone', label: string, ph?: string) => (
    <label key={name} className="block text-xs font-semibold">{label}
      <Input className={cn('mt-1', errors[name] && 'border-destructive')} placeholder={ph} {...register(name)} />
      {errors[name] && <span className="mt-1 block text-xs text-destructive">{errors[name]?.message}</span>}
    </label>
  );
  return (
    <Card className="max-w-2xl p-6">
      <form onSubmit={handleSubmit(async (v) => { try { await bigbullsBackend.updateProfile({full_name:(v.firstName+' '+v.lastName).trim(),country:v.country,phone:v.phone}); p.saveProfile({ ...p.profile, ...v }); toast.success('Profile saved to BIGBULLS account'); } catch(e:any) { toast.error(e.message || 'Profile update failed'); } })} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 text-xs font-semibold">Email<div className="mt-1 rounded-md border bg-muted px-3 py-2 text-sm">{user?.email}</div></div>
        {F('firstName', 'First name')}{F('lastName', 'Last name')}
        {F('phone', 'Phone', '+92 300 1234567')}
        <label className="block text-xs font-semibold">Country
          <Select value={watch('country')} onValueChange={(v) => setValue('country', v)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
        </label>
        <div className="sm:col-span-2"><Button type="submit">Save changes</Button></div>
      </form>
    </Card>
  );
}

function Security() {
  const { user } = useAuth();
  const [enabled,setEnabled]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [pin,setPin]=useState('');
  const [confirmPin,setConfirmPin]=useState('');
  const [setup,setSetup]=useState(false);
  const native=isNativeApp();
  useEffect(()=>{
    let alive=true;
    bigbullsBackend.getAppLockSettings().then(async value=>{
      if(!alive)return;
      const stored=user?.id?await readAppPin(user.id):null;
      if(value&&!stored){await bigbullsBackend.setAppLockEnabled(false);if(alive)setEnabled(false);}
      else if(alive)setEnabled(value);
    }).catch(e=>toast.error(e.message||'App Lock setting could not be loaded')).finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[user?.id]);
  const toggle=async(value:boolean)=>{
    if(loading||saving||!user?.id)return;
    if(!value){
      setSaving(true);
      try{await bigbullsBackend.setAppLockEnabled(false);await removeAppPin(user.id);setEnabled(false);setSetup(false);setPin('');setConfirmPin('');toast.success('App Lock switched OFF.');}
      catch(e:any){toast.error(e.message||'Could not disable App Lock');}
      finally{setSaving(false);}
      return;
    }
    const stored=await readAppPin(user.id);
    if(stored){
      setSaving(true);
      try{await bigbullsBackend.setAppLockEnabled(true);setEnabled(true);toast.success('App Lock enabled.');}
      catch(e:any){toast.error(e.message||'Could not enable App Lock');}
      finally{setSaving(false);}
    }else setSetup(true);
  };
  const save=async()=>{
    if(!user?.id||!/^[0-9]{6}$/.test(pin)||pin!==confirmPin){toast.error('Enter and confirm the same 6-digit PIN.');return;}
    setSaving(true);
    try{await saveAppPin(user.id,pin);await bigbullsBackend.setAppLockEnabled(true);setEnabled(true);setSetup(false);setPin('');setConfirmPin('');toast.success('App Lock enabled securely on this device.');}
    catch(e:any){toast.error(e.message||'App Lock could not be saved');}
    finally{setSaving(false);}
  };
  return (
    <div className="max-w-2xl space-y-3">
      <Row title="BIGBULLS account" desc={user?.email || 'Signed-in BIGBULLS account'} />
      <Row title="Device App Lock" desc={native?'Optional 6-digit PIN protected by Android Keystore. OFF by default.':'Available in the installed Android app.'}>
        <Switch checked={enabled} disabled={!native||loading||saving} onCheckedChange={toggle}/>
      </Row>
      {setup&&native&&<Card className="space-y-3 p-5">
        <div><b className="text-sm">Create your 6-digit App Lock PIN</b><p className="mt-1 text-xs text-muted-foreground">This PIN is stored in Android secure storage on this device. It does not replace your BIGBULLS account password.</p></div>
        <Input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e=>setPin(e.target.value.replace(/\\D/g,'').slice(0,6))} placeholder="Enter 6-digit PIN"/>
        <Input type="password" inputMode="numeric" maxLength={6} value={confirmPin} onChange={e=>setConfirmPin(e.target.value.replace(/\\D/g,'').slice(0,6))} placeholder="Confirm PIN"/>
        <div className="flex gap-2"><Button disabled={saving} onClick={save}>{saving?'Saving…':'Save & enable'}</Button><Button variant="outline" onClick={()=>setSetup(false)}>Cancel</Button></div>
      </Card>}
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
