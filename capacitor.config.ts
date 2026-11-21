import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.anxietycompanion.app',
  appName: 'Anxiety Companion',
  webDir: 'dist',
  backgroundColor: '#F0EDE8',
  android: {
    adjustMarginsForEdgeToEdge: 'force',
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_notify',
      iconColor: '#8B7DB8',
    },
  },
};

export default config;
