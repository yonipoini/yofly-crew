import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  PanResponder,
  Animated,
  Dimensions,
  Platform,
  TouchableWithoutFeedback,
  Easing
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { mcoSvgMaps } from '../assets/mcoSvgMaps';
import { CrewLocation } from '../types/locations';
import { AppTheme } from '../theme/theme';
import { getLocationMarkerColors } from '../utils/mapLocationPresentation';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Map natural dimension sizes for MCO floors 1:1 matching database x,y coordinates
const MAP_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "Tunnel": { width: 7268, height: 5592 },
  "1": { width: 4530, height: 2888 },
  "2": { width: 4676, height: 2330 },
  "3": { width: 4701, height: 2508 },
  "4": { width: 4808, height: 2174 },
  "Gates 1-29": { width: 3753, height: 4942 },
  "Gates 100-129": { width: 4373, height: 3474 },
  "Gates 30-59": { width: 4146, height: 3508 },
  "Gates 70-99": { width: 3122, height: 3474 },
  "C-1": { width: 5875, height: 8192 },
  "C-2": { width: 6682, height: 8100 },
  "TrainPlatform": { width: 2037, height: 2011 }
};

interface CrewAirportSvgMapProps {
  selectedTerminalZone: string;
  selectedFloorLevel: string;
  locations: CrewLocation[];
  theme: AppTheme;
  getMarkerIcon: (location: CrewLocation) => keyof typeof Ionicons.glyphMap;
  onSelectLocation?: (location: CrewLocation | null) => void;
  isDark: boolean;
  selectedLocationId?: string | null;
  userLocation?: { latitude: number; longitude: number } | null;
  userProfile?: {
    fullName: string;
    avatarUri?: string;
    roleLabel?: string;
    airline?: string;
    aircraft?: string;
  };
  onMePress?: () => void;
}

