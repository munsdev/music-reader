import { DEFAULT_PRESET_ID, PRESETS, type InstrumentProfile } from '../core/instruments'
import { sampleScore } from '../core/sample'
import type { Score } from '../core/model'
import { concatScores } from '../core/edit'
import { db } from './db'
import { SOUND_FOR_KIND, type Instrument, type Page, type Song } from './types'

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

export function instrumentFrom(profile: InstrumentProfile, name = profile.name): Instrument {
  const now = Date.now()
  return {
    ...profile,
    id: uid(),
    name,
    builtIn: false,
    sound: SOUND_FOR_KIND[profile.kind],
    createdAt: now,
    updatedAt: now,
  }
}

/** First run: the sample song. The first instrument is created during onboarding. */
export async function seedIfEmpty(): Promise<void> {
  await db.transaction('rw', db.songs, async () => {
    if ((await db.songs.count()) === 0) {
      const score = sampleScore()
      await db.songs.add(newSong(score.title, score, score.composer))
    }
  })
}

export function newSong(title: string, score: Score, composer?: string, pages: Page[] = []): Song {
  const now = Date.now()
  return { id: uid(), title, composer, createdAt: now, updatedAt: now, pages, score, fit: {} }
}

export async function saveSong(song: Song): Promise<void> {
  await db.songs.put({ ...song, updatedAt: Date.now() })
}

export async function saveInstrument(instrument: Instrument): Promise<void> {
  await db.instruments.put({ ...instrument, updatedAt: Date.now() })
}

export async function duplicateSong(song: Song): Promise<Song> {
  const copy = {
    ...newSong(song.title + ' (copy)', song.score, song.composer, song.pages),
    fit: song.fit,
  }
  await db.songs.add(copy)
  return copy
}

/** Append `other` (its pages and notes) to the end of `song`, then delete `other`. */
export async function mergeSongs(song: Song, other: Song): Promise<Song> {
  const score = concatScores(
    [
      { key: song.pages.length ? '' : 'a' + uid().slice(0, 6), score: song.score },
      { key: other.pages.length ? '' : 'b' + uid().slice(0, 6), score: other.score },
    ],
    song.title,
  )
  const merged: Song = {
    ...song,
    pages: [...song.pages, ...other.pages],
    score: { ...score, composer: song.composer },
  }
  await db.transaction('rw', db.songs, async () => {
    await saveSong(merged)
    await db.songs.delete(other.id)
  })
  return merged
}

/** Backup file: songs and instruments as JSON (photos are embedded as data URLs on the web). */
export async function exportLibrary(): Promise<string> {
  const [songs, instruments] = await Promise.all([db.songs.toArray(), db.instruments.toArray()])
  return JSON.stringify({ format: 'music-reader-backup', version: 1, songs, instruments })
}

export async function importLibrary(json: string): Promise<{ songs: number; instruments: number }> {
  const data = JSON.parse(json) as { format?: string; songs?: Song[]; instruments?: Instrument[] }
  if (data.format !== 'music-reader-backup')
    throw new Error('This is not a Music Reader backup file.')
  const songs = data.songs ?? []
  const instruments = data.instruments ?? []
  await db.transaction('rw', db.songs, db.instruments, async () => {
    await db.songs.bulkPut(songs)
    await db.instruments.bulkPut(instruments)
  })
  return { songs: songs.length, instruments: instruments.length }
}

/** Make sure at least one instrument exists (used if onboarding was skipped). */
export async function ensureInstrument(name: string): Promise<void> {
  if ((await db.instruments.count()) > 0) return
  const preset = PRESETS.find((p) => p.id === DEFAULT_PRESET_ID)!
  await db.instruments.add(instrumentFrom(preset, name))
}
