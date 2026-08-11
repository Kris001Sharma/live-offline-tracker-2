import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { ConfigurationEngine } from '../../modules/configuration';
import { StorageEngine, CapacitorSQLiteAdapter } from '../../modules/storage';
import { ConnectivityEngine } from '../../modules/connectivity';
import { AuthenticationEngine } from '../../modules/authentication';
import { UserContextEngine } from '../../modules/user-context';
import { WorkerProfileEngine } from '../../modules/worker-profile';
import { AuthSession } from '../../modules/auth-session';
import { TrustedDeviceEngine } from '../../modules/trusted-device';
import { LifecycleContextValue, LifecycleStateModel } from './lifecycle.types';

const LifecycleContext = createContext<LifecycleContextValue | undefined>(undefined);

export function ApplicationLifecycleProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LifecycleStateModel>({
    state: 'NOT_INITIALIZED',
    error: null,
  });

  const inFlightRef = useRef<Promise<void> | null>(null);
  const readyRef = useRef(false);

  const initializeBackend = useCallback(async (): Promise<void> => {
    if (readyRef.current) {
      return;
    }

    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    const bootstrap = (async () => {
      setState({ state: 'INITIALIZING', error: null });

      try {
        ConfigurationEngine.load();

        const adapter = new CapacitorSQLiteAdapter();
        await StorageEngine.initialize(adapter);

        ConnectivityEngine.initialize();
        AuthenticationEngine.initialize();
        UserContextEngine.initialize();
        WorkerProfileEngine.initialize();
        AuthSession.initialize();
        TrustedDeviceEngine.initialize();
        await TrustedDeviceEngine.load();

        readyRef.current = true;
        setState({ state: 'READY', error: null });
      } catch (error) {
        console.error('Bootstrap failed:', error);
        setState({
          state: 'ERROR',
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    })();

    inFlightRef.current = bootstrap;
    try {
      return await bootstrap;
    } finally {
      inFlightRef.current = null;
    }
  }, []);

  useEffect(() => {
    initializeBackend().catch(() => {});
  }, [initializeBackend]);

  const retry = useCallback(() => {
    initializeBackend().catch(() => {});
  }, [initializeBackend]);

  const value = useMemo<LifecycleContextValue>(
    () => ({ ...state, retry }),
    [state, retry],
  );

  return (
    <LifecycleContext.Provider value={value}>
      {children}
    </LifecycleContext.Provider>
  );
}

/**
 * Public interface for consumers to READ lifecycle state.
 * Mutating the lifecycle is not permitted through this hook.
 */
export function useApplicationLifecycle(): LifecycleStateModel {
  const context = useContext(LifecycleContext);
  if (context === undefined) {
    throw new Error('useApplicationLifecycle must be used within an ApplicationLifecycleProvider');
  }
  return {
    state: context.state,
    error: context.error,
  };
}

/**
 * Internal interface for the Application Shell to trigger retries.
 */
export function useLifecycleBootstrap(): LifecycleContextValue {
  const context = useContext(LifecycleContext);
  if (context === undefined) {
    throw new Error('useLifecycleBootstrap must be used within an ApplicationLifecycleProvider');
  }
  return context;
}
