import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { InstrumentProfile } from '../../core/instruments'
import { labelFor, type LabelSettings } from '../../core/labels'
import { TICKS_PER_QUARTER, type Score } from '../../core/model'
import { writeMusicXml } from '../../core/musicxml-writer'
import { fromMidi } from '../../core/pitch'

/**
 * Real notation with colored noteheads and the labels written under the notes,
 * engraved by OpenSheetMusicDisplay. The cursor follows playback by time.
 */
export function StaffView({
  score,
  instrument,
  labels,
  tick,
  zoom,
}: {
  score: Score
  instrument: InstrumentProfile
  labels: LabelSettings
  /** Song tick of the current note, or -1. */
  tick: number
  zoom: number
}) {
  const { t } = useTranslation()
  const host = useRef<HTMLDivElement>(null)
  const osmd = useRef<OpenSheetMusicDisplay | null>(null)
  const [error, setError] = useState(false)
  const colors = useMemo(
    () => new Map(instrument.notes.map((n) => [n.midi, n.color])),
    [instrument],
  )

  const xml = useMemo(
    () =>
      writeMusicXml(
        { ...score, title: '' },
        {
          colorFor: (m) => colors.get(m),
          labelFor: (m) => labelFor(m, instrument, labels, fromMidi(m)) || undefined,
        },
      ),
    [score, colors, instrument, labels],
  )

  useEffect(() => {
    const el = host.current
    if (!el) return
    const o = new OpenSheetMusicDisplay(el, {
      autoResize: true,
      backend: 'svg',
      drawTitle: false,
      drawSubtitle: false,
      drawComposer: false,
      drawPartNames: false,
      drawMeasureNumbers: true,
      coloringMode: 0,
      coloringEnabled: true,
      colorStemsLikeNoteheads: true,
      followCursor: true,
      cursorsOptions: [
        {
          type: 0,
          color: getComputedStyle(document.documentElement).getPropertyValue('--color-felt').trim(),
          alpha: 0.35,
          follow: true,
        },
      ],
    })
    osmd.current = o
    let cancelled = false
    setError(false)
    o.load(xml)
      .then(() => {
        if (cancelled) return
        o.zoom = zoom
        o.render()
        o.cursor.show()
      })
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
      el.innerHTML = ''
      osmd.current = null
    }
  }, [xml, zoom])

  // Move the cursor to the current note's time.
  useEffect(() => {
    const o = osmd.current
    if (!o?.cursor || !o.IsReadyToRender()) return
    try {
      const cursor = o.cursor
      const target = Math.max(0, tick) / (TICKS_PER_QUARTER * 4)
      const now = cursor.Iterator.currentTimeStamp.RealValue
      if (target < now - 1e-6) cursor.reset()
      while (
        !cursor.Iterator.EndReached &&
        cursor.Iterator.currentTimeStamp.RealValue < target - 1e-6
      )
        cursor.next()
    } catch {
      /* cursor not ready yet */
    }
  }, [tick])

  if (error) return <p className="text-ink/70 py-10 text-center">{t('stand.staffError')}</p>
  return <div ref={host} className="-mx-2 rounded-2xl bg-white" />
}
