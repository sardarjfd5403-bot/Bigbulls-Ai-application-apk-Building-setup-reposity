import { useCallback,useEffect,useState,useRef,ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';

async function pinDigest(pin:string){
 const salt=crypto.randomUUID();
 const bytes=new TextEncoder().encode(salt+':'+pin);
 const hash=await crypto.subtle.digest('SHA-256',bytes);
 const hex=Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('');
 return salt+'.'+hex;
}
async function verifyPin(pin:string,stored:string){
 const parts=stored.split('.');if(parts.length!==2)return false;
 const bytes=new TextEncoder().encode(parts[0]+':'+pin);
 const hash=await crypto.subtle.digest('SHA-256',bytes);
 const hex=Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('');
 return hex===parts[1];
}
function withTimeout<T>(promise:Promise<T>,ms=3000):Promise<T>{
 return Promise.race([promise,new Promise<T>((_,reject)=>setTimeout(()=>reject(new Error('Secure storage initialization timed out')),ms))]);
}
export default function AppLock({children}:{children:ReactNode}){
 const native=Capacitor.isNativePlatform();
 const [ready,setReady]=useState(true);
 const [setup,setSetup]=useState(false);
 const [locked,setLocked]=useState(false);
 const [bioAvailable,setBioAvailable]=useState(false);
 const [bioEnabled,setBioEnabled]=useState(false);
 const [pin,setPin]=useState('');
 const [confirmPin,setConfirmPin]=useState('');
 const [storedPin,setStoredPin]=useState('');
 const [error,setError]=useState('');
 const [attempts,setAttempts]=useState(0);
 const lockActive=useRef(false);
 const load=useCallback(async()=>{
  if(!native){setReady(true);return;}
  try{
   await withTimeout((async()=>{
    await SecureStorage.setKeyPrefix('bigbulls_android_');
    const [enabled,saved,biometric,skipped]=await Promise.all([
     SecureStorage.get('app_lock_enabled'),
     SecureStorage.get('pin_hash'),
     SecureStorage.get('biometric_enabled'),
     SecureStorage.get('app_lock_skipped')
    ]);
    setStoredPin(typeof saved==='string'?saved:'');
    setBioEnabled(biometric==='true');
    if(skipped==='true'){setSetup(false);setLocked(false);return;}
    if(enabled==='true'&&typeof saved==='string'&&saved.length>20){setLocked(true);setSetup(false);}
    else{setSetup(true);setLocked(false);}
   })());
   try{
    const info=await withTimeout(BiometricAuth.checkBiometry(),2000);
    setBioAvailable(Boolean(info?.isAvailable));
   }catch{setBioAvailable(false);}
  }catch(e){
   // A device/plugin initialization problem must never trap a newly signed-in client
   // behind an unfinishable lock screen. The app remains usable; lock can be set up later.
   console.warn('BIGBULLS secure lock initialization skipped:',e);
   lockActive.current=false;setSetup(false);setLocked(false);setError('Device secure storage is unavailable. App opened without app lock.');
  }finally{setReady(true);}
 },[native]);
 useEffect(()=>{
  let alive=true;
  // Independent UI watchdog: never leave a signed-in client on the security splash.
  const watchdog=setTimeout(()=>{if(alive){setSetup(false);setLocked(false);setError('Security storage is taking too long. App opened; you can enable the app lock later.');setReady(true);}},3500);
  void load().finally(()=>clearTimeout(watchdog));
  return()=>{alive=false;clearTimeout(watchdog);};
 },[load]);
 useEffect(()=>{
  if(!native)return;
  let handle:{remove:()=>Promise<void>}|undefined;
  let alive=true;
  App.addListener('appStateChange',state=>{if(!state.isActive&&lockActive.current)setLocked(true);}).then(h=>{if(alive)handle=h;else void h.remove();}).catch(()=>{});
  return()=>{alive=false;if(handle)void handle.remove();};
 },[native]);
 const savePin=async()=>{
  if(!/^\d{6}$/.test(pin)){setError('PIN exactly 6 digits ka hona chahiye.');return;}
  if(pin!==confirmPin){setError('PIN match nahi hua.');return;}
  try{
   const hash=await pinDigest(pin);
   await SecureStorage.set('pin_hash',hash);
   await SecureStorage.set('app_lock_enabled','true');
   await SecureStorage.set('biometric_enabled','false');
   lockActive.current=true;setStoredPin(hash);setBioEnabled(false);setSetup(false);setLocked(false);setPin('');setConfirmPin('');setError('');
  }catch{setError('Secure PIN save nahi ho saka. Aap continue kar sakte hain; baad mein dobara setup karein.');}
 };
 const enableBiometric=async()=>{
  try{
   await BiometricAuth.authenticate({reason:'Enable BIGBULLS app lock',allowDeviceCredential:true,androidTitle:'BIGBULLS security',androidSubtitle:'Confirm your device biometric'});
   await SecureStorage.set('biometric_enabled','true');setBioEnabled(true);setError('Biometric unlock enabled.');
  }catch{setError('Biometric setup cancelled or unavailable. You can continue with PIN.');}
 };
 const unlockBiometric=async()=>{
  try{await BiometricAuth.authenticate({reason:'Unlock BIGBULLS trading app',allowDeviceCredential:true,androidTitle:'BIGBULLS secure login',androidSubtitle:'Fingerprint or device credential'});setLocked(false);setAttempts(0);setError('');}
  catch{setError('Biometric verification failed. Enter your 6-digit app PIN.');}
 };
 const unlockPin=async()=>{
  if(!/^\d{6}$/.test(pin)){setError('Enter your 6-digit PIN.');return;}
  if(await verifyPin(pin,storedPin)){setLocked(false);setAttempts(0);setPin('');setError('');}
  else{const next=attempts+1;setAttempts(next);setPin('');setError(next>=5?'PIN incorrect. You can retry or use biometric/device credential.':'Incorrect PIN.');}
 };
 if(!native)return <>{children}</>;
 if(!ready)return <>{children}</>; // Never block the signed-in portal on device security initialization.
 if(setup)return <div className="flex min-h-screen items-center justify-center bg-background p-5"><div className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6"><h2 className="text-2xl font-extrabold">Secure this device</h2><p className="text-sm text-muted-foreground">Set a 6-digit app PIN. It is stored encrypted with Android Keystore; your BIGBULLS password and biometric data are never stored here.</p><Input inputMode="numeric" maxLength={6} type="password" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="Create 6-digit PIN"/><Input inputMode="numeric" maxLength={6} type="password" value={confirmPin} onChange={e=>setConfirmPin(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="Confirm PIN"/>{error&&<p className="text-sm text-destructive">{error}</p>}<Button className="w-full" onClick={savePin}>Save PIN and continue</Button><Button variant="ghost" className="w-full" onClick={()=>{lockActive.current=false;void SecureStorage.set('app_lock_skipped','true').catch(()=>{});setSetup(false);setLocked(false);setError('');}}>Continue without app lock</Button><p className="text-xs text-muted-foreground">You can enable fingerprint/face unlock after setup. App access will not be blocked if this device does not support secure storage.</p></div></div>;
 if(locked)return <div className="flex min-h-screen items-center justify-center bg-background p-5"><div className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6"><h2 className="text-2xl font-extrabold">BIGBULLS locked</h2><p className="text-sm text-muted-foreground">Authenticate to reopen your trading session.</p>{bioEnabled&&bioAvailable&&<Button className="w-full" onClick={unlockBiometric}>Unlock with fingerprint / face</Button>}<Input inputMode="numeric" maxLength={6} type="password" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="6-digit app PIN"/><Button variant="outline" className="w-full" onClick={unlockPin}>Unlock with PIN</Button>{bioAvailable&&!bioEnabled&&<Button variant="ghost" className="w-full" onClick={enableBiometric}>Enable biometric unlock</Button>}{error&&<p className="text-sm text-destructive">{error}</p>}</div></div>;
 return <>{bioAvailable&&!bioEnabled&&<div className="fixed bottom-3 right-3 z-50"><Button size="sm" variant="outline" onClick={enableBiometric}>Enable fingerprint</Button></div>}{children}</>;
}
