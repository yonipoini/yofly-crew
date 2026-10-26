import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DeviceCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}

const normalizeCoordinates = (coords: Location.LocationObjectCoords): DeviceCoordinates => ({
  latitude: coords.latitude,
  longitude: coords.longitude,
  accuracy: coords.accuracy,
});

const getMockedCoordsIfRiley = async (): Promise<DeviceCoordinates | null> => {
  try {
    const stored = await AsyncStorage.getItem('yofly.profile');
    if (stored) {
      const parsed = JSON.parse(stored);
      // If user profile is Capt. Riley, mock GPS location to Orlando Airport (MCO) departures hall
      if (parsed?.fullName?.toLowerCase().startsWith('capt. riley')) {
        return {
          latitude: 28.43115,
          longitude: -81.30808,
          accuracy: 5,
        };
      }
    }
  } catch (err) {
    // Ignore and fallback to real GPS
  }
  return null;
};

export const DeviceLocationService = {
  async requestForegroundPermission() {
    return Location.requestForegroundPermissionsAsync();
  },

  async getLastKnownLocation(): Promise<DeviceCoordinates | null> {
    const mock = await getMockedCoordsIfRiley();
    if (mock) return mock;

    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return null;

      const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 20 * 60 * 1000 });
      return lastKnown?.coords ? normalizeCoordinates(lastKnown.coords) : null;
    } catch {
      return null;
    }
  },

  async getCurrentLocation(options?: { requireFresh?: boolean }): Promise<DeviceCoordinates | null> {
    const mock = await getMockedCoordsIfRiley();
    if (mock) {
      return mock;
    }

    try {
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
      }
      if (status !== 'granted') {
        return null;
      }

      // Fast path: instant lookup from system location cache (10-50ms)
      if (!options?.requireFresh) {
        try {
          const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 15 * 60 * 1000 });
          if (lastKnown?.coords) {
            return normalizeCoordinates(lastKnown.coords);
          }
        } catch {
          // continue to fresh position
        }
      }

      // Fresh position with 6000ms safety window
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000));
      const currentPromise = (async () => {
        try {
          const current = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          return normalizeCoordinates(current.coords);
        } catch (e) {
          try {
            const fallback = await Location.getLastKnownPositionAsync();
            return fallback?.coords ? normalizeCoordinates(fallback.coords) : null;
          } catch {
            return null;
          }
        }
      })();

      return Promise.race([currentPromise, timeoutPromise]);
    } catch {
      return null;
    }
  },

  async watchLocation(onChange: (coords: DeviceCoordinates) => void) {
    const mock = await getMockedCoordsIfRiley();
    if (mock) {
      onChange(mock);
      const interval = setInterval(() => {
        onChange(mock);
      }, 5000);
      return {
        remove: () => clearInterval(interval),
      };
    }

    return Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 25,
        timeInterval: 15000,
      },
      (position) => {
        onChange(normalizeCoordinates(position.coords));
      }
    );
  },
};
