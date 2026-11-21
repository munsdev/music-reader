import { TICKS_PER_QUARTER, type Measure, type NoteEvent, type Part, type Score } from './model'
import { fromMidi, pitch } from './pitch'

/** Immutable edits used by the Review screen and the note editor. */

function mapEvents(score: Score, fn: (e: NoteEvent, m: Measure) => NoteEvent | null): Score {
  return {
    ...score,
    parts: score.parts.map((p) => ({
      ...p,
      measures: p.measures.map((m) => ({
        ...m,
        events: m.events.flatMap((e) => {
          const r = fn(e, m)
          return r ? [r] : []
        }),
      })),
    })),
  }
}

export function findEvent(
  score: Score,
  id: string,
): { event: NoteEvent; measure: Measure; part: Part } | undefined {
  for (const part of score.parts)
    for (const measure of part.measures)
      for (const event of measure.events) if (event.id === id) return { event, measure, part }
  return undefined
}

/** Set a note's pitch by MIDI number. Turning a rest into a note gives it a pitch. */
export function setPitch(score: Score, id: string, midi: number): Score {
  return mapEvents(score, (e, m) =>
    e.id === id ? { ...e, pitch: fromMidi(midi, (m.key ?? 0) < 0), userEdited: true } : e,
  )
}

/** Move a note up or down by diatonic steps (letter names), keeping natural spelling. */
export function stepPitch(score: Score, id: string, steps: number): Score {
  return mapEvents(score, (e) => {
    if (e.id !== id || !e.pitch) return e
    const order = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
    let index = order.indexOf(e.pitch.step) + e.pitch.octave * 7 + steps
    const octave = Math.floor(index / 7)
    index = ((index % 7) + 7) % 7
    return { ...e, pitch: pitch(order[index]!, octave, 0), userEdited: true }
  })
}

/** Set the accidental: -1 flat, 0 natural, 1 sharp. */
export function setAlter(score: Score, id: string, alter: number): Score {
  return mapEvents(score, (e) =>
    e.id === id && e.pitch
      ? { ...e, pitch: pitch(e.pitch.step, e.pitch.octave, alter), userEdited: true }
      : e,
  )
}

export function makeRest(score: Score, id: string): Score {
  return mapEvents(score, (e) => (e.id === id ? { ...e, pitch: undefined, userEdited: true } : e))
}

/** Change a note's duration and shift the notes after it in the same voice. */
export function setDuration(
  score: Score,
  id: string,
  ticks: number,
  type?: string,
  dots = 0,
): Score {
  return {
    ...score,
    parts: score.parts.map((p) => ({
      ...p,
      measures: p.measures.map((m) => {
        const target = m.events.find((e) => e.id === id)
        if (!target) return m
        const delta = ticks - target.duration
        const events = m.events.map((e) => {
          if (e.id === id) return { ...e, duration: ticks, type, dots, userEdited: true }
          if (e.voice === target.voice && e.staff === target.staff && e.start > target.start) {
            return { ...e, start: e.start + delta }
          }
          return e
        })
        const end = Math.max(m.length, ...events.map((e) => e.start + e.duration))
        return { ...m, events, length: end }
      }),
    })),
  }
}

/** Delete a note. Later notes in the voice move earlier to close the gap. */
export function deleteEvent(score: Score, id: string): Score {
  const found = findEvent(score, id)
  if (!found) return score
  const shifted = found.event.chord ? score : setDuration(score, id, 0)
  return mapEvents(shifted, (e) => (e.id === id ? null : e))
}

export interface DurationChoice {
  ticks: number
  type: string
  dots: number
}

export const DURATIONS: readonly DurationChoice[] = [
  { ticks: TICKS_PER_QUARTER * 4, type: 'whole', dots: 0 },
  { ticks: TICKS_PER_QUARTER * 3, type: 'half', dots: 1 },
  { ticks: TICKS_PER_QUARTER * 2, type: 'half', dots: 0 },
  { ticks: (TICKS_PER_QUARTER * 3) / 2, type: 'quarter', dots: 1 },
  { ticks: TICKS_PER_QUARTER, type: 'quarter', dots: 0 },
  { ticks: TICKS_PER_QUARTER / 2, type: 'eighth', dots: 0 },
]

