import { useRef } from 'react'

/** Long press (500 ms) for touch and mouse, plus the context-menu key. */
export function useLongPress(onLongPress: () => void, ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fired = useRef(false)
  const clear = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  return {
    onPointerDown: () => {
      fired.current = false
      clear()
      timer.current = setTimeout(() => {
        fired.current = true
        onLongPress()
      }, ms)
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault()
      clear()
      fired.current = true
      onLongPress()
    },
    /** True if the last press became a long press; check in onClick to skip the click. */
    wasLongPress: () => fired.current,
  }
}
