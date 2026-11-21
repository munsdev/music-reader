/**
 * Pitch detection for the listening practice modes (YIN-style difference function).
 * Pure function so it can be unit tested with synthetic signals.
 */
export function detectPitch(
  buffer: Float32Array,
  sampleRate: number,
  minHz = 180,
  maxHz = 4200,
): number | null {
  const n = buffer.length
  let rms = 0
  for (let i = 0; i < n; i++) rms += buffer[i]! * buffer[i]!
  rms = Math.sqrt(rms / n)
  if (rms < 0.01) return null

  const minLag = Math.max(2, Math.floor(sampleRate / maxHz))
  const maxLag = Math.min(Math.floor(n / 2), Math.floor(sampleRate / minHz))
  const diff = new Float32Array(maxLag + 1)
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0
    for (let i = 0; i < n - maxLag; i++) {
      const d = buffer[i]! - buffer[i + lag]!
      sum += d * d
    }
    diff[lag] = sum
  }
  // Cumulative mean normalized difference.
  const cmnd = new Float32Array(maxLag + 1)
  let running = 0
  for (let lag = minLag; lag <= maxLag; lag++) {
    running += diff[lag]!
    cmnd[lag] = running === 0 ? 1 : (diff[lag]! * (lag - minLag + 1)) / running
  }
  const threshold = 0.15
  let lag = -1
  for (let l = minLag + 1; l < maxLag; l++) {
    if (cmnd[l]! < threshold && cmnd[l]! <= cmnd[l + 1]!) {
      lag = l
      break
    }
  }
  if (lag < 0) return null
  // Parabolic interpolation around the minimum.
  const a = cmnd[lag - 1]!
  const b = cmnd[lag]!
  const c = cmnd[lag + 1]!
  const shift = (a - c) / (2 * (a - 2 * b + c) || 1)
  return sampleRate / (lag + shift)
}

export const hzToMidi = (hz: number): number => 69 + 12 * Math.log2(hz / 440)

/**
 * True when the heard frequency matches the expected note. Octave errors are accepted
 * because toy bars have strong overtones; `toleranceCents` covers out-of-tune toys.
 */
export function matchesNote(hz: number, expectedMidi: number, toleranceCents = 60): boolean {
  const cents = (hzToMidi(hz) - expectedMidi) * 100
  const folded = (((cents % 1200) + 1800) % 1200) - 600
  return Math.abs(folded) <= toleranceCents
}

export interface Listener {
  stop(): void
}

/** Listen to the microphone and call `onPitch` with detected frequencies. */
export async function listen(onPitch: (hz: number | null) => void): Promise<Listener> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  })
  const ctx = new AudioContext()
  const source = ctx.createMediaStreamSource(stream)
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 2048
  source.connect(analyser)
  const buf = new Float32Array(analyser.fftSize)
  let raf = 0
  const loop = () => {
    analyser.getFloatTimeDomainData(buf)
    onPitch(detectPitch(buf, ctx.sampleRate))
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)
  return {
    stop() {
      cancelAnimationFrame(raf)
      stream.getTracks().forEach((t) => t.stop())
      void ctx.close()
    },
  }
}
