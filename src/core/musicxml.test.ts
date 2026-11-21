import { strToU8, zipSync } from 'fflate'
import { CLARINET_XML, PIANO_XML, TWINKLE_XML } from './__fixtures__/twinkle'
import { TICKS_PER_QUARTER as Q } from './model'
import { MusicXmlError, parseMusicXml, parseScoreFile } from './musicxml'

describe('parseMusicXml', () => {
  it('reads title, composer, tempo and notes', () => {
    const score = parseMusicXml(TWINKLE_XML)
    expect(score.title).toBe('Twinkle, Twinkle, Little Star')
    expect(score.composer).toBe('Traditional')
    const [m1, m2] = score.parts[0]!.measures
    expect(m1!.tempo).toBe(96)
    expect(m1!.time).toEqual({ beats: 4, beatType: 4 })
    expect(m1!.length).toBe(4 * Q)
    expect(m1!.events.map((e) => e.pitch!.midi)).toEqual([60, 60, 67, 67])
    expect(m1!.events.map((e) => e.start)).toEqual([0, Q, 2 * Q, 3 * Q])
    expect(m2!.events.at(-1)).toMatchObject({ duration: 2 * Q, type: 'half' })
  })

  it('handles chords, rests, backup, staves, ties and dots', () => {
    const score = parseMusicXml(PIANO_XML)
    const part = score.parts[0]!
    expect(part.staves).toBe(2)
    const m = part.measures[0]!
    expect(m.key).toBe(-1)
    expect(m.length).toBe(3 * Q)
    expect(m.clefs?.[2]).toMatchObject({ sign: 'F', line: 4 })
    const [f, a, bb, rest, bass] = m.events
    expect(f).toMatchObject({ start: 0, chord: false })
    expect(a).toMatchObject({ start: 0, chord: true })
    expect(bb).toMatchObject({ start: Q, tieStart: true })
    expect(bb!.pitch).toMatchObject({ step: 'B', alter: -1, midi: 82 })
    expect(rest!.pitch).toBeUndefined()
    expect(bass).toMatchObject({ start: 0, duration: 3 * Q, voice: 2, staff: 2, dots: 1 })
  })

  it('stores transposing instruments at sounding pitch', () => {
    const note = parseMusicXml(CLARINET_XML).parts[0]!.measures[0]!.events[0]!
    expect(note.pitch).toMatchObject({ step: 'C', octave: 5, midi: 72 })
  })

  it('falls back to the file name for the title', () => {
    const score = parseMusicXml(CLARINET_XML, 'My song.musicxml')
    expect(score.title).toBe('My song')
  })

  it('rejects files that are not MusicXML', () => {
    expect(() => parseMusicXml('<html></html>')).toThrow(MusicXmlError)
    expect(() => parseMusicXml('not xml <')).toThrow(MusicXmlError)
  })
})

describe('parseScoreFile', () => {
  it('reads compressed .mxl archives through container.xml', () => {
    const container = `<?xml version="1.0"?><container><rootfiles><rootfile full-path="score/main.musicxml"/></rootfiles></container>`
    const mxl = zipSync({
      'META-INF/container.xml': strToU8(container),
      'score/main.musicxml': strToU8(TWINKLE_XML),
    })
    const score = parseScoreFile(mxl, 'twinkle.mxl')
    expect(score.title).toBe('Twinkle, Twinkle, Little Star')
    expect(score.parts[0]!.measures).toHaveLength(2)
  })

  it('reads plain MusicXML bytes', () => {
    expect(parseScoreFile(strToU8(TWINKLE_XML)).parts).toHaveLength(1)
  })
})
