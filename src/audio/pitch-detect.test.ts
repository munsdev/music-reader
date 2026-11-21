import { detectPitch, matchesHz, matchesNote, StrikeDetector } from './pitch-detect'
import { midiToHz } from './synth'

function tone(hz: number, sr = 44100, n = 2048, overtone = 0) {
  const b = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    b[i] =
      0.5 * Math.sin((2 * Math.PI * hz * i) / sr) +
      overtone * Math.sin((2 * Math.PI * hz * 3.93 * i) / sr)
  }
  return b
}

describe('detectPitch', () => {
  it.each([60, 64, 67, 72, 84])('finds MIDI %i', (midi) => {
    const hz = detectPitch(tone(midiToHz(midi), 44100, 2048, 0.2), 44100)
    expect(hz).not.toBeNull()
    expect(matchesNote(hz!, midi, 30)).toBe(true)
  })

  it('ignores silence', () => {
    expect(detectPitch(new Float32Array(2048), 44100)).toBeNull()
  })

  it('rejects wrong notes and accepts octave errors', () => {
    expect(matchesNote(midiToHz(62), 60)).toBe(false)
    expect(matchesNote(midiToHz(72), 60)).toBe(true)
  })
})

describe('StrikeDetector', () => {
  it('reports one stable reading per strike and ignores the same note ringing on', () => {
    const d = new StrikeDetector(5, 35)
    const out: number[] = []
    for (let i = 0; i < 20; i++) {
      const r = d.push(440 + (i % 2))
      if (r) out.push(r)
    }
    expect(out).toHaveLength(1)
    for (let i = 0; i < 10; i++) d.push(null)
    for (let i = 0; i < 5; i++) {
      const r = d.push(440)
      if (r) out.push(r)
    }
    expect(out).toHaveLength(2)
  })

  it('matches a measured, out-of-tune bar', () => {
    expect(matchesHz(452, 450)).toBe(true)
    expect(matchesHz(480, 450)).toBe(false)
  })
})
