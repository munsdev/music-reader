/**
 * Page crop geometry: corner checks, the perspective transform that flattens a cropped
 * page, and the output size. Corners are fractions of the photo size, clockwise from
 * top left. Pure functions; the canvas work lives in src/platform/page-image.ts.
 */

export type Point = [number, number]
export type Quad = [Point, Point, Point, Point]

export const FULL_QUAD: Quad = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
]

function cross(o: Point, a: Point, b: Point): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
}

/** True when the four corners form a convex shape in the given order (no crossing edges). */
export function isValidQuad(q: Quad, minArea = 0.01): boolean {
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const c = cross(q[i]!, q[(i + 1) % 4]!, q[(i + 2) % 4]!)
    if (Math.abs(c) < 1e-9) return false
    const s = Math.sign(c)
    if (sign === 0) sign = s
    else if (s !== sign) return false
  }
  return quadArea(q) >= minArea
}

/** Area of the quad (shoelace formula), in squared fractions of the photo. */
export function quadArea(q: Quad): number {
  let a = 0
  for (let i = 0; i < 4; i++) {
    const [x1, y1] = q[i]!
    const [x2, y2] = q[(i + 1) % 4]!
    a += x1 * y2 - x2 * y1
  }
  return Math.abs(a) / 2
}

export const isFullQuad = (q: Quad | undefined): boolean =>
  !q ||
  q.every(
    (p, i) => Math.abs(p[0] - FULL_QUAD[i]![0]) < 1e-6 && Math.abs(p[1] - FULL_QUAD[i]![1]) < 1e-6,
  )

/**
 * Projective transform mapping the unit square (u, v) to the quad (x, y):
 * x = (a u + b v + c) / (g u + h v + 1), y = (d u + e v + f) / (g u + h v + 1).
 * Corners map in order: (0,0), (1,0), (1,1), (0,1). (Heckbert, square to quad.)
 */
export function squareToQuad(
  q: Quad,
): [number, number, number, number, number, number, number, number] {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q
  const dx1 = x1 - x2
  const dx2 = x3 - x2
  const dy1 = y1 - y2
  const dy2 = y3 - y2
  const sx = x0 - x1 + x2 - x3
  const sy = y0 - y1 + y2 - y3
  let g = 0
  let h = 0
  if (Math.abs(sx) > 1e-12 || Math.abs(sy) > 1e-12) {
    const den = dx1 * dy2 - dx2 * dy1
    g = (sx * dy2 - dx2 * sy) / den
    h = (dx1 * sy - sx * dy1) / den
  }
  const a = x1 - x0 + g * x1
  const b = x3 - x0 + h * x3
  const c = x0
  const d = y1 - y0 + g * y1
  const e = y3 - y0 + h * y3
  const f = y0
  return [a, b, c, d, e, f, g, h]
}

export function mapPoint(m: ReturnType<typeof squareToQuad>, u: number, v: number): Point {
  const [a, b, c, d, e, f, g, h] = m
  const w = g * u + h * v + 1
  return [(a * u + b * v + c) / w, (d * u + e * v + f) / w]
}

const dist = (p: Point, q: Point) => Math.hypot(p[0] - q[0], p[1] - q[1])

/**
 * Output size in pixels for a flattened crop of a photo of `width` x `height`:
 * average opposite edge lengths, then scale so the longer side is at most `maxSide`.
 */
export function outputSize(
  q: Quad,
  width: number,
  height: number,
  maxSide: number,
): { width: number; height: number } {
  const px = q.map(([x, y]) => [x * width, y * height] as Point) as Quad
  const w = (dist(px[0], px[1]) + dist(px[3], px[2])) / 2
  const h = (dist(px[0], px[3]) + dist(px[1], px[2])) / 2
  const scale = Math.min(1, maxSide / Math.max(w, h))
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) }
}

/** Fit a box of aspect `w:h` inside `availW x availH`, centered, keeping `pad` on all sides. */
export function fitBox(w: number, h: number, availW: number, availH: number, pad: number) {
  const maxW = Math.max(1, availW - 2 * pad)
  const maxH = Math.max(1, availH - 2 * pad)
  const scale = Math.min(maxW / w, maxH / h)
  const width = w * scale
  const height = h * scale
  return { left: (availW - width) / 2, top: (availH - height) / 2, width, height }
}
