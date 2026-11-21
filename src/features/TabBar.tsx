import { MusicNotes, Xylophone } from './icons'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'

export function TabBar() {
  const { t } = useTranslation()
  const tab = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl font-semibold ${isActive ? 'bg-ink/8 text-ink' : 'text-ink/60'}`
  return (
    <nav aria-label={t('nav.label')} className="mt-1 flex gap-2">
      <NavLink to="/" end className={tab}>
        <MusicNotes />
        {t('nav.songs')}
      </NavLink>
      <NavLink to="/instruments" className={tab}>
        <Xylophone />
        {t('nav.instruments')}
      </NavLink>
    </nav>
  )
}
