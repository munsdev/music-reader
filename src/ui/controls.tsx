import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { tap } from '../platform/haptics'

export function Button({
  children,
  icon,
  className = '',
  variant = 'plain',
  onClick,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode
  variant?: 'plain' | 'outline' | 'danger'
}) {
  const styles = {
    plain: 'text-felt hover:bg-felt/8',
    outline: 'text-ink ring-1 ring-stand hover:bg-ink/5',
    danger: 'text-alert hover:bg-alert/8',
  }[variant]
  return (
    <button
      type="button"
      {...rest}
      onClick={(e) => {
        tap()
        onClick?.(e)
      }}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-4 font-semibold disabled:opacity-40 ${styles} ${className}`}
    >
      {icon}
      {children}
    </button>
  )
}

export function IconButton({
  label,
  children,
  className = '',
  active,
  onClick,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      {...rest}
      onClick={(e) => {
        tap()
        onClick?.(e)
      }}
      className={`text-ink hover:bg-ink/6 inline-flex size-12 shrink-0 items-center justify-center rounded-full disabled:opacity-35 ${active ? 'bg-felt/12 text-felt' : ''} ${className}`}
    >
      {children}
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string; icon?: ReactNode }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="bg-ink/6 flex rounded-full p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => {
            tap()
            onChange(o.value)
          }}
          className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors ${value === o.value ? 'bg-paper text-ink shadow-soft' : 'text-ink/65'}`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 py-1">
      <span>
        <span className="block font-semibold">{label}</span>
        {hint && <span className="text-ink/65 block text-sm">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="bg-stand peer-checked:bg-felt peer-focus-visible:outline-felt relative h-7 w-12 shrink-0 rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5"
      />
    </label>
  )
}

export function Stepper({
  value,
  onChange,
  min,
  max,
  label,
  format = String,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  label: string
  format?: (v: number) => string
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-semibold">{label}</span>
      <div className="flex items-center gap-1">
        <IconButton
          label={`${label} −`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          className="ring-stand ring-1"
        >
          <span aria-hidden className="text-2xl leading-none">
            −
          </span>
        </IconButton>
        <output className="min-w-14 text-center text-lg font-bold tabular-nums">
          {format(value)}
        </output>
        <IconButton
          label={`${label} +`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className="ring-stand ring-1"
        >
          <span aria-hidden className="text-2xl leading-none">
            +
          </span>
        </IconButton>
      </div>
    </div>
  )
}

export function Select<T extends string>({
  value,
  onChange,
  label,
  options,
}: {
  value: T
  onChange: (v: T) => void
  label: string
  options: { value: T; label: string }[]
}) {
  return (
    <label className="flex min-h-14 items-center justify-between gap-4">
      <span className="font-semibold">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="bg-ink/5 text-ink min-h-12 max-w-[60%] rounded-xl px-3 font-semibold"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
