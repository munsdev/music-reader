import { colorName } from './color-names'
import { PALETTES } from './instruments'

describe('colorName', () => {
  it('names the rainbow palette naturals', () => {
    const p = PALETTES[0]!.colors
    expect([0, 2, 4, 5, 7, 9, 11].map((pc) => colorName(p[pc]!).name)).toEqual([
      'red',
      'orange',
      'yellow',
      'green',
      'blue',
      'indigo',
      'purple',
    ])
  })
  it('handles light and gray colors', () => {
    expect(colorName('#AECBFA')).toMatchObject({ name: 'blue', tone: 'light' })
    expect(colorName('#FFFFFF').name).toBe('white')
    expect(colorName('#808080').name).toBe('gray')
  })
})
