import {
  ArrowClockwise,
  ArrowDown,
  ArrowUp,
  Camera,
  Crop,
  FilePdf,
  Images,
  Plus,
  Trash,
} from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { replacePage } from '../../core/edit'
import { saveSong } from '../../data/repo'
import type { Page, Song } from '../../data/types'
import { omr, OmrError, recognitionReady, type Stage } from '../../omr/engine'
import { readPage } from '../../omr/read-page'
import { pickImages, takePhoto } from '../../platform/camera'
import { pickFiles } from '../../platform/files'
import { makePage, pageSrc, refreshView } from '../../platform/pages'
import { useSong } from '../../state/hooks'
import { Bar } from '../../ui/Bar'
import { Screen } from '../../ui/Screen'
import { ActionList, Sheet } from '../../ui/Sheet'
import { toast } from '../../ui/toast'

/** Where a flow should return when finished: back to the stand it came from, or replace. */
export interface FlowState {
  fromStand?: boolean
}

export function hasNotes(song: Song): boolean {
  return song.score.parts.some((p) => p.measures.some((m) => m.events.length > 0))
}

/**
 * Step 1 of adding a song from a songbook: the pages. One primary action at the bottom.
 * Tap a page for crop, rotate, retake, move and remove.
 */
export function PagesScreen() {
  const { id } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state ?? {}) as FlowState
  const song = useSong(id)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [reading, setReading] = useState<{ page: number; stage?: Stage } | null>(null)
  const [needModels, setNeedModels] = useState(false)
  const [busy, setBusy] = useState(false)
  const ready = recognitionReady()

  if (song === null) return <Navigate to="/" replace />
  if (!song)
    return (
      <Screen title="" back>
        {null}
      </Screen>
    )

  const selected = song.pages.find((p) => p.id === selectedId) ?? null
  const save = (pages: Page[], extra: Partial<Song> = {}) => saveSong({ ...song, ...extra, pages })

  const addPhotos = async (photos: string[]) => {
    if (!photos.length) return
    setBusy(true)
    const pages = await Promise.all(photos.map(makePage))
    await save([...song.pages, ...pages])
    setBusy(false)
  }

  const move = (page: Page, d: -1 | 1) => {
    const pages = [...song.pages]
    const i = pages.findIndex((p) => p.id === page.id)
    const j = i + d
    if (i < 0 || j < 0 || j >= pages.length) return
    ;[pages[i], pages[j]] = [pages[j]!, pages[i]!]
    const score = song.score.parts.length
      ? replacePage(
          song.score,
          pages.map((p) => p.id),
          '',
          undefined,
        )
      : song.score
    void save(pages, { score })
  }

  const rotate = async (page: Page) => {
    setBusy(true)
    const rotated = await refreshView({
      ...page,
      rotation: ((page.rotation + 90) % 360) as Page['rotation'],
      status: page.status === 'read' ? 'new' : page.status,
    })
    await save(song.pages.map((p) => (p.id === page.id ? rotated : p)))
    setBusy(false)
  }

  const retake = async (page: Page) => {
    const photo = await takePhoto()
    if (!photo) return
    const fresh = await makePage(photo)
    await save(song.pages.map((p) => (p.id === page.id ? { ...fresh, id: page.id } : p)))
  }

  const remove = async (page: Page) => {
    setSelectedId(null)
    const pages = song.pages.filter((p) => p.id !== page.id)
    const score = song.score.parts.length
      ? replacePage(
          song.score,
          pages.map((p) => p.id),
          page.id,
          undefined,
        )
      : song.score
    await save(pages, { score })
    toast(t('pages.removed'), () => void saveSong(song))
  }

  /** Go to the next step of the flow, replacing this screen so Back stays simple. */
  const go = (path: string) => navigate(path, { replace: true, state })
  const finish = () =>
    state.fromStand ? navigate(-1) : navigate(`/song/${song.id}`, { replace: true })

  const readAll = async () => {
    const status = await omr.modelStatus()
    if (!status.installed) return setNeedModels(true)
    let current: Song = song
    for (const [index, page] of current.pages.entries()) {
      if (page.status === 'read') continue
      setReading({ page: index + 1 })
      try {
        const source = { ...page, photo: pageSrc(page), corners: undefined, rotation: 0 as const }
        const { score, modelVersion } = await readPage(source, index, (stage) =>
          setReading({ page: index + 1, stage }),
        )
        const pages = current.pages.map((p) =>
          p.id === page.id
            ? { ...p, status: 'read' as const, score, modelVersion, error: undefined }
            : p,
        )
        const base = current.score.parts.length ? current.score : { ...score, parts: [] }
        const merged = replacePage(
          base,
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
    if (current.pages.every((p) => p.status === 'read')) go(`/song/${song.id}/edit?review=1`)
    else toast(t('pages.someFailed'))
  }

  const unread = song.pages.filter((p) => p.status !== 'read').length
  const notes = hasNotes(song)
  let primary: { label: string; onClick: () => void }
  if (song.pages.length === 0)
    primary = { label: t('pages.addFirst'), onClick: () => setAdding(true) }
  else if (!ready)
    primary = {
      label: notes ? t('pages.tapMore') : t('pages.tapIn'),
      onClick: () => go(`/write?song=${song.id}`),
    }
  else if (unread > 0)
    primary = {
      label: reading
        ? t('pages.reading', { page: reading.page, total: song.pages.length })
        : t('pages.readMusic', { count: unread }),
      onClick: () => void readAll(),
    }
  else primary = { label: t('pages.backToSong'), onClick: finish }

  return (
    <Screen
      title={t('pages.title')}
      back
      footer={
        <Bar className="w-full" disabled={busy || !!reading} onClick={primary.onClick}>
          {busy ? t('common.loading') : primary.label}
        </Bar>
      }
    >
      <p className="text-ink/70 -mt-1 mb-4">{t('pages.step', { title: song.title })}</p>

      {reading?.stage && (
        <p role="status" className="bg-felt/10 text-felt mb-3 rounded-2xl px-4 py-3 font-semibold">
          {t(`pages.stage.${reading.stage}`)}
        </p>
      )}

      <ol className="grid grid-cols-2 gap-3">
        {song.pages.map((page, i) => (
          <li key={page.id}>
            <button
              type="button"
              onClick={() => setSelectedId(page.id)}
              aria-label={t('pages.pageActions', { n: i + 1 })}
              className="ring-stand/70 relative block w-full overflow-hidden rounded-2xl bg-white ring-1"
            >
              <img
                src={pageSrc(page)}
                alt=""
                className="block aspect-[3/4] w-full object-contain"
              />
              <span className="bg-ink text-paper absolute top-2 left-2 rounded-full px-2.5 py-0.5 text-sm font-bold">
                {i + 1}
              </span>
              {page.corners && (
                <span className="bg-paper/90 text-ink absolute top-2 right-2 rounded-full px-2 py-0.5 text-xs font-bold">
                  {t('pages.cropped')}
                </span>
              )}
              {page.status === 'failed' && (
                <span className="bg-alert absolute inset-x-0 bottom-0 px-2 py-1 text-xs font-bold text-white">
                  {t(`pages.error.${page.error ?? 'failed'}`)}
                </span>
              )}
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="border-stand text-felt flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed font-semibold"
          >
            <Plus size={28} weight="bold" />
            {t('pages.addPage')}
          </button>
        </li>
      </ol>

      {!ready && song.pages.length > 0 && (
        <div className="bg-birch/50 mt-5 rounded-2xl px-4 py-3">
          <p className="font-semibold">{t('pages.noReaderTitle')}</p>
          <p className="text-ink/80 mt-1">{t('pages.noReaderBody')}</p>
        </div>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title={t('pages.addPage')}>
        <ActionList
          items={[
            {
              label: t('pages.camera'),
              icon: <Camera size={22} />,
              onSelect: async () => {
                setAdding(false)
                const p = await takePhoto()
                if (p) await addPhotos([p])
              },
            },
            {
              label: t('pages.gallery'),
              icon: <Images size={22} />,
              onSelect: async () => {
                setAdding(false)
                await addPhotos(await pickImages())
              },
            },
            {
              label: t('pages.pdf'),
              icon: <FilePdf size={22} />,
              onSelect: async () => {
                setAdding(false)
                const [file] = await pickFiles('application/pdf')
                if (!file) return
                const { pdfToImages } = await import('../../platform/pdf-pages')
                await addPhotos(await pdfToImages(file))
              },
            },
          ]}
        />
      </Sheet>

      <Sheet
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={
          selected
            ? t('pages.pageN', { n: song.pages.findIndex((p) => p.id === selected.id) + 1 })
            : ''
        }
      >
        {selected && (
          <>
            <img
              src={pageSrc(selected)}
              alt=""
              className="ring-stand mb-3 max-h-64 w-full rounded-xl bg-white object-contain ring-1"
            />
            <ActionList
              items={[
                {
                  label: t('pages.crop'),
                  icon: <Crop size={22} />,
                  onSelect: () => {
                    setSelectedId(null)
                    navigate(`/song/${song.id}/page/${selected.id}/crop`)
                  },
                },
                {
                  label: t('pages.rotate'),
                  icon: <ArrowClockwise size={22} />,
                  onSelect: () => void rotate(selected),
                },
                {
                  label: t('pages.retake'),
                  icon: <Camera size={22} />,
                  onSelect: () => {
                    setSelectedId(null)
                    void retake(selected)
                  },
                },
                ...(song.pages[0]?.id !== selected.id
                  ? [
                      {
                        label: t('pages.moveUp'),
                        icon: <ArrowUp size={22} />,
                        onSelect: () => move(selected, -1),
                      },
                    ]
                  : []),
                ...(song.pages.at(-1)?.id !== selected.id
                  ? [
                      {
                        label: t('pages.moveDown'),
                        icon: <ArrowDown size={22} />,
                        onSelect: () => move(selected, 1),
                      },
                    ]
                  : []),
                {
                  label: t('pages.remove'),
                  icon: <Trash size={22} />,
                  danger: true,
                  onSelect: () => void remove(selected),
                },
              ]}
            />
          </>
        )}
      </Sheet>
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
    </Sheet>
  )
}
