import {
  ArrowCounterClockwise,
  CaretRight,
  Files,
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
import { listen, matchesHz, matchesNote, type Listener } from '../../audio/pitch-detect'
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
import { Button, Segmented, Stepper, Switch } from '../../ui/controls'
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
  const tuning = useMemo(
    () =>
      new Map((instrument?.notes ?? []).flatMap((n) => (n.hz ? [[n.midi, n.hz] as const] : []))),
    [instrument],
  )
  const pb = usePlayback(fit?.score, sound, tuning)

  const [view, setView] = useState<View>('circles')
  const [size, setSize] = useState<CircleSize>('m')
  const [mode, setMode] = useState<PracticeMode>('listen')
  const [sheet, setSheet] = useState<
    null | 'menu' | 'instrument' | 'fit' | 'print' | 'playback' | 'practice'
  >(null)
  const [mic, setMic] = useState(false)
  const listener = useRef<Listener | null>(null)
  const [countIn, setCountIn] = useState<number | null>(null)
  const [wrong, setWrong] = useState<number | undefined>()
  const countTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => countTimers.current.forEach(clearTimeout), [])

  // A song keeps the instrument it was first shown with, so adding instruments never changes it.
  useEffect(() => {
    if (song && instrument && !song.lastInstrumentId)
      void saveSong({ ...song, lastInstrumentId: instrument.id })
  }, [song, instrument])

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
  const tuningRef = useRef(tuning)
  useEffect(() => {
    advanceRef.current = advance
    expectedRef.current = expected
    tuningRef.current = tuning
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
      if (
        expectedRef.current.some((m) => {
          const measured = tuningRef.current.get(m)
          return measured ? matchesHz(hz, measured) : matchesNote(hz, m)
        })
      )
        hits++
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

  /** Play, showing the count-in beats so the pause before the first note is not silent. */
  const startPlay = () => {
    countTimers.current.forEach(clearTimeout)
    const first = pb.timeline.measures[0]
    if (pb.options.countIn && first && pb.index <= 0) {
      const beat = (first.beatDuration / pb.options.rate) * 1000
      for (let i = 0; i < first.beats; i++)
        countTimers.current.push(setTimeout(() => setCountIn(i + 1), 50 + i * beat))
      countTimers.current.push(setTimeout(() => setCountIn(null), 50 + first.beats * beat))
    }
    pb.play()
  }

  const strike = (midi: number) => {
    synth.strike(midi, sound, 0, 0.8, tuning.get(midi))
    if (!waiting) return
    if (expected.includes(midi)) advance()
    else {
      setWrong(midi)
      setTimeout(() => setWrong(undefined), 450)
    }
  }

  const onNote = (eventId: string, midi: number | undefined) => {
    if (midi !== undefined) synth.strike(midi, sound, 0, 0.8, tuning.get(midi))
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
      footer={
        <div className="flex flex-col gap-3">
          {showInstrument && (
            <InstrumentView
              instrument={instrument}
              labels={labels}
              active={pb.playing ? playingMidis : []}
              next={waiting ? expected : pb.playing ? midisAt(pb.timeline, nextI) : []}
              onStrike={strike}
              wrong={wrong}
              height={view === 'strip' ? 260 : 150}
            />
          )}
          <div className="flex items-end justify-between gap-1">
            <LabeledButton
              label={t('stand.restart')}
              short={t('stand.restartShort')}
              icon={<ArrowCounterClockwise size={24} />}
              onClick={() => (waiting ? pb.setIndex(0) : pb.restart())}
            />
            {waiting ? (
              <Button variant="outline" className="mb-1 flex-1" onClick={advance}>
                {t('stand.nextNote')}
              </Button>
            ) : (
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  aria-label={pb.playing ? t('stand.pause') : t('stand.play')}
                  onClick={() => (pb.playing ? pb.pause() : startPlay())}
                  className="bg-felt flex size-16 items-center justify-center rounded-full text-white shadow-[inset_0_-3px_0_rgb(0_0_0/0.25)] active:translate-y-0.5"
                >
                  {pb.playing ? (
                    <Pause size={30} weight="fill" />
                  ) : (
                    <Play size={30} weight="fill" />
                  )}
                </button>
                <span aria-hidden className="mt-0.5 text-xs font-semibold">
                  {pb.playing ? t('stand.pause') : t('stand.play')}
                </span>
              </div>
            )}
            {mode === 'wait' && (
              <LabeledButton
                label={mic ? t('stand.micOff') : t('stand.micOn')}
                short={mic ? t('stand.micOnShort') : t('stand.micOffShort')}
                active={mic}
                icon={mic ? <Microphone size={24} /> : <MicrophoneSlash size={24} />}
                onClick={() => setMic(!mic)}
              />
            )}
            <LabeledButton
              label={t('stand.practice')}
              short={t('stand.practiceShort')}
              active={mode !== 'listen'}
              icon={<HandTap size={24} />}
              onClick={() => setSheet('practice')}
            />
            <LabeledButton
              label={t('stand.playback')}
              short={t('stand.playbackShort')}
              icon={<Gauge size={24} />}
              onClick={() => setSheet('playback')}
            />
          </div>
        </div>
      }
    >
      <button
        type="button"
        onClick={() => setSheet('instrument')}
        className="bg-ink/5 mb-2 flex min-h-12 w-full items-center gap-3 rounded-2xl py-1.5 pr-3 pl-1.5 text-left font-semibold"
        aria-label={t('stand.changeInstrument', { name: instrument.name })}
      >
        <InstrumentThumb instrument={instrument} height={36} />
        <span className="min-w-0 flex-1 leading-tight">{instrument.name}</span>
        <span className="text-felt text-sm">{t('stand.change')}</span>
      </button>
      <div className="mb-3 grid grid-cols-3 gap-2">
        <Chip
          icon={<Files size={20} />}
          label={t('stand.pages')}
          onClick={() => navigate(`/song/${song.id}/pages`, { state: { fromStand: true } })}
        />
        <Chip
          icon={<PencilSimple size={20} />}
          label={t('stand.fixNotes')}
          onClick={() => navigate(`/song/${song.id}/edit`, { state: { fromStand: true } })}
        />
        <Chip
          icon={<Printer size={20} />}
          label={t('stand.printShort')}
          onClick={() => setSheet('print')}
        />
      </div>
      {fit.changes.length > 0 && (
        <button
          type="button"
          onClick={() => setSheet('fit')}
          className="bg-check/20 mb-3 flex min-h-12 w-full items-center justify-between rounded-2xl px-4 text-left font-semibold"
        >
          {t('stand.fitChanges', { count: fit.changes.length })}
          <CaretRight size={18} weight="bold" />
        </button>
      )}

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
      <p
        className="bg-felt/10 text-felt mt-3 rounded-2xl px-4 py-2 text-sm font-semibold"
        role="status"
      >
        {countIn !== null ? t('stand.countInBeat', { n: countIn }) : t(`practice.${mode}Active`)}
      </p>

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

function LabeledButton({
  label,
  short,
  icon,
  onClick,
  active,
}: {
  label: string
  short?: string
  icon: React.ReactNode
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-h-16 min-w-16 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 ${active ? 'bg-felt/12 text-felt' : 'text-ink'}`}
    >
      {icon}
      <span aria-hidden className="text-xs leading-tight font-semibold">
        {short ?? label}
      </span>
    </button>
  )
}

function Chip({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-ink/5 flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-sm font-semibold"
    >
      {icon}
      {label}
    </button>
  )
}
