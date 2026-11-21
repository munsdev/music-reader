import { PIANO_XML, TWINKLE_XML } from './__fixtures__/twinkle'
import {
  bestTransposition,
  extractMelody,
  fitToInstrument,
  mapNote,
  nearestAvailable,
} from './adapt'
import { PRESETS, type InstrumentProfile } from './instruments'
import { parseMusicXml } from './musicxml'

const xylophone = PRESETS.find((p) => p.id === 'xylophone-8')!
const keyboard = PRESETS.find((p) => p.id === 'keyboard-25')!
const midis = (r: ReturnType<typeof fitToInstrument>) =>
  r.score.parts[0]!.measures.flatMap((m) =>
    m.events.filter((e) => e.pitch).map((e) => e.pitch!.midi),
  )

describe('fitToInstrument', () => {
  it('leaves a song that already fits untouched', () => {
    const result = fitToInstrument(parseMusicXml(TWINKLE_XML), xylophone)
    expect(result.transpose).toBe(0)
    expect(result.fit).toBe(1)
    expect(result.changes).toEqual([])
    expect(midis(result)).toEqual([60, 60, 67, 67, 69, 69, 67])
  })

  it('transposes a song that is an octave too high', () => {
    const high = parseMusicXml(TWINKLE_XML.replaceAll('<octave>4</octave>', '<octave>5</octave>'))
    const result = fitToInstrument(high, xylophone)
    expect(result.transpose).toBe(-12)
    expect(result.fit).toBe(1)
    expect(midis(result)).toEqual([60, 60, 67, 67, 69, 69, 67])
    expect(result.changes).toContainEqual({ kind: 'transpose', semitones: -12 })
  })

  it('reduces chords and lower staves to a melody on one-note instruments', () => {
    const result = fitToInstrument(parseMusicXml(PIANO_XML), xylophone)
    const change = result.changes.find((c) => c.kind === 'melody')
    expect(change).toMatchObject({ kind: 'melody', removed: 2 })
    // Top notes A5 and B flat 5, played on the C4 to C5 xylophone.
    for (const m of midis(result)) expect(xylophone.notes.some((n) => n.midi === m)).toBe(true)
  })

  it('keeps chords on instruments that allow them', () => {
    const result = fitToInstrument(parseMusicXml(PIANO_XML), keyboard)
    expect(result.changes.find((c) => c.kind === 'melody')).toBeUndefined()
  })

  it('honors a forced transposition', () => {
    const result = fitToInstrument(parseMusicXml(TWINKLE_XML), xylophone, { transpose: 2 })
    expect(result.transpose).toBe(2)
  })
})

describe('mapNote and nearestAvailable', () => {
  it('folds out-of-range notes by octaves', () => {
    expect(mapNote(76, xylophone)).toMatchObject({ midi: 64, octaves: -1, substituted: false })
    expect(mapNote(50, xylophone)).toMatchObject({ midi: 62, octaves: 1, substituted: false })
  })

  it('substitutes missing sharps with the same letter', () => {
    expect(nearestAvailable(66, xylophone)).toBe(65) // F sharp to F
    expect(mapNote(66, xylophone)).toMatchObject({ midi: 65, substituted: true })
  })

  it('handles instruments narrower than an octave', () => {
    const five: InstrumentProfile = { ...xylophone, notes: xylophone.notes.slice(0, 5) } // C4 to G4
    const mapped = mapNote(69, five) // A4
    expect(five.notes.some((n) => n.midi === mapped.midi)).toBe(true)
  })
})

describe('bestTransposition', () => {
  it('prefers no shift when it fits', () => {
    expect(bestTransposition([60, 62, 64], xylophone)).toBe(0)
  })

  it('finds a key that avoids accidentals on a white-notes instrument', () => {
    // D major fragment: D E F sharp G. Down 2 gives C D E F, all white notes.
    expect(bestTransposition([62, 64, 66, 67], xylophone)).toBe(-2)
  })
})

describe('extractMelody', () => {
  it('keeps only the top note of chords on the top staff', () => {
    const { score } = extractMelody(parseMusicXml(PIANO_XML))
    const events = score.parts[0]!.measures[0]!.events
    expect(events.map((e) => e.pitch?.midi ?? null)).toEqual([81, 82, null])
  })
})
