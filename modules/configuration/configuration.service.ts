import { ConfigurationState, FeatureFlag } from './configuration.types';
import {
  DEFAULT_APP_NAME,
  DEFAULT_APP_VERSION,
  DEFAULT_GPS_ACCURACY_THRESHOLD_METERS,
  DEFAULT_SYNC_INTERVAL_MS,
  DEFAULT_TRACKING_INTERVAL_MS,
} from './configuration.constants';

let state: ConfigurationState | null = null;

function parseFeatureFlags(flagsStr?: string): Record<string, boolean> {
  if (!flagsStr) return {};
  try {
    return flagsStr.split(',').reduce((acc, flag) => {
      const [key, value] = flag.split('=');
      if (key) {
        acc[key.trim()] = value ? value.trim().toLowerCase() === 'true' : true;
      }
      return acc;
    }, {} as Record<string, boolean>);
  } catch (error) {
    console.warn('Configuration Engine: Failed to parse feature flags.', error);
    return {};
  }
}

export const Configuration = {
  load(): void {
    // In Vite environments, env variables are exposed on import.meta.env
    const envMeta = (import.meta as any).env || {};
    const envProc = typeof process !== "undefined" && process.env ? process.env : {};
    const env = { ...envProc, ...envMeta };
    const supabaseUrl = env.VITE_SUPABASE_URL;
    const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl) {
      throw new Error('Configuration Engine Error: VITE_SUPABASE_URL is missing.');
    }
    
    if (!supabaseAnonKey) {
      throw new Error('Configuration Engine Error: VITE_SUPABASE_ANON_KEY is missing.');
    }

    const trackingInterval = parseInt(env.VITE_TRACKING_INTERVAL_MS, 10);
    const syncInterval = parseInt(env.VITE_SYNC_INTERVAL_MS, 10);
    const gpsAccuracy = parseInt(env.VITE_GPS_ACCURACY_THRESHOLD_METERS, 10);

    const lat = parseFloat(env.VITE_ATTENDANCE_GEOFENCE_LAT);
    const lng = parseFloat(env.VITE_ATTENDANCE_GEOFENCE_LNG);
    const radius = parseFloat(env.VITE_ATTENDANCE_GEOFENCE_RADIUS);

    state = {
      environment: {
        supabase: {
          url: supabaseUrl,
          anonKey: supabaseAnonKey,
        },
        app: {
          name: env.VITE_APP_NAME || DEFAULT_APP_NAME,
          version: env.VITE_APP_VERSION || DEFAULT_APP_VERSION,
        },
      },
      runtime: {
        tracking: {
          intervalMs: isNaN(trackingInterval) ? DEFAULT_TRACKING_INTERVAL_MS : trackingInterval,
        },
        sync: {
          intervalMs: isNaN(syncInterval) ? DEFAULT_SYNC_INTERVAL_MS : syncInterval,
        },
        gps: {
          accuracyThresholdMeters: isNaN(gpsAccuracy) ? DEFAULT_GPS_ACCURACY_THRESHOLD_METERS : gpsAccuracy,
        },
        attendance: {
          geofence: !isNaN(lat) && !isNaN(lng) && !isNaN(radius) ? {
            center: { latitude: lat, longitude: lng },
            radiusMeters: radius
          } : undefined
        },
        featureFlags: parseFeatureFlags(env.VITE_FEATURE_FLAGS),
      },
    };
  },

  get config(): ConfigurationState {
    if (!state) {
      throw new Error('Configuration Engine has not been initialized. Call load() first.');
    }
    return state;
  },

  isFeatureEnabled(featureName: FeatureFlag | string): boolean {
    if (!state) {
      throw new Error('Configuration Engine has not been initialized. Call load() first.');
    }
    return !!state.runtime.featureFlags[featureName as string];
  },
};
