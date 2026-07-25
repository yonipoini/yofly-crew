import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { data: events } = await supabase
      .from('ops_events')
      .select('*')
      .is('sent_at', null)
      .order('created_at', { ascending: true })
      .limit(20);

    for (const event of events || []) {
      const { data: subscriptions } = await supabase
        .from('notification_subscriptions')
        .select('*')
        .eq('ops_push', true);

      const matchingSubscriptions = (subscriptions || []).filter((subscription: any) => {
        const airports = new Set([
          subscription.active_airport,
          ...(subscription.saved_airports || []),
        ]);
        return airports.has(event.airport_code);
      });

      if (matchingSubscriptions.length === 0) {
        await supabase.from('ops_events').update({ sent_at: new Date().toISOString() }).eq('id', event.id);
        continue;
      }

      const messages = matchingSubscriptions.map((subscription: any) => ({
        to: subscription.expo_push_token,
        sound: 'default',
        title: event.title,
        body: event.message,
        channelId: 'ops-alerts',
        data: {
          airportCode: event.airport_code,
          eventType: event.event_type,
        },
      }));

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      await supabase.from('ops_notification_inbox').insert(
        matchingSubscriptions.map((subscription: any) => ({
          user_id: subscription.user_id,
          event_id: event.id,
          category: 'OPS_ALERT',
          title: event.title,
          message: event.message,
          metadata: {
            airportCode: event.airport_code,
            eventType: event.event_type,
          },
        }))
      );

      await supabase.from('ops_events').update({ sent_at: new Date().toISOString() }).eq('id', event.id);
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
