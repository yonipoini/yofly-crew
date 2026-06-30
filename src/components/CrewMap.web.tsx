import React, { useMemo, useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme } from '../theme/theme';
import { Coordinates, CrewLocation, CrewSavedRoute, LocationType } from '../types/locations';
import { Alert, AlertType } from '../types/alerts';
import { getLocationMarkerColors, getLocationTypeLabel } from '../utils/mapLocationPresentation';
import { clamp, getConnectorStyle, createStyles, AirportBlueprint } from './CrewMapShared';

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

type MapDelta = {
  latitudeDelta: number;
  longitudeDelta: number;
};

type MapDisplayMode = 'AIRPORT' | 'RADIUS';

export type CrewMapProps = {
  activeAirportCode: string;
  activeAirportName: string;
  airportCorePaths?: Coordinates[][];
  center: Coordinates;
  focusCoordinates: Coordinates;
  focusDelta: MapDelta;
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
  onMapPress?: (coordinate: Coordinates) => void;
  onSelectPoi?: (poi: { placeId: string; name: string; coordinate: Coordinates }) => void;
  theme: AppTheme;
  userLocation: Coordinates | null;
  width: number;
  tabBarHeight?: number;
  onLegendPress?: () => void;
  userProfile?: {
    fullName: string;
    avatarUri?: string;
  };
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
  getMarkerIcon,
  height,
  isDark,
  locations,
  alerts = [],
  mapMode = 'RADIUS',
  savedRoutes = [],
  selectedLocationId,
  selectedLocationCoordinate,
  onSelectLocation,
  onCalloutPress,
  theme,
  userLocation,
  width,
  tabBarHeight,
  onLegendPress,
  userProfile,
  showLegend = true,
  activeBlueprintOverlay = null,
  selectedTerminalZone = 'ALL',
  selectedFloorLevel = 'ALL',
  navigationRouteGeometry,
  tempAlertCoordinate = null,
  onTempAlertCoordinateChange,
  onAlertPress,
}: CrewMapProps) {
  const [showMeCallout, setShowMeCallout] = useState(false);
  const styles = useMemo(() => {
    const base = createStyles(theme, isDark);
    const local = StyleSheet.create({
      webMeMarkerContainer: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
        transform: Platform.OS === 'web' ? ('translate(-50%, -50%)' as any) : undefined,
      },
      webMeMarkerWrap: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      },
      webMeMarkerPulseHalo: {
        position: 'absolute',
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(0, 122, 255, 0.28)',
        ...(Platform.OS === 'web' ? {
          animationName: 'webPulse',
          animationDuration: '2.2s',
          animationIterationCount: 'infinite',
          animationTimingFunction: 'ease-out',
        } : {}),
      },
      webMeMarkerBlueDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#007AFF',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        ...({
          boxShadow: '0px 1.5px 3px rgba(0, 0, 0, 0.3)',
        } as any),
      },
      webMeCallout: {
        position: 'absolute',
        bottom: 38,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
        alignItems: 'center',
        minWidth: 120,
        zIndex: 1000,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
      },
      webMeCalloutTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#1C1C1E',
        marginBottom: 2,
      },
      webMeCalloutSubtitle: {
        fontSize: 10,
        color: '#8E8E93',
      },
      webMeCalloutArrow: {
        position: 'absolute',
        bottom: -6,
        left: '50%',
        marginLeft: -6,
        width: 12,
        height: 12,
        backgroundColor: '#FFFFFF',
        transform: [{ rotate: '45deg' }],
        zIndex: -1,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
      },
    });
    return { ...base, ...local };
  }, [theme, isDark]);
  const viewportCenter = focusCoordinates || center;
  const visibleLocations = locations.slice(0, 18);
  const airportCoreCount = visibleLocations.filter((location) => location.airportCore).length;
  const compactAirportMarkers = airportCoreCount > 1 && airportCoreCount === visibleLocations.length;
  const showAirportBlueprint = mapMode === 'AIRPORT';

  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1.0);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });

  // Reset pan offset and zoom scale when the active airport or mode changes
  useEffect(() => {
    setPanOffset({ x: 0, y: 0 });
    setScale(1.0);
  }, [activeAirportCode, mapMode]);

  const handleZoomIn = () => {
    setScale((prev) => clamp(prev + 0.25, 0.5, 3.5));
  };

  const handleZoomOut = () => {
    setScale((prev) => clamp(prev - 0.25, 0.5, 3.5));
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const scaleFactor = 0.06;
    const delta = e.deltaY < 0 ? 1 : -1;
    setScale((prev) => clamp(prev + delta * scaleFactor, 0.5, 3.5));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    isDraggingRef.current = true;
    setIsDragging(true);
    startPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    startPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  const handleTouchStart = (e: any) => {
    const touches = e.nativeEvent?.touches || (e as any).touches;
    if (touches && touches.length === 1) {
      isDraggingRef.current = true;
      setIsDragging(true);
      startPosRef.current = { x: touches[0].clientX, y: touches[0].clientY };
    }
  };

  const handleTouchMove = (e: any) => {
    const touches = e.nativeEvent?.touches || (e as any).touches;
    if (!isDraggingRef.current || !touches || touches.length !== 1) return;
    const dx = touches[0].clientX - startPosRef.current.x;
    const dy = touches[0].clientY - startPosRef.current.y;
    setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    startPosRef.current = { x: touches[0].clientX, y: touches[0].clientY };
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  const getPointStyle = (coordinate: Coordinates) => {
    const mappingDelta = showAirportBlueprint
      ? { latitudeDelta: 0.018, longitudeDelta: 0.018 }
      : focusDelta;

    const horizontalOffset = (coordinate.longitude - viewportCenter.longitude) / mappingDelta.longitudeDelta;
    const verticalOffset = (coordinate.latitude - viewportCenter.latitude) / mappingDelta.latitudeDelta;
    
    let left = 50 + horizontalOffset * 48;
    let top = 50 - verticalOffset * 48;

    if (showAirportBlueprint) {
      left = 50 + (horizontalOffset * 48) * 0.74;
      top = 50 - (verticalOffset * 48) * 0.82;
      left = clamp(left, 16, 84);
      top = clamp(top, 10, 88);
    } else {
      left = clamp(left, 8, 92);
      top = clamp(top, 10, 90);
    }

    return {
      left: `${left}%`,
      top: `${top}%`,
    } as const;
  };

  return (
    <View
      style={[
        styles.map,
        {
          width,
          height,
        },
        {
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          touchAction: 'none',
        } as any
      ]}
      {...({
        onMouseDown: handleMouseDown,
        onMouseMove: handleMouseMove,
        onMouseUp: handleMouseUp,
        onMouseLeave: handleMouseUp,
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
        onWheel: handleWheel,
      } as any)}
    >
      <View
        style={[
          styles.panContainer,
          {
            transform: [
              { translateX: panOffset.x },
              { translateY: panOffset.y },
              { scale: scale }
            ]
          }
        ]}
      >
        {showAirportBlueprint ? (
          <AirportBlueprint
            activeAirportCode={activeAirportCode}
            styles={styles}
            theme={theme}
          />
        ) : (
          <View style={styles.grid} pointerEvents="none" />
        )}

        {Platform.OS === 'web' && (
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes webPulse {
              0% {
                transform: scale(1);
                opacity: 0.65;
              }
              100% {
                transform: scale(2.8);
                opacity: 0;
              }
            }
          `}} />
        )}

        {userLocation && (
          <View style={[styles.webMeMarkerContainer, getPointStyle(userLocation)]}>
            {showMeCallout && (
              <View style={styles.webMeCallout}>
                <Text style={styles.webMeCalloutTitle}>{userProfile?.fullName || 'Me'}</Text>
                <Text style={styles.webMeCalloutSubtitle}>Your current location</Text>
                <View style={styles.webMeCalloutArrow} />
              </View>
            )}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={(e) => {
                e.stopPropagation();
                setShowMeCallout(!showMeCallout);
              }}
              style={styles.webMeMarkerWrap}
            >
              <View style={[styles.webMeMarkerPulseHalo, { className: 'web-pulse-halo' } as any]} />
              <View style={styles.webMeMarkerBlueDot} />
            </TouchableOpacity>
          </View>
        )}

        {userLocation && selectedLocationCoordinate && (
          (() => {
            const ptStyle = getPointStyle(selectedLocationCoordinate);
            const meStyle = getPointStyle(userLocation);
            return (
              <View
                style={[
                  {
                    position: 'absolute',
                    height: 0,
                    borderTopWidth: 2,
                    borderStyle: 'dashed',
                    borderColor: theme.colors.accent,
                    zIndex: 10,
                  },
                  getConnectorStyle(
                    meStyle.left,
                    meStyle.top,
                    ptStyle.left,
                    ptStyle.top,
                    true
                  )
                ]}
              />
            );
          })()
        )}

        {alerts.filter(a => typeof a.latitude === 'number' && typeof a.longitude === 'number').map((alert) => (
          <TouchableOpacity 
            key={alert.id} 
            style={[styles.alertMarkerWrap, getPointStyle({ latitude: alert.latitude!, longitude: alert.longitude! })]}
            onPress={() => onAlertPress?.(alert)}
          >
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
          </TouchableOpacity>
        ))}

        {tempAlertCoordinate && (
          <View style={[styles.tempAlertMarkerWrap, getPointStyle(tempAlertCoordinate)]}>
            <View style={styles.tempAlertMarkerGlow} />
            <View style={styles.tempAlertMarkerCore}>
              <Ionicons name="radio-outline" size={16} color="#FFFFFF" />
            </View>
          </View>
        )}

        {visibleLocations.map((location) => {
          const isSelected = selectedLocationId === location.id;
          return (
            <View
              key={location.id}
              style={[
                styles.pinWrapper,
                getPointStyle(location.coordinate),
              ]}
            >
              <TouchableOpacity
                style={[
                  location.airportCore ? styles.mallPin : styles.pin,
                  {
                    backgroundColor: location.airportCore ? (isSelected ? theme.colors.background : theme.colors.accent) : getLocationMarkerColors(theme, location).fill,
                    borderColor: location.airportCore ? theme.colors.accent : getLocationMarkerColors(theme, location).border,
                  },
                  isSelected && !location.airportCore && styles.pinSelected,
                  isSelected && location.airportCore && styles.mallPinSelected,
                  location.isCrewFavorite && styles.pinFavorite,
                  compactAirportMarkers && !location.airportCore && styles.pinCompact,
                ]}
                onPress={() => onSelectLocation(location)}
              >
                {isSelected && !location.airportCore && <View style={styles.pinPulse} />}
                <Ionicons
                  name={getMarkerIcon(location)}
                  size={compactAirportMarkers || location.airportCore ? 14 : 18}
                  color={location.airportCore && isSelected ? theme.colors.accent : theme.colors.background}
                />
                {location.airportCore && location.shortLabel ? (
                  <Text style={[styles.mallPinText, isSelected && { color: theme.colors.accent }]}>
                    {location.shortLabel}
                  </Text>
                ) : null}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

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
          style={[styles.legendCard, showAirportBlueprint && styles.legendCardBlueprint, tabBarHeight !== undefined && { bottom: tabBarHeight + 16 }]}
        >
          <Text style={styles.legendTitle}>
            {showAirportBlueprint ? `${activeAirportCode} directory map` : 'Web map preview'}
          </Text>
          <Text style={styles.legendText}>
            {showAirportBlueprint
                ? `${visibleLocations.length} terminal markers in view`
                : `${visibleLocations.length} crew spots around ${activeAirportCode}`}
          </Text>
          <Text style={styles.legendMeta}>
            {showAirportBlueprint
              ? 'Parking · gates · TSA · crew picks'
              : savedRoutes.length > 0
              ? `${savedRoutes.length} saved route${savedRoutes.length === 1 ? '' : 's'}`
              : visibleLocations.slice(0, 3).map((location) => getLocationTypeLabel(location.type)).join(' • ')}
          </Text>
        </TouchableOpacity>
      )}

      {showAirportBlueprint && (
        <View style={styles.zoomControls}>
          <TouchableOpacity style={styles.zoomButton} onPress={handleZoomIn}>
            <Ionicons name="add" size={20} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={styles.zoomDivider} />
          <TouchableOpacity style={styles.zoomButton} onPress={handleZoomOut}>
            <Ionicons name="remove" size={20} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
