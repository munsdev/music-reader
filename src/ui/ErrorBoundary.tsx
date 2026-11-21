import { Component, type ReactNode } from 'react'

/**
 * Last line of defense: shows the error instead of a blank screen, so testers can
 * screenshot it. Not translated on purpose (i18n may be what failed).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  override render() {
    if (this.state.error)
      return <CrashReport message={String(this.state.error.stack ?? this.state.error)} />
    return this.props.children
  }
}

export function CrashReport({ message }: { message: string }) {
  return (
    <div className="bg-paper text-ink min-h-dvh p-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <h1 className="font-display text-2xl">Music Reader could not start</h1>
      <p className="mt-2">Take a screenshot of this screen and send it to Casey.</p>
      <pre className="bg-ink/6 mt-4 overflow-auto rounded-xl p-3 text-xs whitespace-pre-wrap">
        {message}
      </pre>
      <button
        type="button"
        className="bg-felt mt-4 min-h-12 rounded-full px-6 font-bold text-white"
        onClick={() => location.reload()}
      >
        Try again
      </button>
    </div>
  )
}
