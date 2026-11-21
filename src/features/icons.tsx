/** Two small custom icons in the Phosphor style (2px rounded stroke). */
export function Xylophone({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="3" y="4" width="4" height="16" rx="1.5" />
      <rect x="10" y="6" width="4" height="12" rx="1.5" />
      <rect x="17" y="8" width="4" height="8" rx="1.5" />
    </svg>
  )
}

export function MusicNotes({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
      <path d="M9 18V5l11-2v13" />
    </svg>
  )
}
