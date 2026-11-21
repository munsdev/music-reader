import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { FULL_QUAD, fitBox, isValidQuad, type Quad } from '../../core/crop'
import { saveSong } from '../../data/repo'
import type { Page } from '../../data/types'
import { refreshView } from '../../platform/pages'
import { useSong } from '../../state/hooks'
import { Bar } from '../../ui/Bar'
import { Button } from '../../ui/controls'
import { Screen } from '../../ui/Screen'

const PAD = 40
const LOUPE = 110
const ZOOM = 2.5

/**
 * Full-screen crop. The photo is fitted with padding so every corner can be reached and no
 * drag starts in the phone's edge-swipe Back zone. A magnifier shows the corner while dragging.
 */
export function CropScreen() {
  const { id, pageId } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const song = useSong(id)
  const page = song?.pages.find((p) => p.id === pageId)
  const area = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 360, h: 560 })
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [quad, setQuad] = useState<Quad>(FULL_QUAD)
  const [drag, setDrag] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const loaded = useRef(false)

  useEffect(() => {
    if (page && !loaded.current) {
      loaded.current = true
      setQuad((page.corners as Quad | undefined) ?? FULL_QUAD)
    }
  }, [page])

  useLayoutEffect(() => {
    const el = area.current
    if (!el) return
    const ro = new ResizeObserver(
      ([e]) => e && setSize({ w: e.contentRect.width, h: e.contentRect.height }),
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [song])

  if (song === null) return <Navigate to="/" replace />
  if (!song)
    return (
      <Screen title="" back>
        {null}
      </Screen>
    )
  if (!page) return <Navigate to={`/song/${song.id}/pages`} replace />

  const box = natural ? fitBox(natural.w, natural.h, size.w, size.h, PAD) : null
  const valid = isValidQuad(quad)
  const toPx = ([x, y]: [number, number]) =>
    (box ? [box.left + x * box.width, box.top + y * box.height] : [0, 0]) as [number, number]

  const move = (e: React.PointerEvent) => {
    if (drag === null || !box || !area.current) return
    const r = area.current.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - r.left - box.left) / box.width))
    const y = Math.min(1, Math.max(0, (e.clientY - r.top - box.top) / box.height))
    setQuad((q) => q.map((p, i) => (i === drag ? [x, y] : p)) as Quad)
  }

  const save = async () => {
    setSaving(true)
    const updated: Page = await refreshView({
      ...page,
      corners: quad,
      status: page.status === 'read' ? 'new' : page.status,
    })
    await saveSong({ ...song, pages: song.pages.map((p) => (p.id === page.id ? updated : p)) })
    navigate(-1)
  }

  const index = song.pages.indexOf(page)
  return (
    <div className="bg-ink text-paper flex h-dvh flex-col pt-[var(--sat)]">
      <header className="flex min-h-16 items-center gap-2 px-3">
        <Button className="text-paper" onClick={() => navigate(-1)}>
          {t('common.cancel')}
        </Button>
        <h1 className="font-display flex-1 text-center text-xl">
          {t('crop.title', { n: index + 1 })}
        </h1>
        <Button className="text-birch" onClick={() => setQuad(FULL_QUAD)}>
          {t('crop.whole')}
        </Button>
      </header>
      <div
        ref={area}
        className="relative min-h-0 flex-1 touch-none select-none"
        onPointerMove={move}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      >
        <img
          src={page.photo}
          alt=""
          draggable={false}
          onLoad={(e) =>
            setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
          }
          className="absolute"
          style={
            box
              ? { left: box.left, top: box.top, width: box.width, height: box.height }
              : { opacity: 0 }
          }
        />
        {box && (
          <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden>
            <polygon
              points={quad.map((p) => toPx(p).join(',')).join(' ')}
              fill={valid ? 'rgb(58 111 143 / 0.18)' : 'rgb(179 38 30 / 0.25)'}
              stroke={valid ? 'var(--color-birch)' : 'var(--color-alert)'}
              strokeWidth={3}
            />
          </svg>
        )}
        {box &&
          quad.map((p, i) => {
            const [x, y] = toPx(p)
            return (
              <button
                key={i}
                type="button"
                aria-label={t('crop.corner', { n: i + 1 })}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId)
                  setDrag(i)
                }}
                onPointerMove={move}
                onPointerUp={() => setDrag(null)}
                className="absolute flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
                style={{ left: x, top: y }}
              >
                <span
                  className={`block size-6 rounded-full border-4 ${drag === i ? 'border-birch bg-birch/40' : 'border-birch bg-ink/30'}`}
                />
              </button>
            )
          })}
        {box &&
          drag !== null &&
          (() => {
            const [x, y] = toPx(quad[drag]!)
            const above = y - LOUPE - 50 > 0
            return (
              <div
                aria-hidden
                className="border-birch shadow-soft pointer-events-none absolute overflow-hidden rounded-full border-4"
                style={{
                  width: LOUPE,
                  height: LOUPE,
                  left: Math.min(size.w - LOUPE - 8, Math.max(8, x - LOUPE / 2)),
                  top: above ? y - LOUPE - 50 : y + 50,
                  backgroundImage: `url(${page.photo})`,
                  backgroundSize: `${box.width * ZOOM}px ${box.height * ZOOM}px`,
                  backgroundPosition: `${LOUPE / 2 - (x - box.left) * ZOOM}px ${LOUPE / 2 - (y - box.top) * ZOOM}px`,
                }}
              >
                <span className="border-alert absolute top-1/2 left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2" />
              </div>
            )
          })()}
      </div>
      <div className="px-4 pt-2 pb-[calc(1rem+var(--sab))]">
        <p
          className={`mb-3 text-center ${valid ? 'text-paper/80' : 'text-birch font-semibold'}`}
          role="status"
        >
          {valid ? t('crop.hint') : t('crop.crossed')}
        </p>
        <Bar tone="birch" className="w-full" disabled={!valid || saving} onClick={save}>
          {saving ? t('crop.saving') : t('crop.save')}
        </Bar>
      </div>
    </div>
  )
}
