import { useEffect, useState } from 'react';
import { Bot, ShieldCheck, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { bigbullsBackend } from '../lib/bigbullsBackend';
import { useTrading } from '../lib/store';

type Settings = { enabled:boolean; ready:boolean; reason:string|null; risk_pct:number; reward_pct:number; max_daily_loss_pct:number };
export default function AIAutoTradeControl() {
  const { account } = useTrading();
  const [settings,setSettings] = useState<Settings|null>(null);
  const [loading,setLoading] = useState(false);
  useEffect(()=>{
    let alive=true;
    setSettings(null);
    if(account.type!=='Real'||!account.id) return;
    bigbullsBackend.aiAutoTradeSettings(account.id,'get').then((v:any)=>{if(alive)setSettings(v as Settings);})
      .catch((e:any)=>{if(alive)toast.error(e.message||'AI settings unavailable');});
    return ()=>{alive=false;};
  },[account.id,account.type]);
  const toggle=async()=>{
    if(account.type!=='Real'||!settings||loading||(!settings.ready&&!settings.enabled))return;
    const enabled=!settings.enabled;
    setLoading(true);
    try{
      const saved:any=await bigbullsBackend.aiAutoTradeSettings(account.id,'set',{enabled,risk_pct:settings.risk_pct??0.5,reward_pct:settings.reward_pct??2.5,max_daily_loss_pct:settings.max_daily_loss_pct??1.5});
      setSettings(old=>old?({...old,...saved,enabled:saved.enabled===true}):old);
      toast.success(enabled?'AI Auto-Trade enabled for this account.':'AI Auto-Trade switched OFF.');
    }catch(e:any){toast.error(e.message||'Could not change AI Auto-Trade');}
    finally{setLoading(false);}
  };
  const demo=account.type!=='Real';
  const disabled=demo||!settings||loading||(!settings.ready&&!settings.enabled);
  const label=demo?'AI · Real account only':loading?'Updating AI…':settings?.enabled?'AI Auto-Trade ON':'AI Auto-Trade';
  return (
    <button type="button" onClick={toggle} disabled={disabled} title={demo?'AI execution is available on approved Real B-Book accounts.':settings?.reason||'Toggle AI Auto-Trade for this account'} aria-pressed={settings?.enabled===true}
      className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.04] px-3 py-2 text-xs font-bold text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60">
      <Bot className="h-4 w-4 shrink-0"/>
      <span>{label}</span>
      {settings?.enabled?<ShieldCheck className="h-3.5 w-3.5"/>:<ShieldAlert className="h-3.5 w-3.5 opacity-70"/>}
      <span className="ml-auto text-[10px] font-semibold">{settings?.enabled?'ON':'OFF'}</span>
    </button>
  );
}
