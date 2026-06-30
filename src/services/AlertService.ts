import { supabase } from '../lib/supabase';
import { Alert, AlertType } from '../types/alerts';
import { CrewAccessService } from './CrewAccessService';

const mapAlertRow = (row: any): Alert => ({
  id: row.id,
  type: row.type as AlertType,
  title: row.title,
  message: row.description || '',
  location: row.airport_code,
  latitude: row.latitude,
  longitude: row.longitude,
  userId: row.creator_id,
  username: row.profiles?.full_name || 'Anonymous',
  userRole: (row.profiles?.role as any) || 'FA',
  createdAt: row.created_at,
  expiresAt: row.expires_at,
});

const isExpectedAlertFetchError = (error: unknown) => {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code || '') : '';
  const message =
    typeof error === 'object' && error && 'message' in error
      ? String((error as { message?: unknown }).message || '').toLowerCase()
      : '';

  return (
    code === '42P01' ||
    code === 'PGRST116' ||
    code === 'PGRST205' ||
    message.includes('relation') ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('permission denied') ||
    message.includes('jwt')
  );
};

export const AlertService = {
  /**
   * Fetch all active alerts for current hub
   */
  async getAlerts(airportCode: string): Promise<Alert[]> {
    const { data, error } = await supabase
      .from('alerts')
      .select('*, profiles(full_name, role)')
      .eq('airport_code', airportCode)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      if (!isExpectedAlertFetchError(error)) {
        console.warn('Alert feed unavailable, continuing with empty crew intel:', error);
      }
      return [];
    }

    return (data || []).map(mapAlertRow);
  },

  /**
   * Create a new layover alert
   */
  async createAlert(alert: Partial<Alert>): Promise<Alert> {
    const user = await CrewAccessService.requireVerifiedCrew();
    
    const { data, error } = await supabase
      .from('alerts')
      .insert({
        creator_id: user.id,
        type: alert.type,
        airport_code: alert.location,
        latitude: alert.latitude,
        longitude: alert.longitude,
        title: alert.title,
        description: alert.message,
        expires_at: alert.expiresAt,
      })
      .select('*, profiles(full_name, role)')
      .single();

    if (error) throw error;

    return mapAlertRow(data);
  },

  /**
   * Subscribe to new alerts
   */
  subscribeToAlerts(airportCode: string, onAlert: (alert: Alert) => void) {
    return supabase
      .channel(`alerts-${airportCode}`)
      .on(
        'postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'alerts', filter: `airport_code=eq.${airportCode}` },
        async (payload) => {
           const { data } = await supabase
             .from('alerts')
             .select('*, profiles(full_name, role)')
             .eq('id', payload.new.id)
             .single();
           
           if (data) {
             onAlert(mapAlertRow(data));
           }
        }
      )
      .subscribe();
  }
};
