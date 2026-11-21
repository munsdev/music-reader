import type { SoundKind } from '../data/types'

/**
 * Small Web Audio synth for mallet-style tones. No sound files: every voice is a few
 * decaying sine partials (modal synthesis), which is how struck bars actually sound.
 */

interface Partial {
  ratio: number
  gain: number
  decay: number
}

interface Voice {
  partials: Partial[]
  /** Short noise burst for the mallet strike, 0 to disable. */
  click: number
  attack: number
}

const VOICES: Record<SoundKind, Voice> = {
  xylophone: {
    partials: [
      { ratio: 1, gain: 1, decay: 0.55 },
      { ratio: 3.93, gain: 0.32, decay: 0.18 },
      { ratio: 9.24, gain: 0.08, decay: 0.07 },
    ],
    click: 0.25,
    attack: 0.002,
  },
  glockenspiel: {
    partials: [
      { ratio: 1, gain: 1, decay: 1.8 },
      { ratio: 2.76, gain: 0.35, decay: 0.9 },
      { ratio: 5.4, gain: 0.15, decay: 0.45 },
      { ratio: 8.93, gain: 0.06, decay: 0.25 },
    ],
    click: 0.1,
    attack: 0.001,
  },
  bells: {
    partials: [
      { ratio: 1, gain: 1, decay: 2.4 },
      { ratio: 2.0, gain: 0.45, decay: 1.6 },
      { ratio: 3.01, gain: 0.25, decay: 1.0 },
      { ratio: 4.2, gain: 0.12, decay: 0.6 },
    ],
    click: 0.05,
    attack: 0.003,
  },
  piano: {
    partials: [
      { ratio: 1, gain: 1, decay: 1.2 },
      { ratio: 2, gain: 0.4, decay: 0.8 },
      { ratio: 3, gain: 0.18, decay: 0.5 },
      { ratio: 4, gain: 0.08, decay: 0.3 },
    ],
    click: 0.03,
    attack: 0.004,
  },
  tubes: {
    partials: [
      { ratio: 1, gain: 1, decay: 0.38 },
      { ratio: 2, gain: 0.12, decay: 0.15 },
    ],
    click: 0.35,
    attack: 0.004,
  },
}

export const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)

class Synth {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  volume = 0.8

  /** Must be called from a user gesture the first time (browser autoplay rules). */
  context(): AudioContext {
    if (!this.ctx) {
      const ctx = new AudioContext({ latencyHint: 'interactive' })
      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -12
      comp.ratio.value = 4
      const master = ctx.createGain()
      master.gain.value = this.volume
      master.connect(comp).connect(ctx.destination)
      const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.03), ctx.sampleRate)
      const data = noise.getChannelData(0)
      for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
      this.ctx = ctx
      this.master = master
      this.noise = noise
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  setVolume(v: number): void {
    this.volume = v
    if (this.master) this.master.gain.value = v
  }

  now(): number {
    return this.context().currentTime
  }

  /** Strike a note at `when` (AudioContext time). Struck sounds ring on their own. */
  strike(midi: number, sound: SoundKind, when = 0, velocity = 0.8, hz?: number): void {
    const ctx = this.context()
    const out = this.master!
    const t = Math.max(when, ctx.currentTime)
    // A measured frequency (from "Set up by listening") matches the real toy's tuning.
    const f0 = hz ?? midiToHz(midi)
    const voice = VOICES[sound]
    // Higher notes decay faster on real bars.
    const decayScale = Math.min(1.3, Math.max(0.5, 440 / f0) ** 0.35)
    const gain = ctx.createGain()
    gain.gain.value = velocity * 0.28
    gain.connect(out)

    for (const p of voice.partials) {
      const freq = f0 * p.ratio
      if (freq > ctx.sampleRate / 2.2) continue
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      const env = ctx.createGain()
      const decay = p.decay * decayScale
      env.gain.setValueAtTime(0, t)
      env.gain.linearRampToValueAtTime(p.gain, t + voice.attack)
      env.gain.exponentialRampToValueAtTime(0.0001, t + voice.attack + decay * 4)
      osc.connect(env).connect(gain)
      osc.start(t)
      osc.stop(t + voice.attack + decay * 4 + 0.05)
    }

    if (voice.click > 0 && this.noise) {
      const src = ctx.createBufferSource()
      src.buffer = this.noise
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = Math.min(8000, f0 * 4)
      const g = ctx.createGain()
      g.gain.value = voice.click
      src.connect(bp).connect(g).connect(gain)
      src.start(t)
    }
  }

  /** Metronome click. Accented on the first beat. */
  click(when: number, accent: boolean): void {
    const ctx = this.context()
    const osc = ctx.createOscillator()
    osc.frequency.value = accent ? 1600 : 1100
    const env = ctx.createGain()
    env.gain.setValueAtTime(accent ? 0.35 : 0.22, when)
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.05)
    osc.connect(env).connect(this.master!)
    osc.start(when)
    osc.stop(when + 0.06)
  }
}

export const synth = new Synth()
