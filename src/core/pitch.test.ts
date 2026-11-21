import { fromMidi, noteName, pitch, toMidi, transpose } from './pitch'

describe('pitch', () => {
  it('converts spelled pitches to MIDI', () => {
    expect(toMidi({ step: 'C', alter: 0, octave: 4 })).toBe(60)
    expect(toMidi({ step: 'A', alter: 0, octave: 4 })).toBe(69)
    expect(toMidi({ step: 'B', alter: 1, octave: 3 })).toBe(60)
    expect(toMidi({ step: 'C', alter: -1, octave: 4 })).toBe(59)
  })

  it('spells MIDI numbers with sharps or flats', () => {
    expect(fromMidi(61)).toMatchObject({ step: 'C', alter: 1, octave: 4 })
    expect(fromMidi(61, true)).toMatchObject({ step: 'D', alter: -1, octave: 4 })
    expect(fromMidi(71)).toMatchObject({ step: 'B', alter: 0, octave: 4 })
    expect(fromMidi(48)).toMatchObject({ step: 'C', alter: 0, octave: 3 })
  })

  it('transposes', () => {
    expect(transpose(pitch('C', 4), 7)).toMatchObject({ step: 'G', octave: 4, midi: 67 })
    expect(transpose(pitch('B', 4, -1), 2)).toMatchObject({ step: 'C', octave: 5, midi: 72 })
  })

  it('names notes in English, German and solfege', () => {
    expect(noteName(pitch('F', 4, 1))).toBe('F♯')
    expect(noteName(pitch('B', 4), 'german')).toBe('H')
    expect(noteName(pitch('B', 4, -1), 'german')).toBe('B')
    expect(noteName(pitch('F', 4, 1), 'german')).toBe('Fis')
    expect(noteName(pitch('E', 4, -1), 'german')).toBe('Es')
    expect(noteName(pitch('A', 4, -1), 'german')).toBe('As')
    expect(noteName(pitch('D', 4, -1), 'german')).toBe('Des')
    expect(noteName(pitch('G', 4), 'solfege')).toBe('Sol')
  })
})
