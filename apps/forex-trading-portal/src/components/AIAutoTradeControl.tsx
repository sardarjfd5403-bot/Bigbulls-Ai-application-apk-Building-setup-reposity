import { useEffect, useState } from 'react';
import { Bot, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Switch } from '@project/components/ui/switch';
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
  if(account.type!=='Real') return (
    <div className="rounded-xl border bg-muted/40 p-3">
      <div className="flex items-center gap-2 text-sm font-bold"><Bot className="h-4 w-4"/> AI Auto-Trade</div>
      <p className="mt-1 text-xs text-muted-foreground">AI execution is available on approved Real B-Book accounts. Demo trading remains manual paper execution.</p>
    </div>
  );
  const toggle=async(enabled:boolean)=>{
    if(loading)return;
    setLoading(true);
    try{
      const saved:any=await bigbullsBackend.aiAutoTradeSettings(account.id,'set',{enabled,risk_pct:settings?.risk_pct??0.5,reward_pct:settings?.reward_pct??2.5,max_daily_loss_pct:settings?.max_daily_loss_pct??1.5});
      setSettings(old=>({...old,...saved,enabled:saved.enabled===true}));
      toast.success(enabled?'AI Auto-Trade enabled for this account.':'AI Auto-Trade switched OFF.');
    }catch(e:any){toast.error(e.message||'Could not change AI Auto-Trade');}
    finally{setLoading(false);}
  };
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/[0.035] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-extrabold"><Bot className="h-4 w-4 text-primary"/> AI Auto-Trade</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">Manual execution remains available when OFF</div>
        </div>
        <Switch checked={settings?.enabled===true} disabled={!settings||loading||(!settings.ready&&!settings.enabled)} onCheckedChange={toggle}/>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold">
        {settings?.enabled?<><ShieldCheck className="h-3.5 w-3.5 text-emerald-600"/> Account opt-in ON</>:<><ShieldAlert className="h-3.5 w-3.5 text-amber-600"/> {settings?.ready?'OFF · Manual trading':'Platform safety gate is paused'}</>}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
        <div>Risk / trade <b className="block text-foreground">{(settings?.risk_pct??0.5).toFixed(2)}%</b></div>
        <div>Reward target <b className="block text-foreground">{(settings?.reward_pct??2.5).toFixed(2)}%</b></div>
        <div>Daily loss cap <b className="block text-foreground">{(settings?.max_daily_loss_pct??1.5).toFixed(2)}%</b></div>
      </div>
      {settings?.reason&&!settings.enabled&&<p className="mt-2 text-[11px] leading-4 text-muted-foreground">{settings.reason}</p>}
      <p className="mt-2 text-[10px] leading-4 text-muted-foreground">AI orders use published signals, fresh quotes and server-side risk checks. Execution is internal BIGBULLS B-Book, not an external MT5 liquidity route.</p>
    </div>
  );
}