import type { FitOptions } from '../core/adapt'
import type { InstrumentProfile } from '../core/instruments'
import type { Score } from '../core/model'

export type PageStatus = 'new' | 'reading' | 'read' | 'failed'

/** Crop corners as fractions of the photo size, clockwise from top left. */
export type Corners = [[number, number], [number, number], [number, number], [number, number]]

export interface Page {
  id: string
  /** Photo as a data URL on the web, or a Capacitor file path on Android. */
  photo: string
  corners?: Corners
  rotation: 0 | 90 | 180 | 270
  status: PageStatus
  error?: string
  modelVersion?: string
  /** What recognition produced for this page; the song score is built from these. */
  score?: Score
}

export interface Song {
  id: string
  title: string
  composer?: string
  createdAt: number
  updatedAt: number
  /** Ordered pages. Empty for imported MusicXML and hand-written songs. */
  pages: Page[]
  /** The song's notes. For scanned songs, the joined page scores plus the user's edits. */
  score: Score
  lastInstrumentId?: string
  /** Fit overrides per instrument id. */
  fit: Record<string, FitOptions>
}

export type Instrument = InstrumentProfile & {
  sound: SoundKind
  createdAt: number
  updatedAt: number
}

export type SoundKind = 'xylophone' | 'glockenspiel' | 'piano' | 'tubes' | 'bells'

export const SOUND_FOR_KIND: Record<InstrumentProfile['kind'], SoundKind> = {
  bars: 'xylophone',
  keys: 'piano',
  tubes: 'tubes',
  bells: 'bells',
}
