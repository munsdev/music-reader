import type { Page } from '../data/types'
import { uid } from '../data/repo'
import { renderPage } from './page-image'

/** A new page from a photo, with its display image ready. */
export async function makePage(photo: string): Promise<Page> {
  const page: Page = { id: uid(), photo, rotation: 0, status: 'new' }
  return { ...page, view: await renderPage(photo, undefined, 0).catch(() => undefined) }
}

/** Recompute the display image after a crop or rotation change. */
export async function refreshView(page: Page): Promise<Page> {
  return {
    ...page,
    view: await renderPage(page.photo, page.corners, page.rotation).catch(() => undefined),
  }
}

export const pageSrc = (p: Page): string => p.view ?? p.photo
