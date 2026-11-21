import { PIANO_XML, TWINKLE_XML } from './__fixtures__/twinkle'
import { sampleScore } from './sample'
import {
  replacePage,
  appendNote,
  concatScores,
  deleteEvent,
  DURATIONS,
  emptyScore,
  previewMidis,
  removeLastNote,
  setDuration,
  setPitch,
  stepPitch,
} from './edit'
import { layoutPart } from './layout'
import { TICKS_PER_QUARTER as Q } from './model'
import { parseMusicXml } from './musicxml'
import { writeMusicXml } from './musicxml-writer'
import { buildTimeline, noteIndexAt } from './timeline'

describe('buildTimeline', () => {
  it('times notes from the tempo', () => {
    const t = buildTimeline(parseMusicXml(TWINKLE_XML)) // tempo 96
    const beat = 60 / 96
    expect(t.notes.map((n) => n.time)).toEqual(
      [0, 1, 2, 3, 4, 5, 6].map((b) => expect.closeTo(b * beat, 6)),
    )
    expect(t.notes.at(-1)!.duration).toBeCloseTo(2 * beat)
    expect(t.measures[0]).toMatchObject({ beats: 4 })
    expect(t.duration).toBeCloseTo(8 * beat)
  })

  it('merges tied notes into one sound', () => {
    const xml = PIANO_XML.replace(
      '<note><rest/><duration>4</duration>',
      '<note><pitch><step>B</step><alter>-1</alter><octave>5</octave></pitch><duration>4</duration><tie type="stop"/>',
    )
    const t = buildTimeline(parseMusicXml(xml))
    const bb = t.notes.filter((n) => n.midi === 82)
    expect(bb).toHaveLength(1)
    expect(bb[0]!.ids).toHaveLength(2)
  })

  it('finds the note at a time', () => {
    const { notes } = buildTimeline(parseMusicXml(TWINKLE_XML))
    expect(noteIndexAt(notes, -1)).toBe(-1)
    expect(noteIndexAt(notes, 0)).toBe(0)
    expect(noteIndexAt(notes, 1.5)).toBe(2)
  })
})

describe('layoutPart', () => {
  it('breaks rows only between measures', () => {
    const part = sampleScore().parts[0]!
    const rows = layoutPart(part, { maxWidth: 10 })
    expect(rows.length).toBeGreaterThan(1)
    for (const r of rows) expect(r.width).toBeLessThanOrEqual(10)
    expect(rows.flatMap((r) => r.measures)).toHaveLength(part.measures.length)
  })

  it('limits measures per row', () => {
    const rows = layoutPart(sampleScore().parts[0]!, { maxWidth: 100, maxMeasuresPerRow: 2 })
    expect(rows.every((r) => r.measures.length <= 2)).toBe(true)
  })

  it('groups chords into one slot', () => {
    const rows = layoutPart(parseMusicXml(PIANO_XML).parts[0]!, { maxWidth: 100 })
    expect(rows[0]!.measures[0]!.notes[0]!.midis).toEqual([77, 81])
  })
})

describe('writeMusicXml', () => {
  it('round-trips pitches, durations and colors', () => {
    const score = parseMusicXml(PIANO_XML)
    const xml = writeMusicXml(score, { colorFor: () => '#FF0000', labelFor: () => 'X' })
    expect(xml).toContain('color="#FF0000"')
    expect(xml).toContain('<lyric')
    const again = parseMusicXml(xml)
    const flat = (s: typeof score) =>
      s.parts[0]!.measures.flatMap((m) =>
        m.events.map((e) => [e.start, e.duration, e.pitch?.midi ?? null, e.staff]),
      )
    expect(flat(again)).toEqual(flat(score))
  })
})

describe('edit', () => {
  const score = parseMusicXml(TWINKLE_XML)
  const firstId = score.parts[0]!.measures[0]!.events[0]!.id

  it('sets and steps pitch', () => {
    expect(setPitch(score, firstId, 64).parts[0]!.measures[0]!.events[0]!.pitch!.midi).toBe(64)
    expect(stepPitch(score, firstId, 1).parts[0]!.measures[0]!.events[0]!.pitch!.midi).toBe(62)
    expect(stepPitch(score, firstId, -1).parts[0]!.measures[0]!.events[0]!.pitch).toMatchObject({
      step: 'B',
      octave: 3,
    })
  })

  it('changes duration and shifts later notes', () => {
    const e = setDuration(score, firstId, Q / 2, 'eighth').parts[0]!.measures[0]!.events
    expect(e.map((x) => x.start)).toEqual([0, Q / 2, Q * 1.5, Q * 2.5])
  })

  it('deletes a note and closes the gap', () => {
    const e = deleteEvent(score, firstId).parts[0]!.measures[0]!.events
    expect(e).toHaveLength(3)
    expect(e[0]!.start).toBe(0)
  })

  it('appends notes and starts new measures', () => {
    const quarter = DURATIONS.find((d) => d.type === 'quarter' && d.dots === 0)!
    let s = emptyScore('Mine')
    for (let i = 0; i < 5; i++) s = appendNote(s, 60 + i, quarter)
    expect(s.parts[0]!.measures).toHaveLength(2)
    expect(s.parts[0]!.measures[1]!.events[0]!.pitch!.midi).toBe(64)
    s = removeLastNote(s)
    expect(previewMidis(s)).toEqual([60, 61, 62, 63])
  })

  it('joins pages into one song with unique ids and continuous measure numbers', () => {
    const joined = concatScores(
      [
        { key: 'a', score },
        { key: 'b', score },
      ],
      'Both',
    )
    const ms = joined.parts[0]!.measures
    expect(ms.map((m) => m.number)).toEqual(['1', '2', '3', '4'])
    const ids = ms.flatMap((m) => m.events.map((e) => e.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('replacePage', () => {
  it('swaps one page and keeps the others', () => {
    const score = parseMusicXml(TWINKLE_XML)
    const song = concatScores(
      [
        { key: 'p1', score },
        { key: 'p2', score },
      ],
      'Song',
    )
    const edited = setPitch(song, song.parts[0]!.measures[0]!.events[0]!.id, 72)
    const replaced = replacePage(edited, ['p1', 'p2'], 'p2', emptyScore('x'))
    const ms = replaced.parts[0]!.measures
    expect(ms.map((m) => m.page)).toEqual(['p1', 'p1', 'p2'])
    expect(ms[0]!.events[0]!.pitch!.midi).toBe(72)
    expect(ms.map((m) => m.number)).toEqual(['1', '2', '3'])
  })
})

describe('writeMidi', () => {
  it('writes a valid header and one note on and off per note', async () => {
    const { writeMidi } = await import('./midi')
    const bytes = writeMidi(buildTimeline(parseMusicXml(TWINKLE_XML)))
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('MThd')
    expect(String.fromCharCode(...bytes.slice(14, 18))).toBe('MTrk')
    const ons = [...bytes].filter((b, i) => b === 0x90 && bytes[i + 2] === 96).length
    expect(ons).toBe(7)
  })
})
