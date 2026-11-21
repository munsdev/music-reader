import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { loadTips, tip, tipsAvailable, type TipOffer } from '../../platform/tips'
import { Bar } from '../../ui/Bar'
import { Sheet } from '../../ui/Sheet'
import { toast } from '../../ui/toast'

/**
 * Optional tips. A grown-up check comes first (Play Families policy): a simple sum that
 * a young child is unlikely to answer.
 */
export function SupportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const [offers, setOffers] = useState<TipOffer[] | null>(null)
  const [gate] = useState(() => ({
    a: 6 + Math.floor(Math.random() * 7),
    b: 5 + Math.floor(Math.random() * 7),
  }))
  const [answer, setAnswer] = useState('')
  const passed = Number(answer) === gate.a * gate.b

  useEffect(() => {
    if (open && passed && tipsAvailable()) void loadTips().then(setOffers)
  }, [open, passed])

  return (
    <Sheet open={open} onClose={onClose} title={t('support.title')}>
      <p>{t('support.body')}</p>
      {!passed ? (
        <label className="mt-4 flex flex-col gap-2">
          <span className="font-semibold">{t('support.gate', { a: gate.a, b: gate.b })}</span>
          <input
            inputMode="numeric"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="bg-ink/6 min-h-14 rounded-2xl px-4 text-xl"
            aria-label={t('support.gateLabel')}
          />
        </label>
      ) : !tipsAvailable() ? (
        <p className="text-ink/70 mt-4">{t('support.unavailable')}</p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {offers === null && <p>{t('common.loading')}</p>}
          {offers?.map((o) => (
            <Bar
              key={o.id}
              tone="birch"
              onClick={async () => {
                try {
                  await tip(o.id)
                  toast(t('support.thanks'))
                  onClose()
                } catch (e) {
                  toast(String((e as Error).message))
                }
              }}
            >
              {t(`support.${o.id}`, { price: o.price })}
            </Bar>
          ))}
        </div>
      )}
    </Sheet>
  )
}
