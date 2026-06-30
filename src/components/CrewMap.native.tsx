import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, PanResponder, TouchableOpacity, Image, Animated, Easing } from 'react-native';
import MapView, { Callout, MapPressEvent, Marker, Overlay, PoiClickEvent, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme } from '../theme/theme';
import { Coordinates, CrewLocation, CrewSavedRoute, LocationType } from '../types/locations';
import { Alert, AlertType } from '../types/alerts';
import { getLocationMarkerColors, getLocationTypeLabel } from '../utils/mapLocationPresentation';
import { clamp, getConnectorStyle, createStyles as createSharedStyles, AirportBlueprint } from './CrewMapShared';
import { CrewAirportSvgMap } from './CrewAirportSvgMap';

const getAlertIcon = (type: string): keyof typeof Ionicons.glyphMap => {
  switch (type) {
    case 'CATERING': return 'restaurant-outline';
    case 'CREW_ROOM': return 'wine-outline';
    case 'GATE_TERMINAL': return 'trail-sign-outline';
    case 'SCHEDULING': return 'people-outline';
    case 'GENERAL': return 'cart-outline';
    case 'MAINTENANCE': return 'water-outline';
    case 'SHUTTLE': return 'bus-outline';
    case 'HOTEL': return 'bed-outline';
    case 'SAFETY': return 'warning-outline';
    case 'TSA_KCM': return 'body-outline';
    case 'BAGGAGE': return 'bag-handle-outline';
    case 'WEATHER': return 'thunderstorm-outline';
    case 'PARKING': return 'car-outline';
    default: return 'alert-circle-outline';
  }
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return 'ME';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + (parts[parts.length - 1][0] || '')).toUpperCase();
};

type MapDisplayMode = 'AIRPORT' | 'RADIUS';

export type CrewMapProps = {
  activeAirportCode: string;
  activeAirportName: string;
  airportCorePaths?: Coordinates[][];
  center: Coordinates;
  focusCoordinates: Coordinates;
  focusDelta: {
    latitudeDelta: number;
    longitudeDelta: number;
  };
  focusRevision: number;
  getMarkerIcon: (location: CrewLocation) => keyof typeof Ionicons.glyphMap;
  height: number;
  isDark: boolean;
  locations: CrewLocation[];
  alerts?: Alert[];
  mapMode?: MapDisplayMode;
  savedRoutes?: CrewSavedRoute[];
  selectedLocationId?: string | null;
  selectedLocationCoordinate?: Coordinates | null;
  onSelectLocation: (location: CrewLocation | null) => void;
  onCalloutPress?: (location: CrewLocation) => void;
  onMapPress?: (coordinate: Coordinates, position?: { x: number; y: number }) => void;
  onSelectPoi?: (poi: { placeId: string; name: string; coordinate: Coordinates }) => void;
  theme: AppTheme;
  userLocation: Coordinates | null;
  width: number;
  tabBarHeight?: number;
  onLegendPress?: () => void;
  userProfile?: {
    fullName: string;
    avatarUri?: string;
    roleLabel?: string;
    airline?: string;
    aircraft?: string;
  };
  onMePress?: () => void;
  showLegend?: boolean;
  activeBlueprintOverlay?: {
    image: any;
    bounds: [Coordinates, Coordinates];
  } | null;
  selectedTerminalZone?: string;
  selectedFloorLevel?: string;
  navigationRouteGeometry?: [number, number][] | null;
  tempAlertCoordinate?: Coordinates | null;
  onTempAlertCoordinateChange?: (coordinate: Coordinates) => void;
  onAlertPress?: (alert: Alert) => void;
};

