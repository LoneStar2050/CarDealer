import type { User } from '../api';
import suv from '../assets/suv.svg';
import { ui } from './ui';

export const BRAND = 'Prestige Motors';

/** Top navigation with branding, section links and the signed-in user's controls. */
export function Navbar({ user, onLogout }: { user: User | null; onLogout: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 text-white backdrop-blur">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <a href="#top" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-slate-950">P</span>
          {BRAND}
        </a>
        {user && (
          <>
            {/* On small screens the links wrap onto their own row below the brand. */}
            <div className="order-last flex w-full items-center gap-5 overflow-x-auto text-sm font-medium text-slate-300 md:order-none md:w-auto">
              <a href="#inventory" className="rounded hover:text-white focus-visible:outline-2 focus-visible:outline-amber-400">Inventory</a>
              <a href="#orders" className="rounded hover:text-white focus-visible:outline-2 focus-visible:outline-amber-400">My orders</a>
              {user.role === 'admin' && (
                <>
                  <a href="#manage" className="rounded hover:text-white focus-visible:outline-2 focus-visible:outline-amber-400">Manage</a>
                  <a href="#analytics" className="rounded hover:text-white focus-visible:outline-2 focus-visible:outline-amber-400">Analytics</a>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right leading-tight sm:block">
                <p className="text-sm font-medium">{user.email}</p>
                <p className="text-xs capitalize text-amber-400">{user.role}</p>
              </div>
              <button type="button" className={`${ui.button} border border-white/20 text-white hover:bg-white/10`} onClick={onLogout}>
                Log out
              </button>
            </div>
          </>
        )}
      </nav>
    </header>
  );
}

/** Landing banner with the main call to action. */
export function Hero({ vehicleCount }: { vehicleCount: number }) {
  return (
    <section id="top" className="relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.18),transparent_55%)]" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 md:py-20">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">New &amp; certified vehicles</p>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Find your next car with confidence.
          </h1>
          <p className="mt-4 max-w-lg text-lg text-slate-300">
            Browse our hand-picked inventory of sedans, SUVs and hatchbacks, with transparent pricing and live stock availability.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a href="#inventory" className={`${ui.button} ${ui.accent} px-6 py-3 text-base`}>Explore Inventory</a>
            <span className="text-sm text-slate-400">{vehicleCount} models available</span>
          </div>
        </div>
        <img src={suv} alt="" aria-hidden="true" className="w-full rounded-3xl shadow-2xl ring-1 ring-white/10" />
      </div>
    </section>
  );
}

/** Shown when a page needs a role the signed-in user does not have. */
export function AccessDenied({ message }: { message: string }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <section aria-label="Access denied" className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <h2 className="text-2xl font-bold text-slate-900">Access denied</h2>
        <p className="mt-2 text-slate-600">{message}</p>
        <a href="#inventory" className={`${ui.button} ${ui.primary} mt-6`}>Back to inventory</a>
      </section>
    </main>
  );
}
