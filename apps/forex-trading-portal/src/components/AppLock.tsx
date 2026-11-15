import { ReactNode,useCallback,useEffect,useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { LockKeyhole,Delete } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { bigbullsBackend } from '../lib/bigbullsBackend';
import { isNativeApp,readAppPin } from '../lib/appLock';

export default function AppLock({children}:{children:ReactNode}) {
  const [checking,setChecking]=useState(true);
  const [locked,setLocked]=useState(false);
  const [pin,setPin]=useState('');
  const [savedPin,setSavedPin]=useState<string|null>(null);
  const [attempts,setAttempts]=useState(0);
  const unlock=useCallback(()=>{
    if(!savedPin)return;
    if(pin===savedPin){setLocked(false);setPin('');setAttempts(0);return;}
    setAttempts(v=>v+1);setPin('');toast.error('Incorrect App Lock PIN.');
  },[pin,savedPin]);
  useEffect(()=>{
    let alive=true;
    let listener:{remove:()=>Promise<void>}|undefined;
    const initialise=async()=>{
      if(!isNativeApp()){if(alive)setChecking(false);return;}
      try{
        const {data,error}=await supabase.auth.getUser();
        if(error)throw error;
        const id=data.user?.id;
        if(!id){if(alive)setChecking(false);return;}
        const enabled=await bigbullsBackend.getAppLockSettings();
        if(!enabled){if(alive)setChecking(false);return;}
        const secret=await readAppPin(id);
        if(!secret){await bigbullsBackend.setAppLockEnabled(false);if(alive)setChecking(false);return;}
        if(alive){setSavedPin(secret);setLocked(true);setChecking(false);}
        listener=await CapacitorApp.addListener('appStateChange',({isActive})=>{
          if(!isActive){setPin('');}
          else if(alive){setPin('');setLocked(true);}
        });
      }catch(e){console.warn('Optional App Lock unavailable:',e);if(alive)setChecking(false);}
    };
    void initialise();
    return()=>{alive=false;if(listener)void listener.remove();};
  },[]);
  useEffect(()=>{if(pin.length===6)unlock();},[pin,unlock]);
  if(checking)return <div className="grid min-h-screen place-items-center bg-background"><div className="animate-pulse text-sm font-bold">BIGBULLS</div></div>;
  if(!locked)return <>{children}</>;
  const add=(digit:string)=>{if(pin.length<6)setPin((v)=>v+digit);};
  const handleKey=(key:string)=>{if(key==='clear')setPin('');else if(key==='delete')setPin((v)=>v.slice(0,-1));else add(key);};
  return <div className="fixed inset-0 z-[9999] flex min-h-screen flex-col items-center justify-center bg-background px-6">
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><LockKeyhole className="h-7 w-7"/></div>
    <h1 className="text-xl font-extrabold">Unlock BIGBULLS</h1>
    <p className="mt-1 text-sm text-muted-foreground">Enter your 6-digit app PIN</p>
    <div className="my-7 flex gap-3">{Array.from({length:6},(_,i)=><span key={i} className={`h-3 w-3 rounded-full border-2 border-primary ${i<pin.length?'bg-primary':''}`}/>)}</div>
    <div className="grid w-full max-w-[270px] grid-cols-3 gap-3">
      {['1','2','3','4','5','6','7','8','9','clear','0','delete'].map(k=><Button key={k} type="button" variant="outline" className="h-14 rounded-xl text-lg font-bold" onClick={()=>handleKey(k)}>{k==='delete'?<Delete className="h-5 w-5"/>:k==='clear'?'Clear':k}/></Button>)}
    </div>
    {attempts>=5&&<p className="mt-4 text-center text-xs text-destructive">Multiple incorrect attempts. Please retry carefully.</p>}
    <Button variant="ghost" className="mt-5" onClick={async()=>{await supabase.auth.signOut();}}>Sign out</Button>
  </div>;
}
