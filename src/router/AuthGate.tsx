import React, { useEffect, useRef, useState } from 'react';
import { AuthSession } from '../../modules/auth-session';
import LoginScreen from './LoginScreen';
import DashboardPlaceholder from './DashboardPlaceholder';

type AuthPhase = 'checking' | 'unauthenticated' | 'authenticated';

const AuthGate: React.FC = () => {
  const [phase, setPhase] = useState<AuthPhase>('checking');
  const restoreRef = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!restoreRef.current) {
      restoreRef.current = AuthSession.restore()
        .then((result) => result.success)
        .catch(() => false);
    }

    restoreRef.current.then((success) => {
      if (!cancelled) {
        setPhase(success ? 'authenticated' : 'unauthenticated');
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignOut = async () => {
    await AuthSession.logout();
    setPhase('unauthenticated');
  };

  if (phase === 'checking') {
    return (
      <div className="text-center">
        <div className="flex items-center gap-3 text-neutral-400">
          <div className="w-4 h-4 border-2 border-neutral-400 border-t-emerald-500 rounded-full animate-spin"></div>
          <span className="text-sm font-mono">Checking session...</span>
        </div>
      </div>
    );
  }

  if (phase === 'authenticated') {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 rounded font-mono text-sm transition-colors border border-neutral-700"
          >
            Sign Out
          </button>
        </div>
        <DashboardPlaceholder />
      </div>
    );
  }

  return <LoginScreen onAuthenticated={() => setPhase('authenticated')} />;
};

export default AuthGate;
