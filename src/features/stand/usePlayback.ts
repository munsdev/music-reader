import { useEffect, useMemo, useState } from 'react'
import { Player, type PlayerOptions } from '../../audio/player'
import { synth } from '../../audio/synth'
import type { Score } from '../../core/model'
import { buildTimeline } from '../../core/timeline'
import type { SoundKind } from '../../data/types'
import { useSettings } from '../../state/settings'

export type PracticeMode = 'listen' | 'follow' | 'wait' | 'tap'

/** Timeline, player and the "current note" cursor for a fitted score. */
export function usePlayback(score: Score | undefined, sound: SoundKind) {
  const timeline = useMemo(
    () => (score ? buildTimeline(score) : { notes: [], measures: [], duration: 0 }),
    [score],
  )
  const [player] = useState(() => new Player())
  const [playing, setPlaying] = useState(false)
  const [index, setIndex] = useState(-1)
  const [options, setOptions] = useState<Omit<PlayerOptions, 'sound'>>({
    rate: 1,
    countIn: true,
    metronome: false,
  })
  const volume = useSettings((s) => s.volume)

  useEffect(() => synth.setVolume(volume), [volume])
  useEffect(() => {
    player.load(timeline)
    setIndex(-1)
  }, [player, timeline])
  useEffect(() => player.configure({ ...options, sound }), [player, options, sound])
  useEffect(
    () =>
      player.subscribe((s) => {
        setPlaying(s.playing)
        setIndex(s.noteIndex)
      }),
    [player],
  )
  useEffect(() => () => player.stop(), [player])

  const api = useMemo(
    () => ({
      setOptions: (patch: Partial<Omit<PlayerOptions, 'sound'>>) =>
        setOptions((o) => ({ ...o, ...patch })),
      play: () => player.play(),
      pause: () => player.pause(),
      restart: () => player.stop(),
    }),
    [player],
  )

  return {
    timeline,
    playing,
    index,
    options,
    ...api,
    /** Move the cursor to a note (and keep playing if playing). */
    seekNote: (i: number) => {
      const n = timeline.notes[i]
      if (n) player.seek(n.time)
      setIndex(i)
    },
    setIndex,
  }
}

/** Ids of the notated events sounding at note index `i` (chords included). */
export function idsAt(timeline: ReturnType<typeof buildTimeline>, i: number): Set<string> {
  const n = timeline.notes[i]
  if (!n) return new Set()
  return new Set(
    timeline.notes.filter((x) => Math.abs(x.time - n.time) < 1e-6).flatMap((x) => x.ids),
  )
}

/** Index of the first note of the next distinct time after `i`. */
export function nextIndex(timeline: ReturnType<typeof buildTimeline>, i: number): number {
  const t = timeline.notes[i]?.time ?? -1
  return timeline.notes.findIndex((n, j) => j > i && n.time > t + 1e-6)
}

/** MIDI numbers sounding at index `i` (all chord members). */
export function midisAt(timeline: ReturnType<typeof buildTimeline>, i: number): number[] {
  const n = timeline.notes[i]
  if (!n) return []
  return timeline.notes.filter((x) => Math.abs(x.time - n.time) < 1e-6).map((x) => x.midi)
}
