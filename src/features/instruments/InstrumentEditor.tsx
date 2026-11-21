import { Microphone, Minus, Plus, Printer } from '@phosphor-icons/react'
import { colorName } from '../../core/color-names'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { synth } from '../../audio/synth'
import {
  applyPalette,
  colorFor,
  PALETTES,
  shapeFor,
  shiftOctave,
  type InstrumentNote,
  type NoteShape,
} from '../../core/instruments'
import { fromMidi, fullName, pitchClass } from '../../core/pitch'
import { shapePath } from '../../core/shapes'
import { saveInstrument } from '../../data/repo'
import type { Instrument, SoundKind } from '../../data/types'
import { printFonts } from '../../platform/fonts'
import { safeFileName, shareFile } from '../../platform/files'
import { useInstrument, useLabelSettings } from '../../state/hooks'
import { resolvePaper, useSettings } from '../../state/settings'
import { Bar } from '../../ui/Bar'
import { Button, IconButton, Select, Switch } from '../../ui/controls'
import { InstrumentView } from '../../ui/InstrumentView'
import { Screen, Section } from '../../ui/Screen'
import { Sheet } from '../../ui/Sheet'

const SHAPES: NoteShape[] = [
  'circle',
  'square',
  'triangle',
  'diamond',
  'star',
  'hexagon',
  'heart',
  'ring',
]
const BLACK = [1, 3, 6, 8, 10]

