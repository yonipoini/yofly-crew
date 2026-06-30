import * as Location from 'expo-location';

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

export const DeviceLocationService = {
  async requestForegroundPermission() {
    return Location.requestForegroundPermissionsAsync();
  },

  async getCurrentLocation(): Promise<DeviceCoordinates | null> {
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
    const currentPromise = (async () => {
      try {
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown?.coords) {
          return normalizeCoordinates(lastKnown.coords);
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        return normalizeCoordinates(current.coords);
      } catch (e) {
        return null;
      }
    })();

    return Promise.race([currentPromise, timeoutPromise]);
  },

  async watchLocation(onChange: (coords: DeviceCoordinates) => void) {
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
