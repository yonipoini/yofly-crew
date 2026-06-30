import { CrewLocation } from '../types/locations';
import { supabase } from '../lib/supabase';
import { getSignedInUserId, shouldFallbackToLocalPersistence } from './RemotePersistenceSupport';
import { UserScopedStorage } from './UserScopedStorage';

type CrewPlaceIntelNote = {
  id: string;
  note: string;
  deal?: string;
  createdAt: string;
};

type CrewPlaceIntelState = Record<string, CrewPlaceIntelNote[]>;

type PlaceIntelRow = {
  id: string;
  airport_code: string;
  place_key: string;
  payload: {
    note?: string;
    deal?: string;
    createdAt?: string;
  } | null;
  created_at: string;
};

const STORAGE_KEY = 'yofly.place-intel';
const TABLE_NAME = 'place_intel_notes';

const normalizeText = (value: string | undefined) => (value || '').trim().toLowerCase();
const normalizeAirportCode = (value: string | undefined) => (value || 'UNK').trim().toUpperCase();

const buildLegacyLocationKey = (
  location: Pick<CrewLocation, 'airportCode' | 'name' | 'coordinate' | 'googlePlaceId'>
) =>
  location.googlePlaceId ||
  [
    normalizeAirportCode(location.airportCode),
    normalizeText(location.name),
    location.coordinate.latitude.toFixed(4),
    location.coordinate.longitude.toFixed(4),
  ].join(':');

const buildLocationKey = (
  location: Pick<CrewLocation, 'airportCode' | 'name' | 'coordinate' | 'googlePlaceId'>
) =>
  [
    normalizeAirportCode(location.airportCode),
    location.googlePlaceId
      ? `google:${location.googlePlaceId}`
      : `coord:${normalizeText(location.name)}:${location.coordinate.latitude.toFixed(4)}:${location.coordinate.longitude.toFixed(4)}`,
  ].join(':');

const getLocationKeyCandidates = (
  location: Pick<CrewLocation, 'airportCode' | 'name' | 'coordinate' | 'googlePlaceId'>
) => {
  const nextKey = buildLocationKey(location);
  const legacyKey = buildLegacyLocationKey(location);
  return legacyKey === nextKey ? [nextKey] : [nextKey, legacyKey];
};

const sortNotes = (notes: CrewPlaceIntelNote[]) =>
  [...notes].sort(
    (left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
  );

const mergeNotes = (...collections: CrewPlaceIntelNote[][]) => {
  const noteMap = new Map<string, CrewPlaceIntelNote>();

  collections.flat().forEach((note) => {
    if (!note?.id || !note.note?.trim()) {
      return;
    }

    noteMap.set(note.id, {
      id: note.id,
      note: note.note.trim(),
      deal: note.deal?.trim() || undefined,
      createdAt: note.createdAt,
    });
  });

  return sortNotes([...noteMap.values()]);
};

const readState = async (): Promise<CrewPlaceIntelState> => {
  try {
    const raw = await UserScopedStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    return (JSON.parse(raw) as CrewPlaceIntelState) || {};
  } catch (error) {
    console.warn('Failed to read place intel:', error);
    return {};
  }
};

const writeState = async (state: CrewPlaceIntelState) => {
  try {
    await UserScopedStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to write place intel:', error);
  }
};

const getLocalNotesForLocation = (
  state: CrewPlaceIntelState,
  location: Pick<CrewLocation, 'airportCode' | 'name' | 'coordinate' | 'googlePlaceId'>
) =>
  mergeNotes(
    ...getLocationKeyCandidates(location).map((candidateKey) => {
      return state[candidateKey] || [];
    })
  );

const setLocalNotesForLocation = (
  state: CrewPlaceIntelState,
  location: Pick<CrewLocation, 'airportCode' | 'name' | 'coordinate' | 'googlePlaceId'>,
  notes: CrewPlaceIntelNote[]
) => {
  const nextKey = buildLocationKey(location);
  const legacyKey = buildLegacyLocationKey(location);
  const normalized = sortNotes(notes).slice(0, 24);

  if (normalized.length) {
    state[nextKey] = normalized;
  } else {
    delete state[nextKey];
  }

  if (legacyKey !== nextKey) {
    delete state[legacyKey];
  }
};

const summarizeNotes = (notes: CrewPlaceIntelNote[]) => {
  if (!notes.length) {
    return {};
  }

  const latest = notes[0];
  return {
    crewIntelCount: notes.length,
    crewIntelSummary: latest.note,
    crewDealLabel: latest.deal || undefined,
  };
};

const rowToNote = (row: PlaceIntelRow): CrewPlaceIntelNote | null => {
  const note = row.payload?.note?.trim();

  if (!note) {
    return null;
  }

  return {
    id: row.id,
    note,
    deal: row.payload?.deal?.trim() || undefined,
    createdAt: row.payload?.createdAt || row.created_at,
  };
};

const buildRemoteRow = (
  userId: string,
  location: Pick<CrewLocation, 'airportCode' | 'name' | 'coordinate' | 'googlePlaceId'>,
  note: CrewPlaceIntelNote
) => ({
  id: note.id,
  user_id: userId,
  airport_code: normalizeAirportCode(location.airportCode),
  place_key: buildLocationKey(location),
  google_place_id: location.googlePlaceId || null,
  place_name: location.name,
  payload: {
    note: note.note.trim(),
    deal: note.deal?.trim() || null,
    createdAt: note.createdAt,
  },
});

const syncLocalNotesForLocations = async (
  userId: string,
  locations: Pick<CrewLocation, 'airportCode' | 'name' | 'coordinate' | 'googlePlaceId'>[],
  state: CrewPlaceIntelState
) => {
  const rows = locations.flatMap((location) => {
    return getLocalNotesForLocation(state, location).map((note) => buildRemoteRow(userId, location, note));
  });

  if (!rows.length) {
    return;
  }

  const uniqueRows = Array.from(
    rows.reduce((rowMap, row) => rowMap.set(row.id, row), new Map<string, (typeof rows)[number]>()).values()
  );

  const { error } = await supabase.from(TABLE_NAME).upsert(uniqueRows, {
    onConflict: 'id',
  });

  if (error) {
    throw error;
  }
};

const fetchRemoteNotesForAirports = async (airportCodes: string[]) => {
  if (!airportCodes.length) {
    return {} as Record<string, CrewPlaceIntelNote[]>;
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('id, airport_code, place_key, payload, created_at')
    .in('airport_code', airportCodes)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data || []) as PlaceIntelRow[]).reduce<Record<string, CrewPlaceIntelNote[]>>((accumulator, row) => {
    const note = rowToNote(row);
    if (!note) {
      return accumulator;
    }

    const current = accumulator[row.place_key] || [];
    accumulator[row.place_key] = [...current, note];
    return accumulator;
  }, {});
};

