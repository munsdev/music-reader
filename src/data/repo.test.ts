import 'fake-indexeddb/auto'
import { db } from './db'
import {
  ensureInstrument,
  exportLibrary,
  importLibrary,
  mergeSongs,
  newSong,
  saveSong,
  seedIfEmpty,
} from './repo'
import { sampleScore } from '../core/sample'

beforeEach(async () => {
  await db.songs.clear()
  await db.instruments.clear()
})

describe('repo', () => {
  it('seeds the sample song once and creates a fallback instrument once', async () => {
    await seedIfEmpty()
    await seedIfEmpty()
    expect(await db.songs.count()).toBe(1)
    await ensureInstrument('Xylophone')
    await ensureInstrument('Xylophone')
    expect(await db.instruments.count()).toBe(1)
  })

  it('merges two songs into one', async () => {
    const a = newSong('A', sampleScore())
    const b = newSong('B', sampleScore())
    await saveSong(a)
    await saveSong(b)
    const merged = await mergeSongs(a, b)
    expect(merged.score.parts[0]!.measures).toHaveLength(24)
    expect(await db.songs.count()).toBe(1)
    const ids = merged.score.parts[0]!.measures.flatMap((m) => m.events.map((e) => e.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('exports and imports a backup', async () => {
    await seedIfEmpty()
    await ensureInstrument('Xylophone')
    const json = await exportLibrary()
    await db.songs.clear()
    await db.instruments.clear()
    expect(await importLibrary(json)).toEqual({ songs: 1, instruments: 1 })
    await expect(importLibrary('{}')).rejects.toThrow()
  })
})
