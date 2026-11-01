export type TxStepStatus = 'pending' | 'active' | 'done' | 'error'

export type TxStep = {
  label: string
  status: TxStepStatus
  detail?: string
}

const stepIcon: Record<TxStepStatus, string> = {
  pending: '○',
  active: '◌',
  done: '✓',
  error: '!',
}

const stepColor: Record<TxStepStatus, string> = {
  pending: 'text-slate-500',
  active: 'text-amber-300',
  done: 'text-emerald-400',
  error: 'text-rose-400',
}

/**
 * Progreso de una operación on-chain. Cada formulario decide sus pasos; aquí
 * solo se pinta el estado de forma consistente y accesible.
 */
export function TxProgress({
  steps,
  title = 'Progreso de la transacción',
}: {
  steps: TxStep[]
  title?: string
}) {
  if (steps.length === 0) return null

  const hasError = steps.some((step) => step.status === 'error')
  const allDone = steps.every((step) => step.status === 'done')
  const summary = hasError ? 'Error' : allDone ? 'Completado' : 'En curso'

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          {title}
        </p>
        <p
          className={`text-xs font-medium ${
            hasError
              ? 'text-rose-300'
              : allDone
                ? 'text-emerald-300'
                : 'text-amber-300'
          }`}
        >
          {summary}
        </p>
      </div>

      <ol className="mt-2 space-y-1.5">
        {steps.map((step, index) => (
          <li
            key={`${index}-${step.label}`}
            className="flex items-start gap-2 text-sm"
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 w-4 shrink-0 text-center font-mono ${stepColor[step.status]} ${
                step.status === 'active' ? 'animate-pulse' : ''
              }`}
            >
              {stepIcon[step.status]}
            </span>
            <span
              className={
                step.status === 'pending' ? 'text-slate-500' : 'text-slate-200'
              }
            >
              {step.label}
              {step.detail ? (
                <span className="mt-0.5 block text-xs text-slate-500">
                  {step.detail}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
