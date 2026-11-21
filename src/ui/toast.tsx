import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { create } from 'zustand'

interface Toast {
  id: number
  message: string
  undo?: () => void
}

interface ToastState {
  toast: Toast | null
  show: (message: string, undo?: () => void) => void
  hide: () => void
}

let n = 0
export const useToast = create<ToastState>((set) => ({
  toast: null,
  show: (message, undo) => set({ toast: { id: ++n, message, undo } }),
  hide: () => set({ toast: null }),
}))

export const toast = (message: string, undo?: () => void) => useToast.getState().show(message, undo)

export function ToastHost() {
  const { toast: current, hide } = useToast()
  const { t } = useTranslation()
  useEffect(() => {
    if (!current) return
    const timer = setTimeout(hide, current.undo ? 6000 : 3500)
    return () => clearTimeout(timer)
  }, [current, hide])
  if (!current) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-[calc(6rem+var(--sab))] z-50 flex justify-center px-4"
    >
      <div className="bg-ink text-paper shadow-soft flex min-h-12 max-w-md items-center gap-3 rounded-2xl py-2 pr-2 pl-4">
        <span className="flex-1">{current.message}</span>
        {current.undo && (
          <button
            type="button"
            className="text-birch min-h-10 rounded-full px-3 font-bold"
            onClick={() => {
              current.undo?.()
              hide()
            }}
          >
            {t('common.undo')}
          </button>
        )}
      </div>
    </div>
  )
}
