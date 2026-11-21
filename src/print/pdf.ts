import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'
import { labelColorFor, mix, parseHex } from '../core/color'
import type { InstrumentProfile } from '../core/instruments'
import { labelFor, type LabelSettings } from '../core/labels'
import { layoutPart, type LayoutNote } from '../core/layout'
import { TICKS_PER_QUARTER, type Score } from '../core/model'
import { shapePath } from '../core/shapes'
import type { NoteShape } from '../core/instruments'

/**
 * Print-ready vector PDF of the circles view. See docs/DESIGN.md section 07.
 * Everything is drawn as vectors with embedded fonts.
 */

export type Paper = 'a4' | 'letter'
export type PrintSize = 'regular' | 'large' | 'xl'
export type Ink = 'color' | 'light' | 'bw'

export interface PrintOptions {
  paper: Paper
  size: PrintSize
  ink: Ink
  legend: boolean
  measureNumbers: boolean
  nameLine: boolean
  labels: LabelSettings
  /** Translated strings used on the page. */
  text: { page: (n: number, total: number) => string; name: string; madeWith: string }
}

export interface PrintFonts {
  serif: Uint8Array
  sans: Uint8Array
  sansBold: Uint8Array
}

const MM = 72 / 25.4
const PAPER: Record<Paper, [number, number]> = { a4: [595.28, 841.89], letter: [612, 792] }
const MARGIN = 15 * MM
const RADIUS: Record<PrintSize, number> = { regular: 12, large: 17, xl: 23 }
const MAX_PER_ROW: Record<PrintSize, number> = { regular: 6, large: 4, xl: 3 }

const INK = hex('#1E2A47')
const RULE = hex('#C9D2DE')

function hex(h: string): RGB {
  const { r, g, b } = parseHex(h)
  return rgb(r / 255, g / 255, b / 255)
}

interface Ctx {
  doc: PDFDocument
  page: PDFPage
  serif: PDFFont
  sans: PDFFont
  bold: PDFFont
  width: number
  height: number
  options: PrintOptions
  instrument: InstrumentProfile
}

export async function buildPdf(
  title: string,
  composer: string | undefined,
  score: Score,
  instrument: InstrumentProfile,
  options: PrintOptions,
  fonts: PrintFonts,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  doc.setTitle(title)
  doc.setCreator('Music Reader')
  doc.setProducer('Music Reader')
  const [serif, sans, bold] = await Promise.all([
    doc.embedFont(fonts.serif, { subset: true }),
    doc.embedFont(fonts.sans, { subset: true }),
    doc.embedFont(fonts.sansBold, { subset: true }),
  ])
  const [width, height] = PAPER[options.paper]
  const ctx: Ctx = {
    doc,
    page: doc.addPage([width, height]),
    serif,
    sans,
    bold,
    width,
    height,
    options,
    instrument,
  }

  const r = RADIUS[options.size]
  const unit = r * 2.7
  const contentWidth = width - 2 * MARGIN
  const part = score.parts[0]
  const rows = part
    ? layoutPart(part, {
        maxWidth: contentWidth / unit,
        quarterWidth: 1,
        minWidth: 1,
        measurePadding: 0.25,
        maxMeasuresPerRow: MAX_PER_ROW[options.size],
      })
    : []

  let y = drawHeader(ctx, title, composer)
  if (options.legend) y = drawLegend(ctx, y)

  const maxChord = Math.max(
    1,
    ...rows.flatMap((row) => row.measures.flatMap((m) => m.notes.map((n) => n.midis.length))),
  )
  const rowHeight = maxChord * r * 2.25 + r * 1.6 + (options.measureNumbers ? 10 : 0)
  const footer = MARGIN + 16

  for (const row of rows) {
    if (y - rowHeight < footer) {
      ctx.page = doc.addPage([width, height])
      y = height - MARGIN
    }
    const top = y - (options.measureNumbers ? 10 : 0)
    const centerY = top - r * 1.15
    const rowX = MARGIN
    for (const [mi, m] of row.measures.entries()) {
      const mx = rowX + m.x * unit
      if (options.measureNumbers) {
        ctx.page.drawText(m.number, { x: mx + 2, y: top + 2, size: 7, font: sans, color: RULE })
      }
      if (mi > 0) {
        ctx.page.drawLine({
          start: { x: mx, y: top },
          end: { x: mx, y: top - maxChord * r * 2.25 },
          thickness: 0.8,
          color: RULE,
        })
      }
      for (const note of m.notes) drawSlot(ctx, note, mx + note.x * unit, centerY, r, unit)
    }
    y -= rowHeight
  }

  const pages = doc.getPages()
  pages.forEach((p, i) => {
    const label = options.text.page(i + 1, pages.length)
    const w = sans.widthOfTextAtSize(label, 8)
    p.drawText(label, { x: (width - w) / 2, y: MARGIN - 4, size: 8, font: sans, color: INK })
    const made = options.text.madeWith
    p.drawText(made, {
      x: width - MARGIN - sans.widthOfTextAtSize(made, 7),
      y: MARGIN - 4,
      size: 7,
      font: sans,
      color: RULE,
    })
  })

  return doc.save()
}