export function InstrumentEditor() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const welcome = params.get('welcome') === '1'
  const { t } = useTranslation()
  const navigate = useNavigate()
  const inst = useInstrument(id)
  const labels = useLabelSettings()
  const paper = useSettings((s) => s.paper)
  const setSettings = useSettings((s) => s.set)
  const [selected, setSelected] = useState<number | null>(null)

  if (inst === null) return <Navigate to="/instruments" replace />
  if (!inst)
    return (
      <Screen title="" back>
        {null}
      </Screen>
    )

  const save = (patch: Partial<Instrument>) => void saveInstrument({ ...inst, ...patch })
  const setNotes = (notes: InstrumentNote[]) =>
    save({ notes: [...notes].sort((a, b) => a.midi - b.midi) })
  const chromatic = inst.notes.some((n) => BLACK.includes(pitchClass(n.midi)))
  const palette = PALETTES.find((p) => inst.notes.every((n) => n.color === colorFor(n.midi, p)))

  const step = (from: number, dir: 1 | -1) => {
    let m = from + dir
    if (!chromatic) while (BLACK.includes(pitchClass(m))) m += dir
    return m
  }
  const addEnd = (top: boolean) => {
    const edge = top ? inst.notes.at(-1)!.midi : inst.notes[0]!.midi
    const midi = step(edge, top ? 1 : -1)
    if (midi < 21 || midi > 108) return
    setNotes([
      ...inst.notes,
      { midi, color: colorFor(midi, palette ?? PALETTES[0]!), shape: shapeFor(midi) },
    ])
  }
  const removeEnd = (top: boolean) =>
    inst.notes.length > 1 && setNotes(top ? inst.notes.slice(0, -1) : inst.notes.slice(1))
  const note = inst.notes.find((n) => n.midi === selected)

  return (
    <Screen
      title={inst.name}
      back={welcome ? undefined : '/instruments'}
      footer={
        welcome ? (
          <Bar
            className="w-full"
            onClick={() => {
              setSettings({ onboarded: true })
              navigate('/', { replace: true })
            }}
          >
            {t('onboarding.saveInstrument')}
          </Bar>
        ) : undefined
      }
    >
      {welcome && <p className="text-ink/75 mb-3">{t('onboarding.matchColors')}</p>}
      <InstrumentView
        instrument={inst}
        labels={labels}
        selected={selected ?? undefined}
        onStrike={(m) =>
          synth.strike(m, inst.sound, 0, 0.8, inst.notes.find((n) => n.midi === m)?.hz)
        }
        onSelect={(m) => setSelected(m)}
        height={220}
      />
      <p className="text-ink/65 mt-2 text-center text-sm">{t('instruments.tapToEdit')}</p>
      <Bar
        tone="birch"
        className="mt-3 w-full"
        icon={<Microphone size={22} weight="bold" />}
        onClick={() => navigate(`/instruments/${inst.id}/listen`)}
      >
        {t('listen.open')}
      </Bar>
      <p className="text-ink/65 mt-1 text-center text-sm">{t('listen.openHint')}</p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <EndControl
          label={t('instruments.lowEnd')}
          onAdd={() => addEnd(false)}
          onRemove={() => removeEnd(false)}
        />
        <EndControl
          label={t('instruments.highEnd')}
          onAdd={() => addEnd(true)}
          onRemove={() => removeEnd(true)}
        />
      </div>

      <Section title={t('instruments.about')}>
        <label className="flex min-h-14 items-center justify-between gap-4">
          <span className="font-semibold">{t('instruments.name')}</span>
          <input
            defaultValue={inst.name}
            onBlur={(e) => e.target.value.trim() && save({ name: e.target.value.trim() })}
            className="bg-ink/5 min-h-12 w-1/2 rounded-xl px-3 text-right font-semibold"
          />
        </label>
        <Select
          label={t('instruments.kind')}
          value={inst.kind}
          onChange={(kind) => save({ kind })}
          options={(['bars', 'keys', 'tubes', 'bells'] as const).map((k) => ({
            value: k,
            label: t(`kinds.${k}`),
          }))}
        />
        <Select
          label={t('instruments.sound')}
          value={inst.sound}
          onChange={(sound: SoundKind) => {
            save({ sound })
            synth.strike(inst.notes[0]!.midi, sound)
          }}
          options={(['xylophone', 'glockenspiel', 'bells', 'tubes', 'piano'] as const).map((k) => ({
            value: k,
            label: t(`sounds.${k}`),
          }))}
        />
        <Switch
          label={t('instruments.chords')}
          hint={t('instruments.chordsHint')}
          checked={inst.polyphony === 'multi'}
          onChange={(v) => save({ polyphony: v ? 'multi' : 'single' })}
        />
      </Section>

      <Section title={t('instruments.colors')}>
        <Select
          label={t('instruments.palette')}
          value={palette?.id ?? 'custom'}
          onChange={(pid) => {
            const p = PALETTES.find((x) => x.id === pid)
            if (p) save({ notes: applyPalette(inst, p).notes })
          }}
          options={[
            ...PALETTES.map((p) => ({ value: p.id, label: t(`palettes.${p.id}`) })),
            ...(palette ? [] : [{ value: 'custom', label: t('palettes.custom') }]),
          ]}
        />
        <div className="flex min-h-14 items-center justify-between">
          <span className="font-semibold">{t('instruments.octave')}</span>
          <div className="flex gap-1">
            <IconButton
              label={t('instruments.octaveDown')}
              className="ring-stand ring-1"
              disabled={inst.notes[0]!.midi - 12 < 21}
              onClick={() => save({ notes: shiftOctave(inst, -1).notes })}
            >
              <Minus size={20} />
            </IconButton>
            <IconButton
              label={t('instruments.octaveUp')}
              className="ring-stand ring-1"
              disabled={inst.notes.at(-1)!.midi + 12 > 108}
              onClick={() => save({ notes: shiftOctave(inst, 1).notes })}
            >
              <Plus size={20} />
            </IconButton>
          </div>
        </div>
        <p className="text-ink/65 pb-2 text-sm">
          {t('instruments.range', {
            low: fullName(fromMidi(inst.notes[0]!.midi)),
            high: fullName(fromMidi(inst.notes.at(-1)!.midi)),
          })}
        </p>
      </Section>

      <Button
        variant="outline"
        className="mt-6 w-full"
        icon={<Printer size={20} />}
        onClick={async () => {
          const { buildStickerSheet } = await import('../../print/pdf')
          const bytes = await buildStickerSheet(
            inst,
            { paper: resolvePaper(paper), labels },
            await printFonts(),
          )
          await shareFile(`${safeFileName(inst.name)}-stickers.pdf`, bytes, 'application/pdf')
        }}
      >
        {t('instruments.stickers')}
      </Button>

      <Sheet
        open={!!note}
        onClose={() => setSelected(null)}
        title={note ? fullName(fromMidi(note.midi)) : ''}
      >
        {note && (
          <NoteEditor
            note={note}
            taken={inst.notes.map((n) => n.midi)}
            onChange={(n) => {
              setNotes(inst.notes.map((x) => (x.midi === note.midi ? n : x)))
              if (n.midi !== note.midi) {
                setSelected(n.midi)
                synth.strike(n.midi, inst.sound)
              }
            }}
          />
        )}
      </Sheet>
    </Screen>
  )
}

