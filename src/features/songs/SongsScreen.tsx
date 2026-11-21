import {
  Camera,
  Copy,
  DotsThreeVertical,
  FileArrowUp,
  Gear,
  MagnifyingGlass,
  PencilSimple,
  ShareNetwork,
  Trash,
  Unite,
} from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { colorFor, PALETTES } from '../../core/instruments'
import { previewMidis } from '../../core/edit'
import { writeMusicXml } from '../../core/musicxml-writer'
import { db } from '../../data/db'
import { duplicateSong, mergeSongs, saveSong } from '../../data/repo'
import type { Instrument, Song } from '../../data/types'
import { safeFileName, shareFile } from '../../platform/files'
import { pickInstrument, useInstruments, useSongs } from '../../state/hooks'
import { Bar } from '../../ui/Bar'
import { Button, IconButton, Segmented } from '../../ui/controls'
import { Screen } from '../../ui/Screen'
import { ActionList, Sheet } from '../../ui/Sheet'
import { toast } from '../../ui/toast'
import { useLongPress } from '../../ui/useLongPress'
import { TabBar } from '../TabBar'
import { useImport } from './useImport'

export function SongsScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const songs = useSongs()
  const instruments = useInstruments()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'recent' | 'az'>('recent')
  const [menu, setMenu] = useState<Song | null>(null)
  const [renaming, setRenaming] = useState<Song | null>(null)
  const [merging, setMerging] = useState<Song | null>(null)
  const startImport = useImport()

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = (songs ?? []).filter((s) => !q || s.title.toLowerCase().includes(q))
    return sort === 'az' ? [...filtered].sort((a, b) => a.title.localeCompare(b.title)) : filtered
  }, [songs, query, sort])

  const remove = async (song: Song) => {
    setMenu(null)
    await db.songs.delete(song.id)
    toast(t('songs.deleted', { title: song.title }), () => void db.songs.put(song))
  }

  return (
    <Screen
      title={t('songs.title')}
      titleSize="lg"
      actions={
        <IconButton label={t('settings.title')} onClick={() => navigate('/settings')}>
          <Gear size={24} />
        </IconButton>
      }
      footer={
        <div className="flex flex-col gap-2">
          <Bar icon={<Camera size={24} weight="bold" />} onClick={() => navigate('/scan')}>
            {t('songs.scan')}
          </Bar>
          <div className="flex justify-center gap-2">
            <Button icon={<FileArrowUp size={20} />} onClick={startImport}>
              {t('songs.import')}
            </Button>
            <Button icon={<PencilSimple size={20} />} onClick={() => navigate('/write')}>
              {t('songs.new')}
            </Button>
          </div>
          <TabBar />
        </div>
      }
    >
      {songs && songs.length > 3 && (
        <div className="mb-4 flex flex-col gap-3">
          <label className="bg-ink/6 flex min-h-12 items-center gap-2 rounded-2xl px-3">
            <MagnifyingGlass size={20} aria-hidden />
            <span className="sr-only">{t('songs.search')}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('songs.search')}
              className="placeholder:text-ink/50 min-h-12 flex-1 bg-transparent outline-none"
            />
          </label>
          <Segmented
            label={t('songs.sort')}
            value={sort}
            onChange={setSort}
            options={[
              { value: 'recent', label: t('songs.sortRecent') },
              { value: 'az', label: t('songs.sortAz') },
            ]}
          />
        </div>
      )}

      {songs && songs.length === 0 && (
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <p className="font-display text-2xl">{t('songs.emptyTitle')}</p>
          <p className="text-ink/70 mt-2">{t('songs.emptyBody')}</p>
        </div>
      )}

      {songs && songs.length > 0 && songs.every((s) => s.sample) && (
        <div className="bg-birch/50 mb-4 rounded-2xl px-4 py-3">
          <p className="font-semibold">{t('songs.hintTitle')}</p>
          <p className="text-ink/80 mt-1">{t('songs.hintBody')}</p>
        </div>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {list.map((song) => (
          <SongCard
            key={song.id}
            song={song}
            instrument={pickInstrument(song, instruments, undefined)}
            onMenu={() => setMenu(song)}
          />
        ))}
      </ul>
      {query && list.length === 0 && (
        <p className="text-ink/70 py-8 text-center">{t('songs.noMatch')}</p>
      )}

      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu?.title ?? ''}>
        {menu && (
          <ActionList
            items={[
              {
                label: t('songs.rename'),
                icon: <PencilSimple size={22} />,
                onSelect: () => (setRenaming(menu), setMenu(null)),
              },
              {
                label: t('songs.duplicate'),
                icon: <Copy size={22} />,
                onSelect: async () => {
                  setMenu(null)
                  await duplicateSong(menu)
                  toast(t('songs.duplicated'))
                },
              },
              {
                label: t('songs.mergeWith'),
                icon: <Unite size={22} />,
                onSelect: () => (setMerging(menu), setMenu(null)),
              },
              {
                label: t('songs.shareMusicXml'),
                icon: <ShareNetwork size={22} />,
                onSelect: () => {
                  setMenu(null)
                  void shareFile(
                    `${safeFileName(menu.title)}.musicxml`,
                    writeMusicXml(menu.score),
                    'application/vnd.recordare.musicxml+xml',
                    menu.title,
                  )
                },
              },
              {
                label: t('common.delete'),
                icon: <Trash size={22} />,
                danger: true,
                onSelect: () => void remove(menu),
              },
            ]}
          />
        )}
      </Sheet>

      <RenameSheet song={renaming} onClose={() => setRenaming(null)} />

      <Sheet open={!!merging} onClose={() => setMerging(null)} title={t('songs.mergeTitle')}>
        {merging && (
          <>
            <p className="text-ink/75 mb-3">{t('songs.mergeBody', { title: merging.title })}</p>
            <ActionList
              items={(songs ?? [])
                .filter((s) => s.id !== merging.id)
                .map((s) => ({
                  label: s.title,
                  onSelect: async () => {
                    setMerging(null)
                    const before = [merging, s]
                    await mergeSongs(merging, s)
                    toast(t('songs.merged'), () => void db.songs.bulkPut(before))
                  },
                }))}
            />
          </>
        )}
      </Sheet>
    </Screen>
  )
}

