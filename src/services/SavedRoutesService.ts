import { CrewLocation, CrewSavedRoute } from '../types/locations';
import { supabase } from '../lib/supabase';
import { getSignedInUserId, shouldFallbackToLocalPersistence } from './RemotePersistenceSupport';
import { UserScopedStorage } from './UserScopedStorage';

const STORAGE_KEY = 'yofly.map.saved-routes';

type SavedRoutesByAirport = Record<string, CrewSavedRoute[]>;

const normalizeAirportCode = (airportCode: string) => airportCode.trim().toUpperCase();

const readSavedRoutes = async (): Promise<SavedRoutesByAirport> => {
  try {
    const raw = await UserScopedStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    return JSON.parse(raw) as SavedRoutesByAirport;
  } catch (error) {
    console.warn('Failed to load saved crew routes:', error);
    return {};
  }
};

const writeSavedRoutes = async (value: SavedRoutesByAirport) => {
  try {
    await UserScopedStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    console.warn('Failed to persist saved crew routes:', error);
  }
};

const mergeSavedRoutes = (primary: CrewSavedRoute[], secondary: CrewSavedRoute[]) => {
  const routeMap = new Map<string, CrewSavedRoute>();

  [...primary, ...secondary].forEach((route) => {
    routeMap.set(route.locationId, route);
  });

  return [...routeMap.values()].sort(
    (left, right) => new Date(right.savedAt || 0).getTime() - new Date(left.savedAt || 0).getTime()
  );
};

const toSavedRoute = (airportCode: string, location: CrewLocation): CrewSavedRoute => ({
  id: `${normalizeAirportCode(airportCode)}:${location.id}`,
  airportCode: normalizeAirportCode(airportCode),
  locationId: location.id,
  destinationName: location.name,
  destinationType: location.type,
  destinationAddress: location.address,
  coordinate: location.coordinate,
  routeHint: location.routeHint,
  categorySummary: location.categorySummary || location.crewTip,
  savedAt: new Date().toISOString(),
});

export const SavedRoutesService = {
  async getSavedRoutes(airportCode: string): Promise<CrewSavedRoute[]> {
    const normalizedAirportCode = normalizeAirportCode(airportCode);
    const userId = await getSignedInUserId();

    if (!userId) {
      const routes = await readSavedRoutes();
      return routes[normalizedAirportCode] || [];
    }

    try {
      const localSavedRoutes = (await readSavedRoutes())[normalizedAirportCode] || [];
      const { data, error } = await supabase
        .from('saved_routes')
        .select('payload')
        .eq('user_id', userId)
        .eq('airport_code', normalizedAirportCode)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const remoteRoutes = (data || [])
        .map((row) => row.payload as CrewSavedRoute | null)
        .filter((route): route is CrewSavedRoute => Boolean(route));

      if (localSavedRoutes.length > 0) {
        const { error: syncError } = await supabase.from('saved_routes').upsert(
          localSavedRoutes.map((route) => ({
            user_id: userId,
            airport_code: normalizedAirportCode,
            location_id: route.locationId,
            payload: route,
          })),
          { onConflict: 'user_id,airport_code,location_id' }
        );

        if (syncError && !shouldFallbackToLocalPersistence(syncError)) {
          console.warn('Failed to sync local saved routes to remote:', syncError);
        }
      }

      const mergedRoutes = mergeSavedRoutes(remoteRoutes, localSavedRoutes);

      const snapshot = await readSavedRoutes();
      snapshot[normalizedAirportCode] = mergedRoutes;
      await writeSavedRoutes(snapshot);
      return mergedRoutes;
    } catch (error) {
      if (!shouldFallbackToLocalPersistence(error)) {
        console.warn('Failed to load remote saved routes:', error);
      }
      const routes = await readSavedRoutes();
      return routes[normalizedAirportCode] || [];
    }
  },

  async toggleSavedRoute(airportCode: string, location: CrewLocation): Promise<CrewSavedRoute[]> {
    const normalizedAirportCode = normalizeAirportCode(airportCode);
    const routes = await readSavedRoutes();
    const current = routes[normalizedAirportCode] || [];
    const routeId = `${normalizedAirportCode}:${location.id}`;
    const exists = current.some((route) => route.id === routeId);

    const next = exists
      ? current.filter((route) => route.id !== routeId)
      : [toSavedRoute(normalizedAirportCode, location), ...current.filter((route) => route.id !== routeId)].slice(0, 8);

    routes[normalizedAirportCode] = next;
    await writeSavedRoutes(routes);

    const userId = await getSignedInUserId();
    if (userId) {
      try {
        if (exists) {
          const { error } = await supabase
            .from('saved_routes')
            .delete()
            .eq('user_id', userId)
            .eq('airport_code', normalizedAirportCode)
            .eq('location_id', location.id);

          if (error) {
            throw error;
          }
        } else {
          const nextRoute = toSavedRoute(normalizedAirportCode, location);
          const { error } = await supabase.from('saved_routes').upsert({
            user_id: userId,
            airport_code: normalizedAirportCode,
            location_id: location.id,
            payload: nextRoute,
          }, {
            onConflict: 'user_id,airport_code,location_id',
          });

          if (error) {
            throw error;
          }
        }
      } catch (error) {
        if (!shouldFallbackToLocalPersistence(error)) {
          console.warn('Failed to persist remote saved route:', error);
        }
      }
    }

    return next;
  },
};
