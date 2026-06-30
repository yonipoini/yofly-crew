import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useTheme } from '../theme/theme';
import { runtimeConfig } from '../config/runtime';
import { AviationWeatherService } from '../services/AviationWeatherService';
import { AviationWeather } from '../types/weather';

interface WeatherWidgetProps {
  icao?: string;
  airportCode?: string;
  airportName?: string;
}

export const WeatherWidget = ({
  icao = runtimeConfig.defaultAirportIcao,
  airportCode,
  airportName,
}: WeatherWidgetProps) => {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [weather, setWeather] = useState<AviationWeather | null>(null);

  useEffect(() => {
    let isActive = true;

    AviationWeatherService.getCurrentWeather(icao)
      .then((data) => {
        if (isActive) {
          setWeather(data);
        }
      })
      .catch((error) => {
        console.warn('Failed to load aviation weather:', error);
      });

    return () => {
      isActive = false;
    };
  }, [icao]);

  if (!weather) {
    return (
      <View style={styles.card}>
        <Text style={styles.loadingText}>Loading aviation weather...</Text>
      </View>
    );
  }

  const updatedTime = new Date(weather.observedAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  const displayCode = airportCode || weather.icao.replace(/^K/, '');
  const displayName = airportName || weather.airportName;
  const sourceLabel = weather.source === 'official' ? 'Live METAR' : 'Unavailable';
  const updatedLabel = weather.source === 'official' ? `Updated ${updatedTime}` : `Checked ${updatedTime}`;
  const flightCategoryColor = weather.flightCategory === 'VFR' ? theme.colors.success : '#F59E0B';
  const metrics = [
    { label: 'Wind', value: weather.wind },
    { label: 'Visibility', value: weather.visibility },
    { label: 'Altimeter', value: weather.altimeter },
    { label: 'Ceiling', value: weather.flightCategory },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.locationContainer}>
          <Ionicons name="location" size={16} color={theme.colors.accent} />
          <View>
            <Text style={styles.locationText}>{displayCode} Weather</Text>
            <Text style={styles.airportNameText}>{displayName}</Text>
          </View>
        </View>
        <View style={styles.sourceContainer}>
          <Text style={styles.sourcePill}>{sourceLabel}</Text>
          <Text style={styles.timeText}>{updatedLabel}</Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.tempContainer}>
          <View style={styles.iconBadge}>
            <Ionicons name={weather.iconName as any} size={32} color="#FFD84D" />
          </View>
          <View>
            <Text style={styles.temperature}>{weather.temperatureF != null ? `${weather.temperatureF}°` : '--'}</Text>
            <Text style={styles.conditions}>{weather.conditionLabel}</Text>
          </View>
        </View>

        <View style={[styles.categoryBadge, { borderColor: `${flightCategoryColor}66` }]}>
          <Text style={styles.categoryLabel}>Flight Cat</Text>
          <Text style={[styles.categoryValue, { color: flightCategoryColor }]}>{weather.flightCategory}</Text>
        </View>
      </View>

      <View style={styles.detailsGrid}>
        {metrics.map((metric) => (
          <View key={metric.label} style={styles.detailItem}>
            <Text style={styles.detailLabel}>{metric.label}</Text>
            <Text style={styles.detailValue}>{metric.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  card: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.cardSoft,
    padding: 16,
    borderRadius: theme.roundness.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 12,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    flex: 1,
  },
  locationText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  airportNameText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  sourceContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  sourcePill: {
    color: theme.colors.accent,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderWidth: 1,
    borderColor: `${theme.colors.accent}55`,
    borderRadius: theme.roundness.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  timeText: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  tempContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: 'rgba(255, 216, 77, 0.12)',
  },
  temperature: {
    color: theme.colors.text,
    fontSize: 38,
    fontWeight: '900',
    lineHeight: 40,
  },
  conditions: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  categoryBadge: {
    minWidth: 92,
    borderWidth: 1,
    borderRadius: theme.roundness.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  categoryLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  categoryValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailItem: {
    width: '48%',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 10,
  },
  detailLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  detailValue: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
});
