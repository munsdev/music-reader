import type { Score } from './model'
import { parseMusicXml } from './musicxml'

/** Full "Twinkle, Twinkle, Little Star" (traditional, public domain), the sample song. */
const notes =
  'C4 C4 G4 G4 | A4 A4 G4- | F4 F4 E4 E4 | D4 D4 C4- | G4 G4 F4 F4 | E4 E4 D4- | G4 G4 F4 F4 | E4 E4 D4- | C4 C4 G4 G4 | A4 A4 G4- | F4 F4 E4 E4 | D4 D4 C4-'

function build(): string {
  const measures = notes.split('|').map((m, i) => {
    const body = m
      .trim()
      .split(/\s+/)
      .map((n) => {
        const half = n.endsWith('-')
        const name = n.replace('-', '')
        const step = name[0]
        const octave = name.slice(1)
        return `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>${half ? 2 : 1}</duration><voice>1</voice><type>${half ? 'half' : 'quarter'}</type></note>`
      })
      .join('')
    const attrs =
      i === 0
        ? '<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes><direction><sound tempo="92"/></direction>'
        : ''
    return `<measure number="${i + 1}">${attrs}${body}</measure>`
  })
  return `<?xml version="1.0"?><score-partwise version="4.0"><work><work-title>Twinkle, Twinkle, Little Star</work-title></work><identification><creator type="composer">Traditional</creator></identification><part-list><score-part id="P1"><part-name>Melody</part-name></score-part></part-list><part id="P1">${measures.join('')}</part></score-partwise>`
}

export const SAMPLE_XML = build()

export function sampleScore(): Score {
  return { ...parseMusicXml(SAMPLE_XML), source: { kind: 'sample' } }
}
