import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle2, Clock, Mail, Phone, User, IdCard, Home, Upload, ShieldCheck, Loader2, XCircle } from 'lucide-react';
import { useLocalUpload } from '../lib/previewAuth';
import { Card } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Progress } from '@project/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { cn } from '@project/components/lib/utils';
import { usePortal, KycStatus, KycStep } from '../lib/portal';

const STEPS: { key: KycStep; title: string; desc: string; icon: typeof Mail }[] = [
  { key: 'email', title: 'Email address', desc: 'Confirmed at sign-in', icon: Mail },
  { key: 'phone', title: 'Phone number', desc: 'Add your mobile number in your profile', icon: Phone },
  { key: 'profile', title: 'Profile details', desc: 'Name, date of birth and address', icon: User },
  { key: 'identity', title: 'Identity verification', desc: 'CNIC, passport or driving licence', icon: IdCard },
  { key: 'address', title: 'Proof of residence', desc: 'Utility bill or bank statement, last 6 months', icon: Home },
];

export default function Verification() {
  const p = usePortal();
  const done = STEPS.filter((s) => p.kyc[s.key] === 'Verified').length;
  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Verification</h1>
      <p className="mt-1 text-sm text-muted-foreground">Complete verification to unlock deposits without limits and withdrawals.</p>
      <Card className="mt-6 flex flex-wrap items-center gap-5 p-5">
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-full', p.verified ? 'bg-[hsl(var(--success)/0.12)] text-up' : 'bg-accent text-primary')}><ShieldCheck className="h-6 w-6" /></div>
        <div className="flex-1">
          <div className="font-extrabold">{p.level}</div>
          <div className="text-xs text-muted-foreground">{p.verified ? 'All features unlocked' : 'Deposit limit $2,000 · Withdrawals locked until fully verified'}</div>
          <Progress value={(done / STEPS.length) * 100} className="mt-2 h-2" />
        </div>
        <div className="num text-sm font-bold">{done}/{STEPS.length}</div>
      </Card>
      <div className="mt-4 space-y-3">
        {STEPS.map((s) => <StepCard key={s.key} step={s} status={p.kyc[s.key]} />)}
      </div>
    </div>
  );
}

function Badge({ status }: { status: KycStatus }) {
  const map = { Verified: ['bg-[hsl(var(--success)/0.12)] text-up', CheckCircle2], 'Under review': ['bg-accent text-primary', Clock], Rejected: ['bg-destructive/10 text-destructive', XCircle], 'Not started': ['bg-muted text-muted-foreground', Clock] } as const;
  const [cls, Icon] = map[status];
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold', cls)}><Icon className="h-3.5 w-3.5" />{status}</span>;
}

function StepCard({ step, status }: { step: (typeof STEPS)[number]; status: KycStatus }) {
  const p = usePortal(); const { upload, isUploading } = useLocalUpload();
  const [docType, setDocType] = useState(step.key === 'identity' ? 'CNIC' : 'Utility bill');
  const isDoc = step.key === 'identity' || step.key === 'address';
  const locked = isDoc && p.kyc.profile !== 'Verified';

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { const { url } = await upload(f); p.submitDoc(step.key as 'identity' | 'address', url, docType); toast.success('Document submitted for review'); }
    catch { toast.error('Upload failed, please try again'); }
  };

  return (
    <Card className="flex flex-wrap items-center gap-4 p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary"><step.icon className="h-5 w-5" /></div>
      <div className="min-w-[180px] flex-1"><div className="font-bold">{step.title}</div><div className="text-xs text-muted-foreground">{step.desc}</div></div>
      <Badge status={status} />
      {(step.key === 'phone' || step.key === 'profile') && status !== 'Verified' && <Button asChild size="sm"><Link to="/profile">Complete</Link></Button>}
      {isDoc && status !== 'Verified' && status !== 'Under review' && (
        locked ? <span className="text-xs text-muted-foreground">Complete profile first</span> : (
          <div className="flex items-center gap-2">
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{(step.key === 'identity' ? ['CNIC', 'Passport', 'Driving licence'] : ['Utility bill', 'Bank statement', 'Tax document']).map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" asChild disabled={isUploading}>
              <label className="cursor-pointer">{isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Upload<input type="file" accept="image/*,.pdf" className="hidden" onChange={onFile} disabled={isUploading} /></label>
            </Button>
          </div>
        )
      )}
    </Card>
  );
}
