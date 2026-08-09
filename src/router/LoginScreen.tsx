import React, { useState } from 'react';
import { AuthenticationEngine, AuthenticationErrorCode } from '../../modules/authentication';

interface LoginScreenProps {
  onAuthenticated: () => void;
}

function describeAuthError(
  errorCode: AuthenticationErrorCode | undefined,
  detail: string | undefined,
): string {
  switch (errorCode) {
    case AuthenticationErrorCode.INVALID_CREDENTIALS:
      return 'Invalid email or password.';
    case AuthenticationErrorCode.NETWORK_ERROR:
      return 'Network error. Check your connection and try again.';
    case AuthenticationErrorCode.SESSION_EXPIRED:
      return 'Your session has expired. Please sign in again.';
    case AuthenticationErrorCode.OFFLINE_NO_SESSION:
      return 'You are offline. Connect to the internet to sign in.';
    default:
      return detail || 'Unable to sign in. Please try again.';
  }
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onAuthenticated }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) {
      return;
    }
    if (!email.trim() || !password) {
      setError('Enter your email and password to sign in.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await AuthenticationEngine.login(email.trim(), password);
      if (result.success) {
        onAuthenticated();
      } else {
        setError(describeAuthError(result.errorCode, result.error));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6 px-6">
        <div className="space-y-2">
          <span className="text-3xl font-sans font-semibold tracking-tight text-neutral-50">
            Sapana Live Tracker
          </span>
          <span className="block text-xl font-mono text-neutral-300">
            Worker Sign In
          </span>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-xs font-mono text-neutral-400 mb-1">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded font-mono text-sm text-neutral-100 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-xs font-mono text-neutral-400 mb-1">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded font-mono text-sm text-neutral-100 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
        {error && (
          <div className="flex items-start gap-3 text-red-400 bg-red-950/30 p-4 rounded border border-red-900/50">
            <span className="text-sm font-mono break-all">{error}</span>
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full px-4 py-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-100 rounded font-mono text-sm transition-colors border border-neutral-700"
        >
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
};

export default LoginScreen;
