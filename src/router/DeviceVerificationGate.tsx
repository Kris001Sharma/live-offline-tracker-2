import React, { useEffect, useRef, useState } from 'react';
import {
  TrustedDeviceRegistrationEngine,
  DeviceVerificationState,
  TrustedDeviceRegistrationResultCode
} from '../../modules/trusted-device-registration';
import { IdentityResolver, IdentityResolutionState } from '../../modules/identity-resolution';
import NativeDeviceDiagnostics from '../shell/NativeDeviceDiagnostics';

type VerificationPhase =
  | 'checking'
  | 'device_unavailable'
  | 'not_registered'
  | 'trusted'
  | 'different_device'
  | 'error';

/**
 * Device Verification Gate (Slice 10A.5-D minimal UI wiring, Slice 10A.5-W
 * identity-resolution boundary).
 *
 * Resolves the application identity boundary first (IdentityResolver):
 * - AUTHENTICATED_DEVICE_AVAILABLE: consume the TrustedDeviceRegistrationEngine
 *   contract for the trusted-device states:
 *   - State A (no active trusted device): prompt to register this device.
 *   - State B (current device trusted): continue to the post-login screen.
 *   - State C (another device already trusted): blocked, contact administrator.
 *   - State D (error): clear non-technical error.
 * - AUTHENTICATED_DEVICE_UNAVAILABLE: the browser provides no authoritative
 *   device identity, so trusted-device registration stays unavailable. The
 *   browser never silently registers itself as a trusted Android device.
 * - RESOLUTION_FAILED / UNAUTHENTICATED: clear non-technical error.
 *
 * A Sign Out control is offered in every non-trusted state so a worker on an
 * unverified, blocked, or errored device is never stuck on the screen.
 */
