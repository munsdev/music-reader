import type { NoteShape } from './instruments'

/**
 * Note shapes as SVG paths in a box from -1 to 1 (y down). Used by the app (SVG) and the
 * PDF export, so screen and paper match. "ring" is drawn as an outline by the renderer.
 */
let scale = 1
const f = (n: number) => (n * scale).toFixed(3)

function polygon(points: [number, number][]): string {
  return 'M' + points.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L') + ' Z'
}

function regular(n: number, r = 1, rotate = -Math.PI / 2): string {
  return polygon(
    Array.from({ length: n }, (_, i) => {
      const a = rotate + (i * 2 * Math.PI) / n
      return [r * Math.cos(a), r * Math.sin(a)] as [number, number]
    }),
  )
}

function star(points = 5, outer = 1, inner = 0.45): string {
  return polygon(
    Array.from({ length: points * 2 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / points
      const r = i % 2 === 0 ? outer : inner
      return [r * Math.cos(a), r * Math.sin(a)] as [number, number]
    }),
  )
}

const circle = () =>
  `M ${f(-1)} 0 A ${f(1)} ${f(1)} 0 1 0 ${f(1)} 0 A ${f(1)} ${f(1)} 0 1 0 ${f(-1)} 0 Z`

function heart(): string {
  const pts = [
    0, 0.9, -0.2, 0.7, -1, 0.2, -1, -0.35, -1, -0.8, -0.55, -1, -0.25, -0.9, -0.1, -0.85, 0, -0.7,
    0, -0.6, 0, -0.7, 0.1, -0.85, 0.25, -0.9, 0.55, -1, 1, -0.8, 1, -0.35, 1, 0.2, 0.2, 0.7, 0, 0.9,
  ].map(f)
  const c = (i: number) => `C ${pts.slice(i, i + 6).join(' ')}`
  return `M ${pts[0]} ${pts[1]} ${c(2)} ${c(8)} ${c(14)} ${c(20)} ${c(26)} ${c(32)} Z`
}

const BUILDERS: Record<NoteShape, () => string> = {
  circle,
  ring: circle,
  square: () =>
    polygon([
      [-0.85, -0.85],
      [0.85, -0.85],
      [0.85, 0.85],
      [-0.85, 0.85],
    ]),
  triangle: () =>
    polygon([
      [0, -1],
      [1, 0.8],
      [-1, 0.8],
    ]),
  diamond: () =>
    polygon([
      [0, -1],
      [0.9, 0],
      [0, 1],
      [-0.9, 0],
    ]),
  star: () => star(),
  hexagon: () => regular(6, 1, 0),
  heart,
}

/** SVG path for a shape centered on 0,0 with radius `size`. */
export function shapePath(shape: NoteShape, size = 1): string {
  scale = size
  const d = BUILDERS[shape]()
  scale = 1
  return d
}
