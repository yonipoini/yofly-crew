import { corsHeaders } from '../_shared/cors.ts';

type OpenAIMessage = {
  role: 'system' | 'user';
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
      >;
};

type ParsedLeg = {
  date?: string;
  reportTime?: string;
  departureTime?: string;
  arrivalTime?: string;
  flightNumber?: string;
  departureAirport?: string;
  arrivalAirport?: string;
  rawText?: string;
};

const AIRPORT_CODE_REGEX = /^[A-Z]{3}$/;

const normalizeCode = (value: string | undefined) => value?.trim().toUpperCase() ?? '';
const normalizeDate = (value: string | undefined) => {
  const trimmed = value?.trim() ?? '';
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : undefined;
};
const normalizeTime = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim().toUpperCase().replace(/\./g, '');
  const twelveHourMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (twelveHourMatch) {
    const hours = Number(twelveHourMatch[1]);
    const minutes = Number(twelveHourMatch[2]);
    const meridiem = twelveHourMatch[3];
    const normalizedHours = meridiem === 'PM' ? (hours % 12) + 12 : hours % 12;
    return `${String(normalizedHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  const twentyFourHourMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHourMatch) {
    const hours = Number(twentyFourHourMatch[1]);
    const minutes = Number(twentyFourHourMatch[2]);
    if (hours <= 23 && minutes <= 59) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
  }

  return undefined;
};

const sanitizeLegs = (legs: ParsedLeg[]) =>
  legs.flatMap((leg, index) => {
    const departureAirport = normalizeCode(leg.departureAirport);
    const arrivalAirport = normalizeCode(leg.arrivalAirport);

    if (!AIRPORT_CODE_REGEX.test(departureAirport) || !AIRPORT_CODE_REGEX.test(arrivalAirport)) {
      return [];
    }

    return [
      {
        id: `leg-${index + 1}`,
        date: normalizeDate(leg.date),
        reportTime: normalizeTime(leg.reportTime),
        departureTime: normalizeTime(leg.departureTime),
        arrivalTime: normalizeTime(leg.arrivalTime),
        flightNumber: leg.flightNumber?.trim() || undefined,
        departureAirport,
        arrivalAirport,
        rawText: leg.rawText?.trim() || undefined,
      },
    ];
  });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiApiKey) {
      throw new Error('Missing OPENAI_API_KEY secret');
    }

    const body = await request.json();
    const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim() : 'image/jpeg';
    const timezone = typeof body.timezone === 'string' ? body.timezone.trim() : 'America/New_York';
    const now = typeof body.now === 'string' ? body.now.trim() : new Date().toISOString();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'Missing imageBase64' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const messages: OpenAIMessage[] = [
      {
        role: 'system',
        content:
          'You extract airline crew schedule screenshots into JSON. Return only valid JSON with keys airlineHint, rawSummary, rawText, and legs. legs must be an array of objects with date, reportTime, departureTime, arrivalTime, flightNumber, departureAirport, arrivalAirport, and rawText. Use YYYY-MM-DD dates when visible. Use 24-hour HH:MM times. Use 3-letter uppercase IATA airport codes. If a field is unclear, leave it empty instead of guessing.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Current timestamp: ${now}\nTimezone: ${timezone}\nExtract the current or upcoming trip legs from this crew roster screenshot.`,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
            },
          },
        ],
      },
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_SCHEDULE_MODEL') || 'gpt-4.1-mini',
        response_format: { type: 'json_object' },
        messages,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: 'OpenAI request failed', details: errorText }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: response.status,
      });
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    const parsed = typeof content === 'string' ? JSON.parse(content) : {};
    const legs = sanitizeLegs(Array.isArray(parsed.legs) ? parsed.legs : []);

    return new Response(
      JSON.stringify({
        schedule: {
          id: `schedule-${Date.now()}`,
          source: 'screenshot',
          importedAt: new Date().toISOString(),
          timezone,
          rawText: typeof parsed.rawText === 'string' ? parsed.rawText : undefined,
          rawSummary: typeof parsed.rawSummary === 'string' ? parsed.rawSummary : undefined,
          airlineHint: typeof parsed.airlineHint === 'string' ? parsed.airlineHint : undefined,
          active: true,
          legs,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
