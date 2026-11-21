import {
  ArrowCounterClockwise,
  CaretDown,
  DotsThreeVertical,
  Files,
  Faders,
  Gauge,
  HandTap,
  Microphone,
  MicrophoneSlash,
  Pause,
  PencilSimple,
  Play,
  Printer,
} from '@phosphor-icons/react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { listen, matchesNote, type Listener } from '../../audio/pitch-detect'
import { synth } from '../../audio/synth'
import { saveSong } from '../../data/repo'
import type { Instrument } from '../../data/types'
import {
  pickInstrument,
  useFit,
  useInstruments,
  useLabelSettings,
  useSong,
} from '../../state/hooks'
import { useSettings } from '../../state/settings'
import { Button, IconButton, Segmented, Stepper, Switch } from '../../ui/controls'
import { InstrumentThumb, InstrumentView } from '../../ui/InstrumentView'
import { Screen } from '../../ui/Screen'
import { ActionList, Sheet } from '../../ui/Sheet'
import { toast } from '../../ui/toast'
import { CirclesView, type CircleSize } from './CirclesView'
import { FitSheet } from './FitSheet'
import { PrintSheet } from './PrintSheet'
const StaffView = lazy(() => import('./StaffView').then((m) => ({ default: m.StaffView })))
import { UpcomingLane } from './StripView'
import { idsAt, midisAt, nextIndex, usePlayback, type PracticeMode } from './usePlayback'

type View = 'circles' | 'staff' | 'strip'

