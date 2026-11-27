import OneSignal from '@onesignal/capacitor-plugin';
import { supabase } from './supabase';

export const BIGBULLS_ONESIGNAL_APP_ID = 'b324fd24-9c74-4871-a2c4-c0c534e14abe';

export async function initializeBigbullsPush() {
  await OneSignal.initialize(BIGBULLS_ONESIGNAL_APP_ID);
}

/**
 * Persist the native OneSignal subscription against the currently signed-in
 * BIGBULLS user. The push_devices table has a unique
 * (user_id, provider, device_id) key and authenticated-user RLS policies.
 */
export async function syncBigbullsPushDevice(userId: string): Promise<boolean> {
  if (!userId) return false;

  // The native SDK can take a moment to receive its FCM token after login or
  // the Android notification permission prompt. Retry briefly before giving up.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const [deviceId, pushToken, optedIn] = await Promise.all([
      OneSignal.User.pushSubscription.getIdAsync(),
      OneSignal.User.pushSubscription.getTokenAsync(),
      OneSignal.User.pushSubscription.getOptedInAsync(),
    ]);

    if (deviceId && pushToken) {
      const now = new Date().toISOString();
      const { error } = await supabase.from('push_devices').upsert({
        user_id: userId,
        provider: 'onesignal',
        device_id: deviceId,
        push_token: pushToken,
        platform: 'android',
        enabled: Boolean(optedIn),
        last_seen_at: now,
        updated_at: now,
      }, { onConflict: 'user_id,provider,device_id' });

      if (error) {
        console.error('BIGBULLS push_devices upsert failed:', error);
        throw error;
      }
      return true;
    }

    if (attempt < 5) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.warn('BIGBULLS OneSignal subscription is not ready yet; will retry on app resume or after permission flow.');
  return false;
}
