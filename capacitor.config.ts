import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.meuigastei.app',
  appName: 'iGastei',
  webDir: 'dist',
  backgroundColor: '#0D0D1A',
  ios: {
    contentInset: 'always',
    backgroundColor: '#0D0D1A',
  },
};

export default config;
