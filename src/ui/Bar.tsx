import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { tap } from '../platform/haptics'

type Tone = 'felt' | 'birch' | 'paper'

const TONES: Record<Tone, string> = {
  felt: 'bg-felt text-white shadow-[inset_0_2px_0_rgb(255_255_255/0.18),inset_0_-3px_0_rgb(0_0_0/0.22)]',
  birch:
    'bg-birch text-ink shadow-[inset_0_2px_0_rgb(255_255_255/0.4),inset_0_-3px_0_rgb(0_0_0/0.12)]',
  paper: 'bg-paper text-ink ring-1 ring-stand shadow-[inset_0_-3px_0_rgb(30_42_71/0.08)]',
}

/**
 * The app's signature control: a painted wooden bar with two brass nails.
 * Used for primary actions. It dips when pressed, like a struck bar.
 */
export function Bar({
  children,
  tone = 'felt',
  icon,
  className = '',
  onClick,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; icon?: ReactNode }) {
  return (
    <button
      type="button"
      {...rest}
      onClick={(e) => {
        tap()
        onClick?.(e)
      }}
      className={`relative flex min-h-14 items-center justify-center gap-2 rounded-[18px] px-12 text-lg font-bold transition-transform duration-100 active:translate-y-0.5 active:brightness-110 disabled:opacity-45 ${TONES[tone]} ${className}`}
    >
      <Nail side="left" />
      {icon}
      <span>{children}</span>
      <Nail side="right" />
    </button>
  )
}

function Nail({ side }: { side: 'left' | 'right' }) {
  return (
    <span
      aria-hidden
      className={`bg-brass absolute top-1/2 size-2 -translate-y-1/2 rounded-full shadow-[inset_0_-1px_0_rgb(0_0_0/0.3)] ${side === 'left' ? 'left-4' : 'right-4'}`}
    />
  )
}
