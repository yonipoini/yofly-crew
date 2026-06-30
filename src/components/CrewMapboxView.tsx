import React, { useMemo, useEffect, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme } from '../theme/theme';
import { CrewLocation, Coordinates, LocationType } from '../types/locations';
import { Alert } from '../types/alerts';

// Set Mapbox access token dynamically from environment
const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
Mapbox.setAccessToken(mapboxToken);

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

interface CrewMapboxViewProps {
  locations: CrewLocation[];
  alerts?: Alert[];
  theme: AppTheme;
  getMarkerIcon: (location: CrewLocation) => keyof typeof Ionicons.glyphMap;
  onSelectLocation: (location: CrewLocation | null) => void;
  isDark: boolean;
  selectedLocationId?: string | null;
  selectedLocationCoordinate?: Coordinates | null;
  userLocation: { latitude: number; longitude: number } | null;
  center: { latitude: number; longitude: number };
  focusCoordinates?: { latitude: number; longitude: number } | null;
  focusRevision?: number;
  onMapPress?: (coordinate: Coordinates) => void;
  userProfile?: {
    fullName: string;
    avatarUri?: string;
    roleLabel?: string;
    airline?: string;
    aircraft?: string;
  };
  onMePress?: () => void;
  navigationRouteGeometry?: [number, number][] | null;
  selectedFloorLevel?: string;
  tempAlertCoordinate?: Coordinates | null;
  onTempAlertCoordinateChange?: (coordinate: Coordinates) => void;
  onAlertPress?: (alert: Alert) => void;
  activeAirportCode: string;
}

