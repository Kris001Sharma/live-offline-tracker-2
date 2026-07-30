/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export default function App() {
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
        <p className="mt-4 text-neutral-400 text-sm md:text-base leading-relaxed">
          The offline-first workforce location tracking platform designed for field teams operating in areas with intermittent or no connectivity.
        </p>
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
