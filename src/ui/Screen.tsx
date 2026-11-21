import { CaretLeft } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { IconButton } from './controls'

export function Screen({
  title,
  back,
  actions,
  children,
  footer,
  titleSize = 'md',
}: {
  title: ReactNode
  back?: string | true
  actions?: ReactNode
  children: ReactNode
  footer?: ReactNode
  titleSize?: 'md' | 'lg'
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  return (
    <div className="flex min-h-dvh flex-col pt-[var(--sat)]">
      <header className="bg-paper/92 sticky top-0 z-20 flex min-h-16 items-center gap-1 px-2 backdrop-blur">
        {back && (
          <IconButton
            label={t('common.back')}
            onClick={() => (back === true ? navigate(-1) : navigate(back))}
          >
            <CaretLeft size={24} weight="bold" />
          </IconButton>
        )}
        <h1
          className={`font-display min-w-0 flex-1 truncate ${back ? '' : 'pl-3'} ${titleSize === 'lg' ? 'text-3xl' : 'text-2xl'}`}
        >
          {title}
        </h1>
        {actions}
      </header>
      <main className={`flex-1 px-4 ${footer ? 'pb-6' : 'pb-[calc(1.5rem+var(--sab))]'}`}>
        {children}
      </main>
      {footer && (
        <div className="border-stand/60 bg-paper/95 sticky bottom-0 z-20 border-t px-4 pt-3 pb-[calc(0.75rem+var(--sab))] backdrop-blur">
          {footer}
        </div>
      )}
    </div>
  )
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      {title && <h2 className="text-ink/60 mb-2 px-1 text-sm font-bold">{title}</h2>}
      <div className="ring-stand/60 rounded-3xl bg-white/70 px-4 py-2 ring-1 dark:bg-white/5">
        {children}
      </div>
    </section>
  )
}
