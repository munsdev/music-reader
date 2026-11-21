import { Preferences } from '@capacitor/preferences'
import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import type { LabelStyle } from '../core/labels'
import type { Paper } from '../print/pdf'

export interface Settings {
  naming: 'english' | 'german'
  labelStyle: LabelStyle
  language: 'system' | 'en' | 'de'
  theme: 'system' | 'light' | 'dark'
  volume: number
  haptics: boolean
  paper: Paper | 'auto'
  modelsWifiOnly: boolean
  onboarded: boolean
  lastInstrumentId?: string
}

interface SettingsState extends Settings {
  set: (patch: Partial<Settings>) => void
}

const storage: StateStorage = {
  getItem: async (key) => (await Preferences.get({ key })).value,
  setItem: (key, value) => Preferences.set({ key, value }),
  removeItem: (key) => Preferences.remove({ key }),
}

export const DEFAULT_SETTINGS: Settings = {
  naming: navigator.language?.startsWith('de') ? 'german' : 'english',
  labelStyle: 'letters',
  language: 'system',
  theme: 'system',
  volume: 0.8,
  haptics: true,
  paper: 'auto',
  modelsWifiOnly: true,
  onboarded: false,
}

export const useSettings = create<SettingsState>()(
  persist((set) => ({ ...DEFAULT_SETTINGS, set: (patch) => set(patch) }), {
    name: 'settings',
    storage: createJSONStorage(() => storage),
  }),
)

/** Paper size: the setting, or Letter in the US and Canada, A4 elsewhere. */
export function resolvePaper(p: Settings['paper']): Paper {
  if (p !== 'auto') return p
  return /-(US|CA)$/i.test(navigator.language) ? 'letter' : 'a4'
}