export function CrewAirportSvgMap({
  selectedTerminalZone,
  selectedFloorLevel,
  locations,
  theme,
  getMarkerIcon,
  onSelectLocation,
  isDark,
  selectedLocationId,
  userLocation,
  userProfile,
  onMePress
}: CrewAirportSvgMapProps) {
  // Map selected zone and floor to key in mcoSvgMaps
  const mapKey = useMemo(() => {
    if (selectedTerminalZone === 'MAIN_AB') {
      if (selectedFloorLevel === 'TUNNEL') return 'Tunnel';
      if (['1', '2', '3', '4'].includes(selectedFloorLevel)) return selectedFloorLevel;
    } else if (selectedTerminalZone === 'AS1') {
      return 'Gates 1-29';
    } else if (selectedTerminalZone === 'AS2') {
      return 'Gates 100-129';
    } else if (selectedTerminalZone === 'AS3') {
      return 'Gates 30-59';
    } else if (selectedTerminalZone === 'AS4') {
      return 'Gates 70-99';
    } else if (selectedTerminalZone === 'MAIN_C') {
      if (selectedFloorLevel === '1') return 'C-1';
      if (selectedFloorLevel === '2') return 'C-2';
    } else if (selectedTerminalZone === 'TRAIN') {
      return 'TrainPlatform';
    }
    return '3'; // Default to Level 3 if not matched
  }, [selectedTerminalZone, selectedFloorLevel]);

  // Animated value for user location pulsing dot
  const userPulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(userPulseAnim, {
          toValue: 1,
          duration: 2200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(userPulseAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        })
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [userPulseAnim]);

  const userPulseScale = userPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.8],
  });

  const userPulseOpacity = userPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.65, 0],
  });

  const svgXml = mcoSvgMaps[mapKey];
  const dimensions = MAP_DIMENSIONS[mapKey] || { width: 4701, height: 2508 };
  console.log('[DEBUG] SvgMap: mapKey =', mapKey, 'svgXml length =', svgXml ? svgXml.length : 'undefined', 'dimensions =', dimensions);

  // Animated values for Zoom & Pan
  const scale = useRef(new Animated.Value(0.12)).current;
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  // Gesture State Refs
  const lastScale = useRef(0.12);
  const lastPan = useRef({ x: 0, y: 0 });
  const initialTouchDistance = useRef<number | null>(null);
  const lastTap = useRef<number>(0);

  // Reset viewport zoom/pan whenever floor/map changes
  useEffect(() => {
    const fitScale = Math.min(SCREEN_WIDTH / dimensions.width, (SCREEN_HEIGHT - 300) / dimensions.height) * 0.72;
    const initialScale = Math.max(fitScale, 0.04);
    
    // Position the center of the map to the center of the viewport
    const initialX = SCREEN_WIDTH / 2 - dimensions.width / 2;
    const initialY = (SCREEN_HEIGHT - 250) / 2 - dimensions.height / 2;

    console.log('[DEBUG] SvgMap useEffect (TEST CENTER): initialScale =', initialScale, 'initialX =', initialX, 'initialY =', initialY);

    scale.setValue(initialScale);
    pan.setValue({ x: initialX, y: initialY });

    lastScale.current = initialScale;
    lastPan.current = { x: initialX, y: initialY };
  }, [mapKey, dimensions.width, dimensions.height]);

  // Animated values tracking refs
  const currentScaleRef = useRef(0.12);
  const currentPan = useRef({ x: 0, y: 0 });

  // Sync pan animated value changes to a ref in real-time
  useEffect(() => {
    const idX = pan.x.addListener(({ value }) => {
      currentPan.current.x = value;
    });
    const idY = pan.y.addListener(({ value }) => {
      currentPan.current.y = value;
    });
    return () => {
      pan.x.removeListener(idX);
      pan.y.removeListener(idY);
    };
  }, [pan]);

  // Track zoom level in state to inversely scale the custom markers in real-time
  const [currentScale, setCurrentScale] = useState(0.12);
  useEffect(() => {
    const id = scale.addListener(({ value }) => {
      currentScaleRef.current = value;
      setCurrentScale(value);
    });
    return () => scale.removeListener(id);
  }, [scale]);

  // Helper for pinch-to-zoom distance calculation
  const calcDistance = (evt: any) => {
    const touches = evt.nativeEvent.touches;
    if (touches.length < 2) return 0;
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const isPinch = evt.nativeEvent.touches.length === 2;
        const isDrag = Math.abs(gestureState.dx) > 12 || Math.abs(gestureState.dy) > 12;
        return isPinch || isDrag;
      },
      onPanResponderGrant: (evt, gestureState) => {
        // Handle touch starts
        if (evt.nativeEvent.touches.length === 2) {
          initialTouchDistance.current = calcDistance(evt);
        } else {
          initialTouchDistance.current = null;
          
          const now = Date.now();
          const DOUBLE_TAP_DELAY = 350;
          if (now - lastTap.current < DOUBLE_TAP_DELAY) {
            handleZoom('in');
          }
          lastTap.current = now;
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;

        if (touches.length === 2 && initialTouchDistance.current !== null) {
          // 2 Finger Pinch Zoom
          const dist = calcDistance(evt);
          if (dist > 0) {
            const factor = dist / initialTouchDistance.current;
            let newScale = lastScale.current * factor;
            
            // Boundary constraints for scale (0.05x to 3.0x zoom)
            newScale = Math.min(Math.max(newScale, 0.04), 3.0);
            scale.setValue(newScale);
          }
        } else if (touches.length === 1 && initialTouchDistance.current === null) {
          // 1 Finger Drag / Pan
          const newX = lastPan.current.x + gestureState.dx;
          const newY = lastPan.current.y + gestureState.dy;

          // Correct boundary constraints taking React Native center transform origin into account
          const boundX = dimensions.width * currentScale;
          const boundY = dimensions.height * currentScale;
          const cx = dimensions.width / 2;
          const cy = dimensions.height / 2;
          
          const maxLeft = SCREEN_WIDTH - boundX * 0.1 - cx * (1 - currentScale);
          const maxRight = boundX * 0.9 + cx * (1 - currentScale);
          const maxTop = (SCREEN_HEIGHT - 200) - boundY * 0.1 - cy * (1 - currentScale);
          const maxBottom = boundY * 0.9 + cy * (1 - currentScale);

          pan.setValue({ 
            x: Math.min(Math.max(newX, -maxRight), maxLeft),
            y: Math.min(Math.max(newY, -maxBottom), maxTop)
          });
        }
      },
      onPanResponderRelease: () => {
        // Save current values as basis for next interactions
        lastScale.current = currentScaleRef.current;
        lastPan.current = { x: currentPan.current.x, y: currentPan.current.y };
      }
    })
  ).current;

  // Zoom Button Controls
  const handleZoom = (direction: 'in' | 'out') => {
    const zoomFactor = direction === 'in' ? 1.4 : 0.7;
    let newScale = lastScale.current * zoomFactor;
    newScale = Math.min(Math.max(newScale, 0.04), 3.0);

    const panVal = currentPan.current;
    
    // Zoom centering relative to viewport center and scale origin
    const targetX = panVal.x * zoomFactor - (SCREEN_WIDTH / 2 - dimensions.width / 2) * (zoomFactor - 1);
    const targetY = panVal.y * zoomFactor - ((SCREEN_HEIGHT - 220) / 2 - dimensions.height / 2) * (zoomFactor - 1);

    // Apply corrected boundary constraints to the target zoom coordinates
    const boundX = dimensions.width * newScale;
    const boundY = dimensions.height * newScale;
    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;
    
    const maxLeft = SCREEN_WIDTH - boundX * 0.1 - cx * (1 - newScale);
    const maxRight = boundX * 0.9 + cx * (1 - newScale);
    const maxTop = (SCREEN_HEIGHT - 200) - boundY * 0.1 - cy * (1 - newScale);
    const maxBottom = boundY * 0.9 + cy * (1 - newScale);

    const clampedX = Math.min(Math.max(targetX, -maxRight), maxLeft);
    const clampedY = Math.min(Math.max(targetY, -maxBottom), maxTop);

    Animated.parallel([
      Animated.timing(scale, {
        toValue: newScale,
        duration: 250,
        useNativeDriver: false
      }),
      Animated.timing(pan, {
        toValue: { x: clampedX, y: clampedY },
        duration: 250,
        useNativeDriver: false
      })
    ]).start(() => {
      lastScale.current = newScale;
      lastPan.current = { x: clampedX, y: clampedY };
    });
  };

  // Filter locations to those positioned specifically on this floor/map layout
  const floorPins = useMemo(() => {
    return locations.filter((loc) => {
      if (loc.x === undefined || loc.y === undefined) return false;
      
      const locLevel = (loc.level || '').toLowerCase();
      const locZone = (loc.zone || '').toLowerCase();
      const locName = (loc.name || '').toLowerCase();
      
      // Match by mapKey
      if (mapKey === 'Tunnel') {
        return locLevel.includes('tunnel') || locLevel.includes('basement');
      }
      if (mapKey === '1') {
        return (locLevel.includes('1') || locLevel.includes('ground')) && !locZone.includes('terminal c') && !locZone.includes('train');
      }
      if (mapKey === '2') {
        return (locLevel.includes('2') || locLevel.includes('arrival')) && !locZone.includes('terminal c') && !locZone.includes('train');
      }
      if (mapKey === '3') {
        return (locLevel.includes('3') || locLevel.includes('depart') || locLevel.includes('ticket')) && !locZone.includes('terminal c');
      }
      if (mapKey === '4') {
        return locLevel.includes('4') || locName.includes('hyatt');
      }
      if (mapKey === 'Gates 1-29') {
        return locLevel.includes('1-29') || locZone.includes('airside 1');
      }
      if (mapKey === 'Gates 100-129') {
        return locLevel.includes('100-129') || locZone.includes('airside 3') || locZone.includes('gates 100-129');
      }
      if (mapKey === 'Gates 30-59') {
        return locLevel.includes('30-59') || locZone.includes('airside 2') || locZone.includes('gates 30-59');
      }
      if (mapKey === 'Gates 70-99') {
        return locLevel.includes('70-99') || locZone.includes('airside 4') || locZone.includes('gates 70-99');
      }
      if (mapKey === 'C-1') {
        return (locLevel.includes('1') || locLevel.includes('ground')) && locZone.includes('terminal c');
      }
      if (mapKey === 'C-2') {
        return (locLevel.includes('2') || locLevel.includes('depart')) && locZone.includes('terminal c');
      }
      if (mapKey === 'TrainPlatform') {
        return locZone.includes('train') || locLevel.includes('platform');
      }
      
      return false;
    });
  }, [locations, mapKey]);

  // Project user location GPS coordinates to SVG coordinate space
  const userSvgPos = useMemo(() => {
    if (!userLocation || typeof userLocation.latitude !== 'number' || typeof userLocation.longitude !== 'number') {
      return null;
    }

    // Find pins on this specific floor map that have both SVG coordinates and valid GPS coordinates
    const validPins = floorPins.filter(
      (p) =>
        p.x !== undefined &&
        p.y !== undefined &&
        p.coordinate &&
        typeof p.coordinate.latitude === 'number' &&
        typeof p.coordinate.longitude === 'number'
    );

    if (validPins.length < 2) {
      if (validPins.length === 1) {
        // Fallback translation using approximate degree-to-pixel scale at MCO coordinates
        const p1 = validPins[0];
        const scaleX = 230000;
        const scaleY = -230000; // y-axis grows down in SVG, latitude grows up
        const dx = (userLocation.longitude - p1.coordinate.longitude) * scaleX;
        const dy = (userLocation.latitude - p1.coordinate.latitude) * scaleY;
        return {
          x: Math.max(0, Math.min(dimensions.width, p1.x! + dx)),
          y: Math.max(0, Math.min(dimensions.height, p1.y! + dy)),
        };
      }
      return null;
    }

    // Sort valid pins by distance to the user's location
    const sorted = [...validPins].sort((a, b) => {
      const distA =
        Math.pow(a.coordinate.latitude - userLocation.latitude, 2) +
        Math.pow(a.coordinate.longitude - userLocation.longitude, 2);
      const distB =
        Math.pow(b.coordinate.latitude - userLocation.latitude, 2) +
        Math.pow(b.coordinate.longitude - userLocation.longitude, 2);
      return distA - distB;
    });

    const p1 = sorted[0];

    // If the closest pin is more than ~10 miles away (0.02 degrees squared),
    // the user is probably not at MCO. Don't render the pulsing dot.
    const closestDistSq =
      Math.pow(p1.coordinate.latitude - userLocation.latitude, 2) +
      Math.pow(p1.coordinate.longitude - userLocation.longitude, 2);
    if (closestDistSq > 0.02) {
      return null;
    }

    const p2 = sorted[1];

    const lat1 = p1.coordinate.latitude;
    const lon1 = p1.coordinate.longitude;
    const x1 = p1.x!;
    const y1 = p1.y!;

    const lat2 = p2.coordinate.latitude;
    const lon2 = p2.coordinate.longitude;
    const x2 = p2.x!;
    const y2 = p2.y!;

    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;
    const denom = dLat * dLat + dLon * dLon;

    if (denom < 1e-12) {
      return { x: x1, y: y1 };
    }

    const dX = x2 - x1;
    const dY = y2 - y1;

    // Solve for scale and rotation: x = sCos * lat - sSin * lon + tX, y = sSin * lat + sCos * lon + tY
    const sCos = (dX * dLat + dY * dLon) / denom;
    const sSin = (dY * dLat - dX * dLon) / denom;

    const tX = x1 - (sCos * lat1 - sSin * lon1);
    const tY = y1 - (sSin * lat1 + sCos * lon1);

    const projectedX = sCos * userLocation.latitude - sSin * userLocation.longitude + tX;
    const projectedY = sSin * userLocation.latitude + sCos * userLocation.longitude + tY;

    return {
      x: Math.max(0, Math.min(dimensions.width, projectedX)),
      y: Math.max(0, Math.min(dimensions.height, projectedY)),
    };
  }, [userLocation, floorPins, dimensions.width, dimensions.height]);

  // Center map on the selected pin smoothly when selectedLocationId changes
  useEffect(() => {
    if (!selectedLocationId) return;
    const selectedPin = floorPins.find(p => p.id === selectedLocationId);
    if (!selectedPin || selectedPin.x === undefined || selectedPin.y === undefined) return;

    const fitScale = Math.min(SCREEN_WIDTH / dimensions.width, (SCREEN_HEIGHT - 300) / dimensions.height) * 1.1;
    const targetScale = Math.max(fitScale * 2.2, 0.35); // zoom in slightly to focus
    
    const targetX = SCREEN_WIDTH / 2 - (dimensions.width / 2) * (1 - targetScale) - selectedPin.x * targetScale;
    const targetY = (SCREEN_HEIGHT - 220) / 2 - (dimensions.height / 2) * (1 - targetScale) - selectedPin.y * targetScale;

    Animated.parallel([
      Animated.timing(scale, {
        toValue: targetScale,
        duration: 400,
        useNativeDriver: false
      }),
      Animated.timing(pan, {
        toValue: { x: targetX, y: targetY },
        duration: 400,
        useNativeDriver: false
      })
    ]).start(() => {
      lastScale.current = targetScale;
      lastPan.current = { x: targetX, y: targetY };
    });
  }, [selectedLocationId, floorPins, dimensions.width, dimensions.height]);

  const handleCanvasPress = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 350;
    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      handleZoom('in');
    } else {
      if (onSelectLocation) {
        onSelectLocation(null);
      }
    }
    lastTap.current = now;
  };

  return (
    <View style={styles.container}>
      {/* Zoomable Canvas Container */}
      <View style={styles.canvasContainer} {...panResponder.panHandlers}>
        <Animated.View
          style={[
            styles.transformView,
            {
              width: dimensions.width,
              height: dimensions.height,
              transform: [
                { translateX: pan.x },
                { translateY: pan.y },
                { scale: scale }
              ]
            }
          ]}
        >
          {svgXml ? (
            <TouchableWithoutFeedback onPress={handleCanvasPress}>
              <View>
                <SvgXml
                  xml={svgXml}
                  width={dimensions.width}
                  height={dimensions.height}
                />
              </View>
            </TouchableWithoutFeedback>
          ) : (
            <View style={[styles.errorContainer, { width: dimensions.width, height: dimensions.height }]}>
              <Ionicons name="alert-circle-outline" size={48} color={theme.colors.textMuted} />
              <Text style={{ color: theme.colors.text }}>Vector Map Not Loaded</Text>
            </View>
          )}

          {/* Plot Category Markers */}
          {floorPins.map((pin) => {
            const isSelected = selectedLocationId === pin.id;
            const markerColors = getLocationMarkerColors(theme, pin);
            const iconName = getMarkerIcon(pin);
            
            // Adjust pin scale inversely relative to map zoom scale to maintain constant physical size
            const pinScale = Math.min(Math.max(1 / currentScale, 1.2), 16.0);

            return (
              <TouchableOpacity
                key={pin.id}
                style={[
                  styles.markerContainer,
                  {
                    left: pin.x! - 16,
                    top: pin.y! - 16,
                    transform: [{ scale: pinScale }]
                  }
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  if (onSelectLocation) onSelectLocation(pin);
                }}
              >
                <View
                  style={[
                    styles.pinCircle,
                    {
                      backgroundColor: isSelected ? theme.colors.primary : markerColors.fill,
                      borderColor: '#FFFFFF',
                      borderWidth: isSelected ? 1.5 : 1
                    }
                  ]}
                >
                  <Ionicons name={iconName} size={10} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Plot User Location "Me" Marker */}
          {userSvgPos && (() => {
            const meScale = Math.min(Math.max(1 / currentScale, 1.2), 16.0);
            return (
              <TouchableOpacity
                key="me-marker"
                style={[
                  styles.meMarkerContainer,
                  {
                    left: userSvgPos.x - 22,
                    top: userSvgPos.y - 22,
                    transform: [{ scale: meScale }]
                  }
                ]}
                activeOpacity={0.8}
                onPress={onMePress}
              >
                <View style={styles.meMarkerLabel}>
                  <Text style={styles.meMarkerLabelText} numberOfLines={1}>
                    {userProfile?.fullName || 'Me'}
                  </Text>
                  <Text style={styles.meMarkerLabelSubtext} numberOfLines={1}>
                    {userProfile?.roleLabel ? `${userProfile.roleLabel}${userProfile.airline ? ` · ${userProfile.airline}` : ''}` : 'Tap to view'}
                  </Text>
                </View>
                <Animated.View
                  style={[
                    styles.meMarkerPulseHalo,
                    {
                      transform: [{ scale: userPulseScale }],
                      opacity: userPulseOpacity,
                    },
                  ]}
                />
                <View style={styles.meMarkerBlueDot} />
              </TouchableOpacity>
            );
          })()}
        </Animated.View>
      </View>

      {/* Floating Zoom Buttons (Bottom Right) */}
      <View style={styles.zoomButtonsContainer}>
        <TouchableOpacity style={styles.zoomBtn} onPress={() => handleZoom('in')}>
          <Ionicons name="add" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.zoomBtn} onPress={() => handleZoom('out')}>
          <Ionicons name="remove" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative'
  },
  canvasContainer: {
    flex: 1,
    backgroundColor: '#0f172a' // Sleek dark slate grid background
  },
  transformView: {
    position: 'absolute'
  },
  markerContainer: {
    position: 'absolute',
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999
  },
  pinCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5
  },
  zoomButtonsContainer: {
    position: 'absolute',
    top: '40%',
    left: 16,
    flexDirection: 'column',
    gap: 8,
    zIndex: 1000
  },
  zoomBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5
  },
  calloutCard: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1001
  },
  calloutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  calloutTitleContainer: {
    flex: 1,
    paddingRight: 8
  },
  calloutName: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20
  },
  calloutCategory: {
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginTop: 2
  },
  closeBtn: {
    padding: 2
  },
  calloutMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    marginBottom: 8
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFD700'
  },
  reviewText: {
    fontSize: 12,
    color: '#94a3b8'
  },
  favoriteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4
  },
  favoriteText: {
    fontSize: 11,
    fontWeight: '700'
  },
  calloutTip: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
    marginTop: 4
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a'
  },
  meMarkerContainer: {
    position: 'absolute',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  meMarkerPulseHalo: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 122, 255, 0.32)',
  },
  meMarkerBlueDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 1.5,
    elevation: 3,
  },
  meMarkerLabel: {
    position: 'absolute',
    bottom: 26,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  meMarkerLabelText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
  meMarkerLabelSubtext: {
    color: '#38BDF8', // Sky blue accent color
    fontSize: 6,
    fontWeight: '600',
    marginTop: 1,
  },
});
