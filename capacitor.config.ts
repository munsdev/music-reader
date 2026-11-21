import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'dev.muns.musicreader',
  appName: 'Music Reader',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
}

export default config
