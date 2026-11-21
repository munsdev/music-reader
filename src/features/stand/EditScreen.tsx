import {
  ArrowArcLeft,
  ArrowArcRight,
  ArrowDown,
  ArrowUp,
  CaretRight,
  Trash,
} from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { FlowState } from './PagesScreen'
import { synth } from '../../audio/synth'
import {
  DURATIONS,
  deleteEvent,
  findEvent,
  makeRest,
  setAlter,
  setDuration,
  setPitch,
  stepPitch,
} from '../../core/edit'
import { buildNotes, noteRange, PALETTES, type InstrumentProfile } from '../../core/instruments'
import type { Score } from '../../core/model'
import { fullName } from '../../core/pitch'
import { saveSong } from '../../data/repo'
import type { Song } from '../../data/types'
import { REVIEW_THRESHOLD } from '../../omr/engine'
import { useLabelSettings, useSong } from '../../state/hooks'
import { Bar } from '../../ui/Bar'
import { Button, IconButton } from '../../ui/controls'
import { Screen } from '../../ui/Screen'
import { CirclesView } from './CirclesView'

/** Every note on a piano keyboard in the default palette, for showing unfitted scores. */
const DISPLAY: InstrumentProfile = {
  id: 'display',
  name: '',
  kind: 'keys',
  polyphony: 'multi',
  notes: buildNotes(noteRange(21, 108, false), PALETTES[0]!),
}

/** Review (after a scan) and note editing: select a note, fix pitch, accidental or length. */
export function EditScreen() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const review = params.get('review') === '1'
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const song = useSong(id)
  const labels = useLabelSettings()
  const [selected, setSelected] = useState<string | null>(null)
  const [undo, setUndo] = useState<Score[]>([])
  const [redo, setRedo] = useState<Score[]>([])

  const toCheck = useMemo(() => {
    if (!song) return []
    return song.score.parts.flatMap((p) =>
      p.measures.flatMap((m) =>
        m.events
          .filter(
            (e) => e.recognition && e.recognition.confidence < REVIEW_THRESHOLD && !e.userEdited,
          )
          .map((e) => e.id),
      ),
    )
  }, [song])

  if (song === null) return <Navigate to="/" replace />
  if (!song)
    return (
      <Screen title="" back>
        {null}
      </Screen>
    )

  const found = selected ? findEvent(song.score, selected) : undefined
  const event = found?.event
  const page = event?.recognition ? song.pages[event.recognition.box.page] : song.pages[0]

  const apply = (fn: (s: Score) => Score) => {
    const next = fn(song.score)
    setUndo((u) => [...u.slice(-49), song.score])
    setRedo([])
    void saveSong({ ...song, score: next })
    const e = selected ? findEvent(next, selected)?.event : undefined
    if (e?.pitch) synth.strike(e.pitch.midi, 'piano')
  }
  const restore = (
    from: Score[],
    to: (s: Score[]) => void,
    other: (f: (s: Score[]) => Score[]) => void,
  ) => {
    const last = from.at(-1)
    if (!last) return
    to(from.slice(0, -1))
    other((o) => [...o, song.score])
    void saveSong({ ...song, score: last })
  }

  const checkNext = () => {
    const i = selected ? toCheck.indexOf(selected) : -1
    const id = toCheck[(i + 1) % toCheck.length]
    if (id) setSelected(id)
  }

  return (
    <Screen
      title={review ? t('edit.reviewTitle') : t('edit.title')}
      back
      actions={
        <>
          <IconButton
            label={t('edit.undo')}
            disabled={!undo.length}
            onClick={() => restore(undo, setUndo, setRedo)}
          >
            <ArrowArcLeft size={22} />
          </IconButton>
          <IconButton
            label={t('edit.redo')}
            disabled={!redo.length}
            onClick={() => restore(redo, setRedo, setUndo)}
          >
            <ArrowArcRight size={22} />
          </IconButton>
        </>
      }
      footer={
        event ? (
          <NotePanel song={song} id={event.id} apply={apply} onClose={() => setSelected(null)} />
        ) : (
          <Bar
            className="w-full"
            onClick={() =>
              (location.state as FlowState | null)?.fromStand
                ? navigate(-1)
                : navigate(`/song/${song.id}`, { replace: true })
            }
          >
            {review ? t('edit.looksGood') : t('common.done')}
          </Bar>
        )
      }
    >
      {review && (
        <p className="text-ink/75 mb-3">
          {toCheck.length ? t('edit.reviewHint') : t('edit.reviewAllGood')}
        </p>
      )}
      {toCheck.length > 0 && (
        <Button
          variant="outline"
          className="bg-check/15 mb-3"
          onClick={checkNext}
          icon={<CaretRight size={20} />}
        >
          {t('edit.toCheck', { count: toCheck.length })}
        </Button>
      )}

      {page && (
        <div className="ring-stand relative mb-4 overflow-hidden rounded-2xl bg-white ring-1">
          <img src={page.view ?? page.photo} alt={t('edit.photoAlt')} className="w-full" />
          {song.score.parts[0]?.measures.flatMap((m) =>
            m.events
              .filter((e) => e.recognition && song.pages[e.recognition.box.page] === page)
              .map((e) => {
                const b = e.recognition!.box
                const low = e.recognition!.confidence < REVIEW_THRESHOLD && !e.userEdited
                return (
                  <button
                    key={e.id}
                    type="button"
                    aria-label={e.pitch ? fullName(e.pitch) : t('stand.rest')}
                    onClick={() => setSelected(e.id)}
                    className={`absolute rounded-md border-2 ${e.id === selected ? 'border-felt bg-felt/20' : low ? 'border-check bg-check/15' : 'border-transparent'}`}
                    style={{
                      left: `${b.x * 100}%`,
                      top: `${b.y * 100}%`,
                      width: `${b.width * 100}%`,
                      height: `${b.height * 100}%`,
                      minWidth: 24,
                      minHeight: 24,
                    }}
                  />
                )
              }),
          )}
        </div>
      )}

      <CirclesView
        score={song.score}
        instrument={DISPLAY}
        labels={{ ...labels, style: labels.style === 'numbers' ? 'letters' : labels.style }}
        current={new Set(selected ? [selected] : [])}
        next={new Set(toCheck)}
        size="m"
        onNote={(eid, midi) => {
          setSelected(eid)
          if (midi !== undefined) synth.strike(midi, 'piano')
        }}
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => apply((s) => shiftAll(s, 12))}>
          {t('edit.allUp')}
        </Button>
        <Button variant="outline" onClick={() => apply((s) => shiftAll(s, -12))}>
          {t('edit.allDown')}
        </Button>
      </div>
    </Screen>
  )
}

