import type { SoundKind } from '../data/types'
import type { Timeline } from '../core/timeline'
import { synth } from './synth'

export interface PlayerOptions {
  sound: SoundKind
  /** 0.4 to 1.5 of the written tempo. */
  rate: number
  countIn: boolean
  metronome: boolean
  /** Keep time and move the cursor without playing the notes (Follow mode). */
  muted?: boolean
  /** Measure index range to loop, inclusive. */
  loop?: [number, number]
}

type Listener = (state: { playing: boolean; noteIndex: number; time: number }) => void

const LOOKAHEAD = 0.12
const TICK_MS = 25

/**
 * Plays a Timeline with lookahead scheduling (steady timing even when the UI is busy)
 * and reports the current note for the cursor.
 */
export class Player {
  private timeline: Timeline = { notes: [], measures: [], duration: 0 }
  private options: PlayerOptions = { sound: 'xylophone', rate: 1, countIn: false, metronome: false }
  private timer: ReturnType<typeof setInterval> | null = null
  private raf = 0
  /** Song time (seconds at 100%) that corresponds to `startCtx`. */
  private startSong = 0
  private startCtx = 0
  private nextNote = 0
  private nextBeat = 0
  private listeners = new Set<Listener>()
  playing = false
  position = 0

  load(timeline: Timeline): void {
    this.stop()
    this.timeline = timeline
  }

  configure(options: Partial<PlayerOptions>): void {
    const wasPlaying = this.playing
    const pos = this.currentTime()
    if (wasPlaying) this.pause()
    this.options = { ...this.options, ...options }
    if (wasPlaying) this.play(pos, false)
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(noteIndex: number): void {
    for (const fn of this.listeners) fn({ playing: this.playing, noteIndex, time: this.position })
  }

  private loopBounds(): [number, number] {
    const { loop } = this.options
    const ms = this.timeline.measures
    if (!loop || !ms.length) return [0, this.timeline.duration]
    const a = ms[Math.max(0, loop[0])]
    const b = ms[Math.min(ms.length - 1, loop[1])]
    if (!a || !b) return [0, this.timeline.duration]
    return [a.time, b.time + b.duration]
  }

  currentTime(): number {
    if (!this.playing) return this.position
    return this.startSong + (synth.now() - this.startCtx) * this.options.rate
  }

  play(from = this.position, allowCountIn = true): void {
    if (this.playing) return
    const ctx = synth.context()
    const [loopStart, loopEnd] = this.loopBounds()
    if (from >= loopEnd - 1e-6 || from < loopStart) from = loopStart
    const firstMeasure = this.timeline.measures.find(
      (m) => m.time <= from + 1e-6 && from < m.time + m.duration,
    )
    let lead = 0.05
    if (allowCountIn && this.options.countIn && firstMeasure) {
      const beat = firstMeasure.beatDuration / this.options.rate
      for (let i = 0; i < firstMeasure.beats; i++)
        synth.click(ctx.currentTime + lead + i * beat, i === 0)
      lead += firstMeasure.beats * beat
    }
    this.startSong = from
    this.startCtx = ctx.currentTime + lead
    this.nextNote = this.timeline.notes.findIndex((n) => n.time >= from - 1e-6)
    if (this.nextNote < 0) this.nextNote = this.timeline.notes.length
    this.nextBeat = 0
    this.playing = true
    this.timer = setInterval(() => this.schedule(), TICK_MS)
    this.schedule()
    const frame = () => {
      if (!this.playing) return
      this.position = this.currentTime()
      this.emit(this.indexAt(this.position))
      this.raf = requestAnimationFrame(frame)
    }
    this.raf = requestAnimationFrame(frame)
  }

  private indexAt(t: number): number {
    const notes = this.timeline.notes
    let idx = -1
    for (let i = 0; i < notes.length; i++) {
      if (notes[i]!.time <= t + 1e-6) idx = i
      else break
    }
    return idx
  }

  private schedule(): void {
    const { rate, sound, metronome } = this.options
    const ctxNow = synth.now()
    const horizon = this.startSong + (ctxNow + LOOKAHEAD - this.startCtx) * rate
    const [loopStart, loopEnd] = this.loopBounds()
    const notes = this.timeline.notes

    while (
      this.nextNote < notes.length &&
      notes[this.nextNote]!.time < Math.min(horizon, loopEnd - 1e-6)
    ) {
      const n = notes[this.nextNote]!
      if (!this.options.muted)
        synth.strike(n.midi, sound, this.startCtx + (n.time - this.startSong) / rate)
      this.nextNote++
    }

    if (metronome) {
      for (const m of this.timeline.measures) {
        for (let b = 0; b < m.beats; b++) {
          const t = m.time + b * m.beatDuration
          if (t < this.startSong - 1e-6 || t >= horizon || t >= loopEnd) continue
          const key = Math.round(t * 1000)
          if (key < this.nextBeat) continue
          synth.click(this.startCtx + (t - this.startSong) / rate, b === 0)
          this.nextBeat = key + 1
        }
      }
    }

    if (horizon >= loopEnd) {
      if (this.options.loop) {
        // Jump back to the loop start without a gap.
        const endCtx = this.startCtx + (loopEnd - this.startSong) / rate
        this.startSong = loopStart
        this.startCtx = endCtx
        this.nextNote = notes.findIndex((n) => n.time >= loopStart - 1e-6)
        this.nextBeat = 0
      } else if (this.currentTime() >= loopEnd) {
        this.stop()
      }
    }
  }

  pause(): void {
    if (!this.playing) return
    this.position = this.currentTime()
    this.halt()
    this.emit(this.indexAt(this.position))
  }

  stop(): void {
    this.halt()
    this.position = 0
    this.emit(-1)
  }

  seek(time: number): void {
    const playing = this.playing
    if (playing) this.halt()
    this.position = Math.max(0, Math.min(time, this.timeline.duration))
    if (playing) this.play(this.position, false)
    else this.emit(this.indexAt(this.position))
  }

  private halt(): void {
    this.playing = false
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    cancelAnimationFrame(this.raf)
  }
}
