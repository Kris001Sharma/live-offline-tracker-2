import { UserContextEngine } from '../user-context';
import { TrustedDeviceEngine, selectDeviceIdentityProvider } from '../trusted-device';
import { IdentityResolution, IdentityResolutionState } from './identity-resolution.types';

/**
 * ARCHITECTURE NOTE: Identity Resolution Ownership
 *
 * This module owns RESOLUTION ONLY. It answers the two boundary questions the
 * Device Verification flow needs, through existing public contracts:
 *
 *   1. "Which authenticated worker is active?" — UserContextEngine
 *      (the single authoritative source of the currently authenticated worker,
 *      populated by AuthSession on login/restore).
 *   2. "Is an authoritative device identity available?" — TrustedDeviceEngine
 *      (runtime device identity) combined with the platform provider selection
 *      (selectDeviceIdentityProvider). A device identity is authoritative for
 *      trusted-device purposes ONLY when the active provider is native
 *      (Capacitor/Android ANDROID_ID). The browser provider is explicitly
 *      development/test only and is never treated as authoritative.
 *
 * This module is stateless: it performs NO initialization, owns NO lifecycle,
 * and must never be initialized or wired by the router or React components.
 * It deliberately does NOT perform trusted-device enforcement (registration,
 * verification, admin reset) — that remains owned by
 * TrustedDeviceRegistrationEngine / TrustedDeviceRepository.
 *
 * Browser behaviour is deterministic and honest: when running in a browser the
 * resolved state reports the device identity as unavailable, so the Device
 * Verification UI keeps trusted-device registration unavailable. The browser
 * never silently registers itself as a trusted Android device and never
 * fabricates an identity to make the registration flow pass.
 */

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  const cloned: any = Array.isArray(obj) ? [] : {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepFreeze((obj as any)[key]);
    }
  }
  return Object.freeze(cloned);
}

export const IdentityResolver = {
  /**
   * Resolves the current identity boundary state.
   *
   * Synchronous composition of existing public APIs; never rejects.
   */
  resolve(): IdentityResolution {
    console.log('[NativeIdentityDiag] IdentityResolver.resolve: START');
    try {
      const worker = UserContextEngine.currentWorker();
      console.log('[NativeIdentityDiag] IdentityResolver.resolve: worker', worker ? { id: worker.id, email: worker.email } : null);

      if (!worker) {
        console.log('[NativeIdentityDiag] IdentityResolver.resolve: UNAUTHENTICATED');
        return deepFreeze({ state: IdentityResolutionState.UNAUTHENTICATED });
      }

      const trustedDeviceStatus = TrustedDeviceEngine.status();
      console.log('[NativeIdentityDiag] IdentityResolver.resolve: trustedDeviceStatus', trustedDeviceStatus);
      if (!trustedDeviceStatus.initialized) {
        console.log('[NativeIdentityDiag] IdentityResolver.resolve: RESOLUTION_FAILED (not initialized)');
        return deepFreeze({
          state: IdentityResolutionState.RESOLUTION_FAILED,
          workerId: worker.id,
          workerEmail: worker.email,
          message: 'TrustedDeviceEngine is not initialized'
        });
      }

      const provider = selectDeviceIdentityProvider();
      console.log('[NativeIdentityDiag] IdentityResolver.resolve: provider', { kind: provider.kind, developmentOnly: provider.developmentOnly });
      const device = TrustedDeviceEngine.device();
      console.log('[NativeIdentityDiag] IdentityResolver.resolve: device', device);

      // An authoritative device identity is available only when the runtime
      // provides a real native identity (Capacitor/Android ANDROID_ID). The
      // browser provider is explicitly development/test only and is never
      // treated as an authoritative trusted-device identity.
      if (device !== null && provider.kind === 'native') {
        console.log('[NativeIdentityDiag] IdentityResolver.resolve: AUTHENTICATED_DEVICE_AVAILABLE');
        return deepFreeze({
          state: IdentityResolutionState.AUTHENTICATED_DEVICE_AVAILABLE,
          workerId: worker.id,
          workerEmail: worker.email,
          deviceIdentityKind: 'native'
        });
      }

      console.log('[NativeIdentityDiag] IdentityResolver.resolve: AUTHENTICATED_DEVICE_UNAVAILABLE');
      // Authenticated worker but no authoritative device identity:
      // - browser: a dev/test browser identity may exist, but it is NOT
      //   authoritative, so trusted-device availability is explicitly false.
      // - native: the device identity could not be established (load failure).
      return deepFreeze({
        state: IdentityResolutionState.AUTHENTICATED_DEVICE_UNAVAILABLE,
        workerId: worker.id,
        workerEmail: worker.email,
        deviceIdentityKind: provider.kind,
        deviceIdentityDevelopmentOnly: provider.developmentOnly
      });
    } catch (error) {
      console.error('[NativeIdentityDiag] IdentityResolver.resolve: RESOLUTION_FAILED (exception)', error);
      return deepFreeze({
        state: IdentityResolutionState.RESOLUTION_FAILED,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
};
