import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { PRESETS, buildNotes, noteRange, PALETTES } from '../../core/instruments'
import { instrumentFrom, saveInstrument } from '../../data/repo'
import { useSettings } from '../../state/settings'
import { InstrumentThumb } from '../../ui/InstrumentView'
import { Screen } from '../../ui/Screen'

export function PresetPicker({ onboarding = false }: { onboarding?: boolean }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const set = useSettings((s) => s.set)
  const choose = async (presetId: string | null) => {
    const preset = PRESETS.find((p) => p.id === presetId)
    const base = preset ?? {
      ...PRESETS[0]!,
      id: 'custom',
      notes: buildNotes(noteRange(60, 67, true), PALETTES[0]!),
    }
    const inst = instrumentFrom(
      base,
      preset ? t(`presets.${preset.id}`) : t('instruments.myInstrument'),
    )
    await saveInstrument(inst)
    set({ lastInstrumentId: inst.id })
    navigate(`/instruments/${inst.id}${onboarding ? '?welcome=1' : ''}`, { replace: true })
  }
  return (
    <Screen title={t('instruments.pickTitle')} back={onboarding ? undefined : true}>
      <p className="text-ink/75 mb-4">{t('instruments.pickHint')}</p>
      <ul className="flex flex-col gap-3">
        {PRESETS.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => void choose(p.id)}
              className="shadow-soft ring-stand/50 flex min-h-20 w-full items-center gap-4 rounded-3xl bg-white/80 p-3 text-left ring-1 active:scale-[0.99] dark:bg-white/6"
            >
              <InstrumentThumb instrument={p} height={56} />
              <span>
                <span className="font-display block text-lg">{t(`presets.${p.id}`)}</span>
                <span className="text-ink/65 block text-sm">
                  {t('instruments.noteCount', { count: p.notes.length })}
                </span>
              </span>
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => void choose(null)}
            className="border-stand flex min-h-20 w-full items-center rounded-3xl border-2 border-dashed p-4 text-left font-semibold"
          >
            {t('instruments.buildOwn')}
          </button>
        </li>
      </ul>
    </Screen>
  )
}