const persistMergedState = async (
  locations: Pick<CrewLocation, 'airportCode' | 'name' | 'coordinate' | 'googlePlaceId'>[],
  localState: CrewPlaceIntelState,
  remoteStateByKey: Record<string, CrewPlaceIntelNote[]>
) => {
  let didChange = false;

  locations.forEach((location) => {
    const localNotes = getLocalNotesForLocation(localState, location);
    const remoteNotes = remoteStateByKey[buildLocationKey(location)] || [];
    const merged = mergeNotes(remoteNotes, localNotes);

    if (
      merged.length !== localNotes.length ||
      merged.some((note, index) => note.id !== localNotes[index]?.id)
    ) {
      setLocalNotesForLocation(localState, location, merged);
      didChange = true;
    }
  });

  if (didChange) {
    await writeState(localState);
  }
};

export const MapPlaceIntelService = {
  buildLocationKey,

  async annotateLocation<T extends CrewLocation>(location: T): Promise<T> {
    const [annotated] = await this.annotateLocations([location]);
    return annotated;
  },

  async annotateLocations<T extends CrewLocation>(locations: T[]): Promise<T[]> {
    if (!locations.length) {
      return [];
    }

    const localState = await readState();
    const userId = await getSignedInUserId();
    let remoteStateByKey: Record<string, CrewPlaceIntelNote[]> = {};

    if (userId) {
      try {
        await syncLocalNotesForLocations(userId, locations, localState);
        const airportCodes = Array.from(
          new Set(locations.map((location) => normalizeAirportCode(location.airportCode)))
        );
        remoteStateByKey = await fetchRemoteNotesForAirports(airportCodes);
        await persistMergedState(locations, localState, remoteStateByKey);
      } catch (error) {
        if (!shouldFallbackToLocalPersistence(error)) {
          console.warn('Failed to load shared place intel:', error);
        }
      }
    }

    return locations.map((location) => {
      const localNotes = getLocalNotesForLocation(localState, location);
      const remoteNotes = remoteStateByKey[buildLocationKey(location)] || [];
      const notes = mergeNotes(remoteNotes, localNotes);

      return {
        ...location,
        ...summarizeNotes(notes),
      };
    });
  },

  async addNote(
    location: Pick<CrewLocation, 'airportCode' | 'name' | 'coordinate' | 'googlePlaceId'>,
    payload: { note: string; deal?: string }
  ) {
    const localState = await readState();
    const nextEntry: CrewPlaceIntelNote = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      note: payload.note.trim(),
      deal: payload.deal?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    const nextNotes = mergeNotes([nextEntry], getLocalNotesForLocation(localState, location)).slice(0, 24);
    setLocalNotesForLocation(localState, location, nextNotes);
    await writeState(localState);

    const userId = await getSignedInUserId();
    if (userId) {
      try {
        const { error } = await supabase.from(TABLE_NAME).upsert(buildRemoteRow(userId, location, nextEntry), {
          onConflict: 'id',
        });

        if (error) {
          throw error;
        }
      } catch (error) {
        if (!shouldFallbackToLocalPersistence(error)) {
          console.warn('Failed to persist shared place intel:', error);
        }
      }
    }

    return nextNotes;
  },
};