function drawHeader(ctx: Ctx, title: string, composer: string | undefined): number {
  const { page, serif, sans, width, height, options, instrument } = ctx
  let y = height - MARGIN - 22
  const size = fitSize(serif, title, 24, width - 2 * MARGIN - (options.nameLine ? 150 : 0))
  page.drawText(title, { x: MARGIN, y, size, font: serif, color: INK })
  const sub = [composer, instrument.name].filter(Boolean).join('   ')
  y -= 16
  if (sub) page.drawText(sub, { x: MARGIN, y, size: 10, font: sans, color: INK })
  if (options.nameLine) {
    const lx = width - MARGIN - 140
    page.drawText(options.text.name, { x: lx, y: y + 16, size: 9, font: sans, color: INK })
    page.drawLine({
      start: { x: lx, y: y + 12 },
      end: { x: width - MARGIN, y: y + 12 },
      thickness: 0.8,
      color: INK,
    })
  }
  return y - 22
}

function drawLegend(ctx: Ctx, y: number): number {
  const { page, instrument, width } = ctx
  const n = instrument.notes.length
  const avail = width - 2 * MARGIN
  const barW = Math.min(34, avail / n - 4)
  const maxH = 70
  const minH = 38
  instrument.notes.forEach((note, i) => {
    const h = n === 1 ? maxH : maxH - ((maxH - minH) * i) / (n - 1)
    const x = MARGIN + i * (barW + 4)
    const fill = fillFor(ctx, note.color)
    page.drawRectangle({
      x,
      y: y - maxH + (maxH - h) / 2,
      width: barW,
      height: h,
      color: fill,
      borderColor: ctx.options.ink === 'color' ? undefined : borderFor(ctx, note.color),
      borderWidth: ctx.options.ink === 'color' ? 0 : 1.2,
    })
    // Brass nail dots.
    for (const f of [0.18, 0.82]) {
      page.drawCircle({
        x: x + barW / 2,
        y: y - maxH + (maxH - h) / 2 + h * f,
        size: 1.6,
        color: hex('#B8893B'),
      })
    }
    const label = labelFor(note.midi, instrument, ctx.options.labels)
    if (label)
      drawLabel(
        ctx,
        label,
        x + barW / 2,
        y - maxH / 2,
        Math.min(12, barW * 0.5),
        textColorFor(ctx, note.color),
      )
    drawShape(ctx, note.shape, x + barW / 2, y - maxH - 8, 4, INK, note.shape === 'ring')
  })
  return y - maxH - 30
}

function drawSlot(
  ctx: Ctx,
  note: LayoutNote,
  x: number,
  cy: number,
  r: number,
  unit: number,
): void {
  const cx = x + r * 1.1
  if (note.midis.length === 0) {
    ctx.page.drawLine({
      start: { x: cx - r * 0.5, y: cy },
      end: { x: cx + r * 0.5, y: cy },
      thickness: 2.5,
      color: RULE,
    })
    return
  }
  // Highest note on top.
  const pitches = [...note.pitches].reverse()
  const midis = pitches.map((p) => p.midi)
  midis.forEach((midi, i) => {
    const y = cy - i * r * 2.25
    const inst = ctx.instrument.notes.find((n) => n.midi === midi)
    const color = inst?.color ?? '#C9D2DE'
    // Hold line for long notes (half note and longer).
    if (note.ticks >= TICKS_PER_QUARTER * 2) {
      const end = x + note.width * unit - r * 0.3
      const hold = ctx.options.ink === 'color' ? fillFor(ctx, color) : borderFor(ctx, color)
      ctx.page.drawLine({
        start: { x: cx, y },
        end: { x: end, y },
        thickness: ctx.options.ink === 'color' ? r * 0.45 : 2,
        color: hold,
        lineCap: 1,
      })
    }
    ctx.page.drawCircle({
      x: cx,
      y,
      size: r,
      color: fillFor(ctx, color),
      borderColor: ctx.options.ink === 'color' ? undefined : borderFor(ctx, color),
      borderWidth: ctx.options.ink === 'color' ? 0 : 1.5,
    })
    const label = labelFor(midi, ctx.instrument, ctx.options.labels, pitches[i])
    if (label) drawLabel(ctx, label, cx, y, r * 0.95, textColorFor(ctx, color))
    if (inst && i === midis.length - 1) {
      drawShape(ctx, inst.shape, cx, y - r - r * 0.45, r * 0.24, INK, inst.shape === 'ring')
    }
  })
}

