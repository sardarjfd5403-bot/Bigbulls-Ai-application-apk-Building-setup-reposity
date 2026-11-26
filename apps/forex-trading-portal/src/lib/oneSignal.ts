import OneSignal from '@onesignal/capacitor-plugin';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';

export const BIGBULLS_ONESIGNAL_APP_ID = 'b324fd24-9c74-4871-a2c4-c0c534e14abe';

let initialization: Promise<void> | null = null;
let subscriptionListenerInstalled = false;
let activeUserId: string | null = null;

type SubscriptionState = {
  id?: string | null;
  token?: string | null;
  optedIn?: boolean;
};

async function savePushDevice(state?: SubscriptionState) {
  const userId = activeUserId;
  if (!userId) return;

  try {
    const current = state ?? {
      id: await OneSignal.User.pushSubscription.getIdAsync(),
      token: await OneSignal.User.pushSubscription.getTokenAsync(),
      optedIn: await OneSignal.User.pushSubscription.getOptedInAsync(),
    };
    if (!current.id) {
      console.info('BIGBULLS OneSignal subscription is not assigned yet.');
      return;
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from('push_devices').upsert({
      user_id: userId,
      provider: 'onesignal',
      device_id: current.id,
      push_token: current.token || '',
      platform: Capacitor.getPlatform() === 'ios' ? 'ios' : 'android',
      enabled: current.optedIn === true && Boolean(current.token),
      last_seen_at: now,
      updated_at: now,
    }, { onConflict: 'user_id,provider,device_id' });

    if (error) throw error;
    console.info('BIGBULLS push device registration saved', {
      subscriptionReady: Boolean(current.id),
      tokenReady: Boolean(current.token),
      optedIn: current.optedIn === true,
    });
  } catch (error) {
    console.error('BIGBULLS push device registration failed:', error);
  }
}

export async function syncBigbullsPushDevice() {
  await savePushDevice();
}

export async function initializeBigbullsPush(userId: string | null) {
  if (!Capacitor.isNativePlatform()) return;

  if (!initialization) {
    initialization = OneSignal.initialize(BIGBULLS_ONESIGNAL_APP_ID);
  }
  await initialization;

  if (!subscriptionListenerInstalled) {
    OneSignal.User.pushSubscription.addEventListener('change', (event) => {
      void savePushDevice(event.current);
    });
    subscriptionListenerInstalled = true;
  }

  if (userId) {
    activeUserId = userId;
    await OneSignal.login(userId);
    await savePushDevice();
  } else {
    activeUserId = null;
    await OneSignal.logout();
  }
}
