import { useEffect,useState } from 'react';
import { toast } from 'sonner';
import { MessageSquare,Plus } from 'lucide-react';
import { Card } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from '@project/components/ui/select';
import { bigbullsBackend } from '../lib/bigbullsBackend';
import { supabase } from '../lib/supabase';
type Ticket={id:string;subject:string;category:string;message:string;status:string;admin_reply:string|null;created_at:string};
const CATS=['Deposits & withdrawals','Verification','Trading','Partner program','Other'];
export default function Support(){
 const [tickets,setTickets]=useState<Ticket[]>([]);const [open,setOpen]=useState(false);const [subject,setSubject]=useState('');const [category,setCategory]=useState(CATS[0]);const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 const reload=()=>bigbullsBackend.supportTickets().then(x=>setTickets(x as Ticket[])).catch(e=>toast.error(e.message||'Support tickets unavailable'));
 useEffect(()=>{reload();},[]);
 useEffect(()=>{let alive=true;let channel:any=null;void supabase.auth.getUser().then(({data})=>{if(alive&&data.user)channel=bigbullsBackend.subscribeClientData(data.user.id,()=>{void reload().catch(e=>console.warn('Support refresh failed',e));});});return()=>{alive=false;if(channel)void supabase.removeChannel(channel);};},[]);
 const submit=async()=>{if(subject.trim().length<4||message.trim().length<10){toast.error('Add a subject and a detailed message.');return;}setBusy(true);try{await bigbullsBackend.createSupportTicket({subject:subject.trim(),category,message:message.trim()});toast.success('Support request sent to BIGBULLS back office.');setSubject('');setMessage('');setOpen(false);await reload();}catch(e:any){toast.error(e.message||'Support request failed');}finally{setBusy(false);}};
 return <div><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-extrabold tracking-tight">Help center</h1><p className="mt-1 text-sm text-muted-foreground">Your support requests are stored in the BIGBULLS back office.</p></div><Button onClick={()=>setOpen(!open)}><Plus className="mr-2 h-4 w-4"/>New request</Button></div>
 {open&&<Card className="mt-5 max-w-2xl space-y-3 p-5"><b>New support request</b><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{CATS.map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select><Input placeholder="Subject" value={subject} onChange={e=>setSubject(e.target.value)}/><Textarea rows={5} placeholder="Describe your issue" value={message} onChange={e=>setMessage(e.target.value)}/><div className="flex gap-2"><Button disabled={busy} onClick={submit}>{busy?'Sending…':'Send request'}</Button><Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button></div></Card>}
 <Card className="mt-5"><div className="border-b p-5 font-bold">My support requests</div>{tickets.length===0?<p className="p-8 text-center text-sm text-muted-foreground">No support requests yet.</p>:tickets.map(t=><div key={t.id} className="flex items-start gap-3 border-b p-4 last:border-0"><MessageSquare className="mt-1 h-4 w-4 text-primary"/><div className="min-w-0 flex-1"><b>{t.subject}</b><div className="text-xs text-muted-foreground">{t.category} · {new Date(t.created_at).toLocaleString()}</div><p className="mt-1 text-sm">{t.message}</p>{t.admin_reply&&<div className="mt-2 rounded bg-muted p-3 text-sm"><b>BIGBULLS support</b><p>{t.admin_reply}</p></div>}</div><span className="rounded-full bg-muted px-2 py-1 text-xs font-bold capitalize">{t.status}</span></div>)}</Card></div>;
}
