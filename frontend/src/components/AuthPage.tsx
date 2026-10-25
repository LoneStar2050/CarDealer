import { useState, type FormEvent } from 'react';
import { api, type Session } from '../api';
import sedan from '../assets/sedan.svg';
import { BRAND } from './Layout';
import { NoticeBanner, Spinner, ui, type Notice } from './ui';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Sign-in and registration. Registration logs the new user in straight away. */
export function AuthPage({ notice, onSignIn }: { notice: Notice; onSignIn: (session: Session) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [message, setMessage] = useState<Notice>(notice);
  const [busy, setBusy] = useState(false);
  const registering = mode === 'register';

  function validate() {
    const found: typeof errors = {};
    if (!email.trim()) found.email = 'Email is required';
    else if (registering && !EMAIL_PATTERN.test(email)) found.email = 'Enter a valid email address';
    if (!password) found.password = 'Password is required';
    else if (registering && password.length < 8) found.password = 'Password must be at least 8 characters';
    setErrors(found);
    return Object.keys(found).length === 0;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (!validate()) return;
    setBusy(true);
    try {
      if (registering) await api.register(email, password);
      onSignIn(await api.login(email, password));
    } catch (error) {
      setMessage({ kind: 'error', text: (error as Error).message });
      setBusy(false);
    }
  }

  function switchMode() {
    setMode(registering ? 'login' : 'register');
    setErrors({});
    setMessage(null);
  }

  return (
    <div className="grid min-h-[calc(100vh-57px)] lg:grid-cols-2">
      <div className="relative hidden flex-col justify-end overflow-hidden bg-slate-950 p-12 text-white lg:flex">
        <img src={sedan} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div className="relative">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">{BRAND}</p>
          <p className="mt-3 max-w-md text-3xl font-bold leading-snug">Quality vehicles, honest prices, real-time availability.</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <form onSubmit={submit} noValidate className="w-full max-w-md space-y-5">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{registering ? 'Create your account' : 'Welcome back'}</h1>
            <p className="mt-2 text-slate-500">
              {registering ? 'Register to browse and purchase vehicles.' : 'Sign in to view the inventory.'}
            </p>
          </div>
          <NoticeBanner notice={message} />

          <div>
            <label htmlFor="auth-email" className={ui.label}>Email</label>
            <input id="auth-email" type="email" autoComplete="email" className={ui.input} value={email}
              aria-invalid={Boolean(errors.email)} onChange={(e) => { setEmail(e.target.value); setErrors({ ...errors, email: undefined }); }} />
            {errors.email && <p className={ui.fieldError}>{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="auth-password" className={ui.label}>Password</label>
            <div className="relative">
              <input id="auth-password" type={showPassword ? 'text' : 'password'}
                autoComplete={registering ? 'new-password' : 'current-password'}
                className={`${ui.input} pr-20`} value={password}
                aria-invalid={Boolean(errors.password)} onChange={(e) => { setPassword(e.target.value); setErrors({ ...errors, password: undefined }); }} />
              <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 px-3 text-sm font-medium text-slate-500 hover:text-slate-800"
                onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {errors.password && <p className={ui.fieldError}>{errors.password}</p>}
            {registering && !errors.password && <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>}
          </div>

          <button type="submit" className={`${ui.button} ${ui.primary} w-full py-3`} disabled={busy}>
            {busy && <Spinner />} {registering ? 'Create account' : 'Sign in'}
          </button>

          <p className="text-center text-sm text-slate-500">
            {registering ? 'Already have an account?' : 'New here?'}{' '}
            <button type="button" className="font-semibold text-amber-600 hover:text-amber-700" onClick={switchMode}>
              {registering ? 'Sign in instead' : 'Create an account'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
