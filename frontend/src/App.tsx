import { useCallback, useState } from 'react';
import type { Session } from './api';
import { AuthPage } from './components/AuthPage';
import { Inventory } from './components/Inventory';
import { Navbar } from './components/Layout';
import type { Notice } from './components/ui';

const SESSION_KEY = 'dealership-session';

function loadSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
  } catch {
    return null;
  }
}

/** Root component: holds the JWT session and switches between sign-in and the dealership view. */
export function App() {
  const [session, setSession] = useState<Session | null>(loadSession);
  const [authNotice, setAuthNotice] = useState<Notice>(null);

  const signIn = (next: Session) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setAuthNotice(null);
    setSession(next);
  };
  const signOut = useCallback((notice: Notice = null) => {
    localStorage.removeItem(SESSION_KEY);
    setAuthNotice(notice);
    setSession(null);
  }, []);
  const expire = useCallback(
    () => signOut({ kind: 'error', text: 'Your session has expired. Please sign in again.' }),
    [signOut],
  );

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar user={session?.user ?? null} onLogout={() => signOut()} />
      {session ? (
        <Inventory key={session.token} session={session} onSessionExpired={expire} />
      ) : (
        <AuthPage key={authNotice?.text ?? 'auth'} notice={authNotice} onSignIn={signIn} />
      )}
    </div>
  );
}
