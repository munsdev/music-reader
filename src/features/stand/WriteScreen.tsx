import { Backspace, Play } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Player } from '../../audio/player'
import { synth } from '../../audio/synth'
import { appendNote, DURATIONS, emptyScore, removeLastNote } from '../../core/edit'
import { buildTimeline } from '../../core/timeline'
import { db } from '../../data/db'
import { newSong, saveSong } from '../../data/repo'
import type { Song } from '../../data/types'
import { pickInstrument, useInstruments, useLabelSettings } from '../../state/hooks'
import { useSettings } from '../../state/settings'
import { Bar } from '../../ui/Bar'
import { Button, IconButton } from '../../ui/controls'
import { InstrumentView } from '../../ui/InstrumentView'
import { Screen } from '../../ui/Screen'
import { CirclesView } from './CirclesView'

const player = new Player()

/** Write a song by tapping the instrument. */
export function WriteScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const instruments = useInstruments()
  const lastId = useSettings((s) => s.lastInstrumentId)
  const instrument = pickInstrument(undefined, instruments, lastId)
  const labels = useLabelSettings()
  const [song, setSong] = useState<Song | null>(null)
  // Latest song, updated synchronously so fast taps never see a stale copy.
  const latest = useRef<Song | null>(null)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const [duration, setDuration] = useState(DURATIONS[4]!)
  const [title, setTitle] = useState('')
  const score = song?.score ?? emptyScore(title || t('write.untitled'))

  const commit = (edit: (current: typeof score) => typeof score) => {
    const name = title.trim() || t('write.untitled')
    const prev = latest.current
    const next = edit(prev?.score ?? emptyScore(name))
    const s: Song = prev
      ? { ...prev, title: name, score: { ...next, title: name } }
      : { ...newSong(name, { ...next, title: name }), lastInstrumentId: instrument?.id }
    latest.current = s
    setSong(s)
    // Writes run in order; the first one creates the song.
    queue.current = queue.current.then(async () => {
      if (prev) await saveSong(s)
      else await db.songs.add(s)
    })
  }

  if (!instrument)
    return (
      <Screen title={t('write.title')} back="/">
        {null}
      </Screen>
    )

  return (
    <Screen
      title={t('write.title')}
      back="/"
      footer={
        <div className="flex flex-col gap-3">
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
                className={`min-h-11 rounded-full px-3 text-sm font-semibold ${duration === d ? 'bg-ink text-paper' : 'bg-ink/6'}`}
              >
                {t(`durations.${d.type}${d.dots ? 'Dotted' : ''}`)}
              </button>
            ))}
          </div>
          <InstrumentView
            instrument={instrument}
            labels={labels}
            height={170}
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
            <IconButton label={t('write.backspace')} onClick={() => commit(removeLastNote)}>
              <Backspace size={24} />
            </IconButton>
            <IconButton
              label={t('stand.play')}
              onClick={() => {
                player.load(buildTimeline(score))
                player.configure({ sound: instrument.sound })
                player.play()
              }}
            >
              <Play size={24} weight="fill" />
            </IconButton>
            <Bar
              tone="birch"
              className="ml-auto px-10"
              disabled={!song}
              onClick={() => song && navigate(`/song/${song.id}`, { replace: true })}
            >
              {t('common.done')}
            </Bar>
          </div>
        </div>
      }
    >
      <label className="mb-4 flex flex-col gap-1">
        <span className="text-ink/60 text-sm font-bold">{t('songs.titleLabel')}</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => song && commit((sc) => sc)}
          placeholder={t('write.untitled')}
          className="bg-ink/6 font-display min-h-14 rounded-2xl px-4 text-xl"
        />
      </label>
      {score.parts[0]?.measures.some((m) => m.events.length) ? (
        <CirclesView
          score={score}
          instrument={instrument}
          labels={labels}
          current={new Set()}
          next={new Set()}
          size="m"
          onNote={(_, m) => m !== undefined && synth.strike(m, instrument.sound)}
        />
      ) : (
        <p className="text-ink/70 py-10 text-center">{t('write.hint')}</p>
      )}
    </Screen>
  )
}
