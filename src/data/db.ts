import Dexie, { type EntityTable } from 'dexie'
import type { Instrument, Song } from './types'

export class MusicReaderDb extends Dexie {
  songs!: EntityTable<Song, 'id'>
  instruments!: EntityTable<Instrument, 'id'>

  constructor(name = 'music-reader') {
    super(name)
    this.version(1).stores({
      songs: 'id, title, updatedAt',
      instruments: 'id, name, updatedAt',
    })
  }
}

export const db = new MusicReaderDb()
