import { App as CapApp } from '@capacitor/app'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { db } from './data/db'
import { ensureInstrument, newSong, pruneEmptySongs, seedIfEmpty } from './data/repo'
import { InstrumentEditor } from './features/instruments/InstrumentEditor'
import { InstrumentsScreen } from './features/instruments/InstrumentsScreen'
import { ListenSetupScreen } from './features/instruments/ListenSetupScreen'
import { PresetPicker } from './features/instruments/PresetPicker'
import { WelcomeScreen } from './features/onboarding/WelcomeScreen'
import { LicensesScreen } from './features/settings/LicensesScreen'
import { SettingsScreen } from './features/settings/SettingsScreen'
import { SongsScreen } from './features/songs/SongsScreen'
import { EditScreen } from './features/stand/EditScreen'
import { PagesScreen } from './features/stand/PagesScreen'
import { StandScreen } from './features/stand/StandScreen'
import { WriteScreen } from './features/stand/WriteScreen'
import { systemLanguage } from './i18n'
import { useSettings } from './state/settings'
import { ToastHost } from './ui/toast'
import { takePhoto } from './platform/camera'
import { makePage } from './platform/pages'
import { CropScreen } from './features/stand/CropScreen'
import { UpdateSheet } from './features/settings/UpdateSheet'
import { updatesSupported } from './platform/updates'

/** Applies theme and language settings to the document. */
function useAppearance() {
  const theme = useSettings((s) => s.theme)
  const language = useSettings((s) => s.language)
  const { i18n } = useTranslation()
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
  useEffect(() => {
    const lng = language === 'system' ? systemLanguage() : language
    void i18n.changeLanguage(lng)
    document.documentElement.lang = lng
  }, [language, i18n])
}

/** Android back button follows the in-app history. */
function useBackButton() {
  const navigate = useNavigate()
  useEffect(() => {
    const sub = CapApp.addListener('backButton', ({ canGoBack }) => {
      // An open sheet closes first (its close event updates React state).
      const dialog = document.querySelector<HTMLDialogElement>('dialog[open]')
      if (dialog) return dialog.close()
      if (canGoBack && location.hash !== '#/' && location.hash !== '') navigate(-1)
      else void CapApp.exitApp()
    })
    return () => void sub.then((s) => s.remove())
  }, [navigate])
}

/** Scan: open the camera first; a song is only created once there is a photo. */
function ScanStart() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const lastInstrumentId = useSettings((s) => s.lastInstrumentId)
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    void (async () => {
      const photo = await takePhoto()
      if (!photo) return navigate('/', { replace: true })
      const page = await makePage(photo)
      const title = `${t('scan.untitled')} ${new Date().toLocaleDateString()}`
      const song = {
        ...newSong(title, { title, parts: [], source: { kind: 'manual' } }, undefined, [page]),
        lastInstrumentId,
      }
      await db.songs.add(song)
      navigate(`/song/${song.id}/pages`, { replace: true })
    })()
  }, [navigate, t, lastInstrumentId])
  return (
    <div className="text-ink/70 flex min-h-dvh items-center justify-center p-6 text-center">
      <p>{t('scan.opening')}</p>
    </div>
  )
}

function AppRoutes() {
  const onboarded = useSettings((s) => s.onboarded)
  const { t } = useTranslation()
  useBackButton()
  useEffect(() => {
    if (onboarded) void ensureInstrument(t('presets.xylophone-8'))
  }, [onboarded, t])
  return (
    <Routes>
      <Route path="/" element={onboarded ? <SongsScreen /> : <Navigate to="/welcome" replace />} />
      <Route path="/welcome" element={<WelcomeScreen />} />
      <Route path="/welcome/instrument" element={<PresetPicker onboarding />} />
      <Route path="/scan" element={<ScanStart />} />
      <Route path="/write" element={<WriteScreen />} />
      <Route path="/song/:id" element={<StandScreen />} />
      <Route path="/song/:id/pages" element={<PagesScreen />} />
      <Route path="/song/:id/page/:pageId/crop" element={<CropScreen />} />
      <Route path="/song/:id/edit" element={<EditScreen />} />
      <Route path="/instruments" element={<InstrumentsScreen />} />
      <Route path="/instruments/new" element={<PresetPicker />} />
      <Route path="/instruments/:id" element={<InstrumentEditor />} />
      <Route path="/instruments/:id/listen" element={<ListenSetupScreen />} />
      <Route path="/settings" element={<SettingsScreen />} />
      <Route path="/settings/licenses" element={<LicensesScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  useAppearance()
  const [ready, setReady] = useState(false)
  const [settingsReady, setSettingsReady] = useState(() => useSettings.persist.hasHydrated())
  useEffect(() => {
    const unsub = useSettings.persist.onFinishHydration(() => setSettingsReady(true))
    // Hydration may finish before this effect subscribes; check again.
    if (useSettings.persist.hasHydrated()) setSettingsReady(true)
    // Never block startup on saved settings: continue with defaults after 1.5 s.
    const timer = setTimeout(() => setSettingsReady(true), 1500)
    return () => {
      unsub()
      clearTimeout(timer)
    }
  }, [])
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 3000)
    void pruneEmptySongs()
      .then(seedIfEmpty)
      .catch((e: unknown) => console.error('seed failed', e))
      .finally(() => {
        clearTimeout(timer)
        setReady(true)
      })
  }, [])
  if (!ready || !settingsReady) return null
  return (
    <HashRouter>
      <AppRoutes />
      {updatesSupported() && <UpdateSheet />}
      <ToastHost />
    </HashRouter>
  )
}
