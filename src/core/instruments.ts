import { mix } from './color'
import { pitchClass } from './pitch'

/** Marker drawn on every note so color is never the only signal. */
export type NoteShape =
  'circle' | 'square' | 'triangle' | 'diamond' | 'star' | 'hexagon' | 'heart' | 'ring'

export interface InstrumentNote {
  midi: number
  color: string
  shape: NoteShape
  /** Optional sticker text that overrides the generated label. */
  label?: string
  /**
   * Measured frequency of this bar on the real toy, set by "Set up by listening".
   * Used to match the toy's own tuning in playback and listening modes.
   */
  hz?: number
}

export type InstrumentKind = 'bars' | 'keys' | 'tubes' | 'bells'

export interface InstrumentProfile {
  id: string
  name: string
  kind: InstrumentKind
  /** One mallet or finger at a time, or chords allowed. */
  polyphony: 'single' | 'multi'
  /** Ordered low to high. This list is the whole definition of the instrument. */
  notes: InstrumentNote[]
  /** Built-in presets cannot be deleted, only duplicated. */
  builtIn?: boolean
}

export interface Palette {
  id: string
  name: string
  /** Color for each pitch class, C = index 0. */
  colors: readonly string[]
}

/** Classic children's xylophone rainbow: C red through B violet. */
const RAINBOW_7: Record<number, string> = {
  0: '#D32F2F', // C red
  2: '#FB8C00', // D orange
  4: '#FDD835', // E yellow
  5: '#43A047', // F green
  7: '#1E88E5', // G blue
  9: '#3949AB', // A indigo
  11: '#8E24AA', // B violet
}

function fillChromatic(naturals: Record<number, string>): string[] {
  return Array.from({ length: 12 }, (_, pc) => {
    const own = naturals[pc]
    if (own) return own
    // Sharps take the hue halfway between their neighbors.
    return mix(naturals[pc - 1]!, naturals[(pc + 1) % 12]!, 0.5)
  })
}

export const PALETTES: readonly Palette[] = [
  { id: 'rainbow', name: 'Rainbow', colors: fillChromatic(RAINBOW_7) },
  {
    id: 'high-contrast',
    name: 'High contrast',
    colors: fillChromatic({
      0: '#D50000',
      2: '#FF6D00',
      4: '#FFD600',
      5: '#00C853',
      7: '#2962FF',
      9: '#AA00FF',
      11: '#3E2723',
    }),
  },
  {
    id: 'pastel',
    name: 'Pastel',
    colors: fillChromatic({
      0: '#F28B82',
      2: '#FBBC04',
      4: '#FFF475',
      5: '#CCFF90',
      7: '#AECBFA',
      9: '#D7AEFB',
      11: '#FDCFE8',
    }),
  },
]

const SHAPES_BY_PC: readonly NoteShape[] = [
  'circle',
  'ring',
  'square',
  'ring',
  'triangle',
  'diamond',
  'ring',
  'star',
  'ring',
  'hexagon',
  'ring',
  'heart',
]

export function shapeFor(midi: number): NoteShape {
  return SHAPES_BY_PC[pitchClass(midi)]!
}

export function colorFor(midi: number, palette: Palette): string {
  return palette.colors[pitchClass(midi)]!
}

const DIATONIC = [0, 2, 4, 5, 7, 9, 11]

/** All MIDI numbers from `low` to `high` inclusive, optionally only white-key notes. */
export function noteRange(low: number, high: number, diatonic: boolean): number[] {
  const out: number[] = []
  for (let m = low; m <= high; m++) {
    if (!diatonic || DIATONIC.includes(pitchClass(m))) out.push(m)
  }
  return out
}

export function buildNotes(midis: number[], palette: Palette): InstrumentNote[] {
  return midis.map((midi) => ({ midi, color: colorFor(midi, palette), shape: shapeFor(midi) }))
}

/** Recolor every note of a profile from a palette, keeping custom labels. */
export function applyPalette(profile: InstrumentProfile, palette: Palette): InstrumentProfile {
  return {
    ...profile,
    notes: profile.notes.map((n) => ({ ...n, color: colorFor(n.midi, palette) })),
  }
}

/** Shift a whole instrument by octaves. Colors and shapes follow pitch class, so they stay. */
export function shiftOctave(profile: InstrumentProfile, octaves: number): InstrumentProfile {
  return { ...profile, notes: profile.notes.map((n) => ({ ...n, midi: n.midi + 12 * octaves })) }
}

const rainbow = PALETTES[0]!
const C4 = 60

function preset(
  id: string,
  name: string,
  kind: InstrumentKind,
  low: number,
  high: number,
  diatonic: boolean,
  polyphony: 'single' | 'multi' = 'single',
): InstrumentProfile {
  return {
    id,
    name,
    kind,
    polyphony,
    notes: buildNotes(noteRange(low, high, diatonic), rainbow),
    builtIn: true,
  }
}

export const PRESETS: readonly InstrumentProfile[] = [
  preset('xylophone-8', '8-note xylophone or bells', 'bars', C4, C4 + 12, true),
  preset('glockenspiel-15', '15-note glockenspiel', 'bars', C4 + 12, C4 + 36, true),
  preset('keyboard-25', '25-key toy keyboard', 'keys', C4, C4 + 24, false, 'multi'),
  preset('tubes-diatonic', 'Tuned tubes, 8 notes', 'tubes', C4, C4 + 12, true),
  preset('tubes-chromatic', 'Tuned tubes, 13 notes', 'tubes', C4, C4 + 12, false),
]

export const DEFAULT_PRESET_ID = 'xylophone-8'

export function lowest(profile: InstrumentProfile): number {
  return profile.notes[0]?.midi ?? C4
}

export function highest(profile: InstrumentProfile): number {
  return profile.notes.at(-1)?.midi ?? C4
}