export function CrewMap({
  activeAirportCode,
  activeAirportName,
  airportCorePaths = [],
  center,
  focusCoordinates,
  focusDelta,
  focusRevision,
  getMarkerIcon,
  height,
  isDark,
  locations,
  alerts = [],
  mapMode = 'RADIUS',
  savedRoutes = [],
  selectedLocationId,
  selectedLocationCoordinate,
  onMapPress,
  onSelectLocation,
  onCalloutPress,
  onSelectPoi,
  theme,
  userLocation,
  width,
  tabBarHeight,
  onLegendPress,
  userProfile,
  onMePress,
  showLegend = true,
  activeBlueprintOverlay = null,
  selectedTerminalZone = 'ALL',
  selectedFloorLevel = 'ALL',
  navigationRouteGeometry,
  tempAlertCoordinate = null,
  onTempAlertCoordinateChange,
  onAlertPress,
}: CrewMapProps) {
  const mapRef = useRef<MapView | null>(null);
  const markerRefs = useRef<Record<string, any>>({});
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const useMapbox = process.env.EXPO_PUBLIC_USE_MAPBOX === 'true';

  if (useMapbox) {
    const { CrewMapboxView } = require('./CrewMapboxView');
    return (
      <View style={[styles.map, { width, height }]}>
        <CrewMapboxView
          activeAirportCode={activeAirportCode}
          locations={locations}
          alerts={alerts}
          theme={theme}
          getMarkerIcon={getMarkerIcon}
          onSelectLocation={onSelectLocation}
          isDark={isDark}
          selectedLocationId={selectedLocationId}
          selectedLocationCoordinate={selectedLocationCoordinate}
          userLocation={userLocation}
          center={center}
          focusCoordinates={focusCoordinates}
          focusRevision={focusRevision}
          onMapPress={onMapPress}
          userProfile={userProfile}
          onMePress={onMePress}
          navigationRouteGeometry={navigationRouteGeometry}
          selectedFloorLevel={selectedFloorLevel}
          tempAlertCoordinate={tempAlertCoordinate}
          onTempAlertCoordinateChange={onTempAlertCoordinateChange}
          onAlertPress={onAlertPress}
        />
      </View>
    );
  }

  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        })
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.8],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.65, 0],
  });

  const visibleLocations = locations.slice(0, 18);
  const airportCoreCount = visibleLocations.filter((location) => location.airportCore).length;
  const compactAirportMarkers = airportCoreCount > 1 && airportCoreCount === visibleLocations.length;

  const currentRegionRef = useRef({
    latitude: focusCoordinates?.latitude || center.latitude,
    longitude: focusCoordinates?.longitude || center.longitude,
    ...focusDelta,
  });

  const handleNativeZoomIn = () => {
    if (mapRef.current && currentRegionRef.current) {
      const nextRegion = {
        ...currentRegionRef.current,
        latitudeDelta: currentRegionRef.current.latitudeDelta / 2.2,
        longitudeDelta: currentRegionRef.current.longitudeDelta / 2.2,
      };
      mapRef.current.animateToRegion(nextRegion, 250);
    }
  };

  const handleNativeZoomOut = () => {
    if (mapRef.current && currentRegionRef.current) {
      const nextRegion = {
        ...currentRegionRef.current,
        latitudeDelta: currentRegionRef.current.latitudeDelta * 2.2,
        longitudeDelta: currentRegionRef.current.longitudeDelta * 2.2,
      };
      mapRef.current.animateToRegion(nextRegion, 250);
    }
  };

  // Animate MapView camera when focus region changes
  useEffect(() => {
    if (mapRef.current) {
      const newRegion = {
        latitude: focusCoordinates.latitude,
        longitude: focusCoordinates.longitude,
        ...focusDelta,
      };
      currentRegionRef.current = newRegion;
      mapRef.current.animateToRegion(newRegion, 500);
    }
  }, [
    focusCoordinates.latitude,
    focusCoordinates.longitude,
    focusDelta.latitudeDelta,
    focusDelta.longitudeDelta,
    focusRevision,
  ]);

  // Programmatically show Callout when selectedLocationId changes
  useEffect(() => {
    if (selectedLocationId && markerRefs.current[selectedLocationId]) {
      const timer = setTimeout(() => {
        markerRefs.current[selectedLocationId]?.showCallout();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [selectedLocationId]);

  if (activeAirportCode === 'MCO' && selectedTerminalZone && selectedTerminalZone !== 'ALL') {
    return (
      <View style={[styles.map, { width, height }]}>
        <CrewAirportSvgMap
          selectedTerminalZone={selectedTerminalZone}
          selectedFloorLevel={selectedFloorLevel}
          locations={locations}
          theme={theme}
          getMarkerIcon={getMarkerIcon}
          onSelectLocation={onSelectLocation}
          isDark={isDark}
          selectedLocationId={selectedLocationId}
          userLocation={userLocation}
          userProfile={userProfile}
          onMePress={onMePress}
        />
      </View>
    );
  }

  return (
    <View style={[styles.map, { width, height }]}>
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        showsUserLocation={!userLocation}
        showsIndoors={true}
        showsBuildings={true}
        showsIndoorLevelPicker={true}
        poiClickEnabled={true}
        onPoiClick={(event: PoiClickEvent) => {
          onSelectPoi?.({
            placeId: event.nativeEvent.placeId,
            name: event.nativeEvent.name,
            coordinate: event.nativeEvent.coordinate,
          });
        }}
        onPress={(event: MapPressEvent) => {
          onMapPress?.(event.nativeEvent.coordinate, event.nativeEvent.position);
        }}
        onRegionChangeComplete={(region: Region) => {
          currentRegionRef.current = region;
        }}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: center.latitude,
          longitude: center.longitude,
          ...focusDelta,
        }}
        customMapStyle={isDark ? undefined : undefined}
      >
        {activeBlueprintOverlay && (
          <Overlay
            image={activeBlueprintOverlay.image}
            bounds={[
              [activeBlueprintOverlay.bounds[0].latitude, activeBlueprintOverlay.bounds[0].longitude],
              [activeBlueprintOverlay.bounds[1].latitude, activeBlueprintOverlay.bounds[1].longitude],
            ]}
          />
        )}

        {userLocation && (
          <Marker
            coordinate={userLocation}
            zIndex={999}
            onPress={(e) => {
              e.stopPropagation();
            }}
          >
            <View style={styles.nativeMeMarkerWrap}>
              <Animated.View
                style={[
                  styles.meMarkerPulseHalo,
                  {
                    transform: [{ scale: pulseScale }],
                    opacity: pulseOpacity,
                  },
                ]}
              />
              <View style={styles.meMarkerBlueDot} />
            </View>
            <Callout tooltip={false} onPress={onMePress}>
              <View style={styles.calloutContainer}>
                <Text style={styles.calloutTitle}>{userProfile?.fullName || 'Me'}</Text>
                <Text style={styles.calloutSubtitle}>
                  {userProfile?.roleLabel 
                    ? `${userProfile.roleLabel}${userProfile.airline ? ` · ${userProfile.airline}` : ''}${userProfile.aircraft ? ` (${userProfile.aircraft})` : ''}`
                    : 'Your current location'}
                </Text>
                <Text style={styles.calloutMeta}>Tap to view profile</Text>
              </View>
            </Callout>
          </Marker>
        )}

        {savedRoutes.map((route) => (
          <Polyline
            key={route.id}
            coordinates={[center, route.coordinate]}
            strokeColor={theme.colors.primary}
            strokeWidth={3}
            lineDashPattern={[8, 6]}
          />
        ))}

        {userLocation && selectedLocationCoordinate && (
          <Polyline
            coordinates={[userLocation, selectedLocationCoordinate]}
            strokeColor={theme.colors.accent}
            strokeWidth={3}
            lineDashPattern={[5, 5]}
          />
        )}

        {alerts.filter(a => typeof a.latitude === 'number' && typeof a.longitude === 'number').map((alert) => (
          <Marker
            key={alert.id}
            coordinate={{ latitude: alert.latitude!, longitude: alert.longitude! }}
            onPress={(e) => {
              e.stopPropagation();
              onAlertPress?.(alert);
            }}
          >
            <View style={styles.alertMarkerWrap}>
              <View style={[
                styles.alertMarkerGlow,
                alert.isPrivate && { backgroundColor: 'rgba(0, 229, 255, 0.35)' }
              ]} />
              <View style={[
                styles.alertMarkerCore,
                alert.isPrivate && { backgroundColor: '#00E5FF', shadowColor: '#00E5FF' }
              ]}>
                <Ionicons name={alert.isPrivate ? "lock-closed-outline" : getAlertIcon(alert.type)} size={alert.isPrivate ? 14 : 16} color="#FFFFFF" />
              </View>
            </View>
          </Marker>
        ))}

        {tempAlertCoordinate && (
          <Marker
            key="temp-alert"
            coordinate={tempAlertCoordinate}
            draggable
            onDragEnd={(e) => {
              onTempAlertCoordinateChange?.(e.nativeEvent.coordinate);
            }}
          >
            <View style={styles.tempAlertMarkerWrap}>
              <View style={styles.tempAlertMarkerGlow} />
              <View style={styles.tempAlertMarkerCore}>
                <Ionicons name="radio-outline" size={16} color="#FFFFFF" />
              </View>
            </View>
          </Marker>
        )}

        {locations.map((location) => {
          const selected = selectedLocationId === location.id;
          let pinColor = '#00F5D4'; // default teal
          if (selected) {
            pinColor = '#E066FF'; // selected purple
          } else if (location.isCrewFavorite) {
            pinColor = '#FFD166'; // favorite yellow
          } else if (location.airportCoreKind === 'SECURITY') {
            pinColor = '#FF6B6B'; // security red/orange
          }

          return (
            <Marker
              ref={(ref) => {
                if (ref) {
                  markerRefs.current[location.id] = ref;
                }
              }}
              key={location.id}
              coordinate={location.coordinate}
              onPress={(event) => {
                event.stopPropagation?.();
                onSelectLocation(location);
              }}
            >
              <View style={[styles.markerWrap, selected && styles.markerSelected]}>
                <View style={[
                  styles.markerContainer,
                  location.isCrewFavorite && styles.markerFavorite,
                  { backgroundColor: pinColor }
                ]}>
                  <Ionicons
                    name={getMarkerIcon(location)}
                    size={14}
                    color={location.isCrewFavorite ? theme.colors.background : '#FFFFFF'}
                  />
                </View>
              </View>
              <Callout tooltip={false} onPress={() => onCalloutPress?.(location)}>
                <View style={styles.calloutContainer}>
                  <Text style={styles.calloutTitle}>{location.name}</Text>
                  <Text style={styles.calloutSubtitle}>
                    {location.airportCore ? (location.shortLabel ? `Level Spot · ${location.shortLabel}` : 'Terminal Spot') : 'Crew Spot'}
                  </Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      <View style={styles.airportTag} pointerEvents="none">
        <Text style={styles.airportTagCode}>{activeAirportCode}</Text>
        <Text style={styles.airportTagName} numberOfLines={1}>
          {activeAirportName}
        </Text>
      </View>

      {showLegend && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onLegendPress}
          style={[styles.legendCard, styles.legendCardBlueprint, tabBarHeight !== undefined && { bottom: tabBarHeight + 16 }]}
        >
          <Text style={styles.legendTitle}>
            {activeAirportCode} directory map
          </Text>
          <Text style={styles.legendText}>
            {visibleLocations.length} terminal spots in view
          </Text>
          <Text style={styles.legendMeta}>
            Parking · gates · TSA · crew picks
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.zoomControls}>
        <TouchableOpacity style={styles.zoomButton} onPress={handleNativeZoomIn}>
          <Ionicons name="add" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.zoomDivider} />
        <TouchableOpacity style={styles.zoomButton} onPress={handleNativeZoomOut}>
          <Ionicons name="remove" size={20} color={theme.colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme, isDark: boolean) => {
  const shared = createSharedStyles(theme, isDark);
  const native = StyleSheet.create({
    nativeMeMarkerWrap: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    meMarkerPulseHalo: {
      position: 'absolute',
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: 'rgba(0, 122, 255, 0.28)',
    },
    meMarkerBlueDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: '#007AFF', // Standard Apple Blue
      borderWidth: 2,
      borderColor: '#FFFFFF',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1.5 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 4,
    },
    markerWrap: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    markerHalo: {
      position: 'absolute',
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      transform: [{ scale: 1.12 }],
    },
    markerContainer: {
      backgroundColor: theme.colors.accent,
      padding: 7,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: theme.colors.surface,
      elevation: 5,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 4,
    },
    markerFavorite: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.accent,
      transform: [{ scale: 1.1 }],
    },
    markerSelected: {
      transform: [{ scale: 1.22 }],
      shadowOpacity: 0.28,
      shadowRadius: 8,
      elevation: 8,
    },
    mallMarkerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      gap: 6,
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
    },
    mallMarkerSelected: {
      transform: [{ scale: 1.15 }],
      shadowOpacity: 0.35,
      shadowRadius: 6,
      elevation: 8,
    },
    mallMarkerText: {
      color: theme.colors.background,
      fontSize: 10,
      fontWeight: '900',
    },
    calloutContainer: {
      padding: 4,
      minWidth: 100,
      maxWidth: 200,
    },
    calloutTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: '#1C1C1E', // Always dark for high contrast in native system callout
      marginBottom: 2,
    },
    calloutSubtitle: {
      fontSize: 10,
      color: '#5C5C5E', // Always medium-dark gray for readability
    },
    calloutMeta: {
      fontSize: 9,
      color: theme.colors.primary,
      marginTop: 2,
      fontWeight: '600',
    },
  });

  return { ...shared, ...native };
};
