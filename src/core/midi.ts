import type { Timeline } from './timeline'

/** Standard MIDI File (format 0) from a timeline, at a fixed 120 BPM grid of seconds. */
export function writeMidi(timeline: Timeline, program = 13 /* xylophone */): Uint8Array {
  const PPQ = 480
  const tempoUs = 500_000 // 120 BPM: one quarter = 0.5 s, so ticks = seconds * 960
  const toTicks = (s: number) => Math.round(s * (PPQ * 2))
  const events: { tick: number; data: number[] }[] = []
  for (const n of timeline.notes) {
    events.push({ tick: toTicks(n.time), data: [0x90, n.midi, 96] })
    events.push({ tick: toTicks(n.time + n.duration * 0.95), data: [0x80, n.midi, 0] })
  }
  events.sort((a, b) => a.tick - b.tick || a.data[0]! - b.data[0]!)

  const track: number[] = []
  const vlq = (v: number) => {
    const bytes = [v & 0x7f]
    while ((v >>= 7)) bytes.unshift((v & 0x7f) | 0x80)
    track.push(...bytes)
  }
  vlq(0)
  track.push(0xff, 0x51, 0x03, (tempoUs >> 16) & 255, (tempoUs >> 8) & 255, tempoUs & 255)
  vlq(0)
  track.push(0xc0, program)
  let last = 0
  for (const e of events) {
    vlq(e.tick - last)
    track.push(...e.data)
    last = e.tick
  }
  vlq(0)
  track.push(0xff, 0x2f, 0x00)

  const u32 = (v: number) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]
  return new Uint8Array([
    ...[0x4d, 0x54, 0x68, 0x64],
    ...u32(6),
    0,
    0,
    0,
    1,
    (PPQ >> 8) & 255,
    PPQ & 255,
    ...[0x4d, 0x54, 0x72, 0x6b],
    ...u32(track.length),
    ...track,
  ])
}
