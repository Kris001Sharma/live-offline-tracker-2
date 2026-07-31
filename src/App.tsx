import { useEffect, useState } from 'react';
import { ConfigurationEngine } from '../modules/configuration';
import { StorageEngine, CapacitorSQLiteAdapter } from '../modules/storage';
import { ConnectivityEngine } from '../modules/connectivity';
import { AuthenticationEngine } from '../modules/authentication';
import { UserContextEngine } from '../modules/user-context';
import { WorkerProfileEngine } from '../modules/worker-profile';

type BootstrapState = 'INITIALIZING' | 'READY' | 'ERROR';

export default function App() {
  const [bootstrapState, setBootstrapState] = useState<BootstrapState>('INITIALIZING');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const initializeBackend = async () => {
    setBootstrapState('INITIALIZING');
    setErrorMessage(null);

    try {
      ConfigurationEngine.load();
      
      const adapter = new CapacitorSQLiteAdapter();
      
      // If we are on the web, we might need custom initialization for sqlite, 
      // but we let the adapter handle it based on Capacitor Platform.
      await StorageEngine.initialize(adapter);
      
      ConnectivityEngine.initialize();
      AuthenticationEngine.initialize();
      UserContextEngine.initialize();
      WorkerProfileEngine.initialize();
      
      setBootstrapState('READY');
    } catch (error) {
      console.error('Bootstrap failed:', error);
      setBootstrapState('ERROR');
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  useEffect(() => {
    initializeBackend();
  }, []);

  return (
    <div id="app-root" className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between p-8 md:p-16 font-sans">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" id="status-indicator"></div>
          <span className="font-mono text-xs text-neutral-400 tracking-wider uppercase">Sapana Ecosystem</span>
        </div>
        <span className="font-mono text-xs text-neutral-500">v1.0.0-bootstrap</span>
      </header>

      <main className="max-w-2xl my-auto">
        <h1 className="text-3xl md:text-5xl font-sans font-semibold tracking-tight text-neutral-50">
          Sapana Live Tracker
        </h1>
        
        <div className="mt-8 p-6 bg-neutral-900 border border-neutral-800 rounded-lg">
          <h2 className="text-xl font-mono mb-4 text-neutral-300">Backend Initialization</h2>
          
          {bootstrapState === 'INITIALIZING' && (
            <div className="flex items-center gap-3 text-neutral-400">
              <div className="w-4 h-4 border-2 border-neutral-400 border-t-emerald-500 rounded-full animate-spin"></div>
              <span>Bootstrapping engines...</span>
            </div>
          )}

          {bootstrapState === 'READY' && (
            <div className="flex items-center gap-3 text-emerald-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              <span>Backend initialization completed successfully.</span>
            </div>
          )}

          {bootstrapState === 'ERROR' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 text-red-400 bg-red-950/30 p-4 rounded border border-red-900/50">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <div className="text-sm font-mono break-all">{errorMessage || 'An unknown error occurred during bootstrap.'}</div>
              </div>
              <button 
                onClick={initializeBackend}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 rounded font-mono text-sm transition-colors border border-neutral-700"
              >
                Retry Bootstrap
              </button>
            </div>
          )}
        </div>
        
        <div className="mt-8 flex flex-wrap gap-4" id="badge-container">
          <span className="px-3 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs font-mono text-neutral-400">
            Repository: Bootstrapped
          </span>
          <span className="px-3 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs font-mono text-emerald-400">
            Architecture: Frozen v1.0
          </span>
          <span className="px-3 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs font-mono text-neutral-400">
            Engine + Feature Ready
          </span>
        </div>
      </main>

      <footer className="border-t border-neutral-900 pt-6 flex flex-col sm:flex-row sm:justify-between gap-4 font-mono text-xs text-neutral-500">
        <div>
          <span>Refer to </span>
          <code className="text-neutral-300">/docs</code>
          <span> for foundations & roadmap</span>
        </div>
        <div>
          <span>MIT License</span>
        </div>
      </footer>
    </div>
  );
}
