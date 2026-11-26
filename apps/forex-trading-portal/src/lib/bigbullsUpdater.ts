import { registerPlugin } from '@capacitor/core';

export interface BigbullsUpdaterPlugin {
  getAppInfo(): Promise<{ version: string; build: number }>;
  installApk(options: { url: string }): Promise<{ permissionRequired: boolean }>;
}

export const BigbullsUpdater = registerPlugin<BigbullsUpdaterPlugin>('BigbullsUpdater');
