import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'dev.muns.musicreader',
  appName: 'Music Reader',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: {
      // Injects --safe-area-inset-* so content can stay clear of the status and navigation bars.
      insetsHandling: 'css',
      style: 'DEFAULT',
    },
  },
}

export default config
