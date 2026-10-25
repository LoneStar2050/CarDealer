import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type Purchase, type Session } from '../api';
import { saveFile } from '../download';
import { formatDate, formatRupees, plural } from '../format';
import { NoticeBanner, Spinner, ui, type Notice } from './ui';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; purchases: Purchase[] };

/** The signed-in user's orders, with invoice downloads. Shown at #orders. */
export function PurchaseHistory({ session, onSessionExpired }: { session: Session; onSessionExpired: () => void }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [downloading, setDownloading] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      setState({ status: 'ready', purchases: (await api.listPurchases(session.token)).purchases });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onSessionExpired();
      else setState({ status: 'error', message: (error as Error).message });
    }
  }, [session.token, onSessionExpired]);

  useEffect(() => {
    void load();
  }, [load]);

  async function download(order: Purchase) {
    if (downloading) return;
    setDownloading(order.id);
    setNotice(null);
    try {
      const file = await api.downloadInvoice(session.token, order);
      saveFile(file.blob, file.filename);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onSessionExpired();
      else setNotice({ kind: 'error', text: `Couldn't download invoice ${order.invoiceNumber}: ${(error as Error).message}` });
    } finally {
      setDownloading(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <section aria-label="Purchase history" className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Purchase history</h2>
            <p className="text-sm text-slate-500">Every vehicle you have bought, with downloadable invoices.</p>
          </div>
          {state.status === 'ready' && state.purchases.length > 0 && (
            <p className="text-sm font-semibold text-slate-700">
              {plural(state.purchases.length, 'order')} · {formatRupees(state.purchases.reduce((sum, p) => sum + p.totalAmount, 0))} spent
            </p>
          )}
        </div>

        <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} />

        {state.status === 'loading' && (
          <div className="flex items-center justify-center gap-3 rounded-2xl bg-white py-16 text-slate-500 ring-1 ring-slate-200">
            <Spinner className="h-6 w-6" /> Loading your orders…
          </div>
        )}

        {state.status === 'error' && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <span>Couldn't load your orders: {state.message}</span>
            <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={() => void load()}>Try again</button>
          </div>
        )}

        {state.status === 'ready' && state.purchases.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white py-16 text-center">
            <p className="text-lg font-semibold text-slate-700">You haven't bought any vehicles yet.</p>
            <a href="#inventory" className={`${ui.button} ${ui.accent} mt-4`}>Browse inventory</a>
          </div>
        )}

        {state.status === 'ready' && state.purchases.length > 0 && (
          <ul aria-label="Orders" className="space-y-4">
            {state.purchases.map((order) => (
              <li key={order.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{order.make} {order.model}</h3>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{order.category}</span>
                      <span>{formatDate(order.purchasedAt)}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Download invoice ${order.invoiceNumber}`}
                    className={`${ui.button} ${ui.secondary}`}
                    disabled={downloading === order.id}
                    onClick={() => void download(order)}
                  >
                    {downloading === order.id ? (<><Spinner /> Downloading…</>) : 'Download invoice'}
                  </button>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm sm:grid-cols-5">
                  {[
                    ['Invoice number', order.invoiceNumber],
                    ['Quantity', String(order.quantity)],
                    ['Unit price', formatRupees(order.unitPrice)],
                    ['Total', formatRupees(order.totalAmount)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
                      <dd className={`mt-1 font-semibold ${label === 'Total' ? 'text-slate-900' : 'text-slate-700'}`}>{value}</dd>
                    </div>
                  ))}
                  <div className="col-span-2 sm:col-span-1">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Order reference</dt>
                    <dd className="mt-1 break-all font-mono text-xs text-slate-500">{order.id}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
