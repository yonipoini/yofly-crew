import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, serviceRoleKey);

const buildDigestSummary = (snapshot: any, airportCode: string) => {
  const lines = [
    snapshot?.airportStatus?.faaDelay
      ? `FAA: ${snapshot.airportStatus.faaDelayReason || 'Delay program active'}`
      : 'FAA: normal flow',
    snapshot?.airportStatus?.tsaWaitTimeMins
      ? `TSA: ${snapshot.airportStatus.tsaWaitTimeMins} min avg`
      : 'TSA: no fresh reports',
    snapshot?.weatherAlerts?.[0]
      ? `WX: ${snapshot.weatherAlerts[0].headline || snapshot.weatherAlerts[0].event}`
      : `WX: ${snapshot?.weather?.flightCategory || 'No METAR category'}`,
    snapshot?.headlineAlerts?.[0]
      ? `Crew intel: ${snapshot.headlineAlerts[0].title}`
      : 'Crew intel: quiet',
  ];

  return {
    title: `${airportCode} ops brief`,
    summary: lines.join(' | '),
  };
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { data: subscriptions } = await supabase
      .from('notification_subscriptions')
      .select('*')
      .eq('daily_digest', true);

    for (const subscription of subscriptions || []) {
      const airportCode = subscription.active_airport || subscription.saved_airports?.[0] || 'JFK';
      const { data: snapshotRow } = await supabase
        .from('ops_snapshots')
        .select('snapshot')
        .eq('airport_code', airportCode)
        .maybeSingle();

      if (!snapshotRow?.snapshot) {
        continue;
      }

      const digest = buildDigestSummary(snapshotRow.snapshot, airportCode);

      await supabase.from('ops_digests').insert({
        user_id: subscription.user_id,
        digest_type: 'MORNING_BRIEF',
        airport_code: airportCode,
        title: digest.title,
        summary: digest.summary,
        payload: snapshotRow.snapshot,
      });

      await supabase.from('ops_notification_inbox').insert({
        user_id: subscription.user_id,
        category: 'DIGEST',
        title: digest.title,
        message: digest.summary,
        metadata: {
          airportCode,
          digestType: 'MORNING_BRIEF',
        },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
