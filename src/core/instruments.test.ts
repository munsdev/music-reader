import { contrast, labelColorFor } from './color'
import { PALETTES, PRESETS, applyPalette, shiftOctave } from './instruments'

describe('palettes', () => {
  it('have 12 colors each', () => {
    for (const p of PALETTES) expect(p.colors).toHaveLength(12)
  })

  it('give every note a label color with at least 4.5:1 contrast', () => {
    for (const p of PALETTES) {
      for (const c of p.colors) expect(contrast(c, labelColorFor(c))).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('presets', () => {
  it('are ordered low to high with unique notes', () => {
    for (const p of PRESETS) {
      const m = p.notes.map((n) => n.midi)
      expect([...m].sort((a, b) => a - b)).toEqual(m)
      expect(new Set(m).size).toBe(m.length)
    }
  })

  it('8-note xylophone is C4 to C5 white notes', () => {
    const x = PRESETS.find((p) => p.id === 'xylophone-8')!
    expect(x.notes.map((n) => n.midi)).toEqual([60, 62, 64, 65, 67, 69, 71, 72])
  })

  it('keeps colors when shifting octaves and recolors from a palette', () => {
    const x = PRESETS[0]!
    const up = shiftOctave(x, 1)
    expect(up.notes.map((n) => n.color)).toEqual(x.notes.map((n) => n.color))
    expect(up.notes[0]!.midi).toBe(x.notes[0]!.midi + 12)
    const pastel = applyPalette(
      x,
      PALETTES.find((p) => p.id === 'pastel')!,
    )
    expect(pastel.notes[0]!.color).not.toBe(x.notes[0]!.color)
  })
})
