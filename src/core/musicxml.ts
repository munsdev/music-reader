import { unzipSync, strFromU8 } from 'fflate'
import {
  TICKS_PER_QUARTER,
  type Clef,
  type ClefSign,
  type Measure,
  type NoteEvent,
  type Part,
  type Score,
  type Step,
  type TimeSignature,
} from './model'
import { STEPS, fromMidi, toMidi } from './pitch'

export class MusicXmlError extends Error {
  override name = 'MusicXmlError'
}

/**
 * Parse a MusicXML document (score-partwise) into the internal model.
 * Pitches are stored as sounding pitch: transposing instruments are converted.
 */
export function parseMusicXml(xml: string, fileName?: string): Score {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new MusicXmlError('The file is not valid XML.')
  }
  const root = doc.documentElement
  if (root.tagName === 'score-timewise') {
    throw new MusicXmlError('Timewise MusicXML is not supported. Export as partwise.')
  }
  if (root.tagName !== 'score-partwise') {
    throw new MusicXmlError('This is not a MusicXML score.')
  }

  const title =
    text(root, 'work > work-title') ??
    text(root, 'movement-title') ??
    fileName?.replace(/\.(mxl|musicxml|xml)$/i, '') ??
    'Untitled'
  const composer = text(root, 'identification > creator[type="composer"]') ?? undefined

  const partNames = new Map<string, string>()
  for (const sp of children(root.querySelector('part-list'), 'score-part')) {
    partNames.set(sp.getAttribute('id') ?? '', text(sp, 'part-name') ?? '')
  }

  const parts = children(root, 'part').map((el, i) => {
    const id = el.getAttribute('id') ?? `P${i + 1}`
    return parsePart(el, id, partNames.get(id) || `Part ${i + 1}`)
  })
  if (parts.length === 0) throw new MusicXmlError('The score has no parts.')

  return { title: title.trim(), composer, parts, source: { kind: 'musicxml', fileName } }
}

interface PartState {
  divisions: number
  time: TimeSignature
  transposeSemitones: number
  staves: number
}

function parsePart(el: Element, id: string, name: string): Part {
  const state: PartState = {
    divisions: 1,
    time: { beats: 4, beatType: 4 },
    transposeSemitones: 0,
    staves: 1,
  }
  const measures: Measure[] = []
  let eventCounter = 0

  for (const [mIndex, mEl] of children(el, 'measure').entries()) {
    const measure: Measure = {
      number: mEl.getAttribute('number') ?? String(mIndex + 1),
      length: 0,
      events: [],
    }
    let cursor = 0
    let maxCursor = 0
    let lastStart = 0

    for (const child of Array.from(mEl.children)) {
      switch (child.tagName) {
        case 'attributes':
          applyAttributes(child, state, measure)
          break
        case 'direction': {
          const tempo = child.querySelector('sound[tempo]')?.getAttribute('tempo')
          if (tempo) measure.tempo = Number(tempo)
          break
        }
        case 'sound': {
          const tempo = child.getAttribute('tempo')
          if (tempo) measure.tempo = Number(tempo)
          break
        }
        case 'backup':
          cursor = Math.max(0, cursor - toTicks(num(child, 'duration'), state))
          break
        case 'forward':
          cursor += toTicks(num(child, 'duration'), state)
          maxCursor = Math.max(maxCursor, cursor)
          break
        case 'note': {
          // Grace and cue notes take no time in the measure and are not played.
          if (child.querySelector('grace') || child.querySelector('cue')) break
          const isChord = child.querySelector('chord') !== null
          const duration = toTicks(num(child, 'duration'), state)
          const start = isChord ? lastStart : cursor
          const event = parseNote(child, `${id}-${eventCounter++}`, start, duration, isChord, state)
          measure.events.push(event)
          if (!isChord) {
            lastStart = cursor
            cursor += duration
            maxCursor = Math.max(maxCursor, cursor)
          }
          break
        }
      }
    }

    const nominal = Math.round((state.time.beats * 4 * TICKS_PER_QUARTER) / state.time.beatType)
    const implicit = mEl.getAttribute('implicit') === 'yes'
    measure.length = implicit ? maxCursor : Math.max(nominal, maxCursor)
    measures.push(measure)
  }

  return { id, name, staves: state.staves, measures }
}