function shiftAll(score: Score, semis: number): Score {
  return {
    ...score,
    parts: score.parts.map((p) => ({
      ...p,
      measures: p.measures.map((m) => ({
        ...m,
        events: m.events.map((e) =>
          e.pitch
            ? {
                ...e,
                pitch: {
                  ...e.pitch,
                  octave: e.pitch.octave + semis / 12,
                  midi: e.pitch.midi + semis,
                },
              }
            : e,
        ),
      })),
    })),
  }
}

function NotePanel({
  song,
  id,
  apply,
  onClose,
}: {
  song: Song
  id: string
  apply: (fn: (s: Score) => Score) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const found = findEvent(song.score, id)
  if (!found) return null
  const e = found.event
  const current = DURATIONS.find((d) => d.ticks === e.duration)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-display text-2xl">
          {e.pitch ? fullName(e.pitch) : t('stand.rest')}
        </span>
        <Button onClick={onClose}>{t('common.done')}</Button>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <IconButton
          label={t('edit.stepUp')}
          className="ring-stand ring-1"
          onClick={() => apply((s) => (e.pitch ? stepPitch(s, id, 1) : setPitch(s, id, 67)))}
        >
          <ArrowUp size={22} />
        </IconButton>
        <IconButton
          label={t('edit.stepDown')}
          className="ring-stand ring-1"
          onClick={() => apply((s) => (e.pitch ? stepPitch(s, id, -1) : setPitch(s, id, 67)))}
        >
          <ArrowDown size={22} />
        </IconButton>
        {[
          { a: 1, l: '♯', n: t('edit.sharp') },
          { a: 0, l: '♮', n: t('edit.natural') },
          { a: -1, l: '♭', n: t('edit.flat') },
        ].map((x) => (
          <IconButton
            key={x.a}
            label={x.n}
            active={e.pitch?.alter === x.a}
            disabled={!e.pitch}
            className="ring-stand text-2xl ring-1"
            onClick={() => apply((s) => setAlter(s, id, x.a))}
          >
            {x.l}
          </IconButton>
        ))}
        <Button variant="outline" onClick={() => apply((s) => makeRest(s, id))} disabled={!e.pitch}>
          {t('edit.makeRest')}
        </Button>
        <IconButton
          label={t('common.delete')}
          className="text-alert"
          onClick={() => {
            apply((s) => deleteEvent(s, id))
            onClose()
          }}
        >
          <Trash size={22} />
        </IconButton>
      </div>
      <div role="radiogroup" aria-label={t('edit.length')} className="flex flex-wrap gap-1">
        {DURATIONS.map((d) => (
          <button
            key={`${d.type}${d.dots}`}
            type="button"
            role="radio"
            aria-checked={current === d}
            onClick={() => apply((s) => setDuration(s, id, d.ticks, d.type, d.dots))}
            className={`min-h-11 rounded-full px-3 text-sm font-semibold ${current === d ? 'bg-ink text-paper' : 'bg-ink/6'}`}
          >
            {t(`durations.${d.type}${d.dots ? 'Dotted' : ''}`)}
          </button>
        ))}
      </div>
    </div>
  )
}
