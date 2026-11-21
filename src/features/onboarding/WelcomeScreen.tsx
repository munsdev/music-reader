import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { PRESETS } from '../../core/instruments'
import { useLabelSettings } from '../../state/hooks'
import { Bar } from '../../ui/Bar'
import { InstrumentView } from '../../ui/InstrumentView'
import { synth } from '../../audio/synth'

export function WelcomeScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const labels = useLabelSettings()
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-8 px-6 pt-[var(--sat)] pb-[calc(1.5rem+var(--sab))]">
      <div>
        <h1 className="font-display text-4xl leading-tight">{t('onboarding.title')}</h1>
        <p className="text-ink/75 mt-3 text-lg">{t('onboarding.body')}</p>
      </div>
      <InstrumentView
        instrument={PRESETS[0]!}
        labels={labels}
        height={200}
        onStrike={(m) => synth.strike(m, 'xylophone')}
      />
      <p className="text-ink/60 text-center text-sm">{t('onboarding.tryIt')}</p>
      <Bar onClick={() => navigate('/welcome/instrument', { replace: true })}>
        {t('onboarding.setUp')}
      </Bar>
    </div>
  )
}
