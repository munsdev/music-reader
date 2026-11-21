import { parseMusicXml } from '../core/musicxml'
import type { Score } from '../core/model'
import type { Page } from '../data/types'
import { omr, type Stage } from './engine'

/** Recognize one page and attach recognition data (box, confidence) to its notes. */
export async function readPage(
  page: Page,
  pageIndex: number,
  onStage?: (s: Stage) => void,
): Promise<{ score: Score; modelVersion: string }> {
  const result = await omr.recognize(page.photo, page.corners, page.rotation, onStage)
  const score = parseMusicXml(result.musicXml)
  let i = 0
  const byIndex = new Map(result.notes.map((n) => [n.index, n]))
  for (const part of score.parts)
    for (const m of part.measures)
      for (const e of m.events) {
        const r = byIndex.get(i++)
        if (r) e.recognition = { box: { page: pageIndex, ...r.box }, confidence: r.confidence }
      }
  return {
    score: {
      ...score,
      source: { kind: 'recognition', modelVersion: result.modelVersion, pageCount: 1 },
    },
    modelVersion: result.modelVersion,
  }
}
