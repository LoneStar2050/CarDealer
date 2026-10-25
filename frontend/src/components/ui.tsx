import { useEffect, useId, type ReactNode } from 'react';

/** Shared class names so buttons and inputs look the same everywhere. */
export const ui = {
  input:
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30',
  label: 'mb-1 block text-sm font-medium text-slate-700',
  button:
    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
  primary: 'bg-slate-900 text-white hover:bg-slate-800',
  accent: 'bg-amber-500 text-slate-950 hover:bg-amber-400',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  fieldError: 'mt-1 text-sm text-red-600',
};

export type Notice = { kind: 'success' | 'error'; text: string } | null;

/** A success (status) or error (alert) message that the user can dismiss. */
export function NoticeBanner({ notice, onDismiss }: { notice: Notice; onDismiss?: () => void }) {
  if (!notice) return null;
  const success = notice.kind === 'success';
  return (
    <div
      role={success ? 'status' : 'alert'}
      className={`flex items-start justify-between gap-4 rounded-xl border px-4 py-3 text-sm ${
        success ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'
      }`}
    >
      <span>{notice.text}</span>
      {onDismiss && (
        <button type="button" aria-label="Dismiss message" className="font-bold opacity-60 hover:opacity-100" onClick={onDismiss}>
          ×
        </button>
      )}
    </div>
  );
}

/** A small inline spinner for buttons and loading states. */
export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <span aria-hidden="true" className={`${className} inline-block animate-spin rounded-full border-2 border-current border-r-transparent`} />;
}

/** An accessible modal dialog: labelled by its title, closes on Escape or backdrop click. */
export function Dialog({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-2xl bg-white p-6 shadow-2xl`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="mb-4 text-xl font-bold text-slate-900">{title}</h2>
        {children}
      </div>
    </div>
  );
}
