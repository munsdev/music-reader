import { useSettings } from '../state/settings'

export function tap(): void {
  if (useSettings.getState().haptics && 'vibrate' in navigator) navigator.vibrate?.(8)
}
