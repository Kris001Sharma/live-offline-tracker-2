import React from 'react';

const BootstrapScreen: React.FC = () => {
  return (
    <div className="text-center">
      <div className="space-y-4">
        <span className="text-3xl md:text-5xl font-sans font-semibold tracking-tight text-neutral-50">
          Sapana Live Tracker
        </span>
        <span className="text-xl font-mono mb-4 text-neutral-300">
          Backend Initialization
        </span>
        <div className="flex items-center gap-3 text-neutral-400">
          <div className="w-4 h-4 border-2 border-neutral-400 border-t-emerald-500 rounded-full animate-spin"></div>
          <span>Bootstrapping engines...</span>
        </div>
        <span className="text-xs font-mono text-neutral-400">
          Repository: Bootstrapped
        </span>
        <span className="text-xs font-mono text-emerald-400">
          Architecture: Frozen v1.0
        </span>
        <span className="text-xs font-mono text-neutral-400">
          Engine + Feature Ready
        </span>
      </div>
    </div>
  );
};

export default BootstrapScreen;