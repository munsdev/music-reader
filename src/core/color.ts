/** Color utilities for palettes: contrast (WCAG 2.1) and label color choice. */

export interface Rgb {
  r: number
  g: number
  b: number
}

export function parseHex(hex: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) throw new Error(`Invalid hex color "${hex}"`)
  const n = parseInt(m[1]!, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function toHex({ r, g, b }: Rgb): string {
  const h = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase()
}

function channel(v: number): number {
  const s = v / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio between two colors, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

export const LABEL_DARK = '#111111'
export const LABEL_LIGHT = '#FFFFFF'

/** The label color (near black or white) with the higher contrast on `background`. */
export function labelColorFor(background: string): string {
  return contrast(background, LABEL_DARK) >= contrast(background, LABEL_LIGHT)
    ? LABEL_DARK
    : LABEL_LIGHT
}

/** Linear blend of two colors, t from 0 (a) to 1 (b). */
export function mix(a: string, b: string, t: number): string {
  const x = parseHex(a)
  const y = parseHex(b)
  return toHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t })
}