const DeviceVerificationGate: React.FC<{ children: React.ReactNode; onSignOut?: () => void }> = ({ children, onSignOut }) => {
  const [phase, setPhase] = useState<VerificationPhase>('checking');
  const [registering, setRegistering] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const checkRef = useRef<Promise<void> | null>(null);

  const diagnosticsButton = (
    <button
      onClick={() => setShowDiagnostics(v => !v)}
      className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded font-mono text-xs border border-neutral-700"
    >
      {showDiagnostics ? 'Hide Diagnostics' : 'Show Diagnostics'}
    </button>
  );

  const applyVerification = (verification: DeviceVerificationState): void => {
    switch (verification) {
      case DeviceVerificationState.TRUSTED:
        setPhase('trusted');
        break;
      case DeviceVerificationState.DIFFERENT_DEVICE:
        setPhase('different_device');
        break;
      case DeviceVerificationState.NOT_REGISTERED:
        setPhase('not_registered');
        break;
      default:
        setPhase('error');
    }
  };

  const checkStatus = async (): Promise<void> => {
    console.log('[NativeIdentityDiag] DeviceVerificationGate.checkStatus: START');
    const identity = IdentityResolver.resolve();
    console.log('[NativeIdentityDiag] DeviceVerificationGate.checkStatus: identity resolved', identity);

    switch (identity.state) {
      case IdentityResolutionState.AUTHENTICATED_DEVICE_AVAILABLE: {
        const result = await TrustedDeviceRegistrationEngine.status();
        console.log('[NativeIdentityDiag] DeviceVerificationGate.checkStatus: registration status', result);
        applyVerification(result.verification);
        break;
      }
      case IdentityResolutionState.AUTHENTICATED_DEVICE_UNAVAILABLE:
        console.log('[NativeIdentityDiag] DeviceVerificationGate.checkStatus: AUTHENTICATED_DEVICE_UNAVAILABLE');
        setPhase('device_unavailable');
        break;
      case IdentityResolutionState.UNAUTHENTICATED:
      case IdentityResolutionState.RESOLUTION_FAILED:
      default:
        console.log('[NativeIdentityDiag] DeviceVerificationGate.checkStatus: error/resolution_failed');
        setPhase('error');
        break;
    }
    console.log('[NativeIdentityDiag] DeviceVerificationGate.checkStatus: END phase=' + phase);
  };

  useEffect(() => {
    if (!checkRef.current) {
      checkRef.current = checkStatus().catch(() => setPhase('error'));
    }
    checkRef.current.then(() => {
      // Result is applied inside checkStatus; keep the promise chain stable.
    });
    return () => {
      // Do not clear the ref: the initial check must run exactly once.
    };
  }, []);

  const handleRegister = async (): Promise<void> => {
    if (registering) {
      return;
    }
    console.log('[NativeIdentityDiag] DeviceVerificationGate.handleRegister: START');
    setRegistering(true);
    const result = await TrustedDeviceRegistrationEngine.registerCurrentDevice();
    console.log('[NativeIdentityDiag] DeviceVerificationGate.handleRegister: result', result);
    setRegistering(false);

    if (result.success) {
      console.log('[NativeIdentityDiag] DeviceVerificationGate.handleRegister: SUCCESS, rechecking');
      await checkStatus();
    } else if (result.code === TrustedDeviceRegistrationResultCode.DEVICE_MISMATCH) {
      console.log('[NativeIdentityDiag] DeviceVerificationGate.handleRegister: DEVICE_MISMATCH');
      setPhase('different_device');
    } else {
      console.log('[NativeIdentityDiag] DeviceVerificationGate.handleRegister: ERROR phase');
      setPhase('error');
    }
  };

  if (phase === 'checking') {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">{diagnosticsButton}</div>
        {showDiagnostics && <NativeDeviceDiagnostics />}
        <div className="text-center">
          <div className="flex items-center gap-3 text-neutral-400">
            <div className="w-4 h-4 border-2 border-neutral-400 border-t-emerald-500 rounded-full animate-spin"></div>
            <span className="text-sm font-mono">Checking device...</span>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'device_unavailable') {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">{diagnosticsButton}</div>
        {showDiagnostics && <NativeDeviceDiagnostics />}
        <div className="flex justify-end">
          <button
            onClick={onSignOut}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 rounded font-mono text-sm transition-colors border border-neutral-700"
          >
            Sign Out
          </button>
        </div>
        <div className="text-center space-y-2">
          <div className="text-neutral-100 font-mono text-sm">
            Trusted-device verification is not available in this development environment.
          </div>
          <div className="text-neutral-400 font-mono text-sm">
            Register your trusted device from the native Android app to continue.
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'different_device') {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">{diagnosticsButton}</div>
        {showDiagnostics && <NativeDeviceDiagnostics />}
        <div className="flex justify-end">
          <button
            onClick={onSignOut}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 rounded font-mono text-sm transition-colors border border-neutral-700"
          >
            Sign Out
          </button>
        </div>
        <div className="text-center space-y-2">
          <div className="text-neutral-100 font-mono text-sm">
            This account is already registered to another trusted device.
          </div>
          <div className="text-neutral-400 font-mono text-sm">
            Please contact an administrator to reset the trusted device.
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">{diagnosticsButton}</div>
        {showDiagnostics && <NativeDeviceDiagnostics />}
        <div className="flex justify-end">
          <button
            onClick={onSignOut}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 rounded font-mono text-sm transition-colors border border-neutral-700"
          >
            Sign Out
          </button>
        </div>
        <div className="text-center space-y-2">
          <div className="text-red-400 font-mono text-sm">
            Unable to verify this device. Please try again.
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'not_registered') {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">{diagnosticsButton}</div>
        {showDiagnostics && <NativeDeviceDiagnostics />}
        <div className="flex justify-end">
          <button
            onClick={onSignOut}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 rounded font-mono text-sm transition-colors border border-neutral-700"
          >
            Sign Out
          </button>
        </div>
        <div className="text-center space-y-4">
          <div className="text-neutral-100 font-mono text-sm">
            This device is not registered.
          </div>
          <button
            onClick={handleRegister}
            disabled={registering}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-100 rounded font-mono text-sm transition-colors border border-neutral-700"
          >
            {registering ? 'Registering...' : 'Register this device'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">{diagnosticsButton}</div>
      {showDiagnostics && <NativeDeviceDiagnostics />}
      <div className="text-center">
        <div className="text-emerald-400 font-mono text-sm">
          Trusted device verified.
        </div>
      </div>
      {children}
    </div>
  );
};

export default DeviceVerificationGate;
