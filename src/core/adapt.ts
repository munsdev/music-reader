import type { Measure, NoteEvent, Pitch, Score } from './model'
import { type InstrumentProfile, highest, lowest } from './instruments'
import { fromMidi, pitchClass } from './pitch'

/** One reported change made to fit a song to an instrument. See docs/DESIGN.md section 10. */
export type Change =
  | { kind: 'transpose'; semitones: number }
  | { kind: 'melody'; measures: string[]; removed: number }
  | { kind: 'octave'; measures: string[]; count: number; direction: 'up' | 'down' }
  | { kind: 'substitute'; measures: string[]; count: number; from: number; to: number }

export interface FitOptions {
  /** Keep only the top voice and top note of chords. Defaults to the instrument's polyphony. */
  melodyOnly?: boolean
  /** Force a transposition instead of searching for the best one. */
  transpose?: number
}

export interface FitResult {
  score: Score
  changes: Change[]
  transpose: number
  /** Share of pitched notes that play exactly as written after transposition, 0 to 1. */
  fit: number
}

const SEARCH = 12
const COST_OCTAVE = 1
const COST_SUBSTITUTE = 3
/** Penalty per semitone of key change (distance from the original key, octaves ignored). */
const COST_KEY_CHANGE = 0.05
/** Small penalty per octave moved, so a pure octave shift beats a key change but not a better fit. */
const COST_OCTAVE_SHIFT = 0.01

export function fitToInstrument(
  score: Score,
  instrument: InstrumentProfile,
  options: FitOptions = {},
): FitResult {
  const available = new Set(instrument.notes.map((n) => n.midi))
  const melodyOnly = options.melodyOnly ?? instrument.polyphony === 'single'
  const changes: Change[] = []

  let working = score
  if (melodyOnly) {
    const { score: melody, removedByMeasure } = extractMelody(score)
    working = melody
    const measures = [...removedByMeasure.keys()]
    const removed = [...removedByMeasure.values()].reduce((a, b) => a + b, 0)
    if (removed > 0) changes.push({ kind: 'melody', measures, removed })
  }

  const midis = pitchedEvents(working).map((e) => e.pitch!.midi)
  const transpose = options.transpose ?? bestTransposition(midis, instrument, available)
  if (transpose !== 0) changes.push({ kind: 'transpose', semitones: transpose })

  const exact = midis.filter((m) => available.has(m + transpose)).length
  const fit = midis.length === 0 ? 1 : exact / midis.length

  // Map each note, collecting octave and substitution changes per measure.
  const octaveUp: string[] = []
  const octaveDown: string[] = []
  const subs = new Map<string, { from: number; to: number; measures: string[] }>()

  const parts = working.parts.map((part) => ({
    ...part,
    measures: part.measures.map((measure) => ({
      ...measure,
      events: measure.events.map((event) => {
        if (!event.pitch) return event
        const preferFlats = (measure.key ?? 0) < 0 || event.pitch.alter < 0
        const target = mapNote(event.pitch.midi + transpose, instrument, available)
        if (target.octaves > 0) octaveUp.push(measure.number)
        if (target.octaves < 0) octaveDown.push(measure.number)
        if (target.substituted) {
          const key = `${target.beforeSub}>${target.midi}`
          const entry = subs.get(key) ?? { from: target.beforeSub, to: target.midi, measures: [] }
          entry.measures.push(measure.number)
          subs.set(key, entry)
        }
        const pitch: Pitch =
          target.midi === event.pitch.midi ? event.pitch : fromMidi(target.midi, preferFlats)
        return { ...event, pitch }
      }),
    })),
  }))

  if (octaveUp.length) {
    changes.push({
      kind: 'octave',
      direction: 'up',
      count: octaveUp.length,
      measures: unique(octaveUp),
    })
  }
  if (octaveDown.length) {
    changes.push({
      kind: 'octave',
      direction: 'down',
      count: octaveDown.length,
      measures: unique(octaveDown),
    })
  }
  for (const s of subs.values()) {
    changes.push({
      kind: 'substitute',
      from: s.from,
      to: s.to,
      count: s.measures.length,
      measures: unique(s.measures),
    })
  }

  return { score: { ...working, parts }, changes, transpose, fit }
}

interface MappedNote {
  midi: number
  /** Octaves moved: positive is up. */
  octaves: number
  substituted: boolean
  /** The pitch after octave folding, before substitution. */
  beforeSub: number
}