function SongCard({
  song,
  instrument,
  onMenu,
}: {
  song: Song
  instrument?: Instrument
  onMenu: () => void
}) {
  const instrumentName = instrument?.name
  const { t } = useTranslation()
  const press = useLongPress(onMenu)
  const preview = previewMidis(song.score, 7)
  const palette = PALETTES[0]!
  const colorOf = (m: number) =>
    instrument?.notes.find((n) => n.midi === m)?.color ?? colorFor(m, palette)
  const pages = song.pages.length
  return (
    <li className="relative">
      <Link
        to={`/song/${song.id}`}
        {...press}
        onClick={(e) => {
          if (press.wasLongPress()) e.preventDefault()
        }}
        className="shadow-soft ring-stand/50 flex h-full min-h-40 flex-col rounded-3xl bg-white/80 p-4 pr-10 ring-1 transition-transform active:scale-[0.98] dark:bg-white/6"
      >
        {song.sample && (
          <span className="bg-felt/12 text-felt mb-1 self-start rounded-full px-2 py-0.5 text-xs font-bold">
            {t('songs.sample')}
          </span>
        )}
        <span className="font-display line-clamp-2 text-lg leading-tight">{song.title}</span>
        <span aria-hidden className="mt-3 flex gap-1">
          {preview.map((m, i) => (
            <span key={i} className="size-3.5 rounded-full" style={{ background: colorOf(m) }} />
          ))}
        </span>
        <span className="text-ink/65 mt-auto pt-3 text-sm">
          {(instrumentName ?? song.composer) && (
            <span className="block truncate">{instrumentName ?? song.composer}</span>
          )}
          {pages > 1 && <span className="block">{t('songs.pages', { count: pages })}</span>}
        </span>
      </Link>
      <IconButton
        label={t('songs.moreFor', { title: song.title })}
        onClick={onMenu}
        className="absolute top-1 right-0"
      >
        <DotsThreeVertical size={22} weight="bold" />
      </IconButton>
    </li>
  )
}

function RenameSheet({ song, onClose }: { song: Song | null; onClose: () => void }) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const open = !!song
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('songs.rename')}
      footer={
        <Bar
          className="w-full"
          disabled={!value.trim()}
          onClick={async () => {
            if (song)
              await saveSong({
                ...song,
                title: value.trim(),
                score: { ...song.score, title: value.trim() },
              })
            onClose()
          }}
        >
          {t('common.save')}
        </Bar>
      }
    >
      {open && (
        <input
          autoFocus
          defaultValue={song.title}
          ref={(el) => {
            if (el && !value) setValue(song.title)
          }}
          onChange={(e) => setValue(e.target.value)}
          aria-label={t('songs.titleLabel')}
          className="bg-ink/6 min-h-14 w-full rounded-2xl px-4 text-lg"
        />
      )}
    </Sheet>
  )
}
