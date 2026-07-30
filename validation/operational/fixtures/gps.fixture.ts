export interface MockGPSCoordinate {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
}

export class GPSFixture {
  public static createCoordinate(lat = 13.7563, lng = 100.5018, accuracy = 5.0): MockGPSCoordinate {
    return {
      latitude: lat,
      longitude: lng,
      accuracy,
      timestamp: new Date().toISOString()
    };
  }
}
