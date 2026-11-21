import { TICKS_PER_QUARTER, type Score } from './model'

export const DEFAULT_TEMPO = 100

/** A sounding note on the song's timeline. Tied notes are merged into one. */
export interface PlayNote {
  /** Ids of the notated events this sound covers (more than one when tied). */
  ids: string[]
  midi: number
  measureIndex: number
  /** Ticks from the start of the song (for notation cursors). */
  tick: number
  /** Seconds from the start of the song, at 100% tempo. */
  time: number
  duration: number
}

export interface MeasureTiming {
  index: number
  time: number
  duration: number
  beats: number
  /** Seconds per beat (the time signature's beat unit). */
  beatDuration: number
}

export interface Timeline {
  notes: PlayNote[]
  measures: MeasureTiming[]
  duration: number
}

/**
 * Build the playback timeline. All parts are combined. Tempo changes are applied at
 * measure starts. Times are at 100% speed; the player scales them.
 */
export function buildTimeline(score: Score, fallbackTempo = DEFAULT_TEMPO): Timeline {
  const first = score.parts[0]
  if (!first) return { notes: [], measures: [], duration: 0 }

  const measures: MeasureTiming[] = []
  let tempo = fallbackTempo
  let time = 0
  let beatType = 4
  const measureStart: number[] = []
  const secondsPerTick: number[] = []
  const tickStart: number[] = []
  let tick = 0

  first.measures.forEach((m, i) => {
    if (m.tempo) tempo = m.tempo
    if (m.time) beatType = m.time.beatType
    const spt = 60 / tempo / TICKS_PER_QUARTER
    measureStart.push(time)
    secondsPerTick.push(spt)
    tickStart.push(tick)
    tick += m.length
    const duration = m.length * spt
    const beatDuration = (TICKS_PER_QUARTER * 4 * spt) / beatType
    const measureBeats = Math.max(1, Math.round(duration / beatDuration))
    measures.push({ index: i, time, duration, beats: measureBeats, beatDuration })
    time += duration
  })

  const notes: PlayNote[] = []
  for (const part of score.parts) {
    // Open ties per voice and pitch, so a tie can cross a barline.
    const open = new Map<string, PlayNote>()
    part.measures.forEach((m, i) => {
      const start = measureStart[i] ?? 0
      const spt = secondsPerTick[i] ?? 60 / fallbackTempo / TICKS_PER_QUARTER
      for (const e of m.events) {
        if (!e.pitch) continue
        const key = `${e.staff}:${e.voice}:${e.pitch.midi}`
        const t = start + e.start * spt
        const d = e.duration * spt
        const pending = e.tieStop ? open.get(key) : undefined
        if (pending) {
          pending.duration = t + d - pending.time
          pending.ids.push(e.id)
          if (!e.tieStart) open.delete(key)
          continue
        }
        const note: PlayNote = {
          ids: [e.id],
          midi: e.pitch.midi,
          measureIndex: i,
          tick: (tickStart[i] ?? 0) + e.start,
          time: t,
          duration: d,
        }
        notes.push(note)
        if (e.tieStart) open.set(key, note)
      }
    })
  }
  notes.sort((a, b) => a.time - b.time || a.midi - b.midi)
  return { notes, measures, duration: time }
}

/** Index of the last note starting at or before `t`, or -1. */
export function noteIndexAt(notes: PlayNote[], t: number): number {
  let lo = 0
  let hi = notes.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (notes[mid]!.time <= t + 1e-9) {
      found = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return found
}
