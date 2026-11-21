import serifUrl from '@fontsource/young-serif/files/young-serif-latin-400-normal.woff?url'
import sansUrl from '@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-400-normal.woff?url'
import boldUrl from '@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-700-normal.woff?url'
import type { PrintFonts } from '../print/pdf'

let cache: Promise<PrintFonts> | null = null

/** Fonts for PDF export, loaded from the app bundle (works offline). */
export function printFonts(): Promise<PrintFonts> {
  cache ??= (async () => {
    const load = async (u: string) => new Uint8Array(await (await fetch(u)).arrayBuffer())
    const [serif, sans, sansBold] = await Promise.all([
      load(serifUrl),
      load(sansUrl),
      load(boldUrl),
    ])
    return { serif, sans, sansBold }
  })()
  return cache
}
