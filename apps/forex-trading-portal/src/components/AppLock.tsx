import { useCallback,useEffect,useState,ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';

function withTimeout<T>(promise:Promise<T>,ms=8000):Promise<T>{
 return Promise.race([promise,new Promise<T>((_,reject)=>setTimeout(()=>reject(new Error('Secure lock initialization timed out')),ms))]);
}
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
export default function AppLock({children}:{children:ReactNode}){
 const native=Capacitor.isNativePlatform();
 const [ready,setReady]=useState(!native);
 const [setup,setSetup]=useState(false);
 const [locked,setLocked]=useState(false);
 const [bioAvailable,setBioAvailable]=useState(false);
 const [bioEnabled,setBioEnabled]=useState(false);
 const [pin,setPin]=useState('');
 const [confirmPin,setConfirmPin]=useState('');
 const [storedPin,setStoredPin]=useState('');
 const [error,setError]=useState('');
 const [attempts,setAttempts]=useState(0);
 const load=useCallback(async()=>{
  if(!native){setReady(true);return;}
  try{
   await withTimeout(SecureStorage.setKeyPrefix('bigbulls_android_'));
   const [enabled,saved,biometric]=await withTimeout(Promise.all([
    SecureStorage.get('app_lock_enabled'),
    SecureStorage.get('pin_hash'),
    SecureStorage.get('biometric_enabled'),
   ]));
   setStoredPin(typeof saved==='string'?saved:'');
   setBioEnabled(biometric===true);
   if(enabled===true&&typeof saved==='string'&&saved.length>10){
    setLocked(true);setSetup(false);
   }else{
    setSetup(true);setLocked(false);
   }
   // Biometric capability is optional; never block portal startup on the sensor API.
   void withTimeout(BiometricAuth.checkBiometry(),4000)
    .then(info=>setBioAvailable(!!info.isAvailable))
    .catch(()=>setBioAvailable(false));
  }catch(e){
   // A broken/unavailable native secure-storage bridge must not trap users on
   // the splash screen. Keep the trading portal usable and surface a warning.
   console.error('BIGBULLS app-lock initialization failed:',e);
   setError('Device app-lock could not initialize. Portal opened without the optional app lock.');
   setSetup(false);setLocked(false);setBioAvailable(false);setBioEnabled(false);
  }finally{
   setReady(true);
  }
 },[native]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{
  if(!native)return;
  let handle:{remove:()=>Promise<void>}|undefined;
  let alive=true;
  App.addListener('appStateChange',state=>{if(!state.isActive)setLocked(true);}).then(h=>{if(alive)handle=h;else void h.remove();}).catch(()=>{});
  return()=>{alive=false;if(handle)void handle.remove();};
 },[native]);
 const savePin=async()=>{
  if(!/^\d{6}$/.test(pin)){setError('PIN exactly 6 digits ka hona chahiye.');return;}
  if(pin!==confirmPin){setError('PIN match nahi hua.');return;}
  try{const hash=await pinDigest(pin);await SecureStorage.set('pin_hash',hash);await SecureStorage.set('app_lock_enabled',true);await SecureStorage.set('biometric_enabled',false);setStoredPin(hash);setBioEnabled(false);setSetup(false);setLocked(false);setPin('');setConfirmPin('');setError('');}
  catch{setError('Secure PIN save nahi ho saka.');}
 };
 const enableBiometric=async()=>{
  try{await BiometricAuth.authenticate({reason:'Enable BIGBULLS app lock',allowDeviceCredential:true,androidTitle:'BIGBULLS security',androidSubtitle:'Confirm your device biometric'});await SecureStorage.set('biometric_enabled',true);setBioEnabled(true);setError('Biometric unlock enabled.');}
  catch{setError('Biometric setup cancelled or unavailable. You can continue with PIN.');}
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
 if(!ready)return <div className="flex min-h-screen items-center justify-center text-sm">Loading BIGBULLS secure lock…</div>;
 if(setup)return <div className="flex min-h-screen items-center justify-center bg-background p-5"><div className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6"><h2 className="text-2xl font-extrabold">Secure this device</h2><p className="text-sm text-muted-foreground">Set a 6-digit app PIN. It is stored encrypted with Android Keystore; your BIGBULLS password and biometric data are never stored here.</p><Input inputMode="numeric" maxLength={6} type="password" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="Create 6-digit PIN"/><Input inputMode="numeric" maxLength={6} type="password" value={confirmPin} onChange={e=>setConfirmPin(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="Confirm PIN"/>{error&&<p className="text-sm text-destructive">{error}</p>}<Button className="w-full" onClick={savePin}>Save PIN and continue</Button><p className="text-xs text-muted-foreground">After setup, enable fingerprint/face unlock from this security screen or use the PIN whenever needed.</p></div></div>;
 if(locked)return <div className="flex min-h-screen items-center justify-center bg-background p-5"><div className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6"><h2 className="text-2xl font-extrabold">BIGBULLS locked</h2><p className="text-sm text-muted-foreground">Authenticate to reopen your trading session.</p>{bioEnabled&&bioAvailable&&<Button className="w-full" onClick={unlockBiometric}>Unlock with fingerprint / face</Button>}<Input inputMode="numeric" maxLength={6} type="password" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="6-digit app PIN"/><Button variant="outline" className="w-full" onClick={unlockPin}>Unlock with PIN</Button>{bioAvailable&&!bioEnabled&&<Button variant="ghost" className="w-full" onClick={enableBiometric}>Enable biometric unlock</Button>}{error&&<p className="text-sm text-destructive">{error}</p>}</div></div>;
 return <>{error&&<div className="fixed bottom-3 left-3 right-3 z-[100] mx-auto max-w-lg rounded-lg border bg-card p-3 text-xs text-muted-foreground shadow">{error}</div>}{bioAvailable&&!bioEnabled&&<div className="fixed bottom-3 right-3 z-50"><Button size="sm" variant="outline" onClick={enableBiometric}>Enable fingerprint</Button></div>}{children}</>;
}
