import type { Pitch, SpelledPitch, Step } from './model'

export const STEPS: readonly Step[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

/** Semitone offset of each natural step above C. */
const STEP_SEMITONES: Record<Step, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

export function toMidi(p: SpelledPitch): number {
  return (p.octave + 1) * 12 + STEP_SEMITONES[p.step] + p.alter
}

export function pitch(step: Step, octave: number, alter = 0): Pitch {
  const spelled = { step, alter, octave }
  return { ...spelled, midi: toMidi(spelled) }
}

/** Pitch class 0 to 11, C = 0. */
export const pitchClass = (midi: number): number => ((midi % 12) + 12) % 12

/** Spellings used when a MIDI number has to be turned back into a name. */
const SHARP_SPELLING: readonly [Step, number][] = [
  ['C', 0],
  ['C', 1],
  ['D', 0],
  ['D', 1],
  ['E', 0],
  ['F', 0],
  ['F', 1],
  ['G', 0],
  ['G', 1],
  ['A', 0],
  ['A', 1],
  ['B', 0],
]
const FLAT_SPELLING: readonly [Step, number][] = [
  ['C', 0],
  ['D', -1],
  ['D', 0],
  ['E', -1],
  ['E', 0],
  ['F', 0],
  ['G', -1],
  ['G', 0],
  ['A', -1],
  ['A', 0],
  ['B', -1],
  ['B', 0],
]

/**
 * Spell a MIDI number. `preferFlats` follows the key signature: negative fifths
 * (flat keys) spell black keys as flats.
 */
export function fromMidi(midi: number, preferFlats = false): Pitch {
  const pc = pitchClass(midi)
  const [step, alter] = (preferFlats ? FLAT_SPELLING : SHARP_SPELLING)[pc]!
  const octave = Math.floor((midi - alter) / 12) - 1
  return { step, alter, octave, midi }
}

/** Transpose by semitones, keeping a sensible spelling. */
export function transpose(p: Pitch, semitones: number, preferFlats = p.alter < 0): Pitch {
  if (semitones === 0) return p
  return fromMidi(p.midi + semitones, preferFlats)
}

export type NamingSystem = 'english' | 'german' | 'solfege'

const SOLFEGE: Record<Step, string> = {
  C: 'Do',
  D: 'Re',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
}

/**
 * Display name without octave. German naming uses H for B natural and B for B flat,
 * and the -is / -es suffixes (Fis, Es, As).
 */
export function noteName(p: SpelledPitch, system: NamingSystem = 'english'): string {
  if (system === 'solfege') return SOLFEGE[p.step] + accidentalSymbol(p.alter)
  if (system === 'german') return germanName(p)
  return p.step + accidentalSymbol(p.alter)
}

function accidentalSymbol(alter: number): string {
  if (alter === 0) return ''
  if (alter > 0) return '♯'.repeat(alter)
  return '♭'.repeat(-alter)
}

function germanName(p: SpelledPitch): string {
  if (p.step === 'B') {
    if (p.alter === 0) return 'H'
    if (p.alter === -1) return 'B'
    if (p.alter === 1) return 'His'
    if (p.alter === -2) return 'Heses'
  }
  if (p.alter === 0) return p.step
  if (p.alter > 0) return p.step + 'is'.repeat(p.alter)
  // Flats: E and A contract (Es, As); others take -es (Des, Ges, Ces, Fes).
  const base = p.step === 'E' || p.step === 'A' ? p.step + 's' : p.step + 'es'
  return p.alter === -1 ? base : base + 'es'.repeat(-p.alter - 1)
}

/** Name with octave in scientific pitch notation, for accessibility text and debugging. */
export function fullName(p: Pitch, system: NamingSystem = 'english'): string {
  return noteName(p, system) + String(p.octave)
}
