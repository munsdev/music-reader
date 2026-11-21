import {
  ArrowClockwise,
  ArrowDown,
  ArrowUp,
  Camera,
  Crop,
  FilePdf,
  Images,
  Trash,
} from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { replacePage } from '../../core/edit'
import { db } from '../../data/db'
import { saveSong } from '../../data/repo'
import type { Corners, Page, Song } from '../../data/types'
import { omr, OmrError, type Stage } from '../../omr/engine'
import { readPage } from '../../omr/read-page'
import { pickImages, takePhoto } from '../../platform/camera'
import { pickFiles } from '../../platform/files'
import { useSong } from '../../state/hooks'
import { Bar } from '../../ui/Bar'
import { Button, IconButton } from '../../ui/controls'
import { Screen } from '../../ui/Screen'
import { Sheet } from '../../ui/Sheet'
import { toast } from '../../ui/toast'
import { newPage } from '../songs/useImport'

const FULL: Corners = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
]

export function PagesScreen() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const song = useSong(id)
  const [cropping, setCropping] = useState<Page | null>(null)
  const [reading, setReading] = useState<{ page: number; stage?: Stage } | null>(null)
  const [needModels, setNeedModels] = useState(false)
  const opened = useRef(false)

  const update = async (s: Song, pages: Page[], extra: Partial<Song> = {}) =>
    saveSong({ ...s, ...extra, pages })

  const addPhotos = async (s: Song, photos: string[], replaceId?: string) => {
    if (!photos.length) return
    if (replaceId) {
      await update(
        s,
        s.pages.map((p) => (p.id === replaceId ? { ...newPage(photos[0]!), id: p.id } : p)),
      )
    } else {
      await update(s, [...s.pages, ...photos.map(newPage)])
    }
  }

  // Scan flow: open the camera straight away.
  useEffect(() => {
    if (!song || opened.current || params.get('camera') !== '1') return
    opened.current = true
    setParams({}, { replace: true })
    void takePhoto().then((p) => {
      if (p) void addPhotos(song, [p])
    })
  }, [song, params, setParams])

  if (song === null) return <Navigate to="/" replace />
  if (!song)
    return (
      <Screen title="" back="/">
        {null}
      </Screen>
    )

  const unread = song.pages.filter((p) => p.status !== 'read')
  const leave = async () => {
    if (song.pages.length === 0 && song.score.parts.length === 0) {
      await db.songs.delete(song.id)
      navigate('/', { replace: true })
    } else navigate(song.score.parts.length ? `/song/${song.id}` : '/')
  }

  const move = (i: number, d: -1 | 1) => {
    const pages = [...song.pages]
    const j = i + d
    if (j < 0 || j >= pages.length) return
    ;[pages[i], pages[j]] = [pages[j]!, pages[i]!]
    const order = pages.map((p) => p.id)
    // Keep the notes in page order too.
    const score = song.score.parts.length
      ? replacePage(song.score, order, '', undefined)
      : song.score
    void update(song, pages, { score })
  }

  const remove = async (page: Page) => {
    const pages = song.pages.filter((p) => p.id !== page.id)
    const score = song.score.parts.length
      ? replacePage(
          song.score,
          pages.map((p) => p.id),
          page.id,
          undefined,
        )
      : song.score
    await update(song, pages, { score })
    toast(t('pages.removed'), () => void saveSong(song))
  }

  const readAll = async () => {
    const status = await omr.modelStatus()
    if (!status.installed) return setNeedModels(true)
    let current: Song = song
    for (const [index, page] of current.pages.entries()) {
      if (page.status === 'read') continue
      setReading({ page: index + 1 })
      try {
        const { score, modelVersion } = await readPage(page, index, (stage) =>
          setReading({ page: index + 1, stage }),
        )
        const pages = current.pages.map((p) =>
          p.id === page.id
            ? { ...p, status: 'read' as const, score, modelVersion, error: undefined }
            : p,
        )
        const merged = replacePage(
          current.score.parts.length ? current.score : { ...score, parts: [] },
          pages.map((p) => p.id),
          page.id,
          score,
        )
        current = { ...current, pages, score: { ...merged, title: current.title } }
      } catch (e) {
        const code = e instanceof OmrError ? e.code : 'failed'
        current = {
          ...current,
          pages: current.pages.map((p) =>
            p.id === page.id ? { ...p, status: 'failed' as const, error: code } : p,
          ),
        }
      }
      await saveSong(current)
    }
    setReading(null)
    if (current.pages.every((p) => p.status === 'read'))
      navigate(`/song/${song.id}/edit?review=1`, { replace: true })
    else toast(t('pages.someFailed'))
  }

  return (
    <Screen
      title={t('pages.title')}
      back
      footer={
        <div className="flex flex-col gap-2">
          <div className="flex justify-center gap-1">
            <Button
              icon={<Camera size={20} />}
              onClick={async () => {
                const p = await takePhoto()
                if (p) await addPhotos(song, [p])
              }}
            >
              {t('pages.camera')}
            </Button>
            <Button
              icon={<Images size={20} />}
              onClick={async () => addPhotos(song, await pickImages())}
            >
              {t('pages.gallery')}
            </Button>
            <Button
              icon={<FilePdf size={20} />}
              onClick={async () => {
                const [file] = await pickFiles('application/pdf')
                if (!file) return
                const { pdfToImages } = await import('../../platform/pdf-pages')
                await addPhotos(song, await pdfToImages(file))
              }}
            >
              PDF
            </Button>
          </div>
          {unread.length > 0 ? (
            <Bar disabled={!!reading} onClick={readAll}>
              {reading
                ? t('pages.reading', { page: reading.page, total: song.pages.length })
                : t('pages.readMusic', { count: unread.length })}
            </Bar>
          ) : (
            song.pages.length > 0 && (
              <Bar onClick={() => navigate(`/song/${song.id}`)}>{t('pages.done')}</Bar>
            )
          )}
        </div>
      }
    >
      <label className="mb-4 flex flex-col gap-1">
        <span className="text-ink/60 text-sm font-bold">{t('songs.titleLabel')}</span>
        <input
          defaultValue={song.title}
          onBlur={(e) => {
            const title = e.target.value.trim()
            if (title && title !== song.title)
              void saveSong({ ...song, title, score: { ...song.score, title } })
          }}
          className="bg-ink/6 font-display min-h-14 rounded-2xl px-4 text-xl"
        />
      </label>

      {reading?.stage && (
        <p role="status" className="bg-felt/10 text-felt mb-3 rounded-2xl px-4 py-3 font-semibold">
          {t(`pages.stage.${reading.stage}`)}
        </p>
      )}

      {song.pages.length === 0 && (
        <p className="text-ink/70 py-12 text-center">{t('pages.empty')}</p>
      )}

      <ol className="flex flex-col gap-4">
        {song.pages.map((page, i) => (
          <li
            key={page.id}
            className="ring-stand/60 flex gap-3 rounded-3xl bg-white/80 p-3 ring-1 dark:bg-white/5"
          >
            <div className="bg-stand/40 relative w-28 shrink-0 overflow-hidden rounded-xl">
              <img
                src={page.photo}
                alt={t('pages.pageN', { n: i + 1 })}
                className="aspect-[3/4] w-full object-cover"
                style={{ transform: `rotate(${page.rotation}deg)` }}
              />
              <span className="bg-ink text-paper absolute top-1 left-1 rounded-full px-2 text-sm font-bold">
                {i + 1}
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold">{t('pages.pageN', { n: i + 1 })}</span>
              <span
                className={`text-sm ${page.status === 'failed' ? 'text-alert' : 'text-ink/65'}`}
              >
                {page.status === 'failed'
                  ? t(`pages.error.${page.error ?? 'failed'}`)
                  : t(`pages.status.${page.status}`)}
              </span>
              <div className="mt-auto flex flex-wrap">
                <IconButton
                  label={t('pages.moveUp')}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp size={20} />
                </IconButton>
                <IconButton
                  label={t('pages.moveDown')}
                  disabled={i === song.pages.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown size={20} />
                </IconButton>
                <IconButton label={t('pages.crop')} onClick={() => setCropping(page)}>
                  <Crop size={20} />
                </IconButton>
                <IconButton
                  label={t('pages.rotate')}
                  onClick={() =>
                    void update(
                      song,
                      song.pages.map((p) =>
                        p.id === page.id
                          ? {
                              ...p,
                              rotation: ((p.rotation + 90) % 360) as Page['rotation'],
                              status: p.status === 'read' ? p.status : 'new',
                            }
                          : p,
                      ),
                    )
                  }
                >
                  <ArrowClockwise size={20} />
                </IconButton>
                <IconButton
                  label={t('pages.retake')}
                  onClick={async () => {
                    const p = await takePhoto()
                    if (p) await addPhotos(song, [p], page.id)
                  }}
                >
                  <Camera size={20} />
                </IconButton>
                <IconButton label={t('pages.remove')} onClick={() => void remove(page)}>
                  <Trash size={20} />
                </IconButton>
              </div>
              {page.status === 'read' && (
                <Button
                  className="self-start"
                  onClick={() =>
                    void update(
                      song,
                      song.pages.map((p) => (p.id === page.id ? { ...p, status: 'new' } : p)),
                    )
                  }
                >
                  {t('pages.readAgain')}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ol>
      {song.pages.length > 0 && (
        <Button className="mt-4 w-full" onClick={leave}>
          {t('common.done')}
        </Button>
      )}

      <CropSheet
        page={cropping}
        onClose={() => setCropping(null)}
        onSave={(corners) => {
          if (cropping)
            void update(
              song,
              song.pages.map((p) =>
                p.id === cropping.id
                  ? { ...p, corners, status: p.status === 'read' ? 'new' : p.status }
                  : p,
              ),
            )
          setCropping(null)
        }}
      />
      <ModelsSheet
        open={needModels}
        onClose={() => setNeedModels(false)}
        onInstalled={() => {
          setNeedModels(false)
          void readAll()
        }}
      />
    </Screen>
  )
}

/** Four draggable corners over the photo. Corners are stored as fractions. */
function CropSheet({
  page,
  onClose,
  onSave,
}: {
  page: Page | null
  onClose: () => void
  onSave: (c: Corners) => void
}) {
  const { t } = useTranslation()
  const [corners, setCorners] = useState<Corners>(FULL)
  const box = useRef<HTMLDivElement>(null)
  const dragging = useRef<number | null>(null)
  useEffect(() => setCorners(page?.corners ?? FULL), [page])

  const onMove = (e: React.PointerEvent) => {
    const i = dragging.current
    const el = box.current
    if (i === null || !el) return
    const r = el.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    setCorners((c) => c.map((p, j) => (j === i ? [x, y] : p)) as Corners)
  }

  return (
    <Sheet
      open={!!page}
      onClose={onClose}
      title={t('pages.crop')}
      footer={
        <Bar className="w-full" onClick={() => onSave(corners)}>
          {t('common.save')}
        </Bar>
      }
    >
      {page && (
        <>
          <p className="text-ink/75 mb-3">{t('pages.cropHint')}</p>
          <div
            ref={box}
            className="relative touch-none select-none"
            onPointerMove={onMove}
            onPointerUp={() => (dragging.current = null)}
          >
            <img src={page.photo} alt="" className="w-full rounded-xl" draggable={false} />
            <svg
              className="pointer-events-none absolute inset-0 size-full"
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
              aria-hidden
            >
              <polygon
                points={corners.map((c) => c.join(',')).join(' ')}
                fill="rgb(58 111 143 / 0.15)"
                stroke="var(--color-felt)"
                strokeWidth={0.006}
              />
            </svg>
            {corners.map(([x, y], i) => (
              <button
                key={i}
                type="button"
                aria-label={t('pages.corner', { n: i + 1 })}
                onPointerDown={(e) => {
                  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
                  dragging.current = i
                }}
                onPointerMove={onMove}
                onPointerUp={() => (dragging.current = null)}
                className="border-felt bg-paper/60 absolute size-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-4"
                style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
              />
            ))}
          </div>
          <Button className="mt-2" onClick={() => setCorners(FULL)}>
            {t('pages.resetCrop')}
          </Button>
        </>
      )}
    </Sheet>
  )
}

export function ModelsSheet({
  open,
  onClose,
  onInstalled,
}: {
  open: boolean
  onClose: () => void
  onInstalled: () => void
}) {
  const { t } = useTranslation()
  const [progress, setProgress] = useState<number | null>(null)
  const [size, setSize] = useState<number | undefined>()
  useEffect(() => {
    if (open) void omr.modelStatus().then((s) => setSize(s.downloadBytes))
  }, [open])
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('models.title')}
      footer={
        <Bar
          className="w-full"
          disabled={progress !== null}
          onClick={async () => {
            setProgress(0)
            try {
              await omr.installModels(setProgress)
              onInstalled()
            } catch {
              toast(t('models.failed'))
            } finally {
              setProgress(null)
            }
          }}
        >
          {progress !== null
            ? t('models.downloading', { percent: Math.round(progress * 100) })
            : t('models.download')}
        </Bar>
      }
    >
      <p>{t('models.body', { size: size ? Math.round(size / 1e6) : '?' })}</p>
      {!omr.available && <p className="text-ink/65 mt-3 text-sm">{t('models.devNote')}</p>}
    </Sheet>
  )
}
