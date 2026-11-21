import { TICKS_PER_QUARTER, type NoteEvent, type Score } from './model'

export interface WriteOptions {
  /** Color for a MIDI note, as #RRGGBB. Notes get colored noteheads when given. */
  colorFor?: (midi: number) => string | undefined
  /** Label written as a lyric under each note (shows under the staff in notation views). */
  labelFor?: (midi: number) => string | undefined
}

const DIVISIONS = TICKS_PER_QUARTER

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Write the internal score as MusicXML 4.0 partwise, optionally with note colors and labels. */
export function writeMusicXml(score: Score, options: WriteOptions = {}): string {
  const out: string[] = []
  out.push('<?xml version="1.0" encoding="UTF-8"?>')
  out.push('<score-partwise version="4.0">')
  out.push(`<work><work-title>${esc(score.title)}</work-title></work>`)
  if (score.composer) {
    out.push(
      `<identification><creator type="composer">${esc(score.composer)}</creator></identification>`,
    )
  }
  out.push('<part-list>')
  for (const p of score.parts) {
    out.push(`<score-part id="${esc(p.id)}"><part-name>${esc(p.name)}</part-name></score-part>`)
  }
  out.push('</part-list>')

  for (const part of score.parts) {
    out.push(`<part id="${esc(part.id)}">`)
    part.measures.forEach((m, i) => {
      out.push(`<measure number="${esc(m.number)}">`)
      const attrs: string[] = []
      if (i === 0) attrs.push(`<divisions>${DIVISIONS}</divisions>`)
      if (m.key !== undefined || i === 0) attrs.push(`<key><fifths>${m.key ?? 0}</fifths></key>`)
      if (m.time || i === 0) {
        const t = m.time ?? { beats: 4, beatType: 4 }
        attrs.push(`<time><beats>${t.beats}</beats><beat-type>${t.beatType}</beat-type></time>`)
      }
      if (i === 0 && part.staves > 1) attrs.push(`<staves>${part.staves}</staves>`)
      const clefs = m.clefs ?? (i === 0 ? defaultClefs(part.staves) : undefined)
      if (clefs) {
        for (const [staff, c] of Object.entries(clefs)) {
          if (!c) continue
          const oc = c.octaveChange
            ? `<clef-octave-change>${c.octaveChange}</clef-octave-change>`
            : ''
          attrs.push(
            `<clef number="${staff}"><sign>${c.sign}</sign><line>${c.line}</line>${oc}</clef>`,
          )
        }
      }
      if (attrs.length) out.push(`<attributes>${attrs.join('')}</attributes>`)
      if (m.tempo) {
        out.push(
          `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${m.tempo}</per-minute></metronome></direction-type><sound tempo="${m.tempo}"/></direction>`,
        )
      }

      // Write voice by voice, using backup between voices.
      const voices = groupVoices(m.events)
      let cursor = 0
      voices.forEach((events) => {
        for (const e of events) {
          if (!e.chord && e.start > cursor) {
            out.push(`<forward><duration>${e.start - cursor}</duration></forward>`)
            cursor = e.start
          }
          out.push(noteXml(e, options))
          if (!e.chord) cursor += e.duration
        }
        if (cursor > 0) {
          out.push(`<backup><duration>${cursor}</duration></backup>`)
          cursor = 0
        }
      })
      out.push('</measure>')
    })
    out.push('</part>')
  }
  out.push('</score-partwise>')
  return out.join('\n')
}

function defaultClefs(staves: number) {
  const clefs: Record<number, { sign: 'G' | 'F'; line: number; octaveChange: number }> = {
    1: { sign: 'G', line: 2, octaveChange: 0 },
  }
  if (staves > 1) clefs[2] = { sign: 'F', line: 4, octaveChange: 0 }
  return clefs
}

function groupVoices(events: NoteEvent[]): NoteEvent[][] {
  const map = new Map<string, NoteEvent[]>()
  for (const e of events) {
    const k = `${e.staff}:${e.voice}`
    const list = map.get(k) ?? []
    list.push(e)
    map.set(k, list)
  }
  return [...map.values()]
}

function noteXml(e: NoteEvent, options: WriteOptions): string {
  const parts: string[] = []
  const color = e.pitch ? options.colorFor?.(e.pitch.midi) : undefined
  parts.push(color ? `<note color="${color}">` : '<note>')
  if (e.chord) parts.push('<chord/>')
  if (e.pitch) {
    const alter = e.pitch.alter ? `<alter>${e.pitch.alter}</alter>` : ''
    parts.push(
      `<pitch><step>${e.pitch.step}</step>${alter}<octave>${e.pitch.octave}</octave></pitch>`,
    )
  } else {
    parts.push('<rest/>')
  }
  parts.push(`<duration>${e.duration}</duration>`)
  if (e.tieStop) parts.push('<tie type="stop"/>')
  if (e.tieStart) parts.push('<tie type="start"/>')
  parts.push(`<voice>${e.voice}</voice>`)
  const type = e.type ?? guessType(e.duration)
  if (type) parts.push(`<type>${type}</type>`)
  for (let i = 0; i < e.dots; i++) parts.push('<dot/>')
  if (e.pitch && e.pitch.alter !== 0) {
    parts.push(`<accidental>${e.pitch.alter > 0 ? 'sharp' : 'flat'}</accidental>`)
  }
  if (e.staff > 1) parts.push(`<staff>${e.staff}</staff>`)
  if (color) parts.push(`<notehead color="${color}">normal</notehead>`)
  if (e.tieStart || e.tieStop) {
    const ties = [e.tieStop && '<tied type="stop"/>', e.tieStart && '<tied type="start"/>'].filter(
      Boolean,
    )
    parts.push(`<notations>${ties.join('')}</notations>`)
  }
  const label = e.pitch && !e.chord && !e.tieStop ? options.labelFor?.(e.pitch.midi) : undefined
  if (label)
    parts.push(`<lyric number="1"><syllabic>single</syllabic><text>${esc(label)}</text></lyric>`)
  parts.push('</note>')
  return parts.join('')
}

const TYPES: [number, string][] = [
  [4, 'whole'],
  [2, 'half'],
  [1, 'quarter'],
  [0.5, 'eighth'],
  [0.25, '16th'],
  [0.125, '32nd'],
]

function guessType(ticks: number): string | undefined {
  const q = ticks / TICKS_PER_QUARTER
  for (const [len, name] of TYPES) if (q >= len * 0.99) return name
  return '32nd'
}
