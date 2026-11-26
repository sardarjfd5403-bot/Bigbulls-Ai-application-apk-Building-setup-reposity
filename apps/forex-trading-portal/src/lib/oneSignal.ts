import OneSignal from '@onesignal/capacitor-plugin';

export const BIGBULLS_ONESIGNAL_APP_ID = 'b324fd24-9c74-4871-a2c4-c0c534e14abe';

export async function initializeBigbullsPush() {
  await OneSignal.initialize(BIGBULLS_ONESIGNAL_APP_ID);
}
