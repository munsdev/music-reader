import {
  ArrowsClockwise,
  ShareNetwork,
  ArrowSquareOut,
  Coffee,
  DownloadSimple,
  Scroll,
  Trash,
  UploadSimple,
} from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { exportLibrary, importLibrary } from '../../data/repo'
import { omr, recognitionReady, type ModelStatus } from '../../omr/engine'
import { pickFiles, shareFile } from '../../platform/files'
import { useSettings, type Settings } from '../../state/settings'
import { Button, Select, Switch } from '../../ui/controls'
import { Screen, Section } from '../../ui/Screen'
import { toast } from '../../ui/toast'
import { ModelsSheet } from '../stand/PagesScreen'
import { SupportSheet } from './SupportSheet'
import { UpdateSheet } from './UpdateSheet'
import { Share } from '@capacitor/share'
import { currentVersion, SHARE_URL, updatesSupported, useUpdates } from '../../platform/updates'

export const SOURCE_URL = 'https://github.com/munsdev/music-reader'

export function SettingsScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const s = useSettings()
  const [models, setModels] = useState<ModelStatus | null>(null)
  const [install, setInstall] = useState(false)
  const [support, setSupport] = useState(false)
  const [version, setVersion] = useState('')
  const [showUpdate, setShowUpdate] = useState(false)
  const checkUpdates = useUpdates((u) => u.check)
  const refresh = () => void omr.modelStatus().then(setModels)
  useEffect(refresh, [])
  useEffect(() => void currentVersion().then((v) => setVersion(v.name)), [])

  return (
    <Screen title={t('settings.title')} back="/">
      <Section title={t('settings.notes')}>
        <Select<Settings['labelStyle']>
          label={t('settings.labels')}
          value={s.labelStyle}
          onChange={(labelStyle) => s.set({ labelStyle })}
          options={[
            { value: 'letters', label: t('settings.labelLetters') },
            { value: 'numbers', label: t('settings.labelNumbers') },
            { value: 'solfege', label: t('settings.labelSolfege') },
            { value: 'none', label: t('settings.labelNone') },
          ]}
        />
        <Select<Settings['naming']>
          label={t('settings.naming')}
          value={s.naming}
          onChange={(naming) => s.set({ naming })}
          options={[
            { value: 'english', label: t('settings.namingEnglish') },
            { value: 'german', label: t('settings.namingGerman') },
          ]}
        />
      </Section>

      <Section title={t('settings.app')}>
        <Select<Settings['language']>
          label={t('settings.language')}
          value={s.language}
          onChange={(language) => s.set({ language })}
          options={[
            { value: 'system', label: t('settings.system') },
            { value: 'en', label: 'English' },
            { value: 'de', label: 'Deutsch' },
          ]}
        />
        <Select<Settings['theme']>
          label={t('settings.theme')}
          value={s.theme}
          onChange={(theme) => s.set({ theme })}
          options={[
            { value: 'system', label: t('settings.system') },
            { value: 'light', label: t('settings.light') },
            { value: 'dark', label: t('settings.dark') },
          ]}
        />
        <Select<Settings['paper']>
          label={t('settings.paper')}
          value={s.paper}
          onChange={(paper) => s.set({ paper })}
          options={[
            { value: 'auto', label: t('settings.paperAuto') },
            { value: 'a4', label: 'A4' },
            { value: 'letter', label: 'US Letter' },
          ]}
        />
        <label className="flex min-h-14 items-center justify-between gap-4">
          <span className="font-semibold">{t('settings.volume')}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.volume}
            onChange={(e) => s.set({ volume: Number(e.target.value) })}
            className="accent-felt h-12 w-1/2"
          />
        </label>
        <Switch
          label={t('settings.haptics')}
          checked={s.haptics}
          onChange={(haptics) => s.set({ haptics })}
        />
      </Section>

      {recognitionReady() ? (
        <Section title={t('settings.recognition')}>
          <p className="py-2">
            {models?.installed
              ? t('settings.modelsInstalled', { version: models.version ?? '' })
              : t('settings.modelsMissing')}
          </p>
          <Switch
            label={t('settings.wifiOnly')}
            checked={s.modelsWifiOnly}
            onChange={(modelsWifiOnly) => s.set({ modelsWifiOnly })}
          />
          <div className="flex gap-2 py-2">
            {models?.installed ? (
              <Button
                variant="danger"
                icon={<Trash size={20} />}
                onClick={async () => {
                  await omr.removeModels()
                  refresh()
                }}
              >
                {t('settings.removeModels')}
              </Button>
            ) : (
              <Button icon={<DownloadSimple size={20} />} onClick={() => setInstall(true)}>
                {t('models.download')}
              </Button>
            )}
          </div>
        </Section>
      ) : (
        <Section title={t('settings.recognition')}>
          <p className="py-2">{t('settings.recognitionNotYet')}</p>
        </Section>
      )}

      <Section title={t('settings.library')}>
        <div className="flex flex-wrap gap-2 py-2">
          <Button
            icon={<UploadSimple size={20} />}
            onClick={async () =>
              shareFile(
                `music-reader-backup-${new Date().toISOString().slice(0, 10)}.json`,
                await exportLibrary(),
                'application/json',
              )
            }
          >
            {t('settings.backup')}
          </Button>
          <Button
            icon={<DownloadSimple size={20} />}
            onClick={async () => {
              const [f] = await pickFiles('application/json,.json')
              if (!f) return
              try {
                const r = await importLibrary(await f.text())
                toast(t('settings.restored', { songs: r.songs, instruments: r.instruments }))
              } catch {
                toast(t('settings.restoreFailed'))
              }
            }}
          >
            {t('settings.restore')}
          </Button>
        </div>
      </Section>

      <Section title={t('updates.section')}>
        <p className="py-2">{t('updates.current', { version })}</p>
        <div className="flex flex-wrap gap-2 pb-2">
          {updatesSupported() && (
            <Button
              icon={<ArrowsClockwise size={20} />}
              onClick={async () => {
                const found = await checkUpdates(true)
                if (found) setShowUpdate(true)
                else toast(t('updates.upToDate'))
              }}
            >
              {t('updates.check')}
            </Button>
          )}
          <Button
            icon={<ShareNetwork size={20} />}
            onClick={() =>
              void Share.share({
                title: 'Music Reader',
                text: t('updates.shareText'),
                url: SHARE_URL,
                dialogTitle: t('updates.share'),
              }).catch(() => undefined)
            }
          >
            {t('updates.share')}
          </Button>
        </div>
      </Section>

      <Section title={t('settings.about')}>
        <p className="py-2">{t('settings.privacy')}</p>
        <Button icon={<Coffee size={20} />} onClick={() => setSupport(true)}>
          {t('support.title')}
        </Button>
        <Button icon={<Scroll size={20} />} onClick={() => navigate('/settings/licenses')}>
          {t('licenses.title')}
        </Button>
        <Button
          icon={<ArrowSquareOut size={20} />}
          onClick={() => window.open(SOURCE_URL, '_blank', 'noopener')}
        >
          {t('settings.source')}
        </Button>
        <p className="text-ink/60 py-2 text-sm">
          {t('settings.version', { version: __APP_VERSION__ })}
        </p>
      </Section>

      <ModelsSheet
        open={install}
        onClose={() => setInstall(false)}
        onInstalled={() => {
          setInstall(false)
          refresh()
        }}
      />
      <SupportSheet open={support} onClose={() => setSupport(false)} />
      {showUpdate && <UpdateSheet forceOpen onClose={() => setShowUpdate(false)} />}
    </Screen>
  )
}
