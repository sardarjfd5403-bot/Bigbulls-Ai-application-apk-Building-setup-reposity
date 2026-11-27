import { Capacitor } from '@capacitor/core';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

export const isNativeApp = () => Capacitor.isNativePlatform();
export const appLockKey = (userId:string) => 'bigbulls-app-lock-pin-v1-' + userId;
export async function readAppPin(userId:string):Promise<string|null>{
  if(!isNativeApp()) return null;
  const value=await SecureStorage.get(appLockKey(userId),false);
  return typeof value==='string'?value:null;
}
export async function saveAppPin(userId:string,pin:string){
  if(!isNativeApp()) throw new Error('App Lock is available in the BIGBULLS Android app only.');
  await SecureStorage.set(appLockKey(userId),pin,false,false);
}
export async function removeAppPin(userId:string){
  if(!isNativeApp()) return;
  await SecureStorage.remove(appLockKey(userId));
}

export const biometricPreferenceKey = (userId:string) => 'bigbulls-biometric-enabled-v1-' + userId;
export async function readBiometricEnabled(userId:string):Promise<boolean>{
  if(!isNativeApp()) return false;
  const value=await SecureStorage.get(biometricPreferenceKey(userId),false);
  return value===true||value==='true';
}
export async function saveBiometricEnabled(userId:string,enabled:boolean){
  if(!isNativeApp()) throw new Error('Biometric sign-in is available in the BIGBULLS Android app only.');
  await SecureStorage.set(biometricPreferenceKey(userId),enabled,false,false);
}
