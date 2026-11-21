import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import { fitToInstrument } from '../core/adapt'
import { PRESETS } from '../core/instruments'
import { parseMusicXml } from '../core/musicxml'
import { sampleScore } from '../core/sample'
import { PIANO_XML } from '../core/__fixtures__/twinkle'
import { buildPdf, buildStickerSheet, type PrintOptions } from './pdf'

const font = (p: string) => new Uint8Array(readFileSync(`node_modules/@fontsource/${p}`))
const fonts = {
  serif: font('young-serif/files/young-serif-latin-400-normal.woff'),
  sans: font('atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-400-normal.woff'),
  sansBold: font(
    'atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-700-normal.woff',
  ),
}
const options: PrintOptions = {
  paper: 'a4',
  size: 'regular',
  ink: 'color',
  legend: true,
  measureNumbers: true,
  nameLine: true,
  labels: { style: 'letters', naming: 'english' },
  text: { page: (n, t) => `Page ${n} of ${t}`, name: 'Name', madeWith: 'Made with Music Reader' },
}
const xylo = PRESETS[0]!
const keys = PRESETS.find((p) => p.id === 'keyboard-25')!

describe('buildPdf', () => {
  it('builds a one-page sample song', async () => {
    const fit = fitToInstrument(sampleScore(), xylo)
    const bytes = await buildPdf(
      'Twinkle, Twinkle, Little Star',
      'Traditional',
      fit.score,
      xylo,
      options,
      fonts,
    )
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
    if (process.env.PDF_OUT) {
      mkdirSync(process.env.PDF_OUT, { recursive: true })
      writeFileSync(`${process.env.PDF_OUT}/sample.pdf`, bytes)
    }
  })

  it('paginates long songs at extra-large size and handles every ink mode', async () => {
    const score = sampleScore()
    const long = {
      ...score,
      parts: [
        {
          ...score.parts[0]!,
          measures: [
            ...score.parts[0]!.measures,
            ...score.parts[0]!.measures,
            ...score.parts[0]!.measures,
          ],
        },
      ],
    }
    for (const ink of ['color', 'light', 'bw'] as const) {
      const bytes = await buildPdf(
        'Long',
        undefined,
        fitToInstrument(long, xylo).score,
        xylo,
        { ...options, ink, size: 'xl', paper: 'letter' },
        fonts,
      )
      const doc = await PDFDocument.load(bytes)
      expect(doc.getPageCount()).toBeGreaterThan(1)
      if (process.env.PDF_OUT) writeFileSync(`${process.env.PDF_OUT}/long-${ink}.pdf`, bytes)
    }
  })

  it('draws chords and accidentals for a chromatic keyboard', async () => {
    const fit = fitToInstrument(parseMusicXml(PIANO_XML), keys)
    const bytes = await buildPdf('Piano', undefined, fit.score, keys, options, fonts)
    expect(bytes.length).toBeGreaterThan(1000)
    if (process.env.PDF_OUT) writeFileSync(`${process.env.PDF_OUT}/piano.pdf`, bytes)
  })

  it('builds a sticker sheet', async () => {
    const bytes = await buildStickerSheet(xylo, options, fonts)
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1)
    if (process.env.PDF_OUT) writeFileSync(`${process.env.PDF_OUT}/stickers.pdf`, bytes)
  })
})
