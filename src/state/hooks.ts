import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { fitToInstrument, type FitResult } from '../core/adapt'
import type { LabelSettings } from '../core/labels'
import { db } from '../data/db'
import type { Instrument, Song } from '../data/types'
import { useSettings } from './settings'

export const useSongs = () =>
  useLiveQuery(() => db.songs.orderBy('updatedAt').reverse().toArray(), [])
/** undefined while loading, null when the song does not exist. */
export const useSong = (id: string | undefined) =>
  useLiveQuery(async () => (id ? ((await db.songs.get(id)) ?? null) : null), [id])
export const useInstruments = () => useLiveQuery(() => db.instruments.orderBy('name').toArray(), [])
/** undefined while loading, null when the instrument does not exist. */
export const useInstrument = (id: string | undefined) =>
  useLiveQuery(async () => (id ? ((await db.instruments.get(id)) ?? null) : null), [id])

export function useLabelSettings(): LabelSettings {
  const style = useSettings((s) => s.labelStyle)
  const naming = useSettings((s) => s.naming)
  return useMemo(() => ({ style, naming }), [style, naming])
}

/** The instrument to use for a song: the song's last one, the app's last one, or the first. */
export function pickInstrument(
  song: Song | null | undefined,
  instruments: Instrument[] | undefined,
  lastId?: string,
): Instrument | undefined {
  if (!instruments?.length) return undefined
  return (
    instruments.find((i) => i.id === song?.lastInstrumentId) ??
    instruments.find((i) => i.id === lastId) ??
    instruments[0]
  )
}

export function useFit(
  song: Song | null | undefined,
  instrument: Instrument | undefined,
): FitResult | undefined {
  return useMemo(() => {
    if (!song || !instrument) return undefined
    return fitToInstrument(song.score, instrument, song.fit[instrument.id] ?? {})
  }, [song, instrument])
}
