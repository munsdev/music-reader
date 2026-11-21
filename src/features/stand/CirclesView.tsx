import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { labelColorFor } from '../../core/color'
import type { InstrumentProfile, NoteShape } from '../../core/instruments'
import { shapePath } from '../../core/shapes'
import { describeNote, labelFor, type LabelSettings } from '../../core/labels'
import { layoutPart } from '../../core/layout'
import { TICKS_PER_QUARTER, type Score } from '../../core/model'

export type CircleSize = 's' | 'm' | 'l' | 'xl'
const SIZES: Record<CircleSize, number> = { s: 34, m: 44, l: 58, xl: 76 }

/** Rows of colored circles, spaced by rhythm, lines broken only at measures. */
export function CirclesView({
  score,
  instrument,
  labels,
  current,
  next,
  size,
  onNote,
}: {
  score: Score
  instrument: InstrumentProfile
  labels: LabelSettings
  current: Set<string>
  next: Set<string>
  size: CircleSize
  onNote: (eventId: string, midi: number | undefined) => void
}) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(360)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => e && setWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Medium fits two 4/4 measures per row on a phone; other sizes are fixed.
  const d = size === 'm' ? Math.max(34, Math.min(SIZES.m, width / 9.4)) : SIZES[size]
  const unit = d * 1.08
  const part = score.parts[0]
  const rows = useMemo(
    () =>
      part
        ? layoutPart(part, {
            maxWidth: width / unit,
            quarterWidth: 1,
            minWidth: 1,
            measurePadding: 0.2,
          })
        : [],
    [part, width, unit],
  )
  const colors = useMemo(() => new Map(instrument.notes.map((n) => [n.midi, n])), [instrument])
  const maxChord = Math.max(
    1,
    ...rows.flatMap((r) => r.measures.flatMap((m) => m.notes.map((n) => n.midis.length))),
  )
  const rowHeight = maxChord * d * 1.08 + d * 0.55 + 18

  // Keep the current note in view while playing.
  useEffect(() => {
    if (!current.size) return
    const el = ref.current?.querySelector('[data-current="true"]')
    el?.scrollIntoView({
      block: 'center',
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }, [current])

  return (
    <div ref={ref} className="w-full">
      {rows.map((row, ri) => (
        <div key={ri} className="relative" style={{ height: rowHeight }}>
          {row.measures.map((m, mi) => (
            <div
              key={m.index}
              className="absolute top-0 h-full"
              style={{ left: m.x * unit, width: m.width * unit }}
            >
              <span
                aria-hidden
                className="text-ink/40 absolute top-0 left-1 text-[11px] tabular-nums"
              >
                {m.number}
              </span>
              {mi > 0 && (
                <span aria-hidden className="bg-stand absolute top-4 bottom-3 left-0 w-px" />
              )}
              {m.notes.map((n) => {
                const isCurrent = n.ids.some((id) => current.has(id))
                const isNext = !isCurrent && n.ids.some((id) => next.has(id))
                const long = n.ticks >= TICKS_PER_QUARTER * 2
                if (n.midis.length === 0) {
                  return (
                    <span
                      key={n.ids[0]}
                      aria-label={t('stand.rest')}
                      role="img"
                      className="bg-stand absolute h-1.5 rounded-full"
                      style={{ left: n.x * unit + d * 0.25, top: 18 + d / 2 - 3, width: d * 0.5 }}
                    />
                  )
                }
                const pitches = [...n.pitches].reverse()
                return (
                  <div
                    key={n.ids[0]}
                    className="absolute"
                    style={{ left: n.x * unit, top: 16 }}
                    data-current={isCurrent || undefined}
                  >
                    {pitches.map((p, pi) => {
                      const inst = colors.get(p.midi)
                      const label = labelFor(p.midi, instrument, labels, p)
                      const color = inst?.color ?? 'var(--color-stand)'
                      const hold = long ? n.width * unit - d - 6 : 0
                      return (
                        <button
                          key={p.midi}
                          type="button"
                          onClick={() => onNote(n.ids[0]!, p.midi)}
                          aria-label={describeNote(label || p.step, undefined, m.number)}
                          aria-current={isCurrent || undefined}
                          className="absolute block rounded-full"
                          style={{
                            top: pi * d * 1.08,
                            left: 0,
                            width: d + Math.max(0, hold),
                            height: d,
                          }}
                        >
                          <Disc
                            d={d}
                            color={color}
                            label={label}
                            hold={hold}
                            state={isCurrent ? 'current' : isNext ? 'next' : 'idle'}
                          />
                        </button>
                      )
                    })}
                    {colors.get(n.midis[0]!) && (
                      <Shape
                        shape={colors.get(n.midis[0]!)!.shape}
                        d={d}
                        top={pitches.length * d * 1.08 - d * 0.02}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function Disc({
  d,
  color,
  label,
  hold,
  state,
}: {
  d: number
  color: string
  label: string
  hold: number
  state: 'idle' | 'current' | 'next'
}) {
  const r = d / 2
  return (
    <svg width={d + Math.max(0, hold)} height={d} className="overflow-visible" aria-hidden>
      {hold > 0 && (
        <line
          x1={r}
          y1={r}
          x2={r + hold}
          y2={r}
          stroke={color}
          strokeWidth={r * 0.42}
          strokeLinecap="round"
        />
      )}
      <g
        style={{
          transform: state === 'current' ? 'scale(1.13)' : undefined,
          transformOrigin: `${r}px ${r}px`,
          transition: 'transform 90ms ease-out',
        }}
      >
        <circle cx={r} cy={r} r={state === 'next' ? r - 3 : r} fill={color} />
        {state === 'current' && (
          <circle cx={r} cy={r} r={r + 2} fill="none" stroke="var(--color-ink)" strokeWidth={3} />
        )}
        {state === 'next' && (
          <circle
            cx={r}
            cy={r}
            r={r}
            fill="none"
            stroke="var(--color-felt)"
            strokeWidth={2.5}
            strokeDasharray="5 4"
          />
        )}
        {label && (
          <text
            x={r}
            y={r}
            dy="0.36em"
            textAnchor="middle"
            fontWeight={700}
            fontSize={label.length > 2 ? r * 0.6 : r * 0.86}
            fill={color.startsWith('#') ? labelColorFor(color) : 'currentColor'}
          >
            {label}
          </text>
        )}
      </g>
    </svg>
  )
}

function Shape({ shape, d, top }: { shape: NoteShape; d: number; top: number }) {
  const s = d * 0.12
  return (
    <svg
      aria-hidden
      className="text-ink/80 absolute"
      width={d}
      height={s * 2 + 4}
      style={{ top, left: 0 }}
      viewBox={`${-d / 2} ${-s - 2} ${d} ${s * 2 + 4}`}
    >
      <path
        d={shapePath(shape, s)}
        fill={shape === 'ring' ? 'none' : 'currentColor'}
        stroke={shape === 'ring' ? 'currentColor' : 'none'}
        strokeWidth={1.5}
      />
    </svg>
  )
}
