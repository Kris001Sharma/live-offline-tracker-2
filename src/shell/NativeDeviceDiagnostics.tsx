import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { TrustedDeviceEngine, selectDeviceIdentityProvider } from '../../modules/trusted-device';
import { IdentityResolver } from '../../modules/identity-resolution';
import { TrustedDeviceRegistrationEngine } from '../../modules/trusted-device-registration';
import { UserContextEngine } from '../../modules/user-context';
import { TrustedDeviceRepository } from '../../modules/repositories';
import { ConnectivityEngine } from '../../modules/connectivity';
import { TrustedDeviceSyncEngine } from '../../modules/trusted-device-sync/trusted-device-sync.service';
import { DiagnosticTraceStore } from '../../modules/diagnostic/diagnostic-trace.store';

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
  const [traceEvents, setTraceEvents] = useState<ReturnType<typeof DiagnosticTraceStore.getEvents>>([]);

  useEffect(() => {
    const unsubscribe = DiagnosticTraceStore.subscribe((events) => {
      setTraceEvents(events);
    });
    setTraceEvents(DiagnosticTraceStore.getEvents());
    return unsubscribe;
  }, []);

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

  const handleClearTrace = useCallback(() => {
    DiagnosticTraceStore.clear();
  }, []);

  const handleCopyTrace = useCallback(() => {
    const text = traceEvents.map(e => {
      const time = new Date(e.timestamp).toISOString().split('T')[1].replace('Z', '');
      let lines = [`${e.id} (${time}) [${e.result}]`];
      lines.push(`  step: ${e.data.step || e.id}`);
      for (const [key, val] of Object.entries(e.data)) {
        if (key === 'step') continue;
        lines.push(`  ${key}: ${typeof val === 'object' ? JSON.stringify(val) : val}`);
      }
      return lines.join('\n');
    }).join('\n\n');
    navigator.clipboard.writeText(text).catch(() => {});
  }, [traceEvents]);

  const verificationResult = traceEvents.find(e => e.id === 'finalTrustedDeviceDecision');
  const authorityDecision = verificationResult?.data?.authoritativeDecision ?? 'NOT_REACHED';
  const returnedStatus = verificationResult?.data?.returnedStatus ?? 'NOT_REACHED';
  const decisionConsistent = verificationResult?.data?.decisionConsistent ?? false;
  const gateEvent = traceEvents.find(e => e.id === 'gateDecision');
  const renderedState = gateEvent?.data?.renderedState ?? 'NOT_REACHED';

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

  return (
    <div className="p-4 bg-neutral-900 border border-neutral-700 rounded space-y-4">
      <div className="text-emerald-400 font-mono text-sm font-bold">Native Device Diagnostics</div>

      <div className="space-y-2">
        <div className="text-neutral-100 font-mono text-xs font-bold uppercase tracking-wider border-b border-neutral-800 pb-1">Verification Result</div>
        {renderValue('Expected Authority Decision', authorityDecision)}
        {renderValue('Actual Returned Status', returnedStatus)}
        {renderValue('Gate Rendered State', renderedState)}
        <div className={`text-xs font-mono ${decisionConsistent ? 'text-emerald-400' : 'text-red-400'}`}>
          CONSISTENCY: {decisionConsistent ? 'PASS' : 'FAIL'}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-neutral-100 font-mono text-xs font-bold uppercase tracking-wider border-b border-neutral-800 pb-1">Automatic Trusted Device Verification Trace</div>
        {traceEvents.length === 0 && (
          <div className="text-neutral-400 font-mono text-xs">No trace events captured yet.</div>
        )}
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {traceEvents.map((event) => (
            <details key={event.id} className="bg-neutral-800 rounded border border-neutral-700">
              <summary className="px-2 py-1 text-xs font-mono cursor-pointer select-none">
                <span className="text-neutral-400">{event.id}</span>
                <span className={`ml-2 ${event.result === 'SUCCESS' ? 'text-emerald-400' : event.result === 'FAILED' ? 'text-red-400' : 'text-neutral-300'}`}>{event.result}</span>
                <span className="ml-2 text-neutral-500">{new Date(event.timestamp).toISOString().split('T')[1].replace('Z', '')}</span>
              </summary>
              <div className="px-2 py-1 space-y-1 border-t border-neutral-700">
                {Object.entries(event.data).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-start gap-2">
                    <span className="text-neutral-400 text-xs">{key}</span>
                    <span className="text-neutral-100 text-xs text-right break-all">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={runDiagnostics} className="flex-1 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 rounded font-mono text-xs border border-neutral-700 transition-colors">
          Refresh Diagnostics
        </button>
        <button onClick={handleClearTrace} className="flex-1 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 rounded font-mono text-xs border border-neutral-700 transition-colors">
          Clear Verification Trace
        </button>
        <button onClick={handleCopyTrace} className="flex-1 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 rounded font-mono text-xs border border-neutral-700 transition-colors">
          Copy Verification Trace
        </button>
      </div>
    </div>
  );
}
