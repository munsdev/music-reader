import { Capacitor, registerPlugin } from '@capacitor/core'
import type { Corners } from '../data/types'

/**
 * Recognition engine interface. The native Kotlin plugin "Omr" implements it on Android
 * (see docs/OMR.md). MockOmrEngine is used in the browser and until models are installed.
 */

export interface RecognizedNote {
  /** Index of the note in document order of the returned MusicXML (rests included). */
  index: number
  box: { x: number; y: number; width: number; height: number }
  confidence: number
}

export interface PageResult {
  musicXml: string
  notes: RecognizedNote[]
  modelVersion: string
}

export interface ModelStatus {
  installed: boolean
  version?: string
  bytes?: number
  downloadBytes?: number
}

export type Stage = 'staves' | 'symbols' | 'notes'

export interface OmrEngine {
  readonly available: boolean
  modelStatus(): Promise<ModelStatus>
  installModels(onProgress?: (fraction: number) => void): Promise<void>
  removeModels(): Promise<void>
  recognize(
    photo: string,
    corners: Corners | undefined,
    rotation: number,
    onStage?: (s: Stage) => void,
  ): Promise<PageResult>
}

export class OmrError extends Error {
  override name = 'OmrError'
  readonly code: 'no-models' | 'no-staff' | 'blurry' | 'failed'
  constructor(code: OmrError['code'], message?: string) {
    super(message ?? code)
    this.code = code
  }
}

interface NativeOmr {
  modelStatus(): Promise<ModelStatus>
  installModels(): Promise<void>
  removeModels(): Promise<void>
  recognize(opts: { photo: string; corners?: Corners; rotation: number }): Promise<PageResult>
  addListener(
    event: 'stage' | 'installProgress',
    fn: (e: { stage?: Stage; fraction?: number }) => void,
  ): Promise<{ remove: () => Promise<void> }>
}

const Native = registerPlugin<NativeOmr>('Omr')

class NativeOmrEngine implements OmrEngine {
  readonly available = true
  modelStatus() {
    return Native.modelStatus()
  }
  async installModels(onProgress?: (f: number) => void) {
    const sub = await Native.addListener('installProgress', (e) => onProgress?.(e.fraction ?? 0))
    try {
      await Native.installModels()
    } finally {
      await sub.remove()
    }
  }
  removeModels() {
    return Native.removeModels()
  }
  async recognize(
    photo: string,
    corners: Corners | undefined,
    rotation: number,
    onStage?: (s: Stage) => void,
  ) {
    const sub = await Native.addListener('stage', (e) => e.stage && onStage?.(e.stage))
    try {
      return await Native.recognize({ photo, corners, rotation })
    } catch (e) {
      const code = (e as { code?: string }).code
      throw new OmrError(
        code === 'no-models' || code === 'no-staff' || code === 'blurry' ? code : 'failed',
        String(e),
      )
    } finally {
      await sub.remove()
    }
  }
}

/**
 * Development engine: pretends to read the page and returns a short melody with a few
 * low-confidence notes, so the whole scan, review and fit flow can be built in a browser.
 */
export class MockOmrEngine implements OmrEngine {
  readonly available = false
  private installed = import.meta.env.DEV
  async modelStatus(): Promise<ModelStatus> {
    return { installed: this.installed, version: 'mock-0', bytes: 0, downloadBytes: 30_000_000 }
  }
  async installModels(onProgress?: (f: number) => void) {
    for (let i = 1; i <= 10; i++) {
      await new Promise((r) => setTimeout(r, 80))
      onProgress?.(i / 10)
    }
    this.installed = true
  }
  async removeModels() {
    this.installed = false
  }
  async recognize(
    _photo: string,
    _c: Corners | undefined,
    _r: number,
    onStage?: (s: Stage) => void,
  ): Promise<PageResult> {
    if (!this.installed) throw new OmrError('no-models')
    for (const s of ['staves', 'symbols', 'notes'] as const) {
      onStage?.(s)
      await new Promise((r) => setTimeout(r, 400))
    }
    const melody = ['E4', 'D4', 'C4', 'D4', 'E4', 'E4', 'E4-', 'D4', 'D4', 'D4-', 'E4', 'G4', 'G4-']
    let measure = 1
    let used = 0
    const xml: string[] = []
    const notes: RecognizedNote[] = []
    xml.push(
      `<measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>`,
    )
    melody.forEach((n, i) => {
      const half = n.endsWith('-')
      const d = half ? 2 : 1
      if (used + d > 4) {
        measure++
        used = 0
        xml.push(`</measure><measure number="${measure}">`)
      }
      used += d
      xml.push(
        `<note><pitch><step>${n[0]}</step><octave>${n[1]}</octave></pitch><duration>${d}</duration><voice>1</voice><type>${half ? 'half' : 'quarter'}</type></note>`,
      )
      notes.push({
        index: i,
        box: { x: 0.08 + i * 0.065, y: 0.2, width: 0.04, height: 0.05 },
        confidence: i % 5 === 3 ? 0.4 : 0.95,
      })
    })
    xml.push('</measure>')
    const musicXml = `<?xml version="1.0"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Melody</part-name></score-part></part-list><part id="P1">${xml.join('')}</part></score-partwise>`
    return { musicXml, notes, modelVersion: 'mock-0' }
  }
}

export const omr: OmrEngine = Capacitor.isPluginAvailable('Omr')
  ? new NativeOmrEngine()
  : new MockOmrEngine()

/** Notes below this confidence are flagged for checking in Review. */
export const REVIEW_THRESHOLD = 0.7
