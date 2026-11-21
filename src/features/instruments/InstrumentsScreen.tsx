import { Copy, DotsThreeVertical, Plus, Trash } from '@phosphor-icons/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../../data/db'
import { instrumentFrom, saveInstrument } from '../../data/repo'
import type { Instrument } from '../../data/types'
import { useInstruments } from '../../state/hooks'
import { Bar } from '../../ui/Bar'
import { IconButton } from '../../ui/controls'
import { InstrumentThumb } from '../../ui/InstrumentView'
import { Screen } from '../../ui/Screen'
import { ActionList, Sheet } from '../../ui/Sheet'
import { toast } from '../../ui/toast'
import { TabBar } from '../TabBar'

export function InstrumentsScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const instruments = useInstruments()
  const [menu, setMenu] = useState<Instrument | null>(null)

  return (
    <Screen
      title={t('instruments.title')}
      titleSize="lg"
      footer={
        <div className="flex flex-col gap-2">
          <Bar icon={<Plus size={22} weight="bold" />} onClick={() => navigate('/instruments/new')}>
            {t('instruments.new')}
          </Bar>
          <TabBar />
        </div>
      }
    >
      <ul className="flex flex-col gap-3">
        {instruments?.map((i) => (
          <li key={i.id} className="relative">
            <Link
              to={`/instruments/${i.id}`}
              className="shadow-soft ring-stand/50 flex min-h-20 items-center gap-4 rounded-3xl bg-white/80 p-3 pr-14 ring-1 dark:bg-white/6"
            >
              <InstrumentThumb instrument={i} height={56} />
              <span className="min-w-0">
                <span className="font-display block truncate text-lg">{i.name}</span>
                <span className="text-ink/65 block text-sm">
                  {t('instruments.noteCount', { count: i.notes.length })}
                </span>
              </span>
            </Link>
            <IconButton
              label={t('songs.moreFor', { title: i.name })}
              className="absolute top-1/2 right-1 -translate-y-1/2"
              onClick={() => setMenu(i)}
            >
              <DotsThreeVertical size={22} weight="bold" />
            </IconButton>
          </li>
        ))}
      </ul>
      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu?.name ?? ''}>
        {menu && (
          <ActionList
            items={[
              {
                label: t('songs.duplicate'),
                icon: <Copy size={22} />,
                onSelect: async () => {
                  setMenu(null)
                  await saveInstrument(
                    instrumentFrom(menu, `${menu.name} (${t('instruments.copy')})`),
                  )
                },
              },
              {
                label: t('common.delete'),
                icon: <Trash size={22} />,
                danger: true,
                onSelect: async () => {
                  setMenu(null)
                  if ((instruments?.length ?? 0) <= 1) return toast(t('instruments.keepOne'))
                  await db.instruments.delete(menu.id)
                  toast(
                    t('instruments.deleted', { name: menu.name }),
                    () => void db.instruments.put(menu),
                  )
                },
              },
            ]}
          />
        )}
      </Sheet>
    </Screen>
  )
}
