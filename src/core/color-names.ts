import { parseHex } from './color'

export type ColorName =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'lime'
  | 'green'
  | 'teal'
  | 'skyBlue'
  | 'blue'
  | 'indigo'
  | 'purple'
  | 'pink'
  | 'brown'
  | 'white'
  | 'gray'
  | 'black'

/** A plain color name for a hex color, for accessible names and the listening setup. */
export function colorName(hex: string): { name: ColorName; tone: 'light' | 'dark' | 'normal' } {
  const { r, g, b } = parseHex(hex)
  const max = Math.max(r, g, b) / 255
  const min = Math.min(r, g, b) / 255
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (d !== 0) {
    const R = r / 255,
      G = g / 255,
      B = b / 255
    if (max === R) h = 60 * (((G - B) / d) % 6)
    else if (max === G) h = 60 * ((B - R) / d + 2)
    else h = 60 * ((R - G) / d + 4)
  }
  if (h < 0) h += 360
  const tone = l > 0.72 ? 'light' : l < 0.3 ? 'dark' : 'normal'
  if (s < 0.15) return { name: l > 0.85 ? 'white' : l < 0.18 ? 'black' : 'gray', tone: 'normal' }
  if (h < 15 || h >= 345) return { name: l < 0.35 && s < 0.6 ? 'brown' : 'red', tone }
  if (h < 40) return { name: l < 0.4 ? 'brown' : 'orange', tone }
  if (h < 65) return { name: 'yellow', tone }
  if (h < 90) return { name: 'lime', tone }
  if (h < 160) return { name: 'green', tone }
  if (h < 185) return { name: 'teal', tone }
  if (h < 200) return { name: 'skyBlue', tone }
  if (h < 228) return { name: 'blue', tone }
  if (h < 262) return { name: 'indigo', tone }
  if (h < 300) return { name: 'purple', tone }
  return { name: 'pink', tone }
}
