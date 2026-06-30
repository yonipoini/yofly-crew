import { CrewLocation } from '../types/locations';
import { supabase } from '../lib/supabase';
import { getSignedInUserId, shouldFallbackToLocalPersistence } from './RemotePersistenceSupport';
import { UserScopedStorage } from './UserScopedStorage';

const STORAGE_KEY = 'yofly.map.saved-locations';

type SavedLocationsByAirport = Record<string, CrewLocation[]>;

const normalizeAirportCode = (airportCode: string) => airportCode.trim().toUpperCase();

const readSavedLocations = async (): Promise<SavedLocationsByAirport> => {
  try {
    const rawValue = await UserScopedStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return {};
    }

    return JSON.parse(rawValue) as SavedLocationsByAirport;
  } catch (error) {
    console.warn('Failed to load saved map locations:', error);
    return {};
  }
};

const writeSavedLocations = async (value: SavedLocationsByAirport) => {
  try {
    await UserScopedStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    console.warn('Failed to persist saved map locations:', error);
  }
};

const mergeSavedLocations = (primary: CrewLocation[], secondary: CrewLocation[]) => {
  const locationMap = new Map<string, CrewLocation>();

  [...primary, ...secondary].forEach((location) => {
    locationMap.set(location.id, {
      ...locationMap.get(location.id),
      ...location,
      isSaved: true,
    });
  });

  return [...locationMap.values()];
};

export const SavedLocationsService = {
  async getSavedLocations(airportCode: string): Promise<CrewLocation[]> {
    const normalizedAirportCode = normalizeAirportCode(airportCode);
    const userId = await getSignedInUserId();

    if (!userId) {
      const savedLocations = await readSavedLocations();
      return savedLocations[normalizedAirportCode] || [];
    }

    try {
      const localSavedLocations = (await readSavedLocations())[normalizedAirportCode] || [];
      const { data, error } = await supabase
        .from('saved_locations')
        .select('payload')
        .eq('user_id', userId)
        .eq('airport_code', normalizedAirportCode)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const remoteLocations = (data || [])
        .map((row) => row.payload as CrewLocation | null)
        .filter((location): location is CrewLocation => Boolean(location))
        .map((location) => ({ ...location, isSaved: true }));

      if (localSavedLocations.length > 0) {
        const { error: syncError } = await supabase.from('saved_locations').upsert(
          localSavedLocations.map((location) => ({
            user_id: userId,
            airport_code: normalizedAirportCode,
            location_id: location.id,
            payload: { ...location, isSaved: true },
          })),
          { onConflict: 'user_id,airport_code,location_id' }
        );

        if (syncError && !shouldFallbackToLocalPersistence(syncError)) {
          console.warn('Failed to sync local saved map locations to remote:', syncError);
        }
      }

      const mergedLocations = mergeSavedLocations(remoteLocations, localSavedLocations);

      const snapshot = await readSavedLocations();
      snapshot[normalizedAirportCode] = mergedLocations;
      await writeSavedLocations(snapshot);
      return mergedLocations;
    } catch (error) {
      if (!shouldFallbackToLocalPersistence(error)) {
        console.warn('Failed to load remote saved map locations:', error);
      }
      const savedLocations = await readSavedLocations();
      return savedLocations[normalizedAirportCode] || [];
    }
  },

  async toggleSavedLocation(airportCode: string, location: CrewLocation): Promise<CrewLocation[]> {
    const normalizedAirportCode = normalizeAirportCode(airportCode);
    const savedLocations = await readSavedLocations();
    const current = savedLocations[normalizedAirportCode] || [];
    const exists = current.some((item) => item.id === location.id);

    const next = exists
      ? current.filter((item) => item.id !== location.id)
      : [{ ...location, isSaved: true }, ...current.filter((item) => item.id !== location.id)].slice(0, 12);

    savedLocations[normalizedAirportCode] = next;
    await writeSavedLocations(savedLocations);

    const userId = await getSignedInUserId();
    if (userId) {
      try {
        if (exists) {
          const { error } = await supabase
            .from('saved_locations')
            .delete()
            .eq('user_id', userId)
            .eq('airport_code', normalizedAirportCode)
            .eq('location_id', location.id);

          if (error) {
            throw error;
          }
        } else {
          const { error } = await supabase.from('saved_locations').upsert({
            user_id: userId,
            airport_code: normalizedAirportCode,
            location_id: location.id,
            payload: { ...location, isSaved: true },
          }, {
            onConflict: 'user_id,airport_code,location_id',
          });

          if (error) {
            throw error;
          }
        }
      } catch (error) {
        if (!shouldFallbackToLocalPersistence(error)) {
          console.warn('Failed to persist remote saved location:', error);
        }
      }
    }

    return next;
  },
};
