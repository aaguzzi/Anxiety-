import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.anxietycompanion.app',
  appName: 'Anxiety Companion',
  webDir: 'dist',
  backgroundColor: '#F0EDE8',
  android: {
    adjustMarginsForEdgeToEdge: 'force',
  },
};

export default config;
