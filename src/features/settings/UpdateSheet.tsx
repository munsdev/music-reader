import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { App } from '@capacitor/app'
import { downloadAndInstall, InstallPermissionNeeded, useUpdates } from '../../platform/updates'
import { Bar } from '../../ui/Bar'
import { Sheet } from '../../ui/Sheet'

/** Offers a newer test build and installs it. Shown once per version unless opened from Settings. */
export function UpdateSheet({ forceOpen, onClose }: { forceOpen?: boolean; onClose?: () => void }) {
  const { t } = useTranslation()
  const { available, dismissed, check, dismiss } = useUpdates()
  const [progress, setProgress] = useState<number | null>(null)
  const [needPermission, setNeedPermission] = useState(false)
  const [error, setError] = useState(false)

  // Check on start and whenever the app comes back to the foreground.
  useEffect(() => {
    void check()
    const sub = App.addListener('resume', () => void check())
    return () => void sub.then((s) => s.remove())
  }, [check])

  const open = !!available && (forceOpen || dismissed !== available.versionCode)
  const close = () => {
    dismiss()
    onClose?.()
  }

  const install = async () => {
    if (!available) return
    setError(false)
    setProgress(0)
    try {
      await downloadAndInstall(available, setProgress)
    } catch (e) {
      if (e instanceof InstallPermissionNeeded) setNeedPermission(true)
      else setError(true)
    } finally {
      setProgress(null)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title={t('updates.title')}
      footer={
        <Bar className="w-full" disabled={progress !== null} onClick={install}>
          {progress !== null
            ? t('updates.downloading', { percent: Math.round(progress * 100) })
            : t('updates.install')}
        </Bar>
      }
    >
      {available && (
        <>
          <p className="text-lg">{t('updates.body', { version: available.versionName })}</p>
          {available.notes && (
            <p className="bg-ink/5 text-ink/80 mt-2 rounded-2xl px-4 py-3">{available.notes}</p>
          )}
          {needPermission && <p className="mt-3 font-semibold">{t('updates.permission')}</p>}
          {error && <p className="text-alert mt-3 font-semibold">{t('updates.failed')}</p>}
        </>
      )}
    </Sheet>
  )
}
