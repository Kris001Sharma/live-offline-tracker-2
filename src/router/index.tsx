import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import BootstrapScreen from './BootstrapScreen';
import AuthGate from './AuthGate';
import { useApplicationLifecycle, useLifecycleBootstrap } from '../shell';

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppRoutes />,
  },
]);

function AppRoutes() {
  const { state, error } = useApplicationLifecycle();
  const { retry: initializeBackend } = useLifecycleBootstrap();

  // When lifecycle is READY, show auth gate (login / session restore / dashboard)
  if (state === 'READY') {
    return <AuthGate />;
  }

  // When lifecycle is ERROR, show error screen
  if (state === 'ERROR') {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 text-red-400 bg-red-950/30 p-4 rounded border border-red-900/50">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <div className="text-sm font-mono break-all">{error || 'An unknown error occurred during bootstrap.'}</div>
        </div>
        <button
          onClick={initializeBackend}
          className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 rounded font-mono text-sm transition-colors border border-neutral-700"
        >
          Retry Bootstrap
        </button>
      </div>
    );
  }

  // For INITIALIZING state, show bootstrap screen
  return <BootstrapScreen />;
};

export default function AppRouter() {
  return (
    <RouterProvider router={router} />
  );
}