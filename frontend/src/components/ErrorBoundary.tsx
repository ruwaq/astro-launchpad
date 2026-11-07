import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  fallback?: ReactNode
}

type State = {
  error: Error | null
}

/**
 * Corta un crash de render para que un fallo de un componente no deje la
 * página en blanco. Los errores de eventos/async se manejan con toasts.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AstroGate] Render error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-slate-100">
            <div
              role="alert"
              className="w-full max-w-md rounded-xl border border-rose-900 bg-rose-950/30 p-5"
            >
              <h1 className="text-lg font-semibold text-rose-200">
                Something went wrong
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Your funds remain safe on-chain. You can retry rendering this
                view or reload the page.
              </p>
              <p className="mt-2 break-words font-mono text-xs text-slate-500">
                {this.state.error.message}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => this.setState({ error: null })}
                  className="min-h-[44px] rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="min-h-[44px] rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
                >
                  Reload page
                </button>
              </div>
            </div>
          </div>
        )
      )
    }

    return this.props.children
  }
}