/** Fold into range by octaves, then substitute if the pitch class is missing. */
export function mapNote(
  midi: number,
  instrument: InstrumentProfile,
  available: Set<number> = new Set(instrument.notes.map((n) => n.midi)),
): MappedNote {
  if (available.has(midi)) return { midi, octaves: 0, substituted: false, beforeSub: midi }

  const low = lowest(instrument)
  const high = highest(instrument)
  let folded = midi
  while (folded > high) folded -= 12
  while (folded < low) folded += 12
  // If folding upward overshot a narrow range, fall back toward the nearer edge.
  if (folded > high) folded = midi > high ? folded - 12 : folded
  const octaves = Math.round((folded - midi) / 12)

  if (available.has(folded)) return { midi: folded, octaves, substituted: false, beforeSub: folded }
  return {
    midi: nearestAvailable(folded, instrument),
    octaves,
    substituted: true,
    beforeSub: folded,
  }
}

/**
 * Nearest available note. Prefers the same letter name (F sharp to F), which for a
 * sharp is one semitone down and for a flat one semitone up; otherwise nearest, ties upward.
 */
export function nearestAvailable(midi: number, instrument: InstrumentProfile): number {
  const notes = instrument.notes.map((n) => n.midi)
  const spelled = fromMidi(midi)
  if (spelled.alter !== 0) {
    const sameLetter = midi - spelled.alter
    if (notes.includes(sameLetter)) return sameLetter
  }
  let best = notes[0] ?? midi
  for (const n of notes) {
    const d = Math.abs(n - midi)
    const bd = Math.abs(best - midi)
    if (d < bd || (d === bd && n > best)) best = n
  }
  return best
}

export function bestTransposition(
  midis: number[],
  instrument: InstrumentProfile,
  available: Set<number> = new Set(instrument.notes.map((n) => n.midi)),
): number {
  if (midis.length === 0) return 0
  let best = 0
  let bestCost = Infinity
  // Order: 0, +1, -1, +2, -2 ... so ties go to the smaller shift, then upward.
  for (let i = 0; i <= SEARCH * 2; i++) {
    const shift = i === 0 ? 0 : i % 2 === 1 ? (i + 1) / 2 : -i / 2
    const semis = Math.abs(shift) % 12
    const keyChange = Math.min(semis, 12 - semis)
    let cost =
      (keyChange * COST_KEY_CHANGE + Math.round(Math.abs(shift) / 12) * COST_OCTAVE_SHIFT) *
      midis.length
    for (const m of midis) {
      const mapped = mapNote(m + shift, instrument, available)
      if (mapped.octaves !== 0) cost += COST_OCTAVE
      if (mapped.substituted) cost += COST_SUBSTITUTE
    }
    if (cost < bestCost - 1e-9) {
      bestCost = cost
      best = shift
    }
  }
  return best
}

/** Keep the top staff's top voice; in chords keep only the highest note. */
export function extractMelody(score: Score): {
  score: Score
  removedByMeasure: Map<string, number>
} {
  const removedByMeasure = new Map<string, number>()
  const first = score.parts[0]
  if (!first) return { score, removedByMeasure }

  const measures: Measure[] = first.measures.map((measure) => {
    const staffEvents = measure.events.filter((e) => e.staff === 1)
    const voice = staffEvents.find((e) => e.pitch)?.voice ?? 1
    const kept: NoteEvent[] = []
    for (const e of staffEvents.filter((ev) => ev.voice === voice)) {
      const prev = kept.at(-1)
      if (e.chord && prev && prev.start === e.start) {
        if (e.pitch && prev.pitch && e.pitch.midi > prev.pitch.midi) {
          kept[kept.length - 1] = { ...e, chord: false }
        }
        continue
      }
      kept.push(e)
    }
    const removed =
      measure.events.filter((e) => e.pitch).length - kept.filter((e) => e.pitch).length
    if (removed > 0) removedByMeasure.set(measure.number, removed)
    return { ...measure, events: kept }
  })

  return {
    score: { ...score, parts: [{ ...first, staves: 1, measures }] },
    removedByMeasure,
  }
}

function pitchedEvents(score: Score): NoteEvent[] {
  return score.parts.flatMap((p) => p.measures.flatMap((m) => m.events.filter((e) => e.pitch)))
}

function unique(xs: string[]): string[] {
  return [...new Set(xs)]
}

/** True if every note's pitch class exists somewhere on the instrument. */
export function coversPitchClass(midi: number, instrument: InstrumentProfile): boolean {
  return instrument.notes.some((n) => pitchClass(n.midi) === pitchClass(midi))
}
