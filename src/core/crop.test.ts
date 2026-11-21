import {
  FULL_QUAD,
  fitBox,
  isFullQuad,
  isValidQuad,
  mapPoint,
  outputSize,
  squareToQuad,
  type Quad,
} from './crop'

describe('crop geometry', () => {
  it('accepts a normal page and rejects crossed or tiny shapes', () => {
    expect(isValidQuad(FULL_QUAD)).toBe(true)
    const tilted: Quad = [
      [0.1, 0.05],
      [0.9, 0.1],
      [0.95, 0.9],
      [0.05, 0.95],
    ]
    expect(isValidQuad(tilted)).toBe(true)
    const bowtie: Quad = [
      [0.1, 0.1],
      [0.9, 0.9],
      [0.9, 0.1],
      [0.1, 0.9],
    ]
    expect(isValidQuad(bowtie)).toBe(false)
    const tiny: Quad = [
      [0.5, 0.5],
      [0.52, 0.5],
      [0.52, 0.52],
      [0.5, 0.52],
    ]
    expect(isValidQuad(tiny)).toBe(false)
  })

  it('maps the unit square onto the quad corners', () => {
    const q: Quad = [
      [0.1, 0.05],
      [0.9, 0.1],
      [0.95, 0.9],
      [0.05, 0.95],
    ]
    const m = squareToQuad(q)
    const corners: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]
    corners.forEach(([u, v], i) => {
      const [x, y] = mapPoint(m, u, v)
      expect(x).toBeCloseTo(q[i]![0], 6)
      expect(y).toBeCloseTo(q[i]![1], 6)
    })
  })

  it('is the identity for the full photo', () => {
    const [x, y] = mapPoint(squareToQuad(FULL_QUAD), 0.3, 0.7)
    expect(x).toBeCloseTo(0.3)
    expect(y).toBeCloseTo(0.7)
    expect(isFullQuad(FULL_QUAD)).toBe(true)
    expect(isFullQuad(undefined)).toBe(true)
  })

  it('sizes the output from the edge lengths and caps the long side', () => {
    expect(outputSize(FULL_QUAD, 1000, 1400, 2000)).toEqual({ width: 1000, height: 1400 })
    expect(outputSize(FULL_QUAD, 1000, 1400, 700)).toEqual({ width: 500, height: 700 })
  })

  it('fits a photo inside the screen with padding', () => {
    const box = fitBox(1080, 2340, 412, 700, 40)
    expect(box.height).toBeCloseTo(620)
    expect(box.top).toBeCloseTo(40)
    expect(box.left).toBeGreaterThanOrEqual(40)
  })
})
