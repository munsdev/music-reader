import { App as CapApp } from '@capacitor/app'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { db } from './data/db'
import { ensureInstrument, newSong, seedIfEmpty } from './data/repo'
import { InstrumentEditor } from './features/instruments/InstrumentEditor'
import { InstrumentsScreen } from './features/instruments/InstrumentsScreen'
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
      if (document.querySelector('dialog[open]')) return
      if (canGoBack && location.hash !== '#/') navigate(-1)
      else void CapApp.exitApp()
    })
    return () => void sub.then((s) => s.remove())
  }, [navigate])
}

function ScanStart() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  useEffect(() => {
    const title = `${t('scan.untitled')} ${new Date().toLocaleDateString()}`
    const song = newSong(title, { title, parts: [], source: { kind: 'manual' } })
    void db.songs
      .add(song)
      .then(() => navigate(`/song/${song.id}/pages?camera=1`, { replace: true }))
  }, [navigate, t])
  return null
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
      <Route path="/song/:id/edit" element={<EditScreen />} />
      <Route path="/instruments" element={<InstrumentsScreen />} />
      <Route path="/instruments/new" element={<PresetPicker />} />
      <Route path="/instruments/:id" element={<InstrumentEditor />} />
      <Route path="/settings" element={<SettingsScreen />} />
      <Route path="/settings/licenses" element={<LicensesScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  useAppearance()
  const [ready, setReady] = useState(false)
  const hydrated = useSettings.persist.hasHydrated()
  const [settingsReady, setSettingsReady] = useState(hydrated)
  useEffect(() => useSettings.persist.onFinishHydration(() => setSettingsReady(true)), [])
  useEffect(() => {
    void seedIfEmpty().finally(() => setReady(true))
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
