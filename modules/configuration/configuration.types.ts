export enum FeatureFlag {
  DEBUG_MODE = 'DEBUG_MODE',
  MOCK_GPS = 'MOCK_GPS'
}

export interface EnvironmentConfig {
  supabase: {
    url: string;
    anonKey: string;
  };
  app: {
    name: string;
    version: string;
  };
}

export interface RuntimeConfig {
  tracking: {
    intervalMs: number;
  };
  sync: {
    intervalMs: number;
  };
  gps: {
    accuracyThresholdMeters: number;
  };
  attendance: {
    geofence?: {
      center: {
        latitude: number;
        longitude: number;
      };
      radiusMeters: number;
    };
  };
  featureFlags: Record<string, boolean>;
}

export interface ConfigurationState {
  environment: EnvironmentConfig;
  runtime: RuntimeConfig;
}
