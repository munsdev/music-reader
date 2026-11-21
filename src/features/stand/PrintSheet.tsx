import { FilePdf, FileText, MusicNotesSimple } from '@phosphor-icons/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Score } from '../../core/model'
import { writeMidi } from '../../core/midi'
import { writeMusicXml } from '../../core/musicxml-writer'
import type { Timeline } from '../../core/timeline'
import type { Instrument, Song } from '../../data/types'
import { printFonts } from '../../platform/fonts'
import { safeFileName, shareFile } from '../../platform/files'
import type { Ink, Paper, PrintSize } from '../../print/pdf'
import { resolvePaper, useSettings } from '../../state/settings'
import { useLabelSettings } from '../../state/hooks'
import { Bar } from '../../ui/Bar'
import { Button, Segmented, Switch } from '../../ui/controls'
import { Sheet } from '../../ui/Sheet'
import { toast } from '../../ui/toast'

export function PrintSheet({
  open,
  onClose,
  song,
  instrument,
  score,
  timeline,
}: {
  open: boolean
  onClose: () => void
  song: Song
  instrument: Instrument
  score: Score
  timeline: Timeline
}) {
  const { t } = useTranslation()
  const labels = useLabelSettings()
  const paperSetting = useSettings((s) => s.paper)
  const [paper, setPaper] = useState<Paper>(resolvePaper(paperSetting))
  const [size, setSize] = useState<PrintSize>('large')
  const [ink, setInk] = useState<Ink>('color')
  const [legend, setLegend] = useState(true)
  const [numbers, setNumbers] = useState(false)
  const [nameLine, setNameLine] = useState(true)
  const [busy, setBusy] = useState(false)
  const file = safeFileName(song.title)

  const makePdf = async () => {
    setBusy(true)
    try {
      const { buildPdf } = await import('../../print/pdf')
      const bytes = await buildPdf(
        song.title,
        song.composer,
        score,
        instrument,
        {
          paper,
          size,
          ink,
          legend,
          measureNumbers: numbers,
          nameLine,
          labels,
          text: {
            page: (n, total) => t('print.pageOf', { n, total }),
            name: t('print.name'),
            madeWith: t('print.madeWith'),
          },
        },
        await printFonts(),
      )
      await shareFile(`${file}.pdf`, bytes, 'application/pdf', song.title)
    } catch {
      toast(t('print.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('print.title')}
      footer={
        <Bar
          className="w-full"
          icon={<FilePdf size={24} weight="bold" />}
          disabled={busy}
          onClick={makePdf}
        >
          {busy ? t('print.making') : t('print.makePdf')}
        </Bar>
      }
    >
      <div className="flex flex-col gap-4">
        <Group label={t('print.paper')}>
          <Segmented
            label={t('print.paper')}
            value={paper}
            onChange={setPaper}
            options={[
              { value: 'a4', label: 'A4' },
              { value: 'letter', label: 'US Letter' },
            ]}
          />
        </Group>
        <Group label={t('print.size')}>
          <Segmented
            label={t('print.size')}
            value={size}
            onChange={setSize}
            options={[
              { value: 'regular', label: t('print.regular') },
              { value: 'large', label: t('print.large') },
              { value: 'xl', label: t('print.xl') },
            ]}
          />
        </Group>
        <Group label={t('print.ink')}>
          <Segmented
            label={t('print.ink')}
            value={ink}
            onChange={setInk}
            options={[
              { value: 'color', label: t('print.color') },
              { value: 'light', label: t('print.light') },
              { value: 'bw', label: t('print.bw') },
            ]}
          />
        </Group>
        <div>
          <Switch
            label={t('print.legend')}
            hint={t('print.legendHint')}
            checked={legend}
            onChange={setLegend}
          />
          <Switch label={t('print.nameLine')} checked={nameLine} onChange={setNameLine} />
          <Switch label={t('print.measureNumbers')} checked={numbers} onChange={setNumbers} />
        </div>
        <div>
          <h3 className="text-ink/60 mb-1 text-sm font-bold">{t('print.otherFormats')}</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              icon={<FileText size={20} />}
              onClick={() =>
                void shareFile(
                  `${file}.musicxml`,
                  writeMusicXml(score, {
                    colorFor: (m) => instrument.notes.find((n) => n.midi === m)?.color,
                  }),
                  'application/vnd.recordare.musicxml+xml',
                  song.title,
                )
              }
            >
              MusicXML
            </Button>
            <Button
              variant="outline"
              icon={<MusicNotesSimple size={20} />}
              onClick={() =>
                void shareFile(`${file}.mid`, writeMidi(timeline), 'audio/midi', song.title)
              }
            >
              MIDI
            </Button>
          </div>
        </div>
      </div>
    </Sheet>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-ink/60 mb-1.5 text-sm font-bold">{label}</h3>
      {children}
    </div>
  )
}
