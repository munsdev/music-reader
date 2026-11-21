import { App } from '@capacitor/app'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { create } from 'zustand'

/**
 * Self-update for sideloaded test builds. Releases are published by CI to GitHub
 * (see .github/workflows/ci.yml, job "release"). Not used for Play Store builds.
 */
export const REPO = 'munsdev/music-reader'
export const MANIFEST_URL = `https://github.com/${REPO}/releases/latest/download/latest.json`
/** Direct download link for sharing, always the newest build. */
export const SHARE_URL = `https://github.com/${REPO}/releases/latest/download/music-reader.apk`

export interface ReleaseInfo {
  versionCode: number
  versionName: string
  apkUrl: string
  sha256: string
  notes: string
}

interface UpdaterPlugin {
  fetchText(o: { url: string }): Promise<{ text: string }>
  download(o: { url: string; sha256: string }): Promise<{ path: string }>
  canInstall(): Promise<{ allowed: boolean }>
  openInstallSettings(): Promise<void>
  install(o: { path: string }): Promise<void>
  addListener(
    e: 'progress',
    fn: (p: { fraction: number }) => void,
  ): Promise<{ remove: () => Promise<void> }>
}

const Updater = registerPlugin<UpdaterPlugin>('Updater')

export const updatesSupported = () =>
  Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('Updater')

export async function currentVersion(): Promise<{ code: number; name: string }> {
  if (!Capacitor.isNativePlatform()) return { code: 0, name: __APP_VERSION__ }
  const info = await App.getInfo()
  return { code: Number(info.build) || 0, name: info.version }
}

/** The newer release, or null when up to date. */
export async function checkForUpdate(): Promise<ReleaseInfo | null> {
  if (!updatesSupported()) return null
  const { text } = await Updater.fetchText({ url: `${MANIFEST_URL}?t=${Date.now()}` })
  const latest = JSON.parse(text) as ReleaseInfo
  const current = await currentVersion()
  return latest.versionCode > current.code ? latest : null
}

export class InstallPermissionNeeded extends Error {
  override name = 'InstallPermissionNeeded'
}

export async function downloadAndInstall(
  release: ReleaseInfo,
  onProgress: (f: number) => void,
): Promise<void> {
  const { allowed } = await Updater.canInstall()
  if (!allowed) {
    await Updater.openInstallSettings()
    throw new InstallPermissionNeeded()
  }
  const sub = await Updater.addListener('progress', (p) => onProgress(p.fraction))
  try {
    const { path } = await Updater.download({ url: release.apkUrl, sha256: release.sha256 })
    onProgress(1)
    await Updater.install({ path })
  } finally {
    await sub.remove()
  }
}

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000

interface UpdateState {
  available: ReleaseInfo | null
  dismissed: number | null
  lastCheck: number
  check: (force?: boolean) => Promise<ReleaseInfo | null>
  dismiss: () => void
}

export const useUpdates = create<UpdateState>((set, get) => ({
  available: null,
  dismissed: null,
  lastCheck: 0,
  check: async (force = false) => {
    if (!force && Date.now() - get().lastCheck < CHECK_EVERY_MS) return get().available
    set({ lastCheck: Date.now() })
    try {
      const available = await checkForUpdate()
      set({ available })
      return available
    } catch {
      return null
    }
  },
  dismiss: () => set((s) => ({ dismissed: s.available?.versionCode ?? null })),
}))
