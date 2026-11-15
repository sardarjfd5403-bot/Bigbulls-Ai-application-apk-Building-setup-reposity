import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bigbullsglobalmarket.client',
  appName: 'BIGBULLS Global Market',
  webDir: 'apps/forex-trading-portal/dist',
  bundledWebRuntime: false,
  server: { androidScheme: 'https' },
};

export default config;
