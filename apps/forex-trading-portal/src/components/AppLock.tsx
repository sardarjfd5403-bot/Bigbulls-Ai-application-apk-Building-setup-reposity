import { useCallback,useEffect,useState,ReactNode } from 'react';
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
   await SecureStorage.setKeyPrefix('bigbulls_android_');
   const enabled=await SecureStorage.get('app_lock_enabled');
   const saved=await SecureStorage.get('pin_hash');
   const biometric=await SecureStorage.get('biometric_enabled');
   const info=await BiometricAuth.checkBiometry();
   setBioAvailable(info.isAvailable);
   setBioEnabled(biometric===true);
   setStoredPin(typeof saved==='string'?saved:'');
   if(enabled===true&&typeof saved==='string'){setLocked(true);setSetup(false);}
   else{setSetup(true);setLocked(false);}
  }catch(e){setError('Secure Android storage is unavailable. App lock cannot be safely enabled on this device.');setSetup(true);}
  finally{setReady(true);}
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
  else{const next=attempts+1;setAttempts(next);setPin('');setError(next>=5?'PIN incorrect. Use biometric/device credential to unlock.':'Incorrect PIN.');}
 };
 if(!native)return <>{children}</>;
 if(!ready)return <div className="flex min-h-screen items-center justify-center text-sm">Loading BIGBULLS secure lock…</div>;
 if(setup)return <div className="flex min-h-screen items-center justify-center bg-background p-5"><div className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6"><h2 className="text-2xl font-extrabold">Secure this device</h2><p className="text-sm text-muted-foreground">Set a 6-digit app PIN. It is stored encrypted with Android Keystore; your BIGBULLS password and biometric data are never stored here.</p><Input inputMode="numeric" maxLength={6} type="password" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="Create 6-digit PIN"/><Input inputMode="numeric" maxLength={6} type="password" value={confirmPin} onChange={e=>setConfirmPin(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="Confirm PIN"/>{error&&<p className="text-sm text-destructive">{error}</p>}<Button className="w-full" onClick={savePin}>Save PIN and continue</Button><p className="text-xs text-muted-foreground">After setup, enable fingerprint/face unlock from this security screen or use the PIN whenever needed.</p></div></div>;
 if(locked)return <div className="flex min-h-screen items-center justify-center bg-background p-5"><div className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6"><h2 className="text-2xl font-extrabold">BIGBULLS locked</h2><p className="text-sm text-muted-foreground">Authenticate to reopen your trading session.</p>{bioEnabled&&bioAvailable&&<Button className="w-full" onClick={unlockBiometric}>Unlock with fingerprint / face</Button>}<Input inputMode="numeric" maxLength={6} type="password" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="6-digit app PIN"/><Button variant="outline" className="w-full" disabled={attempts>=5} onClick={unlockPin}>Unlock with PIN</Button>{bioAvailable&&!bioEnabled&&<Button variant="ghost" className="w-full" onClick={enableBiometric}>Enable biometric unlock</Button>}{error&&<p className="text-sm text-destructive">{error}</p>}</div></div>;
 return <>{bioAvailable&&!bioEnabled&&<div className="fixed bottom-3 right-3 z-50"><Button size="sm" variant="outline" onClick={enableBiometric}>Enable fingerprint</Button></div>}{children}</>;
}
