import { Microphone, Plus } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { hzToMidi, listen, StrikeDetector, type Listener } from '../../audio/pitch-detect'
import { synth } from '../../audio/synth'
import { colorName } from '../../core/color-names'
import { PALETTES, shapeFor, type InstrumentNote } from '../../core/instruments'
import { fromMidi, noteName } from '../../core/pitch'
import { saveInstrument } from '../../data/repo'
import { useInstrument, useLabelSettings } from '../../state/hooks'
import { useSettings } from '../../state/settings'
import { Bar } from '../../ui/Bar'
import { Button } from '../../ui/controls'
import { InstrumentView } from '../../ui/InstrumentView'
import { Screen } from '../../ui/Screen'
import { toast } from '../../ui/toast'

interface Heard {
  hz: number
  midi: number
  cents: number
}

/**
 * Set up an instrument by ear: strike a bar, the app hears its pitch, you tap the bar's color.
 * Each bar keeps its measured frequency, so toys that are out of tune still match.
 */
export function ListenSetupScreen() {
  const { id } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const inst = useInstrument(id)
  const labels = useLabelSettings()
  const naming = useSettings((s) => s.naming)
  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState<Heard | null>(null)
  const [notes, setNotes] = useState<InstrumentNote[]>([])
  const [level, setLevel] = useState(false)
  const listener = useRef<Listener | null>(null)
  const heardRef = useRef<Heard | null>(null)

  useEffect(() => {
    heardRef.current = heard
  }, [heard])

  useEffect(() => () => listener.current?.stop(), [])

  if (inst === null) return <Navigate to="/instruments" replace />
  if (!inst)
    return (
      <Screen title="" back>
        {null}
      </Screen>
    )

  const start = async () => {
    const detector = new StrikeDetector(5, 35)
    try {
      listener.current = await listen((hz) => {
        setLevel(hz !== null)
        // Wait for the color answer before taking the next bar.
        if (heardRef.current) return
        const found = detector.push(hz)
        if (!found) return
        const exact = hzToMidi(found)
        const midi = Math.round(exact)
        setHeard({ hz: found, midi, cents: Math.round((exact - midi) * 100) })
      })
      setListening(true)
    } catch {
      toast(t('stand.micDenied'))
    }
  }

  const stop = () => {
    listener.current?.stop()
    listener.current = null
    setListening(false)
  }

  const choose = (color: string) => {
    if (!heard) return
    // Two bars that round to the same note: move the new one a step toward its real pitch.
    let midi = heard.midi
    const taken = new Map(notes.map((n) => [n.midi, n]))
    const clash = taken.get(midi)
    if (clash && clash.color !== color) midi += heard.cents >= 0 ? 1 : -1
    const note: InstrumentNote = { midi, color, shape: shapeFor(midi), hz: heard.hz }
    setNotes((list) =>
      [...list.filter((n) => n.midi !== midi), note].sort((a, b) => a.midi - b.midi),
    )
    synth.strike(midi, inst.sound, 0, 0.8, heard.hz)
    setHeard(null)
  }

  const save = async () => {
    stop()
    await saveInstrument({ ...inst, notes })
    toast(t('listen.saved', { count: notes.length }))
    navigate(-1)
  }

  const swatches = [
    ...new Set([...inst.notes.map((n) => n.color), ...PALETTES.flatMap((p) => p.colors)]),
  ]
  const tuning = (c: number) =>
    Math.abs(c) <= 10
      ? t('listen.inTune')
      : c > 0
        ? t('listen.sharp', { cents: c })
        : t('listen.flat', { cents: -c })
  const preview = { ...inst, notes }

  return (
    <Screen
      title={t('listen.title')}
      back
      footer={
        <div className="flex flex-col gap-2">
          <Bar className="w-full" disabled={notes.length < 2} onClick={save}>
            {t('listen.save', { count: notes.length })}
          </Bar>
          {notes.length > 0 && (
            <Button onClick={() => setNotes([])}>{t('listen.startOver')}</Button>
          )}
        </div>
      }
    >
      <p className="text-ink/75 mb-4">{t('listen.intro')}</p>

      {!listening ? (
        <Bar
          tone="birch"
          className="w-full"
          icon={<Microphone size={24} weight="bold" />}
          onClick={start}
        >
          {t('listen.start')}
        </Bar>
      ) : heard ? (
        <div
          className="ring-stand rounded-3xl bg-white/80 p-4 ring-1 dark:bg-white/6"
          role="status"
        >
          <p className="text-ink/60 text-sm font-semibold">{t('listen.heard')}</p>
          <p className="font-display text-4xl">{noteName(fromMidi(heard.midi), naming)}</p>
          <p className="text-ink/70">{tuning(heard.cents)}</p>
          <h2 className="mt-4 mb-2 font-semibold">{t('listen.whichColor')}</h2>
          <div className="flex flex-wrap gap-2">
            {swatches.map((c) => {
              const n = colorName(c)
              return (
                <button
                  key={c}
                  type="button"
                  aria-label={
                    t(`colors.${n.name}`) +
                    (n.tone !== 'normal' ? ` (${t(`colors.${n.tone}`)})` : '')
                  }
                  onClick={() => choose(c)}
                  className="ring-ink/15 size-12 rounded-full ring-1"
                  style={{ background: c }}
                />
              )
            })}
            <label
              className="ring-stand relative flex size-12 cursor-pointer items-center justify-center rounded-full ring-2"
              title={t('instruments.customColor')}
            >
              <span className="sr-only">{t('instruments.customColor')}</span>
              <Plus size={18} aria-hidden />
              <input
                type="color"
                onChange={(e) => choose(e.target.value.toUpperCase())}
                className="absolute inset-0 opacity-0"
              />
            </label>
          </div>
          <Button className="mt-3" onClick={() => setHeard(null)}>
            {t('listen.skip')}
          </Button>
        </div>
      ) : (
        <div
          className="bg-felt/10 text-felt flex items-center gap-3 rounded-3xl p-4 font-semibold"
          role="status"
        >
          <span className={`size-4 rounded-full ${level ? 'bg-felt' : 'bg-felt/30'}`} aria-hidden />
          {notes.length === 0 ? t('listen.strikeFirst') : t('listen.strikeNext')}
          <Button className="ml-auto" onClick={stop}>
            {t('listen.pause')}
          </Button>
        </div>
      )}

      {notes.length > 0 && (
        <div className="mt-5">
          <h2 className="text-ink/60 mb-2 text-sm font-bold">
            {t('listen.soFar', { count: notes.length })}
          </h2>
          <InstrumentView
            instrument={preview}
            labels={labels}
            height={170}
            onStrike={(m) =>
              synth.strike(m, inst.sound, 0, 0.8, notes.find((n) => n.midi === m)?.hz)
            }
          />
        </div>
      )}
    </Screen>
  )
}