function EndControl({
  label,
  onAdd,
  onRemove,
}: {
  label: string
  onAdd: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="bg-ink/5 flex items-center justify-between rounded-2xl py-1 pr-1 pl-3">
      <span className="text-sm font-semibold">{label}</span>
      <span className="flex">
        <IconButton label={`${label}: ${t('instruments.removeBar')}`} onClick={onRemove}>
          <Minus size={20} />
        </IconButton>
        <IconButton label={`${label}: ${t('instruments.addBar')}`} onClick={onAdd}>
          <Plus size={20} />
        </IconButton>
      </span>
    </div>
  )
}

function NoteEditor({
  note,
  taken,
  onChange,
}: {
  note: InstrumentNote
  taken: number[]
  onChange: (n: InstrumentNote) => void
}) {
  const { t } = useTranslation()
  const colorLabel = (c: string) => {
    const n = colorName(c)
    return t(`colors.${n.name}`) + (n.tone !== 'normal' ? ` (${t(`colors.${n.tone}`)})` : '')
  }
  const free = (m: number) => m >= 21 && m <= 108 && (m === note.midi || !taken.includes(m))
  const move = (d: number) => {
    let m = note.midi + d
    while (!free(m) && m >= 21 && m <= 108) m += d
    if (free(m)) onChange({ ...note, midi: m, shape: shapeFor(m), hz: undefined })
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{t('instruments.pitch')}</span>
        <div className="flex items-center gap-1">
          <IconButton
            label={t('edit.stepDown')}
            className="ring-stand ring-1"
            onClick={() => move(-1)}
          >
            <Minus size={20} />
          </IconButton>
          <span className="min-w-16 text-center text-lg font-bold">
            {fullName(fromMidi(note.midi))}
          </span>
          <IconButton
            label={t('edit.stepUp')}
            className="ring-stand ring-1"
            onClick={() => move(1)}
          >
            <Plus size={20} />
          </IconButton>
        </div>
      </div>
      <div>
        <h3 className="mb-2 font-semibold">{t('instruments.color')}</h3>
        <div className="flex flex-wrap gap-2">
          {[...new Set(PALETTES.flatMap((p) => p.colors))].map((c) => (
            <button
              key={c}
              type="button"
              aria-label={colorLabel(c)}
              aria-pressed={note.color === c}
              onClick={() => onChange({ ...note, color: c })}
              className={`size-11 rounded-full ${note.color === c ? 'ring-ink ring-offset-paper ring-3 ring-offset-2' : ''}`}
              style={{ background: c }}
            />
          ))}
          <label
            className="ring-stand relative flex size-11 cursor-pointer items-center justify-center rounded-full ring-2"
            title={t('instruments.customColor')}
          >
            <span className="sr-only">{t('instruments.customColor')}</span>
            <Plus size={18} aria-hidden />
            <input
              type="color"
              value={note.color}
              onChange={(e) => onChange({ ...note, color: e.target.value.toUpperCase() })}
              className="absolute inset-0 opacity-0"
            />
          </label>
        </div>
      </div>
      <div>
        <h3 className="mb-2 font-semibold">{t('instruments.shape')}</h3>
        <div role="radiogroup" aria-label={t('instruments.shape')} className="flex flex-wrap gap-2">
          {SHAPES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={note.shape === s}
              aria-label={t(`shapes.${s}`)}
              onClick={() => onChange({ ...note, shape: s })}
              className={`flex size-12 items-center justify-center rounded-2xl ${note.shape === s ? 'bg-ink text-paper' : 'bg-ink/6'}`}
            >
              <svg width="22" height="22" viewBox="-11 -11 22 22" aria-hidden>
                <path
                  d={shapePath(s, 8)}
                  fill={s === 'ring' ? 'none' : 'currentColor'}
                  stroke={s === 'ring' ? 'currentColor' : 'none'}
                  strokeWidth={2}
                />
              </svg>
            </button>
          ))}
        </div>
      </div>
      <label className="flex flex-col gap-1">
        <span className="font-semibold">{t('instruments.sticker')}</span>
        <span className="text-ink/65 text-sm">{t('instruments.stickerHint')}</span>
        <input
          value={note.label ?? ''}
          maxLength={3}
          onChange={(e) => onChange({ ...note, label: e.target.value || undefined })}
          className="bg-ink/5 min-h-12 rounded-xl px-3 text-lg font-bold"
        />
      </label>
    </div>
  )
}