export function StandScreen() {
  const { id } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const song = useSong(id)
  const instruments = useInstruments()
  const lastInstrumentId = useSettings((s) => s.lastInstrumentId)
  const setSettings = useSettings((s) => s.set)
  const labels = useLabelSettings()
  const instrument = pickInstrument(song, instruments, lastInstrumentId)
  const fit = useFit(song, instrument)
  const sound = instrument?.sound ?? 'xylophone'
  const pb = usePlayback(fit?.score, sound)

  const [view, setView] = useState<View>('circles')
  const [size, setSize] = useState<CircleSize>('m')
  const [mode, setMode] = useState<PracticeMode>('listen')
  const [sheet, setSheet] = useState<
    null | 'menu' | 'instrument' | 'fit' | 'print' | 'playback' | 'practice'
  >(null)
  const [mic, setMic] = useState(false)
  const listener = useRef<Listener | null>(null)

  const waiting = mode === 'wait' || mode === 'tap'
  const current = useMemo(() => idsAt(pb.timeline, pb.index), [pb.timeline, pb.index])
  const nextI = nextIndex(pb.timeline, pb.index)
  const next = useMemo(
    () => (waiting || pb.playing ? idsAt(pb.timeline, nextI) : new Set<string>()),
    [pb.timeline, nextI, waiting, pb.playing],
  )
  const expected = midisAt(pb.timeline, pb.index)

  const { setOptions, pause, setIndex } = pb
  // Follow mode: clicks and cursor, the child plays the notes.
  useEffect(() => {
    setOptions(mode === 'follow' ? { muted: true, metronome: true } : { muted: false })
    if (mode === 'wait' || mode === 'tap') {
      pause()
      setIndex(0)
    }
  }, [mode, setOptions, pause, setIndex])

  const advance = () => {
    const n = nextIndex(pb.timeline, pb.index)
    if (n < 0) {
      toast(t('stand.finished'))
      pb.setIndex(0)
    } else pb.setIndex(n)
  }
  const advanceRef = useRef(advance)
  const expectedRef = useRef(expected)
  useEffect(() => {
    advanceRef.current = advance
    expectedRef.current = expected
  })

  // Microphone listening for Wait for me.
  useEffect(() => {
    if (!(mode === 'wait' && mic)) return
    let hits = 0
    let cooldown = 0
    let stopped = false
    listen((hz) => {
      const now = performance.now()
      if (!hz || now < cooldown) return (hits = 0)
      if (expectedRef.current.some((m) => matchesNote(hz, m))) hits++
      else hits = 0
      if (hits >= 3) {
        hits = 0
        cooldown = now + 280
        advanceRef.current()
      }
    })
      .then((l) => (stopped ? l.stop() : (listener.current = l)))
      .catch(() => {
        setMic(false)
        toast(t('stand.micDenied'))
      })
    return () => {
      stopped = true
      listener.current?.stop()
      listener.current = null
    }
  }, [mode, mic, t])

  if (song === null) return <Navigate to="/" replace />
  if (!song || !instruments)
    return (
      <Screen title="" back="/">
        {null}
      </Screen>
    )
  if (song.pages.length && song.score.parts.length === 0)
    return <Navigate to={`/song/${song.id}/pages`} replace />
  if (!instrument || !fit) {
    return (
      <Screen title={song.title} back="/">
        <p className="py-10 text-center">{t('stand.noInstrument')}</p>
        <Button onClick={() => navigate('/instruments/new')}>{t('instruments.new')}</Button>
      </Screen>
    )
  }

  const chooseInstrument = async (i: Instrument) => {
    setSheet(null)
    setSettings({ lastInstrumentId: i.id })
    await saveSong({ ...song, lastInstrumentId: i.id })
  }

  const strike = (midi: number) => {
    synth.strike(midi, sound)
    if (waiting && expected.includes(midi)) advance()
  }

  const onNote = (eventId: string, midi: number | undefined) => {
    if (midi !== undefined) synth.strike(midi, sound)
    const i = pb.timeline.notes.findIndex((n) => n.ids.includes(eventId))
    if (i >= 0) pb.seekNote(i)
  }

  const playingMidis = pb.playing || waiting ? expected : []
  const showInstrument = view === 'strip' || waiting
  const tick = pb.timeline.notes[pb.index]?.tick ?? -1

  return (
    <Screen
      title={song.title}
      back="/"
      actions={
        <IconButton label={t('common.more')} onClick={() => setSheet('menu')}>
          <DotsThreeVertical size={24} weight="bold" />
        </IconButton>
      }
      footer={
        <div className="flex flex-col gap-3">
          {showInstrument && (
            <InstrumentView
              instrument={instrument}
              labels={labels}
              active={pb.playing ? playingMidis : []}
              next={waiting ? expected : pb.playing ? midisAt(pb.timeline, nextI) : []}
              onStrike={strike}
              height={view === 'strip' ? 260 : 150}
            />
          )}
          <div className="flex items-center gap-2">
            <IconButton
              label={t('stand.restart')}
              onClick={() => (waiting ? pb.setIndex(0) : pb.restart())}
            >
              <ArrowCounterClockwise size={24} />
            </IconButton>
            {waiting ? (
              <Button variant="outline" className="flex-1" onClick={advance}>
                {t('stand.nextNote')}
              </Button>
            ) : (
              <button
                type="button"
                aria-label={pb.playing ? t('stand.pause') : t('stand.play')}
                onClick={() => (pb.playing ? pb.pause() : pb.play())}
                className="bg-felt mx-auto flex size-16 items-center justify-center rounded-full text-white shadow-[inset_0_-3px_0_rgb(0_0_0/0.25)] active:translate-y-0.5"
              >
                {pb.playing ? <Pause size={30} weight="fill" /> : <Play size={30} weight="fill" />}
              </button>
            )}
            {mode === 'wait' && (
              <IconButton
                label={mic ? t('stand.micOff') : t('stand.micOn')}
                active={mic}
                onClick={() => setMic(!mic)}
              >
                {mic ? <Microphone size={24} /> : <MicrophoneSlash size={24} />}
              </IconButton>
            )}
            <IconButton
              label={t('stand.practice')}
              active={mode !== 'listen'}
              onClick={() => setSheet('practice')}
            >
              <HandTap size={24} />
            </IconButton>
            <IconButton label={t('stand.playback')} onClick={() => setSheet('playback')}>
              <Gauge size={24} />
            </IconButton>
          </div>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSheet('instrument')}
          className="bg-ink/5 flex min-h-12 items-center gap-2 rounded-2xl py-1 pr-3 pl-1.5 font-semibold"
          aria-label={t('stand.changeInstrument', { name: instrument.name })}
        >
          <InstrumentThumb instrument={instrument} height={36} />
          <span className="max-w-40 truncate">{instrument.name}</span>
          <CaretDown size={16} weight="bold" />
        </button>
        <button
          type="button"
          onClick={() => setSheet('fit')}
          className={`min-h-12 rounded-2xl px-3 font-semibold ${fit.changes.length ? 'bg-check/20' : 'bg-ink/5'}`}
        >
          {t('stand.fitChip', { percent: Math.round(fit.fit * 100) })}
        </button>
      </div>

      <Segmented
        label={t('stand.view')}
        value={view}
        onChange={setView}
        options={[
          { value: 'circles', label: t('stand.circles') },
          { value: 'staff', label: t('stand.staff') },
          { value: 'strip', label: t('stand.strip') },
        ]}
      />
      {mode !== 'listen' && (
        <p className="bg-felt/10 text-felt mt-3 rounded-2xl px-4 py-2 text-sm font-semibold">
          {t(`practice.${mode}Active`)}
        </p>
      )}

      <div className="mt-4">
        {view === 'circles' && (
          <CirclesView
            score={fit.score}
            instrument={instrument}
            labels={labels}
            current={current}
            next={next}
            size={size}
            onNote={onNote}
          />
        )}
        {view === 'staff' && (
          <Suspense
            fallback={<p className="text-ink/60 py-10 text-center">{t('common.loading')}</p>}
          >
            <StaffView
              score={fit.score}
              instrument={instrument}
              labels={labels}
              tick={tick}
              zoom={size === 's' ? 0.8 : size === 'm' ? 1 : size === 'l' ? 1.25 : 1.5}
            />
          </Suspense>
        )}
        {view === 'strip' && (
          <div className="flex min-h-48 items-center">
            <UpcomingLane
              timeline={pb.timeline}
              index={pb.index}
              instrument={instrument}
              labels={labels}
            />
          </div>
        )}
      </div>

      <Sheet open={sheet === 'menu'} onClose={() => setSheet(null)} title={song.title}>
        <ActionList
          items={[
            {
              label: t('stand.fitTitle'),
              icon: <Faders size={22} />,
              onSelect: () => setSheet('fit'),
            },
            {
              label: t('stand.print'),
              icon: <Printer size={22} />,
              onSelect: () => setSheet('print'),
            },
            {
              label: t('stand.editNotes'),
              icon: <PencilSimple size={22} />,
              onSelect: () => navigate(`/song/${song.id}/edit`),
            },
            {
              label: t('stand.pages'),
              icon: <Files size={22} />,
              onSelect: () => navigate(`/song/${song.id}/pages`),
            },
          ]}
        />
      </Sheet>

      <Sheet
        open={sheet === 'instrument'}
        onClose={() => setSheet(null)}
        title={t('stand.chooseInstrument')}
      >
        <ActionList
          items={[
            ...instruments.map((i) => ({
              label: i.name + (i.id === instrument.id ? `  ✓` : ''),
              icon: <InstrumentThumb instrument={i} height={32} />,
              onSelect: () => void chooseInstrument(i),
            })),
            { label: t('instruments.new'), onSelect: () => navigate('/instruments/new') },
          ]}
        />
      </Sheet>

      <FitSheet
        open={sheet === 'fit'}
        onClose={() => setSheet(null)}
        song={song}
        instrument={instrument}
        fit={fit}
      />
      <PrintSheet
        open={sheet === 'print'}
        onClose={() => setSheet(null)}
        song={song}
        instrument={instrument}
        score={fit.score}
        timeline={pb.timeline}
      />

      <Sheet open={sheet === 'playback'} onClose={() => setSheet(null)} title={t('stand.playback')}>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="flex justify-between font-semibold">
              {t('stand.tempo')}
              <output className="tabular-nums">{Math.round(pb.options.rate * 100)}%</output>
            </span>
            <input
              type="range"
              min={40}
              max={150}
              step={5}
              value={Math.round(pb.options.rate * 100)}
              onChange={(e) => pb.setOptions({ rate: Number(e.target.value) / 100 })}
              className="accent-felt h-12"
            />
          </label>
          <Switch
            label={t('stand.countIn')}
            checked={pb.options.countIn}
            onChange={(v) => pb.setOptions({ countIn: v })}
          />
          <Switch
            label={t('stand.metronome')}
            checked={pb.options.metronome}
            onChange={(v) => pb.setOptions({ metronome: v })}
          />
          <LoopControls
            count={pb.timeline.measures.length}
            loop={pb.options.loop}
            onChange={(loop) => pb.setOptions({ loop })}
          />
          <div>
            <h3 className="text-ink/60 mb-1.5 text-sm font-bold">{t('stand.size')}</h3>
            <Segmented
              label={t('stand.size')}
              value={size}
              onChange={setSize}
              options={[
                { value: 's', label: 'S' },
                { value: 'm', label: 'M' },
                { value: 'l', label: 'L' },
                { value: 'xl', label: 'XL' },
              ]}
            />
          </div>
        </div>
      </Sheet>

      <Sheet open={sheet === 'practice'} onClose={() => setSheet(null)} title={t('stand.practice')}>
        <ul className="flex flex-col gap-2">
          {(['listen', 'follow', 'wait', 'tap'] as const).map((m) => (
            <li key={m}>
              <button
                type="button"
                aria-pressed={mode === m}
                onClick={() => {
                  setMode(m)
                  if (m !== 'wait') setMic(false)
                  setSheet(null)
                }}
                className={`w-full rounded-2xl px-4 py-3 text-left ${mode === m ? 'bg-felt/12 ring-felt ring-2' : 'bg-ink/5'}`}
              >
                <span className="block font-bold">{t(`practice.${m}`)}</span>
                <span className="text-ink/70 block text-sm">{t(`practice.${m}Hint`)}</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </Screen>
  )
}

function LoopControls({
  count,
  loop,
  onChange,
}: {
  count: number
  loop?: [number, number]
  onChange: (l?: [number, number]) => void
}) {
  const { t } = useTranslation()
  return (
    <div>
      <Switch
        label={t('stand.loop')}
        hint={t('stand.loopHint')}
        checked={!!loop}
        onChange={(v) => onChange(v ? [0, Math.min(1, count - 1)] : undefined)}
      />
      {loop && (
        <div className="mt-1 flex flex-col gap-2">
          <Stepper
            label={t('stand.loopFrom')}
            value={loop[0] + 1}
            min={1}
            max={loop[1] + 1}
            onChange={(v) => onChange([v - 1, loop[1]])}
          />
          <Stepper
            label={t('stand.loopTo')}
            value={loop[1] + 1}
            min={loop[0] + 1}
            max={count}
            onChange={(v) => onChange([loop[0], v - 1])}
          />
        </div>
      )}
    </div>
  )
}
