import { labelColorFor } from '../core/color'
import type { InstrumentProfile } from '../core/instruments'
import { labelFor, type LabelSettings } from '../core/labels'
import { shapePath } from '../core/shapes'
import { fromMidi, fullName } from '../core/pitch'

/**
 * The instrument drawn as it looks: bars that get shorter as they get higher (xylophone,
 * tubes, bells) or a row of keys. Bars dip and brighten when they sound.
 */
export function InstrumentView({
  instrument,
  labels,
  active = [],
  next = [],
  selected,
  wrong,
  onStrike,
  onSelect,
  height = 180,
  className = '',
}: {
  instrument: InstrumentProfile
  labels: LabelSettings
  active?: number[]
  next?: number[]
  selected?: number
  /** A bar that was just struck by mistake (shown with a short red ring). */
  wrong?: number
  onStrike?: (midi: number) => void
  /**
   * Called on a completed tap (click), after the finger lifts. Use this to open editors,
   * so the same tap can never land on whatever opens under the finger.
   */
  onSelect?: (midi: number) => void
  height?: number
  className?: string
}) {
  const n = instrument.notes.length
  // More than 12 notes: keep every bar at least 44 px wide and let the row scroll.
  const crowded = n > 12
  const keys = instrument.kind === 'keys'
  return (
    <div
      role="group"
      aria-label={instrument.name}
      className={`bg-birch flex items-center gap-[3px] overflow-x-auto rounded-[22px] px-3 py-3 shadow-[inset_0_-4px_0_rgb(0_0_0/0.1)] ${crowded ? 'justify-start' : 'justify-center'} ${className}`}
      style={{ height }}
    >
      {instrument.notes.map((note, i) => {
        const isActive = active.includes(note.midi)
        const isNext = next.includes(note.midi)
        const isSel = selected === note.midi
        const frac = keys ? 1 : n === 1 ? 1 : 1 - (0.42 * i) / (n - 1)
        const label = labelFor(note.midi, instrument, labels)
        return (
          <button
            key={note.midi}
            type="button"
            aria-label={
              label ? `${label} (${fullName(fromMidi(note.midi))})` : fullName(fromMidi(note.midi))
            }
            aria-pressed={isSel || undefined}
            onPointerDown={(e) => {
              e.preventDefault()
              onStrike?.(note.midi)
            }}
            onClick={() => onSelect?.(note.midi)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onStrike?.(note.midi)
                onSelect?.(note.midi)
              }
            }}
            className="group relative flex min-w-0 flex-1 touch-none flex-col items-center justify-between rounded-[10px] py-2 outline-offset-2 transition-[transform,filter] duration-75"
            style={{
              height: `${frac * 100}%`,
              maxWidth: 64,
              minWidth: crowded ? 44 : undefined,
              flexShrink: crowded ? 0 : undefined,
              background: note.color,
              boxShadow: `inset 0 2px 0 rgb(255 255 255 / 0.35), inset 0 -4px 0 rgb(0 0 0 / 0.18)${isSel ? ', 0 0 0 3px var(--color-ink)' : ''}${isNext ? ', 0 0 0 3px var(--color-felt)' : ''}${wrong === note.midi ? ', 0 0 0 4px var(--color-alert)' : ''}`,
              transform: isActive ? 'translateY(3px)' : undefined,
              filter: isActive ? 'brightness(1.25) saturate(1.1)' : undefined,
            }}
          >
            <span
              aria-hidden
              className="bg-brass size-1.5 rounded-full shadow-[inset_0_-1px_0_rgb(0_0_0/0.3)]"
            />
            <span
              aria-hidden
              className="text-[clamp(11px,3.4vw,18px)] leading-none font-bold"
              style={{ color: labelColorFor(note.color) }}
            >
              {label}
            </span>
            <svg
              aria-hidden
              width="14"
              height="14"
              viewBox="-7 -7 14 14"
              style={{ color: labelColorFor(note.color) }}
            >
              <path
                d={shapePath(note.shape, 5)}
                fill={note.shape === 'ring' ? 'none' : 'currentColor'}
                stroke={note.shape === 'ring' ? 'currentColor' : 'none'}
                strokeWidth={1.4}
              />
            </svg>
            <span
              aria-hidden
              className="bg-brass size-1.5 rounded-full shadow-[inset_0_-1px_0_rgb(0_0_0/0.3)]"
            />
          </button>
        )
      })}
    </div>
  )
}

/** Small static drawing for lists and cards. */
export function InstrumentThumb({
  instrument,
  height = 44,
}: {
  instrument: InstrumentProfile
  height?: number
}) {
  const n = instrument.notes.length
  return (
    <div
      aria-hidden
      className="bg-birch flex items-center gap-[2px] rounded-lg px-1.5"
      style={{ height }}
    >
      {instrument.notes.map((note, i) => (
        <span
          key={note.midi}
          className="w-1.5 rounded-[3px]"
          style={{
            background: note.color,
            height: `${(instrument.kind === 'keys' ? 1 : 1 - (0.42 * i) / Math.max(1, n - 1)) * 78}%`,
          }}
        />
      ))}
    </div>
  )
}
