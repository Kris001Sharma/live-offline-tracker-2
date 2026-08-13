import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { TrustedDeviceEngine, selectDeviceIdentityProvider } from '../../modules/trusted-device';
import { IdentityResolver } from '../../modules/identity-resolution';
import { TrustedDeviceRegistrationEngine } from '../../modules/trusted-device-registration';

interface DiagnosticData {
  runtime: {
    isNative: boolean;
    platform: string;
    platformId: string;
  };
  capacitorDevice: any;
  provider: {
    kind: string;
    developmentOnly: boolean;
  };
  engineStatus: any;
  engineDevice: any;
  resolver: any;
  registrationStatus: any;
}

export default function NativeDeviceDiagnostics() {
  const [data, setData] = useState<DiagnosticData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setLoading(true);
    setError(null);
    try {
      const runtime = {
        isNative: Capacitor.isNativePlatform(),
        platform: Capacitor.getPlatform(),
        platformId: Capacitor.getPlatform()
      };

      let capacitorDevice: any = { status: 'NOT_ATTEMPTED' };
      try {
        const deviceIdInfo = await Device.getId();
        const deviceInfo = await Device.getInfo();
        capacitorDevice = {
          status: 'SUCCESS',
          identifier: deviceIdInfo.identifier,
          manufacturer: deviceInfo.manufacturer,
          model: deviceInfo.model,
          platform: deviceInfo.platform,
          operatingSystem: deviceInfo.operatingSystem,
          osVersion: deviceInfo.osVersion
        };
      } catch (e: any) {
        capacitorDevice = {
          status: 'ERROR',
          error: e?.message || String(e)
        };
      }

      const provider = selectDeviceIdentityProvider();
      const engineStatus = TrustedDeviceEngine.status();
      const engineDevice = TrustedDeviceEngine.device();
      const resolver = IdentityResolver.resolve();
      const registrationStatus = await TrustedDeviceRegistrationEngine.status();

      setData({
        runtime,
        capacitorDevice,
        provider: {
          kind: provider.kind,
          developmentOnly: provider.developmentOnly
        },
        engineStatus,
        engineDevice,
        resolver,
        registrationStatus
      });
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const renderValue = (label: string, value: any) => (
    <div key={label} className="flex justify-between items-start gap-4">
      <span className="text-neutral-400 text-xs uppercase tracking-wider">{label}</span>
      <span className="text-neutral-100 text-xs text-right break-all">{value === undefined || value === null ? 'null' : JSON.stringify(value)}</span>
    </div>
  );

  if (loading) {
    return (
      <div className="p-4 bg-neutral-900 border border-neutral-700 rounded space-y-3">
        <div className="text-emerald-400 font-mono text-sm font-bold">Native Device Diagnostics</div>
        <div className="text-neutral-400 font-mono text-xs">Running diagnostics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-neutral-900 border border-neutral-700 rounded space-y-3">
        <div className="text-emerald-400 font-mono text-sm font-bold">Native Device Diagnostics</div>
        <div className="text-red-400 font-mono text-xs">Error: {error}</div>
        <button onClick={runDiagnostics} className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 rounded font-mono text-xs border border-neutral-700">
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-4 bg-neutral-900 border border-neutral-700 rounded space-y-4">
      <div className="text-emerald-400 font-mono text-sm font-bold">Native Device Diagnostics</div>
      
      <div className="space-y-2">
        <div className="text-neutral-100 font-mono text-xs font-bold uppercase tracking-wider border-b border-neutral-800 pb-1">Runtime</div>
        {renderValue('Platform', data.runtime.platform)}
        {renderValue('Native runtime', data.runtime.isNative ? 'YES' : 'NO')}
        {renderValue('Device plugin', data.capacitorDevice.status === 'SUCCESS' ? 'AVAILABLE' : 'UNAVAILABLE')}
      </div>

      <div className="space-y-2">
        <div className="text-neutral-100 font-mono text-xs font-bold uppercase tracking-wider border-b border-neutral-800 pb-1">Capacitor Device</div>
        {renderValue('getId()', data.capacitorDevice.status)}
        {data.capacitorDevice.status === 'SUCCESS' && renderValue('Device ID', data.capacitorDevice.identifier)}
        {data.capacitorDevice.status === 'ERROR' && renderValue('Error', data.capacitorDevice.error)}
      </div>

      <div className="space-y-2">
        <div className="text-neutral-100 font-mono text-xs font-bold uppercase tracking-wider border-b border-neutral-800 pb-1">Identity Provider</div>
        {renderValue('Kind', data.provider.kind)}
        {renderValue('Development only', data.provider.developmentOnly ? 'YES' : 'NO')}
      </div>

      <div className="space-y-2">
        <div className="text-neutral-100 font-mono text-xs font-bold uppercase tracking-wider border-b border-neutral-800 pb-1">TrustedDeviceEngine</div>
        {renderValue('Initialized', data.engineStatus.initialized ? 'YES' : 'NO')}
        {renderValue('State', data.engineStatus.state)}
        {renderValue('Last loaded', data.engineStatus.lastLoadedAt || 'never')}
        {renderValue('Device available', data.engineDevice ? 'YES' : 'NO')}
        {data.engineDevice && renderValue('Device ID', data.engineDevice.deviceId)}
        {data.engineDevice && renderValue('Platform', data.engineDevice.platform)}
      </div>

      <div className="space-y-2">
        <div className="text-neutral-100 font-mono text-xs font-bold uppercase tracking-wider border-b border-neutral-800 pb-1">IdentityResolver</div>
        {renderValue('State', data.resolver.state)}
        {data.resolver.workerId && renderValue('Worker ID', data.resolver.workerId)}
        {data.resolver.workerEmail && renderValue('Worker email', data.resolver.workerEmail)}
        {renderValue('Device kind', data.resolver.deviceIdentityKind || 'n/a')}
        {renderValue('Development only', data.resolver.deviceIdentityDevelopmentOnly != null ? String(data.resolver.deviceIdentityDevelopmentOnly) : 'n/a')}
        {data.resolver.message && renderValue('Message', data.resolver.message)}
      </div>

      <div className="space-y-2">
        <div className="text-neutral-100 font-mono text-xs font-bold uppercase tracking-wider border-b border-neutral-800 pb-1">Trusted Device Registration</div>
        {renderValue('Status', data.registrationStatus.status)}
        {renderValue('Verification', data.registrationStatus.verification)}
        {data.registrationStatus.message && renderValue('Message', data.registrationStatus.message)}
      </div>

      <button onClick={runDiagnostics} className="w-full px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 rounded font-mono text-xs border border-neutral-700 transition-colors">
        Refresh Diagnostics
      </button>
    </div>
  );
}
