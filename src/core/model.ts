/**
 * Internal score model. Every source (recognized photo, MusicXML file, manual entry)
 * is converted into this shape. See docs/DESIGN.md section 04.
 */

/** Fixed tick resolution: ticks per quarter note. */
export const TICKS_PER_QUARTER = 480

export type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'

/** A spelled pitch. `alter` is in semitones: -1 flat, 0 natural, 1 sharp. */
export interface SpelledPitch {
  step: Step
  alter: number
  octave: number
}

export interface Pitch extends SpelledPitch {
  /** MIDI note number, middle C (C4) = 60. */
  midi: number
}

export type ClefSign = 'G' | 'F' | 'C' | 'percussion'

export interface Clef {
  sign: ClefSign
  line: number
  octaveChange: number
}

export interface TimeSignature {
  beats: number
  beatType: number
}

/** Bounding box on a source page image, in source pixels. */
export interface SourceBox {
  page: number
  x: number
  y: number
  width: number
  height: number
}

export interface Recognition {
  box: SourceBox
  /** 0 to 1. Notes below the review threshold are flagged for checking. */
  confidence: number
}

export interface NoteEvent {
  id: string
  /** Start, in ticks from the start of the measure. */
  start: number
  /** Notated duration in ticks. */
  duration: number
  /** Absent for rests. */
  pitch?: Pitch
  voice: number
  staff: number
  /** True when this note sounds at the same time as the previous note (a chord member). */
  chord: boolean
  tieStart: boolean
  tieStop: boolean
  /** Notated type, for display: 'quarter', 'eighth', and so on. */
  type?: string
  dots: number
  recognition?: Recognition
  /** Set when the user changed this note in Review or the editor. */
  userEdited?: boolean
}

export interface Measure {
  number: string
  /** Id of the scanned page this measure came from, for multi-page songs. */
  page?: string
  /** Length of the measure in ticks, from its time signature or its contents. */
  length: number
  key?: number
  time?: TimeSignature
  clefs?: Partial<Record<number, Clef>>
  /** Beats per minute for a quarter note, where the tempo changes. */
  tempo?: number
  events: NoteEvent[]
}

export interface Part {
  id: string
  name: string
  staves: number
  measures: Measure[]
}

export interface Score {
  title: string
  composer?: string
  parts: Part[]
  source: ScoreSource
}

export type ScoreSource =
  | { kind: 'musicxml'; fileName?: string }
  | { kind: 'recognition'; modelVersion: string; pageCount: number }
  | { kind: 'manual' }
  | { kind: 'sample' }

export const isRest = (e: NoteEvent): boolean => e.pitch === undefined
