import { AirportSearchService } from './AirportSearchService';
import { WeatherAlert } from '../types/weather';

interface NwsAlertFeature {
  id?: string;
  properties?: {
    event?: string;
    headline?: string;
    severity?: string;
    urgency?: string;
    areaDesc?: string;
    effective?: string;
    expires?: string;
    description?: string;
  };
}

interface NwsAlertResponse {
  features?: NwsAlertFeature[];
}

const mapUrgency = (severity?: string, urgency?: string): WeatherAlert['urgency'] => {
  const severityLabel = (severity || '').toLowerCase();
  const urgencyLabel = (urgency || '').toLowerCase();

  if (severityLabel === 'extreme' || severityLabel === 'severe' || urgencyLabel === 'immediate') {
    return 'critical';
  }

  if (severityLabel === 'moderate' || urgencyLabel === 'expected') {
    return 'watch';
  }

  return 'normal';
};

const isOperationalAlert = (feature: NwsAlertFeature) => {
  const severityLabel = (feature.properties?.severity || '').toLowerCase();
  const event = (feature.properties?.event || '').toLowerCase();

  return (
    ['extreme', 'severe', 'moderate'].includes(severityLabel) ||
    event.includes('thunderstorm') ||
    event.includes('flood') ||
    event.includes('wind') ||
    event.includes('snow') ||
    event.includes('ice') ||
    event.includes('tornado')
  );
};

export const WeatherAlertService = {
  async getAirportAlerts(airportCode: string): Promise<WeatherAlert[]> {
    const airport = AirportSearchService.getAirportByCode(airportCode);
    if (!airport) {
      return [];
    }

    try {
      const response = await fetch(
        `https://api.weather.gov/alerts/active?point=${airport.latitude},${airport.longitude}`,
        {
          headers: {
            'User-Agent': 'YoFlyCrew/1.0 (ops@yoflycrew.app)',
            Accept: 'application/geo+json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`NWS alerts request failed with ${response.status}`);
      }

      const payload = (await response.json()) as NwsAlertResponse;
      return (payload.features || [])
        .filter(isOperationalAlert)
        .slice(0, 3)
        .map((feature, index) => ({
          id: feature.id || `${airportCode}-${index}`,
          event: feature.properties?.event || 'Weather Alert',
          headline: feature.properties?.headline || feature.properties?.event || 'Weather Alert',
          severity: feature.properties?.severity || 'Unknown',
          urgency: mapUrgency(feature.properties?.severity, feature.properties?.urgency),
          area: feature.properties?.areaDesc || airport.name,
          effective: feature.properties?.effective,
          expires: feature.properties?.expires,
          description: feature.properties?.description,
        }));
    } catch (error) {
      console.warn('NWS alerts unavailable, continuing without severe-weather alerts:', error);
      return [];
    }
  },
};