function applyAttributes(el: Element, state: PartState, measure: Measure): void {
  const divisions = text(el, 'divisions')
  if (divisions) state.divisions = Number(divisions)

  const fifths = text(el, 'key > fifths')
  if (fifths !== null) measure.key = Number(fifths)

  const beats = text(el, 'time > beats')
  const beatType = text(el, 'time > beat-type')
  if (beats && beatType) {
    // Compound beats like "3+2" are summed.
    const total = beats.split('+').reduce((sum, b) => sum + Number(b), 0)
    state.time = { beats: total, beatType: Number(beatType) }
    measure.time = state.time
  }

  const staves = text(el, 'staves')
  if (staves) state.staves = Number(staves)

  for (const clefEl of children(el, 'clef')) {
    const staff = Number(clefEl.getAttribute('number') ?? '1')
    const sign = (text(clefEl, 'sign') ?? 'G') as ClefSign
    const clef: Clef = {
      sign,
      line: Number(text(clefEl, 'line') ?? (sign === 'F' ? 4 : sign === 'C' ? 3 : 2)),
      octaveChange: Number(text(clefEl, 'clef-octave-change') ?? 0),
    }
    measure.clefs = { ...measure.clefs, [staff]: clef }
  }

  const transpose = el.querySelector('transpose')
  if (transpose) {
    state.transposeSemitones =
      Number(text(transpose, 'chromatic') ?? 0) + 12 * Number(text(transpose, 'octave-change') ?? 0)
  }
}

function parseNote(
  el: Element,
  id: string,
  start: number,
  duration: number,
  chord: boolean,
  state: PartState,
): NoteEvent {
  const ties = Array.from(el.querySelectorAll(':scope > tie')).map((t) => t.getAttribute('type'))
  const event: NoteEvent = {
    id,
    start,
    duration,
    voice: Number(text(el, 'voice') ?? 1),
    staff: Number(text(el, 'staff') ?? 1),
    chord,
    tieStart: ties.includes('start'),
    tieStop: ties.includes('stop'),
    type: text(el, 'type') ?? undefined,
    dots: el.querySelectorAll(':scope > dot').length,
  }

  const pitchEl = el.querySelector(':scope > pitch')
  if (pitchEl) {
    const step = text(pitchEl, 'step') as Step
    if (!STEPS.includes(step)) throw new MusicXmlError(`Unknown pitch step "${step}".`)
    const written = {
      step,
      alter: Math.round(Number(text(pitchEl, 'alter') ?? 0)),
      octave: Number(text(pitchEl, 'octave')),
    }
    const midi = toMidi(written) + state.transposeSemitones
    // Sounding pitch keeps the written spelling when not transposed.
    event.pitch =
      state.transposeSemitones === 0 ? { ...written, midi } : fromMidi(midi, written.alter < 0)
  }
  return event
}

function toTicks(duration: number, state: PartState): number {
  return Math.round((duration * TICKS_PER_QUARTER) / state.divisions)
}

function children(el: Element | null, tag: string): Element[] {
  if (!el) return []
  return Array.from(el.children).filter((c) => c.tagName === tag)
}

function text(el: Element, selector: string): string | null {
  const found = el.querySelector(selector)
  return found?.textContent?.trim() ?? null
}

function num(el: Element, selector: string): number {
  return Number(text(el, selector) ?? 0)
}

/** Read a compressed MusicXML (.mxl) archive and return the main score document. */
export function readMxl(data: Uint8Array): string {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(data)
  } catch {
    throw new MusicXmlError('The .mxl file could not be unzipped.')
  }
  const container = files['META-INF/container.xml']
  if (container) {
    const doc = new DOMParser().parseFromString(strFromU8(container), 'application/xml')
    const path = doc.querySelector('rootfile')?.getAttribute('full-path')
    const file = path ? files[path] : undefined
    if (file) return strFromU8(file)
  }
  const fallback = Object.keys(files).find(
    (n) => !n.startsWith('META-INF/') && /\.(xml|musicxml)$/i.test(n),
  )
  if (!fallback) throw new MusicXmlError('No score found inside the .mxl file.')
  return strFromU8(files[fallback]!)
}

/** Parse either a plain MusicXML file or a compressed .mxl archive. */
export function parseScoreFile(data: Uint8Array, fileName?: string): Score {
  const isZip = data[0] === 0x50 && data[1] === 0x4b // "PK"
  const xml = isZip ? readMxl(data) : new TextDecoder().decode(data)
  return parseMusicXml(xml, fileName)
}
