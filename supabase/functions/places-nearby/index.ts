import { corsHeaders } from '../_shared/cors.ts';

type HubDefinition = {
  latitude: number;
  longitude: number;
};

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
};

const HUBS: Record<string, HubDefinition> = {
  JFK: {
    latitude: 40.6413,
    longitude: -73.7781,
  },
  LAX: {
    latitude: 33.9416,
    longitude: -118.4085,
  },
  MIA: {
    latitude: 25.7959,
    longitude: -80.287,
  },
};

const DEFAULT_RADIUS_METERS = 4000;
const DEFAULT_MAX_INSTANCE_REQUESTS = 25;
let googlePlacesInstanceRequestCount = 0;

const getHub = (hubCode?: string) => HUBS[(hubCode || 'JFK').toUpperCase()] ?? HUBS.JFK;
const isEnabled = (value?: string | null) => ['1', 'true', 'yes', 'on'].includes((value || '').trim().toLowerCase());
const getMaxInstanceRequests = () => {
  const parsed = Number(Deno.env.get('GOOGLE_PLACES_MAX_INSTANCE_REQUESTS') || '');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_INSTANCE_REQUESTS;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!isEnabled(Deno.env.get('GOOGLE_PLACES_ENABLED'))) {
      return new Response(
        JSON.stringify({
          error: 'Google Places is disabled for this environment.',
          locations: [],
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const googleMapsApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!googleMapsApiKey) {
      throw new Error('Missing GOOGLE_MAPS_API_KEY secret');
    }

    if (googlePlacesInstanceRequestCount >= getMaxInstanceRequests()) {
      return new Response(
        JSON.stringify({
          error: 'Google Places request cap reached for this function instance.',
          locations: [],
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const body = request.method === 'POST' ? await request.json() : {};
    const hubCode = typeof body.hubCode === 'string' ? body.hubCode : 'JFK';
    const radiusMeters =
      typeof body.radiusMeters === 'number' && body.radiusMeters > 0
        ? body.radiusMeters
        : DEFAULT_RADIUS_METERS;
    const latitude =
      typeof body.latitude === 'number' ? body.latitude : undefined;
    const longitude =
      typeof body.longitude === 'number' ? body.longitude : undefined;

    const hub = getHub(hubCode);
    const center = {
      latitude: latitude ?? hub.latitude,
      longitude: longitude ?? hub.longitude,
    };

    googlePlacesInstanceRequestCount += 1;
    const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleMapsApiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location,places.types',
      },
      body: JSON.stringify({
        includedTypes: ['restaurant', 'cafe', 'gym', 'pharmacy', 'grocery_store', 'bar'],
        maxResultCount: 12,
          locationRestriction: {
            circle: {
              center,
              radius: radiusMeters,
            },
          },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({
          error: 'Places API request failed',
          details: errorText,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: response.status,
        }
      );
    }

    const payload = (await response.json()) as { places?: GooglePlace[] };
    return new Response(
      JSON.stringify({
        hubCode: hubCode.toUpperCase(),
        center,
        locations: payload.places || [],
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
