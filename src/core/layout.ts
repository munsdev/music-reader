import { TICKS_PER_QUARTER, type Measure, type Part, type Pitch } from './model'

/**
 * Layout for the circles view and the circles PDF. Units are abstract ("note units");
 * the renderer scales them. Lines break only between measures. See docs/DESIGN.md 05 and 07.
 */

export interface LayoutNote {
  /** Ids of the events in this slot (several for a chord). */
  ids: string[]
  /** MIDI numbers, low to high. Empty for a rest. */
  midis: number[]
  /** Spelled pitches matching `midis`, for labels (B flat, not A sharp). */
  pitches: Pitch[]
  x: number
  width: number
  ticks: number
}

export interface LayoutMeasure {
  index: number
  number: string
  x: number
  width: number
  notes: LayoutNote[]
}

export interface LayoutRow {
  measures: LayoutMeasure[]
  width: number
}

export interface LayoutOptions {
  /** Available row width in note units. */
  maxWidth: number
  /** Width of a quarter note. */
  quarterWidth?: number
  /** Smallest width a slot can have, so short notes stay tappable and readable. */
  minWidth?: number
  /** Padding inside each measure, both sides. */
  measurePadding?: number
  /** Most measures on one row (for large print). */
  maxMeasuresPerRow?: number
}

/** Group a measure's events into time slots (chords share a slot). */
export interface Slot {
  start: number
  ticks: number
  ids: string[]
  midis: number[]
  pitches: Pitch[]
}

export function slots(measure: Measure, staff?: number): Slot[] {
  const byStart = new Map<number, Slot>()
  for (const e of measure.events) {
    if (staff !== undefined && e.staff !== staff) continue
    const slot = byStart.get(e.start) ?? {
      start: e.start,
      ticks: e.duration,
      ids: [],
      midis: [],
      pitches: [],
    }
    // A rest never hides a note that starts at the same time.
    if (e.pitch) {
      slot.midis.push(e.pitch.midi)
      slot.pitches.push(e.pitch)
    }
    slot.ids.push(e.id)
    slot.ticks = Math.min(slot.ticks, e.duration)
    byStart.set(e.start, slot)
  }
  const sorted = [...byStart.values()].sort((a, b) => a.start - b.start)
  for (const s of sorted) {
    s.pitches.sort((a, b) => a.midi - b.midi)
    s.midis = s.pitches.map((p) => p.midi)
  }
  // A rest slot that overlaps a note slot from another voice is dropped.
  return sorted.filter(
    (s, i) =>
      s.midis.length > 0 ||
      !sorted.some((o, j) => j !== i && o.midis.length > 0 && o.start === s.start),
  )
}

export function layoutPart(part: Part, options: LayoutOptions): LayoutRow[] {
  const quarter = options.quarterWidth ?? 1
  const min = options.minWidth ?? 0.7
  const pad = options.measurePadding ?? 0.3
  const maxPer = options.maxMeasuresPerRow ?? Infinity

  const measures: LayoutMeasure[] = part.measures.map((m, index) => {
    let x = pad
    const notes: LayoutNote[] = slots(m, 1).map((s) => {
      // Square-root scaling keeps long notes from taking over a line.
      const width = Math.max(min, quarter * Math.sqrt(s.ticks / TICKS_PER_QUARTER))
      const note = { ids: s.ids, midis: s.midis, pitches: s.pitches, x, width, ticks: s.ticks }
      x += width
      return note
    })
    return { index, number: m.number, x: 0, width: x + pad, notes }
  })

  const rows: LayoutRow[] = []
  let row: LayoutRow = { measures: [], width: 0 }
  for (const m of measures) {
    const fits = row.width + m.width <= options.maxWidth && row.measures.length < maxPer
    if (row.measures.length > 0 && !fits) {
      rows.push(row)
      row = { measures: [], width: 0 }
    }
    row.measures.push({ ...m, x: row.width })
    row.width += m.width
  }
  if (row.measures.length) rows.push(row)
  return rows
}
