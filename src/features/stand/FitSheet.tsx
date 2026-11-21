import { useTranslation } from 'react-i18next'
import type { Change, FitResult } from '../../core/adapt'
import { fromMidi, noteName } from '../../core/pitch'
import { saveSong } from '../../data/repo'
import type { Instrument, Song } from '../../data/types'
import { useSettings } from '../../state/settings'
import { Button, Stepper, Switch } from '../../ui/controls'
import { Sheet } from '../../ui/Sheet'

/** What was changed to fit the song to the instrument, with overrides. */
export function FitSheet({
  open,
  onClose,
  song,
  instrument,
  fit,
}: {
  open: boolean
  onClose: () => void
  song: Song
  instrument: Instrument
  fit: FitResult
}) {
  const { t } = useTranslation()
  const naming = useSettings((s) => s.naming)
  const options = song.fit[instrument.id] ?? {}
  const update = (patch: Partial<typeof options>) =>
    void saveSong({ ...song, fit: { ...song.fit, [instrument.id]: { ...options, ...patch } } })
  const name = (m: number) => noteName(fromMidi(m), naming)

  const describe = (c: Change): string => {
    switch (c.kind) {
      case 'transpose':
        return t(c.semitones > 0 ? 'fit.movedUp' : 'fit.movedDown', {
          count: Math.abs(c.semitones),
        })
      case 'melody':
        return t('fit.melody', { count: c.removed })
      case 'octave':
        return t(c.direction === 'up' ? 'fit.octaveUp' : 'fit.octaveDown', { count: c.count })
      case 'substitute':
        return t('fit.substitute', { from: name(c.from), to: name(c.to), count: c.count })
    }
  }
  const measures = (c: Change) =>
    'measures' in c && c.measures.length
      ? t('fit.inMeasures', {
          list: c.measures.slice(0, 8).join(', ') + (c.measures.length > 8 ? ' …' : ''),
        })
      : ''

  return (
    <Sheet open={open} onClose={onClose} title={t('fit.title')}>
      <p className="text-lg">
        <strong className="text-3xl tabular-nums">{Math.round(fit.fit * 100)}%</strong>{' '}
        {t('fit.exact')}
      </p>
      {fit.changes.length === 0 ? (
        <p className="text-ink/75 mt-3">{t('fit.noChanges', { instrument: instrument.name })}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {fit.changes.map((c, i) => (
            <li key={i} className="bg-ink/5 rounded-2xl px-4 py-3">
              <span className="block font-semibold">{describe(c)}</span>
              {measures(c) && <span className="text-ink/65 block text-sm">{measures(c)}</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 flex flex-col gap-2">
        <Stepper
          label={t('fit.transpose')}
          value={fit.transpose}
          min={-12}
          max={12}
          format={(v) => (v > 0 ? `+${v}` : String(v))}
          onChange={(v) => update({ transpose: v })}
        />
        {options.transpose !== undefined && (
          <Button className="self-start" onClick={() => update({ transpose: undefined })}>
            {t('fit.autoTranspose')}
          </Button>
        )}
        <Switch
          label={t('fit.melodyOnly')}
          hint={t('fit.melodyOnlyHint')}
          checked={options.melodyOnly ?? instrument.polyphony === 'single'}
          onChange={(v) => update({ melodyOnly: v })}
        />
      </div>
    </Sheet>
  )
}
