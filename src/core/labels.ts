import type { InstrumentProfile, InstrumentNote } from './instruments'
import type { Pitch } from './model'
import { fromMidi, noteName, type NamingSystem } from './pitch'

export type LabelStyle = 'letters' | 'numbers' | 'solfege' | 'none'

export interface LabelSettings {
  style: LabelStyle
  /** Letter naming for the letters style. */
  naming: Exclude<NamingSystem, 'solfege'>
}

export const DEFAULT_LABELS: LabelSettings = { style: 'letters', naming: 'english' }

export function instrumentNote(
  instrument: InstrumentProfile,
  midi: number,
): InstrumentNote | undefined {
  return instrument.notes.find((n) => n.midi === midi)
}

/**
 * The text shown on a note. A sticker label set in the instrument editor wins; numbers count
 * bars from the lowest (1 to n), which matches numbered toy instruments.
 */
export function labelFor(
  midi: number,
  instrument: InstrumentProfile,
  settings: LabelSettings,
  spelled?: Pitch,
): string {
  if (settings.style === 'none') return ''
  const note = instrumentNote(instrument, midi)
  if (note?.label) return note.label
  if (settings.style === 'numbers') {
    const i = instrument.notes.findIndex((n) => n.midi === midi)
    return i >= 0 ? String(i + 1) : ''
  }
  const p = spelled && spelled.midi === midi ? spelled : fromMidi(midi)
  return noteName(p, settings.style === 'solfege' ? 'solfege' : settings.naming)
}

/** Text alternative for screen readers: "C sharp, quarter note, measure 3". */
export function describeNote(name: string, type: string | undefined, measure: string): string {
  return [
    name.replace('♯', ' sharp').replace('♭', ' flat'),
    type ? `${type} note` : '',
    `measure ${measure}`,
  ]
    .filter(Boolean)
    .join(', ')
}
