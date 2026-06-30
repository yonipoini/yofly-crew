import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useTheme } from '../theme/theme';
import { AirportSearchService } from '../services/AirportSearchService';
import { MarketplaceCoordinate } from '../services/MarketplaceLocationService';

type DragPinLocationPickerProps = {
  airportCode: string;
  coordinate: MarketplaceCoordinate;
  onChange: (coordinate: MarketplaceCoordinate) => void;
};

const MAP_WIDTH = 320;
const MAP_HEIGHT = 190;
const LATITUDE_DELTA = 0.09;
const LONGITUDE_DELTA = 0.11;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const DragPinLocationPicker: React.FC<DragPinLocationPickerProps> = ({
  airportCode,
  coordinate,
  onChange,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const airport = AirportSearchService.getAirportByCode(airportCode);
  const center = {
    latitude: airport?.latitude || coordinate.latitude,
    longitude: airport?.longitude || coordinate.longitude,
  };
  const initialPoint = {
    x: MAP_WIDTH / 2,
    y: MAP_HEIGHT / 2,
  };
  const [mapSize, setMapSize] = useState({ width: MAP_WIDTH, height: MAP_HEIGHT });
  const [pinPoint, setPinPoint] = useState(initialPoint);
  const dragStartRef = useRef(initialPoint);

  const coordinateToDynamicPoint = React.useCallback(
    (nextCoordinate: MarketplaceCoordinate) => ({
      x: clamp(
        ((nextCoordinate.longitude - center.longitude) / LONGITUDE_DELTA + 0.5) * mapSize.width,
        24,
        mapSize.width - 24
      ),
      y: clamp(
        (0.5 - (nextCoordinate.latitude - center.latitude) / LATITUDE_DELTA) * mapSize.height,
        28,
        mapSize.height - 24
      ),
    }),
    [center.latitude, center.longitude, mapSize.height, mapSize.width]
  );

  const dynamicPointToCoordinate = React.useCallback(
    (x: number, y: number) => ({
      latitude: center.latitude + (0.5 - y / mapSize.height) * LATITUDE_DELTA,
      longitude: center.longitude + (x / mapSize.width - 0.5) * LONGITUDE_DELTA,
    }),
    [center.latitude, center.longitude, mapSize.height, mapSize.width]
  );

  React.useEffect(() => {
    const nextPoint = coordinateToDynamicPoint(coordinate);
    setPinPoint(nextPoint);
    dragStartRef.current = nextPoint;
  }, [coordinate.latitude, coordinate.longitude, coordinateToDynamicPoint]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStartRef.current = pinPoint;
        },
        onPanResponderMove: (_, gestureState) => {
          const nextPoint = {
            x: clamp(dragStartRef.current.x + gestureState.dx, 24, mapSize.width - 24),
            y: clamp(dragStartRef.current.y + gestureState.dy, 28, mapSize.height - 24),
          };
          setPinPoint(nextPoint);
          onChange(dynamicPointToCoordinate(nextPoint.x, nextPoint.y));
        },
        onPanResponderRelease: (_, gestureState) => {
          const nextPoint = {
            x: clamp(dragStartRef.current.x + gestureState.dx, 24, mapSize.width - 24),
            y: clamp(dragStartRef.current.y + gestureState.dy, 28, mapSize.height - 24),
          };
          dragStartRef.current = nextPoint;
          setPinPoint(nextPoint);
          onChange(dynamicPointToCoordinate(nextPoint.x, nextPoint.y));
        },
      }),
    [dynamicPointToCoordinate, mapSize.height, mapSize.width, onChange, pinPoint]
  );

  return (
    <View style={styles.container}>
      <View
        style={styles.map}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          if (width > 0 && height > 0) {
            setMapSize({ width, height });
          }
        }}
      >
        <View style={styles.grid} pointerEvents="none" />
        <View style={styles.airportBadge} pointerEvents="none">
          <Text style={styles.airportCode}>{airportCode}</Text>
          <Text style={styles.airportName} numberOfLines={1}>
            {airport?.name || 'Airport area'}
          </Text>
        </View>
        <View style={styles.airportPin} pointerEvents="none">
          <Ionicons name="airplane" size={15} color={theme.colors.background} />
        </View>
        <View
          {...panResponder.panHandlers}
          style={[styles.pin, { left: pinPoint.x - 19, top: pinPoint.y - 38 }]}
        >
          <Ionicons name="location" size={24} color={theme.colors.background} />
        </View>
      </View>
      <Text style={styles.caption}>Drag the pin near the pickup area. Exact details can stay private until contact.</Text>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      gap: 8,
    },
    map: {
      width: '100%',
      height: MAP_HEIGHT,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      overflow: 'hidden',
      position: 'relative',
    },
    grid: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.colors.background === '#000000' ? 'rgba(7, 18, 23, 0.96)' : '#E8F2F6',
      borderColor: theme.colors.border,
      borderWidth: 1,
    },
    airportBadge: {
      position: 'absolute',
      top: 12,
      left: 12,
      maxWidth: 220,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    airportCode: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.8,
    },
    airportName: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      marginTop: 2,
    },
    airportPin: {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: 30,
      height: 30,
      marginLeft: -15,
      marginTop: -15,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      borderWidth: 2,
      borderColor: theme.colors.surface,
    },
    pin: {
      position: 'absolute',
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.accent,
      borderWidth: 3,
      borderColor: theme.colors.surface,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.28,
      shadowRadius: 10,
      elevation: 5,
    },
    caption: {
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
  });
