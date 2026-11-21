import { X } from '@phosphor-icons/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { IconButton } from './controls'

/** Bottom sheet built on the native <dialog> element (focus trap and Escape for free). */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const closingByProp = useRef(false)
  const { t } = useTranslation()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) {
      // Closed because the parent changed state: do not report it back as a user close.
      closingByProp.current = true
      d.close()
    }
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={() => {
        if (closingByProp.current) closingByProp.current = false
        else onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className="bg-paper text-ink backdrop:bg-ink/40 m-0 mt-auto max-h-[calc(100dvh-var(--sat)-1rem)] w-full max-w-none rounded-t-[28px] p-0 sm:mx-auto sm:mb-auto sm:max-w-lg sm:rounded-[28px]"
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-var(--sat)-1rem)] flex-col">
          <div className="flex items-center gap-2 px-5 pt-3 pb-1">
            <h2 className="font-display flex-1 text-2xl">{title}</h2>
            <IconButton label={t('common.close')} onClick={onClose}>
              <X size={22} />
            </IconButton>
          </div>
          <div
            className={`overflow-y-auto px-5 ${footer ? 'pb-5' : 'pb-[calc(1.25rem+var(--sab))]'}`}
          >
            {children}
          </div>
          {footer && (
            <div className="border-stand/70 border-t px-5 pt-3 pb-[calc(0.75rem+var(--sab))]">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  )
}

export function ActionList({
  items,
}: {
  items: { label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean }[]
}) {
  return (
    <ul className="-mx-2">
      {items.map((it) => (
        <li key={it.label}>
          <button
            type="button"
            onClick={it.onSelect}
            className={`hover:bg-ink/5 flex min-h-14 w-full items-center gap-4 rounded-2xl px-3 text-left font-semibold ${it.danger ? 'text-alert' : ''}`}
          >
            {it.icon}
            {it.label}
          </button>
        </li>
      ))}
    </ul>
  )
}