export function CrewMapboxView({
  locations,
  alerts = [],
  theme,
  getMarkerIcon,
  onSelectLocation,
  isDark,
  selectedLocationId,
  selectedLocationCoordinate,
  userLocation,
  center,
  focusCoordinates,
  focusRevision,
  onMapPress,
  userProfile,
  onMePress,
  navigationRouteGeometry,
  selectedFloorLevel,
  tempAlertCoordinate = null,
  onTempAlertCoordinateChange,
  onAlertPress,
  activeAirportCode,
}: CrewMapboxViewProps) {
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const cameraRef = useRef<Mapbox.Camera>(null);
  const mapViewRef = useRef<Mapbox.MapView | null>(null);
  const currentZoomRef = useRef(16.5);
  const isFirstRender = useRef(true);

  const firstName = useMemo(() => {
    if (!userProfile?.fullName) return 'Me';
    let name = userProfile.fullName.trim();
    
    // Normalize case-insensitive prefixes (titles/honorifics)
    const prefixes = [
      /^capt\.?\s+/i,
      /^captain\s+/i,
      /^f\/?o\.?\s+/i,
      /^first officer\s+/i,
      /^co-pilot\s+/i,
      /^copilot\s+/i,
      /^purser\s+/i,
      /^fa\s+/i,
      /^flight attendant\s+/i,
    ];
    
    for (const prefix of prefixes) {
      if (prefix.test(name)) {
        name = name.replace(prefix, '');
        break;
      }
    }
    
    const parts = name.split(/\s+/);
    return parts[0] || 'Me';
  }, [userProfile]);

  // Move camera dynamically when user shifts focus (recenters or selects from list)
  useEffect(() => {
    if (focusCoordinates && cameraRef.current) {
      const isFirst = isFirstRender.current;
      isFirstRender.current = false;
      
      const isNavigating = navigationRouteGeometry && navigationRouteGeometry.length > 0;
      const zoomLevel = isNavigating ? 19.2 : 16.8; // Deep zoom in during active walk navigation!

      cameraRef.current.setCamera({
        centerCoordinate: [focusCoordinates.longitude, focusCoordinates.latitude],
        zoomLevel: zoomLevel,
        animationDuration: 0, // Disabled transition animation for instant response
      });
      currentZoomRef.current = zoomLevel;
    }
  }, [focusCoordinates, focusRevision, navigationRouteGeometry]);

  const handleZoomIn = () => {
    if (cameraRef.current) {
      const nextZoom = Math.min(22, currentZoomRef.current + 1);
      cameraRef.current.setCamera({
        zoomLevel: nextZoom,
        animationDuration: 0, // Disabled transition animation for instant response
      });
      currentZoomRef.current = nextZoom;
    }
  };

  const handleZoomOut = () => {
    if (cameraRef.current) {
      const nextZoom = Math.max(1, currentZoomRef.current - 1);
      cameraRef.current.setCamera({
        zoomLevel: nextZoom,
        animationDuration: 0, // Disabled transition animation for instant response
      });
      currentZoomRef.current = nextZoom;
    }
  };

  const handleLocateMe = () => {
    if (userLocation && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [userLocation.longitude, userLocation.latitude],
        zoomLevel: 16.5,
        animationDuration: 0, // Disabled transition animation for instant response
      });
      currentZoomRef.current = 16.5;
    }
  };

  const handleRecenter = () => {
    if (cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [center.longitude, center.latitude],
        zoomLevel: 16.2,
        animationDuration: 0, // Disabled transition animation for instant response
      });
      currentZoomRef.current = 16.2;
    }
  };

  const lastMarkerSelectedTime = useRef(0);

  const activeSelectedCoordinate = useMemo(() => {
    if (selectedLocationCoordinate) return selectedLocationCoordinate;
    if (selectedLocationId) {
      const loc = locations.find((l) => l.id === selectedLocationId);
      if (loc) return loc.coordinate;
    }
    return null;
  }, [selectedLocationCoordinate, selectedLocationId, locations]);

  const routeGeoJSON = useMemo(() => {
    if (navigationRouteGeometry && navigationRouteGeometry.length > 0) {
      return {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: navigationRouteGeometry,
            },
          },
        ],
      } as any;
    }
    
    if (!userLocation || !activeSelectedCoordinate) return null;
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [userLocation.longitude, userLocation.latitude],
              [activeSelectedCoordinate.longitude, activeSelectedCoordinate.latitude],
            ],
          },
        },
      ],
    } as any;
  }, [userLocation, activeSelectedCoordinate, navigationRouteGeometry]);

  const handleSelectMarker = (loc: CrewLocation) => {
    lastMarkerSelectedTime.current = Date.now();
    onSelectLocation(loc);
  };

  const mapPoiCategoryToType = (category?: string, name?: string): LocationType => {
    const text = `${category || ''} ${name || ''}`.toLowerCase();
    if (text.includes('coffee') || text.includes('starbucks') || text.includes('dunkin') || text.includes('cafe') || text.includes('peet') || text.includes('barista')) {
      return LocationType.COFFEE;
    }
    if (text.includes('food') || text.includes('restaurant') || text.includes('dining') || text.includes('eats') || text.includes('grill') || text.includes('bistro') || text.includes('kitchen') || text.includes('pizza') || text.includes('burger') || text.includes('express')) {
      return LocationType.RESTAURANT;
    }
    if (text.includes('lounge') || text.includes('club') || text.includes('suite') || text.includes('rest area')) {
      return LocationType.LOUNGE;
    }
    if (
      text.includes('shop') ||
      text.includes('store') ||
      text.includes('gift') ||
      text.includes('retail') ||
      text.includes('boutique') ||
      text.includes('fashion') ||
      text.includes('clothing') ||
      text.includes('oakley') ||
      text.includes('brookstone') ||
      text.includes('swarovski') ||
      text.includes('socks') ||
      text.includes('candy') ||
      text.includes('bookstore') ||
      text.includes('news') ||
      text.includes('duty free') ||
      text.includes('duty-free') ||
      text.includes('market') ||
      text.includes('convenience')
    ) {
      return LocationType.SHOPPING;
    }
    return LocationType.SERVICE;
  };

  const matchLocationFloor = (loc: CrewLocation, floorLevel: string | undefined): boolean => {
    if (!floorLevel || floorLevel === 'ALL') return true;
    
    // Always show the currently selected location so focus highlight pin remains visible
    if (selectedLocationId === loc.id) return true;
    
    const locLevel = (loc.level || '').toLowerCase();
    const locName = (loc.name || '').toLowerCase();
    const level = floorLevel.toUpperCase();
    
    if (level === '1') {
      return locLevel.includes('1') || locLevel.includes('ground') || locLevel.includes('curb') || locLevel.includes('transport') || locLevel.includes('level 1');
    }
    if (level === '2') {
      return locLevel.includes('2') || locLevel.includes('arrival') || locLevel.includes('baggage') || locLevel.includes('level 2');
    }
    if (level === '3') {
      return locLevel.includes('3') || locLevel.includes('depart') || locLevel.includes('ticket') || locLevel.includes('lobby') || locLevel.includes('food court') || locLevel.includes('level 3');
    }
    if (level === '4') {
      return locLevel.includes('4') || locLevel.includes('parking') || locLevel.includes('level 4') || locName.includes('hyatt') || locName.includes("mccoy");
    }
    if (level === 'TUNNEL' || level === 'B') {
      return locLevel.includes('tunnel') || locLevel.includes('b') || locLevel.includes('basement') || locLevel.includes('level b');
    }
    if (level === 'TRAIN_PLATFORM') {
      return locLevel.includes('platform') || locLevel.includes('train') || locLevel.includes('level 2') || locLevel.includes('2');
    }
    if (level === 'AS_GATES') {
      return locLevel.includes('gate') || locLevel.includes('post-security') || locLevel.includes('concourse');
    }
    
    return locLevel.includes(floorLevel.toLowerCase());
  };

  const matchFeatureFloor = (f: any, floorLevel: string | undefined): boolean => {
    if (!floorLevel || floorLevel === 'ALL') return true;
    
    const properties = f.properties || {};
    
    // Extract any potential floor level properties from Mapbox feature properties
    const featLevel = properties.level !== undefined ? String(properties.level) :
                      properties.floor !== undefined ? String(properties.floor) :
                      properties.floor_level !== undefined ? String(properties.floor_level) :
                      properties.level_id !== undefined ? String(properties.level_id) :
                      properties.level_name !== undefined ? String(properties.level_name) :
                      properties.level_index !== undefined ? String(properties.level_index) :
                      properties.floor_index !== undefined ? String(properties.floor_index) :
                      properties.level_number !== undefined ? String(properties.level_number) : '';
                      
    if (!featLevel) {
      // If the feature has no floor/level properties, check if layerId indicates it is level-specific
      const layerId = (f.layer?.id || properties.layer || '').toLowerCase();
      if (layerId.includes('level')) {
        const match = layerId.match(/level[-_\s]?(\d)/);
        if (match && match[1]) {
          return match[1] === floorLevel;
        }
      }
      return true;
    }
    
    const featLevelLower = featLevel.toLowerCase().trim();
    const selectedLower = floorLevel.toLowerCase().trim();
    
    if (featLevelLower === selectedLower) return true;
    
    // Numerical extraction matching (e.g. "level 3" matches "3")
    const numMatch = featLevelLower.match(/\d+/);
    const selectedNumMatch = selectedLower.match(/\d+/);
    if (numMatch && selectedNumMatch && numMatch[0] === selectedNumMatch[0]) {
      return true;
    }
    
    if (selectedLower === '1') {
      return featLevelLower.includes('1') || featLevelLower.includes('ground') || featLevelLower.includes('curb') || featLevelLower.includes('transport');
    }
    if (selectedLower === '2') {
      return featLevelLower.includes('2') || featLevelLower.includes('arrival') || featLevelLower.includes('baggage');
    }
    if (selectedLower === '3') {
      return featLevelLower.includes('3') || featLevelLower.includes('depart') || featLevelLower.includes('ticket') || featLevelLower.includes('lobby') || featLevelLower.includes('food');
    }
    if (selectedLower === '4') {
      return featLevelLower.includes('4') || featLevelLower.includes('parking');
    }
    if (selectedLower === 'tunnel' || selectedLower === 'b') {
      return featLevelLower.includes('tunnel') || featLevelLower.includes('b') || featLevelLower.includes('basement');
    }
    if (selectedLower === 'train_platform') {
      return featLevelLower.includes('platform') || featLevelLower.includes('train') || featLevelLower === '2';
    }
    if (selectedLower === 'as_gates') {
      return featLevelLower.includes('gate') || featLevelLower.includes('post-security') || featLevelLower.includes('concourse');
    }
    
    return featLevelLower.includes(selectedLower) || selectedLower.includes(featLevelLower);
  };

  const handleMapPress = async (event: any) => {
    console.log('[MAP_DEBUG] handleMapPress invoked. event=', JSON.stringify(event));
    const now = Date.now();
    if (now - lastMarkerSelectedTime.current < 300) {
      console.log('[MAP_DEBUG] Ignored press due to marker selection debounce.');
      return;
    }

    let didSelectPoi = false;

    if (mapViewRef.current && event?.properties) {
      const x = event.properties?.screenPointX ?? event.properties?.x;
      const y = event.properties?.screenPointY ?? event.properties?.y;
      console.log('[MAP_DEBUG] Resolved screen coordinates:', { x, y });

      if (typeof x === 'number' && typeof y === 'number') {
        try {
          // Use queryRenderedFeaturesInRect with a 20-pixel tolerance for touch target forgiveness
          const rect: [number, number, number, number] = [y - 20, x + 20, y + 20, x - 20];
          console.log('[MAP_DEBUG] Querying rect:', rect);
          const featureCollection = await mapViewRef.current.queryRenderedFeaturesInRect(
            rect,
            undefined,
            undefined
          );
          console.log('[MAP_DEBUG] Features found in rect:', featureCollection?.features?.length ?? 0);

          // Global Query Test: Query the entire visible map area
          const globalCollection = await mapViewRef.current.queryRenderedFeaturesInRect(
            [],
            undefined,
            undefined
          );
          console.log('[MAP_DEBUG] Global query features found:', globalCollection?.features?.length ?? 0);

          if (featureCollection?.features && featureCollection.features.length > 0) {
            const tapLng = event.geometry?.coordinates?.[0];
            const tapLat = event.geometry?.coordinates?.[1];

            // Filter and map to identify relevant POI features
            const candidates = featureCollection.features
              .filter((f: any) => {
                const name = f.properties?.name || f.properties?.name_en || f.properties?.ref;
                if (!name) return false;

                const layerId = f.layer?.id || f.properties?.layer || '';
                // Exclude purely structural layers (water, roads, buildings, etc.)
                const isStructural = /background|landuse|water|road|highway|building|fill|line|border|admin|contour/i.test(layerId);
                const isTargetLayer = /poi|label|symbol|gate|indoor|shop|food|transit|station|airport|checkin|airline/i.test(layerId);

                const keep = isTargetLayer || (!isStructural && f.geometry?.type === 'Point');
                if (!keep) return false;

                // Validate floor level matching
                return matchFeatureFloor(f, selectedFloorLevel);
              })
              .map((f: any) => {
                let featLng = tapLng;
                let featLat = tapLat;
                if (f.geometry?.type === 'Point' && f.geometry?.coordinates?.length === 2) {
                  featLng = f.geometry.coordinates[0];
                  featLat = f.geometry.coordinates[1];
                }
                // Calculate square distance from tap point
                const dist = Math.pow(featLng - tapLng, 2) + Math.pow(featLat - tapLat, 2);
                return { feature: f, distance: dist, lat: featLat, lng: featLng };
              })
              .sort((a, b) => a.distance - b.distance);

            console.log('[MAP_DEBUG] Filtered candidates count:', candidates.length);

            if (candidates.length > 0) {
              const bestCandidate = candidates[0];
              const selectedFeature = bestCandidate.feature;
              const name = selectedFeature.properties?.name || selectedFeature.properties?.name_en || selectedFeature.properties?.ref || 'Map Spot';
              const category = selectedFeature.properties?.category || selectedFeature.properties?.type || 'Spot';
              const poiLat = bestCandidate.lat;
              const poiLng = bestCandidate.lng;
              console.log('[MAP_DEBUG] Best candidate selected:', { name, category, poiLat, poiLng });

              // Check if there is an existing matching location in our locations database list
              const nameLower = name.toLowerCase();
              const existingMatch = locations.find((loc) => {
                // Ensure the floor level matches
                if (!matchLocationFloor(loc, selectedFloorLevel)) return false;

                const locNameLower = loc.name.toLowerCase();
                const nameMatches = locNameLower.includes(nameLower) || nameLower.includes(locNameLower);
                if (nameMatches) return true;

                // Alternate check: check if coordinates are extremely close (within ~11 meters / 0.0001 deg)
                const latDiff = Math.abs(loc.coordinate.latitude - poiLat);
                const lngDiff = Math.abs(loc.coordinate.longitude - poiLng);
                return latDiff < 0.0001 && lngDiff < 0.0001;
              });

              if (existingMatch) {
                console.log('[MAP_DEBUG] Found existing match in locations list:', existingMatch.name);
                onSelectLocation(existingMatch);
              } else {
                // Construct a new directory-addable POI spot
                const poiLocation: CrewLocation = {
                  id: `tap-poi-${name.replace(/\s+/g, '-')}-${poiLat.toFixed(6)}-${poiLng.toFixed(6)}`,
                  name: name,
                  address: `${category.charAt(0).toUpperCase() + category.slice(1)} Spot`,
                  coordinate: {
                    latitude: poiLat,
                    longitude: poiLng,
                  },
                  type: mapPoiCategoryToType(category, name),
                  airportCore: true,
                  source: 'places',
                  rating: 0,
                  reviewCount: 0,
                  isCrewFavorite: false,
                  level: selectedFloorLevel,
                };
                console.log('[MAP_DEBUG] Constructed new POI location:', poiLocation);
                onSelectLocation(poiLocation);
              }
              didSelectPoi = true;
            }
          }
        } catch (err) {
          console.warn('[MAP_DEBUG] Failed to query map features:', err);
        }
      }
    }

    if (!didSelectPoi) {
      // Fallback: check if the tap coordinates are close to any of our database/curated locations
      const tapLng = event.geometry?.coordinates?.[0];
      const tapLat = event.geometry?.coordinates?.[1];
      
      if (typeof tapLng === 'number' && typeof tapLat === 'number') {
        let closestLoc: CrewLocation | null = null;
        let minDistance = Infinity;
        
        for (const loc of locations) {
          // Check if this location is relevant to the selected floor level
          const isFloorMatch = matchLocationFloor(loc, selectedFloorLevel);
          const isVisible = (selectedLocationId === loc.id) || isFloorMatch;
          if (!isVisible) continue;

          // Degree difference (flat-earth approximation: 1 deg lat = 111.1km, 1 deg lng = 97.7km at MCO)
          const latDiff = (loc.coordinate.latitude - tapLat) * 111111;
          const lngDiff = (loc.coordinate.longitude - tapLng) * 97700;
          const dist = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff); // distance in meters
          
          if (dist < minDistance) {
            minDistance = dist;
            closestLoc = loc;
          }
        }
        
        if (closestLoc) {
          console.log('[MAP_DEBUG] Closest database location:', closestLoc.name, 'at distance (meters):', minDistance, 'coords:', closestLoc.coordinate);
        }
        
        // Use 12 meters as the threshold for touch forgiveness
        if (closestLoc && minDistance < 12) {
          console.log('[MAP_DEBUG] Found close location via fallback coordinate match:', closestLoc.name, 'distance meters:', minDistance);
          onSelectLocation(closestLoc);
          didSelectPoi = true;
        }
      }
    }

    if (!didSelectPoi) {
      console.log('[MAP_DEBUG] No POI selected. Clearing selection and triggering onMapPress for custom marker placement.');
      onSelectLocation(null);
      const tapLng = event.geometry?.coordinates?.[0];
      const tapLat = event.geometry?.coordinates?.[1];
      if (typeof tapLng === 'number' && typeof tapLat === 'number') {
        if (onMapPress) {
          onMapPress({ latitude: tapLat, longitude: tapLng });
        }
      }
    }
  };

  const handleMapLongPress = (event: any) => {
    if (!onMapPress) return;
    let latitude = null;
    let longitude = null;
    if (event?.geometry?.coordinates) {
      [longitude, latitude] = event.geometry.coordinates;
    } else if (event?.nativeEvent?.coordinate) {
      latitude = event.nativeEvent.coordinate.latitude;
      longitude = event.nativeEvent.coordinate.longitude;
    }
    if (latitude !== null && longitude !== null) {
      onMapPress({ latitude, longitude });
    }
  };

  return (
    <View style={styles.container}>
      <Mapbox.MapView
        ref={mapViewRef}
        style={StyleSheet.absoluteFillObject}
        styleURL="mapbox://styles/mapbox/standard"
        logoEnabled={false}
        attributionEnabled={false}
        onPress={handleMapPress}
        onLongPress={handleMapLongPress}
        onCameraChanged={(state) => {
          if (state && state.properties && typeof state.properties.zoom === 'number') {
            currentZoomRef.current = state.properties.zoom;
          }
        }}
      >
        <Mapbox.Camera
          ref={cameraRef}
          zoomLevel={16.2}
          centerCoordinate={[center.longitude, center.latitude]}
        />

        {/* Enable Mapbox Standard Style Indoor Airport Map Tileset */}
        <Mapbox.StyleImport
          id="basemap"
          existing={true}
          config={{
            showIndoor: true as any,
            theme: isDark ? 'dark' : 'light',
            show3dObjects: true as any,
            showPointOfInterestLabels: true as any,
            showTransitLabels: true as any,
          }}
        />

        {/* User Location Dot via MarkerView to enable pressing/calling out profile page */}
        {userLocation && (
          <Mapbox.MarkerView
            id="user-location-marker"
            coordinate={[userLocation.longitude, userLocation.latitude]}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onMePress}
              style={styles.mapboxMeMarkerWrap}
            >
              <View style={styles.meMarkerLabel}>
                <Text style={styles.meMarkerLabelText} numberOfLines={1}>
                  {userProfile?.fullName || 'Me'}
                </Text>
                <Text style={styles.meMarkerLabelSubtext} numberOfLines={1}>
                  {userProfile?.roleLabel 
                    ? `${userProfile.roleLabel}${userProfile.airline ? ` · ${userProfile.airline}` : ''}`
                    : 'Tap to view'}
                </Text>
              </View>
              <View style={styles.meMarkerPulseHalo} />
              <View style={styles.meMarkerBlueDot} />
            </TouchableOpacity>
          </Mapbox.MarkerView>
        )}

        {/* Route directions path */}
        {routeGeoJSON && (
          <Mapbox.ShapeSource id="routeSource" shape={routeGeoJSON}>
            <Mapbox.LineLayer
              id="routeLine"
              style={{
                lineColor: theme.colors.accent,
                lineWidth: 3,
                lineDasharray: [2, 2],
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* Crew Alerts Markers */}
        {(alerts || [])
          .filter((a) => typeof a.latitude === 'number' && typeof a.longitude === 'number')
          .map((alert) => (
            <Mapbox.MarkerView
              key={alert.id}
              id={alert.id}
              coordinate={[alert.longitude!, alert.latitude!]}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  lastMarkerSelectedTime.current = Date.now();
                  onAlertPress?.(alert);
                }}
                style={styles.alertMarkerWrap}
              >
                <View style={[
                  styles.alertMarkerGlow,
                  alert.isPrivate && { backgroundColor: 'rgba(0, 229, 255, 0.35)' }
                ]} />
                <View style={[
                  styles.alertMarkerCore,
                  alert.isPrivate && { backgroundColor: '#00E5FF', shadowColor: '#00E5FF' }
                ]}>
                  <Ionicons name={alert.isPrivate ? "lock-closed" : getAlertIcon(alert.type)} size={alert.isPrivate ? 10 : 12} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            </Mapbox.MarkerView>
          ))}

        {tempAlertCoordinate && (
          <Mapbox.MarkerView
            key="temp-alert"
            id="temp-alert"
            coordinate={[tempAlertCoordinate.longitude, tempAlertCoordinate.latitude]}
          >
            <View style={styles.tempAlertMarkerWrap}>
              <View style={styles.tempAlertMarkerGlow} />
              <View style={styles.tempAlertMarkerCore}>
                <Ionicons name="radio-outline" size={12} color="#FFFFFF" />
              </View>
            </View>
          </Mapbox.MarkerView>
        )}

        {/* Crew Spots & Airport Markers */}
        {locations.filter((loc) => {
          const isSelected = selectedLocationId === loc.id;
          const isCustomUserMarker = loc.source === 'crew';
          
          if (isSelected) return true;
          if (!isCustomUserMarker) return false;
          
          return matchLocationFloor(loc, selectedFloorLevel);
        }).map((loc) => {
          const isSelected = selectedLocationId === loc.id;
          let pinColor = '#00F5D4'; // default teal
          if (isSelected) {
            pinColor = '#E066FF'; // selected purple
          } else if (loc.isCrewFavorite) {
            pinColor = '#FFD166'; // favorite yellow
          } else if (loc.airportCoreKind === 'SECURITY') {
            pinColor = '#FF6B6B'; // security red/orange
          }

          return (
            <Mapbox.MarkerView
              key={loc.id}
              id={loc.id}
              coordinate={[loc.coordinate.longitude, loc.coordinate.latitude]}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleSelectMarker(loc)}
              >
                <View style={[styles.markerWrap, isSelected && styles.markerSelected]}>
                  <View style={[styles.markerContainer, { backgroundColor: pinColor }]}>
                    <Ionicons
                      name={getMarkerIcon(loc)}
                      size={14}
                      color={loc.isCrewFavorite ? theme.colors.background : '#FFFFFF'}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            </Mapbox.MarkerView>
          );
        })}
      </Mapbox.MapView>

      {/* Floating Zoom Controls */}
      <View style={styles.zoomControls}>
        <TouchableOpacity style={styles.zoomButton} onPress={handleZoomIn}>
          <Ionicons name="add" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.zoomDivider} />
        <TouchableOpacity style={styles.zoomButton} onPress={handleZoomOut}>
          <Ionicons name="remove" size={20} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Floating Camera Actions Controls */}
      <View style={styles.actionControls}>
        {userLocation && (
          <TouchableOpacity style={styles.actionButton} onPress={handleLocateMe}>
            <Ionicons name="navigate" size={16} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Me</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.actionButton, styles.actionButtonSecondary]} onPress={handleRecenter}>
          <Ionicons name="airplane-outline" size={16} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>{activeAirportCode}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    markerWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 36,
      height: 36,
    },
    markerSelected: {
      transform: [{ scale: 1.25 }],
    },
    markerContainer: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1.5,
      borderColor: theme.colors.surface,
      elevation: 5,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    alertMarkerWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 36,
      height: 36,
    },
    alertMarkerGlow: {
      position: 'absolute',
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255, 107, 107, 0.25)',
    },
    alertMarkerCore: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#FF6B6B',
      borderWidth: 1.5,
      borderColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 4,
    },
    tempAlertMarkerWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 36,
      height: 36,
    },
    tempAlertMarkerGlow: {
      position: 'absolute',
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255, 152, 0, 0.3)',
    },
    tempAlertMarkerCore: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#FF9800',
      borderWidth: 1.5,
      borderColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 4,
    },
    mapboxMeMarkerWrap: {
      width: 120, // Expanded width to prevent name truncation
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    meMarkerPulseHalo: {
      position: 'absolute',
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: 'rgba(0, 122, 255, 0.25)',
    },
    meMarkerBlueDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: '#007AFF',
      borderWidth: 2,
      borderColor: '#FFFFFF',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1.5 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 4,
    },
    meMarkerLabel: {
      position: 'absolute',
      bottom: 24,
      backgroundColor: 'rgba(10, 18, 28, 0.88)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 32,
    },
    meMarkerLabelText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '800',
    },
    meMarkerLabelSubtext: {
      color: '#38BDF8', // Sky blue accent color
      fontSize: 8,
      fontWeight: '600',
      marginTop: 1,
    },
    zoomControls: {
      position: 'absolute',
      left: 16,
      top: '40%',
      backgroundColor: isDark ? 'rgba(10, 18, 28, 0.86)' : 'rgba(255, 255, 255, 0.9)',
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.16,
      shadowRadius: 8,
      elevation: 5,
    },
    zoomButton: {
      width: 38,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
    },
    zoomDivider: {
      width: '70%',
      height: 1,
      backgroundColor: theme.colors.border,
    },
    actionControls: {
      position: 'absolute',
      left: 16,
      top: '54%',
      gap: 12,
      zIndex: 1000,
      alignItems: 'flex-start',
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 18,
      backgroundColor: theme.colors.accent,
      gap: 6,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 5,
    },
    actionButtonSecondary: {
      backgroundColor: theme.colors.primary,
    },
    actionButtonText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '800',
    },
  });