function fillFor(ctx: Ctx, color: string): RGB {
  if (ctx.options.ink === 'bw') return rgb(1, 1, 1)
  if (ctx.options.ink === 'light') return hex(mix(color, '#FFFFFF', 0.62))
  return hex(color)
}

function borderFor(ctx: Ctx, color: string): RGB {
  return ctx.options.ink === 'bw' ? INK : hex(color)
}

function textColorFor(ctx: Ctx, color: string): RGB {
  if (ctx.options.ink !== 'color') return INK
  return hex(labelColorFor(color))
}

/** Draw a label, rendering sharps and flats as vector symbols (the fonts lack them). */
function drawLabel(
  ctx: Ctx,
  label: string,
  cx: number,
  cy: number,
  size: number,
  color: RGB,
): void {
  const acc = label.endsWith('♯') ? 'sharp' : label.endsWith('♭') ? 'flat' : null
  const text = acc ? label.slice(0, -1) : label
  const font = ctx.bold
  const s = fitSize(font, text, size, size * 1.9)
  const w = font.widthOfTextAtSize(text, s)
  const accW = acc ? s * 0.45 : 0
  const x = cx - (w + accW) / 2
  ctx.page.drawText(text, { x, y: cy - s * 0.35, size: s, font, color })
  if (acc) drawAccidental(ctx.page, acc, x + w + accW * 0.55, cy + s * 0.15, s * 0.55, color)
}

function drawAccidental(
  page: PDFPage,
  kind: 'sharp' | 'flat',
  x: number,
  y: number,
  s: number,
  color: RGB,
): void {
  const t = Math.max(0.6, s * 0.11)
  if (kind === 'sharp') {
    for (const dx of [-0.18, 0.18])
      page.drawLine({
        start: { x: x + dx * s, y: y - 0.5 * s },
        end: { x: x + dx * s, y: y + 0.5 * s },
        thickness: t,
        color,
      })
    for (const dy of [-0.15, 0.15])
      page.drawLine({
        start: { x: x - 0.35 * s, y: y + dy * s - 0.06 * s },
        end: { x: x + 0.35 * s, y: y + dy * s + 0.06 * s },
        thickness: t * 1.6,
        color,
      })
  } else {
    page.drawLine({
      start: { x: x - 0.2 * s, y: y - 0.45 * s },
      end: { x: x - 0.2 * s, y: y + 0.55 * s },
      thickness: t,
      color,
    })
    page.drawSvgPath(`M 0 0 C ${0.5 * s} ${-0.2 * s} ${0.45 * s} ${0.3 * s} 0 ${0.45 * s}`, {
      x: x - 0.2 * s,
      y,
      borderColor: color,
      borderWidth: t * 1.4,
    })
  }
}

function drawShape(
  ctx: Ctx,
  shape: NoteShape,
  cx: number,
  cy: number,
  size: number,
  color: RGB,
  outline: boolean,
): void {
  // pdf-lib draws SVG paths with y down from (x, y), which matches the shape box.
  const path = shapePath(shape, size)
  ctx.page.drawSvgPath(
    path,
    outline ? { x: cx, y: cy, borderColor: color, borderWidth: 1 } : { x: cx, y: cy, color },
  )
}

function fitSize(font: PDFFont, text: string, size: number, maxWidth: number): number {
  const w = font.widthOfTextAtSize(text, size)
  return w > maxWidth ? Math.max(6, (size * maxWidth) / w) : size
}

/** Sticker sheet: round labels in the instrument's colors with cut guides. */
export async function buildStickerSheet(
  instrument: InstrumentProfile,
  options: Pick<PrintOptions, 'paper' | 'labels'>,
  fonts: PrintFonts,
  copies = 3,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  doc.setTitle(`${instrument.name} stickers`)
  const bold = await doc.embedFont(fonts.sansBold, { subset: true })
  const [width, height] = PAPER[options.paper]
  let page = doc.addPage([width, height])
  const r = 12 * MM
  const gap = 6 * MM
  const perRow = Math.floor((width - 2 * MARGIN + gap) / (2 * r + gap))
  let i = 0
  const items = Array.from({ length: copies }, () => instrument.notes).flat()
  let y = height - MARGIN - r
  for (const note of items) {
    const col = i % perRow
    if (col === 0 && i > 0) y -= 2 * r + gap
    if (y - r < MARGIN) {
      page = doc.addPage([width, height])
      y = height - MARGIN - r
    }
    const x = MARGIN + r + col * (2 * r + gap)
    page.drawCircle({
      x,
      y,
      size: r + 1.5 * MM,
      borderColor: RULE,
      borderWidth: 0.5,
      borderDashArray: [2, 2],
    })
    page.drawCircle({ x, y, size: r, color: hex(note.color) })
    const label = labelFor(note.midi, instrument, options.labels)
    const ctx = { page, bold } as unknown as Ctx
    if (label) drawLabel(ctx, label, x, y, r * 0.9, hex(labelColorFor(note.color)))
    i++
  }
  return doc.save()
}
