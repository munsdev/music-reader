import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { MusicXmlError, parseScoreFile } from '../../core/musicxml'
import { db } from '../../data/db'
import { newSong, uid } from '../../data/repo'
import type { Page } from '../../data/types'
import { pickFiles, readAsDataUrl } from '../../platform/files'
import { toast } from '../../ui/toast'

export const IMPORT_ACCEPT =
  '.musicxml,.xml,.mxl,application/vnd.recordare.musicxml+xml,application/vnd.recordare.musicxml,image/*,application/pdf'

export function newPage(photo: string): Page {
  return { id: uid(), photo, rotation: 0, status: 'new' }
}

/** Import MusicXML, .mxl, PDF or images. Images and PDFs start a scanned song. */
export function useImport() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return async () => {
    const files = await pickFiles(IMPORT_ACCEPT, true)
    if (!files.length) return
    const images = files.filter((f) => f.type.startsWith('image/'))
    const pdfs = files.filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
    )
    const scores = files.filter((f) => !images.includes(f) && !pdfs.includes(f))

    let lastId: string | undefined
    for (const file of scores) {
      try {
        const score = parseScoreFile(new Uint8Array(await file.arrayBuffer()), file.name)
        const song = newSong(score.title, score, score.composer)
        await db.songs.add(song)
        lastId = song.id
      } catch (e) {
        toast(
          e instanceof MusicXmlError
            ? t('import.badFile', { name: file.name, reason: e.message })
            : t('import.failed', { name: file.name }),
        )
      }
    }

    const pages: Page[] = []
    for (const img of images) pages.push(newPage(await readAsDataUrl(img)))
    for (const pdf of pdfs) {
      try {
        const { pdfToImages } = await import('../../platform/pdf-pages')
        for (const url of await pdfToImages(pdf)) pages.push(newPage(url))
      } catch {
        toast(t('import.pdfFailed', { name: pdf.name }))
      }
    }
    if (pages.length) {
      const title = (images[0] ?? pdfs[0])?.name.replace(/\.[^.]+$/, '') ?? t('scan.untitled')
      const song = newSong(
        title,
        { title, parts: [], source: { kind: 'manual' } },
        undefined,
        pages,
      )
      await db.songs.add(song)
      navigate(`/song/${song.id}/pages`)
      return
    }
    if (lastId) navigate(`/song/${lastId}`)
  }
}
