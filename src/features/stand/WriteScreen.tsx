import {
  Backspace,
  CaretLeft,
  CaretRight,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  Play,
} from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Player } from '../../audio/player'
import { synth } from '../../audio/synth'
import { appendNote, DURATIONS, emptyScore, removeLastNote } from '../../core/edit'
import type { Score } from '../../core/model'
import { buildTimeline } from '../../core/timeline'
import { db } from '../../data/db'
import { newSong, saveSong } from '../../data/repo'
import type { Song } from '../../data/types'
import { pageSrc } from '../../platform/pages'
import { pickInstrument, useInstruments, useLabelSettings, useSong } from '../../state/hooks'
import { useSettings } from '../../state/settings'
import { Button, IconButton } from '../../ui/controls'
import { InstrumentView } from '../../ui/InstrumentView'
import { Screen } from '../../ui/Screen'
import { CirclesView } from './CirclesView'
import type { FlowState } from './PagesScreen'

const player = new Player()

/**
 * Tap in a song on the instrument. With ?song=<id> it adds to that song and shows its page
 * photos above the bars, so a parent can copy the notes from a songbook page.
 */
export function WriteScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const flow = (location.state ?? {}) as FlowState
  const [params] = useSearchParams()
  const songId = params.get('song') ?? undefined
  const existing = useSong(songId)
  const instruments = useInstruments()
  const lastId = useSettings((s) => s.lastInstrumentId)
  const labels = useLabelSettings()
  const [song, setSong] = useState<Song | null>(null)
  const [duration, setDuration] = useState(DURATIONS[4]!)
  const [title, setTitle] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const [zoom, setZoom] = useState(1)
  // Latest song, updated synchronously so fast taps never see a stale copy.
  const latest = useRef<Song | null>(null)
  const queue = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    if (existing && !latest.current) {
      latest.current = existing
      setSong(existing)
    }
  }, [existing])

  const instrument = pickInstrument(song ?? existing ?? undefined, instruments, lastId)
  const score: Score = useMemo(() => {
    const s = song?.score
    return s && s.parts.length ? s : emptyScore(song?.title ?? (title || t('write.untitled')))
  }, [song, title, t])

  if (songId && existing === null) return <Navigate to="/" replace />
  if (!instrument || (songId && !song))
    return (
      <Screen title={t('write.title')} back>
        {null}
      </Screen>
    )

  const commit = (edit: (current: Score) => Score) => {
    const prev = latest.current
    const name = prev?.title ?? (title.trim() || t('write.untitled'))
    const base = prev?.score.parts.length ? prev.score : emptyScore(name)
    const next = edit(base)
    const s: Song = prev
      ? { ...prev, score: { ...next, title: prev.title } }
      : { ...newSong(name, { ...next, title: name }), lastInstrumentId: instrument.id }
    latest.current = s
    setSong(s)
    queue.current = queue.current.then(async () => {
      if (prev) await saveSong(s)
      else await db.songs.add(s)
    })
  }

  const done = () => {
    if (!song) return navigate(-1)
    if (flow.fromStand) navigate(-1)
    else navigate(`/song/${song.id}`, { replace: true })
  }

  const pages = song?.pages ?? []
  const page = pages[Math.min(pageIndex, pages.length - 1)]
  const hasNotes = score.parts[0]?.measures.some((m) => m.events.length > 0) ?? false
  const lastId2 = score.parts[0]?.measures.flatMap((m) => m.events).at(-1)?.id

  return (
    <Screen
      title={songId ? song!.title : t('write.title')}
      back
      actions={
        <Button onClick={done} disabled={!hasNotes}>
          {t('common.done')}
        </Button>
      }
      footer={
        <div className="flex flex-col gap-2">
          <div
            role="radiogroup"
            aria-label={t('edit.length')}
            className="flex flex-wrap justify-center gap-1"
          >
            {DURATIONS.map((d) => (
              <button
                key={`${d.type}${d.dots}`}
                type="button"
                role="radio"
                aria-checked={duration === d}
                onClick={() => setDuration(d)}
                className={`min-h-12 rounded-full px-3 text-sm font-semibold ${duration === d ? 'bg-ink text-paper' : 'bg-ink/6'}`}
              >
                {t(`durations.${d.type}${d.dots ? 'Dotted' : ''}`)}
              </button>
            ))}
          </div>
          <InstrumentView
            instrument={instrument}
            labels={labels}
            height={150}
            onStrike={(midi) => {
              synth.strike(midi, instrument.sound)
              commit((sc) => appendNote(sc, midi, duration))
            }}
          />
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => commit((sc) => appendNote(sc, undefined, duration))}
            >
              {t('write.rest')}
            </Button>
            <IconButton
              label={t('write.backspace')}
              disabled={!hasNotes}
              onClick={() => commit(removeLastNote)}
            >
              <Backspace size={24} />
            </IconButton>
            <Button
              className="ml-auto"
              icon={<Play size={22} weight="fill" />}
              disabled={!hasNotes}
              onClick={() => {
                player.load(buildTimeline(score))
                player.configure({ sound: instrument.sound, countIn: false })
                player.play()
              }}
            >
              {t('write.listen')}
            </Button>
          </div>
        </div>
      }
    >
      {!songId && (
        <label className="mb-3 flex flex-col gap-1">
          <span className="text-ink/60 text-sm font-bold">{t('songs.titleLabel')}</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              const name = title.trim()
              const prev = latest.current
              if (prev && name && name !== prev.title) {
                const s = { ...prev, title: name, score: { ...prev.score, title: name } }
                latest.current = s
                setSong(s)
                void saveSong(s)
              }
            }}
            placeholder={t('write.untitled')}
            className="bg-ink/6 font-display min-h-14 rounded-2xl px-4 text-xl"
          />
        </label>
      )}

      {page && (
        <div className="mb-3">
          <div className="ring-stand max-h-[38dvh] overflow-auto rounded-2xl bg-white ring-1">
            <img
              src={pageSrc(page)}
              alt={t('pages.pageN', { n: pageIndex + 1 })}
              style={{ width: `${zoom * 100}%`, maxWidth: 'none' }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between">
            <div className="flex">
              <IconButton
                label={t('write.zoomOut')}
                disabled={zoom <= 1}
                onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
              >
                <MagnifyingGlassMinus size={22} />
              </IconButton>
              <IconButton
                label={t('write.zoomIn')}
                disabled={zoom >= 3}
                onClick={() => setZoom((z) => Math.min(3, z + 0.5))}
              >
                <MagnifyingGlassPlus size={22} />
              </IconButton>
            </div>
            {pages.length > 1 && (
              <div className="flex items-center">
                <IconButton
                  label={t('write.prevPage')}
                  disabled={pageIndex === 0}
                  onClick={() => setPageIndex((i) => i - 1)}
                >
                  <CaretLeft size={22} />
                </IconButton>
                <span className="text-sm font-semibold tabular-nums">
                  {pageIndex + 1} / {pages.length}
                </span>
                <IconButton
                  label={t('write.nextPage')}
                  disabled={pageIndex >= pages.length - 1}
                  onClick={() => setPageIndex((i) => i + 1)}
                >
                  <CaretRight size={22} />
                </IconButton>
              </div>
            )}
          </div>
        </div>
      )}

      {hasNotes ? (
        <CirclesView
          score={score}
          instrument={instrument}
          labels={labels}
          current={new Set(lastId2 ? [lastId2] : [])}
          next={new Set()}
          size="s"
          onNote={(_, m) => m !== undefined && synth.strike(m, instrument.sound)}
        />
      ) : (
        <p className="text-ink/70 py-6 text-center">
          {page ? t('write.hintPhoto') : t('write.hint')}
        </p>
      )}
    </Screen>
  )
}