let counter = 0
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`

/** An empty one-part score for the note editor. */
export function emptyScore(title: string, beats = 4, beatType = 4): Score {
  return {
    title,
    parts: [
      {
        id: 'P1',
        name: 'Melody',
        staves: 1,
        measures: [
          {
            number: '1',
            length: (beats * 4 * TICKS_PER_QUARTER) / beatType,
            key: 0,
            time: { beats, beatType },
            clefs: { 1: { sign: 'G', line: 2, octaveChange: 0 } },
            events: [],
          },
        ],
      },
    ],
    source: { kind: 'manual' },
  }
}

/**
 * Append a note (or rest when `midi` is undefined) to the end of the melody, starting a new
 * measure when the current one is full. Notes longer than the space left are shortened to fit.
 */
export function appendNote(score: Score, midi: number | undefined, d: DurationChoice): Score {
  const part = score.parts[0]
  if (!part) return score
  const measures = [...part.measures]
  let last = measures.at(-1)!
  const nominal = nominalLength(measures)
  let used = last.events.reduce((t, e) => Math.max(t, e.start + e.duration), 0)
  if (used >= nominal) {
    last = { number: String(measures.length + 1), length: nominal, events: [] }
    measures.push(last)
    used = 0
  }
  const ticks = Math.min(d.ticks, nominal - used)
  const choice = DURATIONS.find((x) => x.ticks === ticks) ?? d
  const event: NoteEvent = {
    id: newId('n'),
    start: used,
    duration: ticks,
    pitch: midi === undefined ? undefined : fromMidi(midi),
    voice: 1,
    staff: 1,
    chord: false,
    tieStart: false,
    tieStop: false,
    type: choice.type,
    dots: choice.ticks === ticks ? choice.dots : 0,
  }
  measures[measures.length - 1] = { ...last, events: [...last.events, event] }
  return { ...score, parts: [{ ...part, measures }, ...score.parts.slice(1)] }
}

/** Remove the last note of the melody, and an empty last measure. */
export function removeLastNote(score: Score): Score {
  const part = score.parts[0]
  if (!part) return score
  const measures = [...part.measures]
  for (let i = measures.length - 1; i >= 0; i--) {
    const m = measures[i]!
    if (m.events.length) {
      measures[i] = { ...m, events: m.events.slice(0, -1) }
      break
    }
    if (i > 0) measures.pop()
  }
  return { ...score, parts: [{ ...part, measures }, ...score.parts.slice(1)] }
}

function nominalLength(measures: Measure[]): number {
  for (let i = measures.length - 1; i >= 0; i--) {
    const t = measures[i]!.time
    if (t) return (t.beats * 4 * TICKS_PER_QUARTER) / t.beatType
  }
  return 4 * TICKS_PER_QUARTER
}

/**
 * Join scores page after page (multi-page songs). Parts are matched by position. Event ids
 * are prefixed with the page key so they stay unique, and each measure records its page.
 * An empty key keeps ids and page as they are. Measure numbers continue across pages.
 */
export function concatScores(pages: { key: string; score: Score }[], title: string): Score {
  const firstPage = pages[0]
  if (!firstPage) return { title, parts: [], source: { kind: 'manual' } }
  const partCount = Math.max(...pages.map((p) => p.score.parts.length))
  const parts: Part[] = []
  for (let i = 0; i < partCount; i++) {
    const template = pages.find((p) => p.score.parts[i])!.score.parts[i]!
    let number = 0
    const measures: Measure[] = pages.flatMap(({ key, score }) =>
      (score.parts[i]?.measures ?? []).map((m) => ({
        ...m,
        number: String(++number),
        page: key || m.page,
        events: key ? m.events.map((e) => ({ ...e, id: `${key}:${e.id}` })) : m.events,
      })),
    )
    parts.push({
      ...template,
      staves: Math.max(...pages.map((p) => p.score.parts[i]?.staves ?? 1)),
      measures,
    })
  }
  return { ...firstPage.score, title, parts }
}

/** First few pitched notes, for the song card preview strip. */
export function previewMidis(score: Score, count = 8): number[] {
  const out: number[] = []
  for (const m of score.parts[0]?.measures ?? []) {
    for (const e of m.events) {
      if (e.pitch && !e.chord && !e.tieStop) out.push(e.pitch.midi)
      if (out.length >= count) return out
    }
  }
  return out
}

/**
 * Replace the measures of one page in a song score (after a retake or re-read), keeping
 * every other page's measures, including the user's edits. `pageOrder` is the song's page ids.
 */
export function replacePage(
  song: Score,
  pageOrder: string[],
  pageId: string,
  pageScore: Score | undefined,
): Score {
  const byPage = new Map<string, Score>()
  for (const id of pageOrder) {
    if (id === pageId) {
      if (pageScore) byPage.set(id, concatScores([{ key: id, score: pageScore }], song.title))
      continue
    }
    byPage.set(id, {
      ...song,
      parts: song.parts.map((p) => ({ ...p, measures: p.measures.filter((m) => m.page === id) })),
    })
  }
  const pages = pageOrder.flatMap((id) => {
    const score = byPage.get(id)
    return score ? [{ key: '', score }] : []
  })
  return { ...concatScores(pages, song.title), title: song.title, composer: song.composer }
}
