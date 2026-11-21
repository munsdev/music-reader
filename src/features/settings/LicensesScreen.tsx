import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import licenses from '../../generated/licenses.json'
import { Screen, Section } from '../../ui/Screen'

/** Assets and data that are not npm packages, with their required attribution. */
const EXTRA = [
  { name: 'Young Serif', license: 'SIL Open Font License 1.1', note: 'Copyright Bastien Sozeau.' },
  {
    name: 'Atkinson Hyperlegible Next',
    license: 'SIL Open Font License 1.1',
    note: 'Copyright Braille Institute of America.',
  },
  { name: 'Phosphor Icons', license: 'MIT', note: '' },
  {
    name: 'oemer (recognition pipeline design)',
    license: 'MIT',
    note: 'Yu-Te Wu and contributors.',
  },
  {
    name: 'DeepScoresV2 (training data for the recognition models)',
    license: 'CC BY 4.0',
    note: 'Tuggener et al., Zurich University of Applied Sciences.',
  },
]

export function LicensesScreen() {
  const { t } = useTranslation()
  const [open, setOpen] = useState<string | null>(null)
  return (
    <Screen title={t('licenses.title')} back="/settings">
      <p className="text-ink/75 mt-2">{t('licenses.intro')}</p>
      <Section title={t('licenses.assets')}>
        <ul>
          {EXTRA.map((e) => (
            <li key={e.name} className="py-2">
              <span className="block font-semibold">{e.name}</span>
              <span className="text-ink/70 block text-sm">
                {[e.license, e.note].filter(Boolean).join('. ')}
              </span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title={t('licenses.packages')}>
        <ul>
          {licenses.map((l) => (
            <li key={l.name} className="border-stand/50 border-b py-2 last:border-0">
              <button
                type="button"
                className="flex min-h-12 w-full items-center justify-between gap-3 text-left"
                aria-expanded={open === l.name}
                onClick={() => setOpen(open === l.name ? null : l.name)}
              >
                <span className="font-semibold">
                  {l.name} <span className="text-ink/60 font-normal">{l.version}</span>
                </span>
                <span className="text-ink/70 shrink-0 text-sm">{l.license}</span>
              </button>
              {open === l.name && l.text && (
                <pre className="bg-ink/5 mt-2 max-h-72 overflow-auto rounded-xl p-3 text-xs whitespace-pre-wrap">
                  {l.text}
                </pre>
              )}
            </li>
          ))}
        </ul>
      </Section>
    </Screen>
  )
}
