import { Link } from 'react-router'
import { BRAND } from '../lib/brand'

export function NotFoundPage() {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center">
      <p className="text-5xl" aria-hidden="true">
        {BRAND.emoji}
      </p>
      <h1 className="mt-3 text-2xl font-bold">Page Not Found</h1>
      <p className="mt-2 text-sm text-slate-400">
        The destination you are looking for does not exist on {BRAND.name}. Return home or explore the live market.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link
          to="/"
          className="inline-flex min-h-[44px] items-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
        >
          Back to Home
        </Link>
        <Link
          to="/market"
          className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-700 px-4 py-2 text-sm hover:border-slate-500"
        >
          Explore Market
        </Link>
      </div>
    </section>
  )
}
