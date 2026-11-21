import { useTranslation } from 'react-i18next'
import type { InstrumentProfile } from '../../core/instruments'
import { labelColorFor } from '../../core/color'
import { labelFor, type LabelSettings } from '../../core/labels'
import type { Timeline } from '../../core/timeline'

/** "Coming up" lane: the next few notes as circles, current one first. */
export function UpcomingLane({
  timeline,
  index,
  instrument,
  labels,
}: {
  timeline: Timeline
  index: number
  instrument: InstrumentProfile
  labels: LabelSettings
}) {
  const { t } = useTranslation()
  const start = Math.max(0, index)
  const notes = timeline.notes.slice(start, start + 8)
  const colors = new Map(instrument.notes.map((n) => [n.midi, n.color]))
  return (
    <div
      aria-label={t('stand.comingUp')}
      role="list"
      className="flex min-h-20 items-center gap-3 overflow-hidden px-1"
    >
      {notes.map((n, i) => {
        const color = colors.get(n.midi) ?? 'var(--color-stand)'
        const size = i === 0 ? 96 : 64 - i * 4
        const label = labelFor(n.midi, instrument, labels)
        return (
          <span
            role="listitem"
            key={`${start + i}-${n.midi}`}
            className="flex shrink-0 items-center justify-center rounded-full font-bold transition-all"
            style={{
              width: size,
              height: size,
              background: color,
              color: color.startsWith('#') ? labelColorFor(color) : undefined,
              opacity: 1 - i * 0.09,
              fontSize: size * 0.4,
              boxShadow: i === 0 ? '0 0 0 4px var(--color-ink)' : undefined,
            }}
          >
            {label}
          </span>
        )
      })}
    </div>
  )
}
