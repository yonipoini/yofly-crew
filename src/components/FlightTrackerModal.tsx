import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Platform,
  Dimensions,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { AppTheme } from '../theme/theme';
import { Coordinates } from '../types/locations';
import { FlightBoardEntry } from '../types/ops';
import { OpsIntelService } from '../services/OpsIntelService';

const getAirlineName = (flightNumber: string): string => {
  const code = flightNumber.trim().toUpperCase();
  
  if (code.startsWith('DAL') || code.startsWith('DL')) return 'Delta Air Lines';
  if (code.startsWith('UAL') || code.startsWith('UA')) return 'United Airlines';
  if (code.startsWith('AAL') || code.startsWith('AA')) return 'American Airlines';
  if (code.startsWith('JBU') || code.startsWith('B6')) return 'JetBlue Airways';
  if (code.startsWith('SWA') || code.startsWith('WN')) return 'Southwest Airlines';
  if (code.startsWith('ASA') || code.startsWith('AS')) return 'Alaska Airlines';
  if (code.startsWith('FFT') || code.startsWith('F9')) return 'Frontier Airlines';
  if (code.startsWith('NKS') || code.startsWith('NK')) return 'Spirit Airlines';
  if (code.startsWith('HAL') || code.startsWith('HA')) return 'Hawaiian Airlines';
  if (code.startsWith('AWE') || code.startsWith('US')) return 'US Airways';
  if (code.startsWith('EGF') || code.startsWith('MQ')) return 'Envoy Air';
  if (code.startsWith('SKW') || code.startsWith('OO')) return 'SkyWest Airlines';
  if (code.startsWith('ROU') || code.startsWith('RV')) return 'Air Canada Rouge';
  if (code.startsWith('ACA') || code.startsWith('AC')) return 'Air Canada';
  if (code.startsWith('BAW') || code.startsWith('BA')) return 'British Airways';
  if (code.startsWith('DLH') || code.startsWith('LH')) return 'Lufthansa';
  if (code.startsWith('AFR') || code.startsWith('AF')) return 'Air France';
  if (code.startsWith('AMX') || code.startsWith('AM')) return 'Aeromexico';
  
  const match = code.match(/^([A-Z]+)/);
  if (match) {
    const letters = match[1];
    if (letters === 'DL') return 'Delta Air Lines';
    if (letters === 'UA') return 'United Airlines';
    if (letters === 'AA') return 'American Airlines';
    if (letters === 'B6') return 'JetBlue Airways';
    if (letters === 'WN') return 'Southwest Airlines';
    if (letters === 'AS') return 'Alaska Airlines';
    if (letters === 'F9') return 'Frontier Airlines';
    if (letters === 'NK') return 'Spirit Airlines';
  }
  
  return 'Commercial Airline';
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Dynamic platform loading for react-native-maps to prevent web bundling crashes
let MapView: any;
let Marker: any;
let Polyline: any;

if (Platform.OS !== 'web') {
  try {
    const RNMaps = require('react-native-maps');
    MapView = RNMaps.default;
    Marker = RNMaps.Marker;
    Polyline = RNMaps.Polyline;
  } catch (e) {
    console.warn('Failed to load react-native-maps dynamically:', e);
  }
}

interface FlightTrackerModalProps {
  visible: boolean;
  onClose: () => void;
  airportCode: string;
  airportName: string;
  airportCenter: Coordinates;
  theme: AppTheme;
  isDark: boolean;
}

interface SimulatedPlane {
  id: string;
  flightNumber: string;
  route: string;
  movementType: 'arrival' | 'departure';
  statusLabel: string;
  latitude: number;
  longitude: number;
  heading: number;
  speedKnots: number;
  altitudeFeet: number;
  airlineCode: string;
  gate?: string;
  terminal?: string;
}

export const FlightTrackerModal: React.FC<FlightTrackerModalProps> = ({
  visible,
  onClose,
  airportCode,
  airportName,
  airportCenter,
  theme,
  isDark,
}) => {
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const [activeTab, setActiveTab] = useState<'arrival' | 'departure'>('arrival');
  const [searchQuery, setSearchQuery] = useState('');
  const [flights, setFlights] = useState<FlightBoardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [planes, setPlanes] = useState<SimulatedPlane[]>([]);
  const [selectedPlaneId, setSelectedPlaneId] = useState<string | null>(null);
  
  // Animation for radar sweep angle
  const radarSweepAnim = useRef(new Animated.Value(0)).current;

  // Recenter map tracker ref
  const nativeMapRef = useRef<any>(null);

  // Generate fallback realistic mock flights when API is offline or empty
  const mockFlights = useMemo(() => {
    const code = airportCode.toUpperCase();
    return [
      { id: 'mock-1', flightNumber: 'DAL1420', route: `ATL ➔ ${code}`, movementType: 'arrival', statusLabel: 'On Time', scheduledTime: '11:15 PM', gate: 'A10', terminal: 'A', urgency: 'normal', source: 'fallback' },
      { id: 'mock-2', flightNumber: 'UAL2323', route: `ORD ➔ ${code}`, movementType: 'arrival', statusLabel: 'On Time', scheduledTime: '11:35 PM', gate: 'B22', terminal: 'B', urgency: 'normal', source: 'fallback' },
      { id: 'mock-3', flightNumber: 'JBU524', route: `JFK ➔ ${code}`, movementType: 'arrival', statusLabel: 'Delayed', scheduledTime: '11:45 PM', gate: 'A4', terminal: 'A', urgency: 'watch', source: 'fallback' },
      { id: 'mock-4', flightNumber: 'FFT954', route: `PHX ➔ ${code}`, movementType: 'arrival', statusLabel: 'On Time', scheduledTime: '11:58 PM', gate: 'C2', terminal: 'C', urgency: 'normal', source: 'fallback' },
      { id: 'mock-5', flightNumber: 'SWA367', route: `${code} ➔ FLL`, movementType: 'departure', statusLabel: 'On Time', scheduledTime: '11:10 PM', gate: 'B12', terminal: 'B', urgency: 'normal', source: 'fallback' },
      { id: 'mock-6', flightNumber: 'AAL896', route: `${code} ➔ CLT`, movementType: 'departure', statusLabel: 'On Time', scheduledTime: '11:25 PM', gate: 'B8', terminal: 'B', urgency: 'normal', source: 'fallback' },
      { id: 'mock-7', flightNumber: 'AV119', route: `${code} ➔ BOG`, movementType: 'departure', statusLabel: 'Delayed', scheduledTime: '11:40 PM', gate: 'C24', terminal: 'C', urgency: 'watch', source: 'fallback' },
      { id: 'mock-8', flightNumber: 'UAL180', route: `${code} ➔ EWR`, movementType: 'departure', statusLabel: 'On Time', scheduledTime: '11:55 PM', gate: 'B20', terminal: 'B', urgency: 'normal', source: 'fallback' },
    ] as FlightBoardEntry[];
  }, [airportCode]);

  // Load flights from OpsIntelService or mock fallback
  useEffect(() => {
    if (!visible) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const snapshot = await OpsIntelService.getSnapshot(airportCode);
        if (snapshot && Array.isArray(snapshot.flightBoard) && snapshot.flightBoard.length > 0) {
          setFlights(snapshot.flightBoard);
        } else {
          setFlights(mockFlights);
        }
      } catch (err) {
        console.warn('Failed to fetch live flight board, using mock data:', err);
        setFlights(mockFlights);
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, [visible, airportCode, mockFlights]);

  // Initialize simulated planes when flights change
  useEffect(() => {
    if (flights.length === 0) {
      setPlanes([]);
      return;
    }

    const initialPlanes = flights.map((flight) => {
      const isArrival = flight.movementType === 'arrival';
      
      // Random angle (0 to 2*PI)
      const angle = Math.random() * Math.PI * 2;
      
      // Radius: arrivals start further out (10-18 miles), departures closer (2-5 miles)
      const radius = isArrival 
        ? 0.08 + Math.random() * 0.08 
        : 0.02 + Math.random() * 0.04;

      const lat = airportCenter.latitude + Math.cos(angle) * radius;
      const lng = airportCenter.longitude + Math.sin(angle) * radius;

      // Heading: arrivals face the airport, departures face away
      const bearing = Math.atan2(airportCenter.longitude - lng, airportCenter.latitude - lat);
      const headingDeg = (bearing * 180) / Math.PI;
      const finalHeading = isArrival ? (headingDeg + 360) % 360 : (headingDeg + 180 + 360) % 360;

      return {
        id: flight.id,
        flightNumber: flight.flightNumber,
        route: flight.route,
        movementType: flight.movementType as 'arrival' | 'departure',
        statusLabel: flight.statusLabel,
        latitude: lat,
        longitude: lng,
        heading: finalHeading,
        speedKnots: isArrival ? 160 + Math.floor(Math.random() * 60) : 220 + Math.floor(Math.random() * 80),
        altitudeFeet: isArrival ? 2000 + Math.floor(Math.random() * 3000) : 5000 + Math.floor(Math.random() * 12000),
        airlineCode: flight.flightNumber.substring(0, 3).toUpperCase(),
        gate: flight.gate,
        terminal: flight.terminal,
      };
    });

    setPlanes(initialPlanes);
  }, [flights, airportCenter]);

  // Update plane positions in real-time
  useEffect(() => {
    if (!visible || planes.length === 0) return;

    const interval = setInterval(() => {
      setPlanes((currentPlanes) =>
        currentPlanes.map((plane) => {
          const isArrival = plane.movementType === 'arrival';
          
          // Speed conversion: degree shift per tick (1.5 seconds)
          // 1 knot is approx 0.00016 degrees/hour.
          // Ticking every 1.5 seconds:
          const tickFactor = 1.5 / 3600;
          const speedDegrees = plane.speedKnots * 0.00016 * tickFactor;

          let lat = plane.latitude;
          let lng = plane.longitude;
          let heading = plane.heading;
          let altitude = plane.altitudeFeet;
          let speed = plane.speedKnots;

          if (isArrival) {
            // Move toward airport center
            const dy = airportCenter.latitude - lat;
            const dx = airportCenter.longitude - lng;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 0.008) {
              // Airplane landed! Reset it far away
              const angle = Math.random() * Math.PI * 2;
              lat = airportCenter.latitude + Math.cos(angle) * 0.16;
              lng = airportCenter.longitude + Math.sin(angle) * 0.16;
              altitude = 5000 + Math.floor(Math.random() * 2000);
              speed = 180 + Math.floor(Math.random() * 40);
              const bearing = Math.atan2(airportCenter.longitude - lng, airportCenter.latitude - lat);
              heading = ((bearing * 180) / Math.PI + 360) % 360;
            } else {
              // Continue flight
              const bearing = Math.atan2(dx, dy);
              lat += Math.cos(bearing) * speedDegrees * 1.8;
              lng += Math.sin(bearing) * speedDegrees * 1.8;
              heading = ((bearing * 180) / Math.PI + 360) % 360;
              // Decrease altitude slowly as it approaches
              if (altitude > 1000) altitude -= 50;
            }
          } else {
            // Move away from airport center
            const bearingRad = (heading * Math.PI) / 180;
            lat += Math.cos(bearingRad) * speedDegrees * 1.8;
            lng += Math.sin(bearingRad) * speedDegrees * 1.8;

            const dy = lat - airportCenter.latitude;
            const dx = lng - airportCenter.longitude;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 0.18) {
              // Exited airspace! Reset near airport
              const angle = Math.random() * Math.PI * 2;
              lat = airportCenter.latitude + Math.cos(angle) * 0.015;
              lng = airportCenter.longitude + Math.sin(angle) * 0.015;
              altitude = 1200;
              speed = 160;
              heading = ((angle * 180) / Math.PI + 180 + 360) % 360;
            } else {
              // Ascend flight
              if (altitude < 25000) altitude += 120;
              if (speed < 380) speed += 2;
            }
          }

          return {
            ...plane,
            latitude: lat,
            longitude: lng,
            heading,
            altitudeFeet: Math.round(altitude),
            speedKnots: Math.round(speed),
          };
        })
      );
    }, 1500);

    return () => clearInterval(interval);
  }, [visible, planes.length, airportCenter]);

  // Animate Radar sweep on Web
  useEffect(() => {
    if (Platform.OS === 'web' && visible) {
      Animated.loop(
        Animated.timing(radarSweepAnim, {
          toValue: 360,
          duration: 4000,
          useNativeDriver: false,
        })
      ).start();
    } else {
      radarSweepAnim.setValue(0);
    }
  }, [visible]);

  // Handle flight selection
  const handleSelectPlane = (planeId: string) => {
    setSelectedPlaneId(planeId);
    const plane = planes.find((p) => p.id === planeId);
    if (plane && Platform.OS !== 'web' && nativeMapRef.current) {
      nativeMapRef.current.animateToRegion(
        {
          latitude: plane.latitude,
          longitude: plane.longitude,
          latitudeDelta: 0.06,
          longitudeDelta: 0.06,
        },
        800
      );
    }
  };

  // Filter flights by active tab and search query
  const filteredFlights = useMemo(() => {
    return flights.filter((flight) => {
      const matchTab = flight.movementType === activeTab;
      const matchSearch =
        flight.flightNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        flight.route.toLowerCase().includes(searchQuery.toLowerCase());
      return matchTab && matchSearch;
    });
  }, [flights, activeTab, searchQuery]);

  const filteredPlanes = useMemo(() => {
    return planes.filter((plane) => {
      const matchTab = plane.movementType === activeTab;
      const matchSearch =
        plane.flightNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        plane.route.toLowerCase().includes(searchQuery.toLowerCase());
      return matchTab && matchSearch;
    });
  }, [planes, activeTab, searchQuery]);

  const selectedPlane = useMemo(() => {
    return planes.find((p) => p.id === selectedPlaneId);
  }, [planes, selectedPlaneId]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        {/* Header Bar */}
        <View style={styles.header}>
          <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={styles.headerContent}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveLabel}>LIVE RADAR</Text>
              </View>
              <Text style={styles.headerTitle} numberOfLines={1}>{airportCode} Airspace</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>{airportName}</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={22} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Map / Radar View */}
        <View style={styles.mapContainer}>
          {Platform.OS === 'web' ? (
            // Web radar dashboard view
            <View style={styles.radarScreen}>
              {/* Concentric distance circles */}
              <View style={[styles.radarCircle, { width: SCREEN_WIDTH * 0.9, height: SCREEN_WIDTH * 0.9, borderRadius: SCREEN_WIDTH * 0.45 }]}>
                <Text style={styles.radarLabel}>20 NM</Text>
              </View>
              <View style={[styles.radarCircle, { width: SCREEN_WIDTH * 0.65, height: SCREEN_WIDTH * 0.65, borderRadius: SCREEN_WIDTH * 0.325 }]}>
                <Text style={styles.radarLabel}>15 NM</Text>
              </View>
              <View style={[styles.radarCircle, { width: SCREEN_WIDTH * 0.4, height: SCREEN_WIDTH * 0.4, borderRadius: SCREEN_WIDTH * 0.2 }]}>
                <Text style={styles.radarLabel}>10 NM</Text>
              </View>

              {/* Crosshairs */}
              <View style={styles.radarCrosshairV} />
              <View style={styles.radarCrosshairH} />

              {/* Scanning sweep line */}
              <Animated.View
                style={[
                  styles.radarSweep,
                  {
                    transform: [
                      {
                        rotate: radarSweepAnim.interpolate({
                          inputRange: [0, 360],
                          outputRange: ['0deg', '360deg'],
                        }),
                      },
                    ],
                  },
                ]}
              />

              {/* Airport center marker */}
              <View style={styles.radarAirportCenter}>
                <Text style={styles.radarAirportText}>{airportCode}</Text>
              </View>

              {/* Moving airplanes */}
              {filteredPlanes.map((plane) => {
                // Map lat/long to relative X/Y coordinate on the radar grid
                const scale = (SCREEN_WIDTH * 0.45) / 0.16; // radius of 20NM maps to outer circle
                const dx = (plane.longitude - airportCenter.longitude) * scale;
                const dy = -(plane.latitude - airportCenter.latitude) * scale; // invert Y for screen space

                const isSelected = plane.id === selectedPlaneId;

                // Render airplane marker on radar screen
                return (
                  <TouchableOpacity
                    key={plane.id}
                    style={[
                      styles.radarPlane,
                      {
                        transform: [
                          { translateX: dx - 16 },
                          { translateY: dy - 16 },
                        ],
                      },
                    ]}
                    activeOpacity={0.8}
                    onPress={() => setSelectedPlaneId(plane.id)}
                  >
                    <View style={styles.radarPlaneBody}>
                      <Ionicons
                        name="airplane"
                        size={isSelected ? 18 : 14}
                        color={isSelected ? theme.colors.accent : '#00FF66'}
                        style={{ transform: [{ rotate: `${plane.heading}deg` }] }}
                      />
                      <Text style={[styles.radarPlaneText, isSelected && styles.radarPlaneTextSelected]}>
                        {plane.flightNumber}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            // Native Map View
            <MapView
              ref={nativeMapRef}
              style={StyleSheet.absoluteFillObject}
              provider={Platform.OS === 'android' ? 'google' : undefined}
              initialRegion={{
                latitude: airportCenter.latitude,
                longitude: airportCenter.longitude,
                latitudeDelta: 0.16,
                longitudeDelta: 0.16,
              }}
              customMapStyle={isDark ? darkMapStyle : []}
            >
              {/* Airport Core Location Dot */}
              <Marker coordinate={airportCenter}>
                <View style={styles.nativeAirportDot}>
                  <View style={styles.nativeAirportDotCore} />
                  <Text style={styles.nativeAirportDotText}>{airportCode}</Text>
                </View>
              </Marker>

              {/* Render Flight Paths */}
              {selectedPlane && (
                <Polyline
                  coordinates={[
                    { latitude: selectedPlane.latitude, longitude: selectedPlane.longitude },
                    airportCenter,
                  ]}
                  strokeColor={theme.colors.accent}
                  strokeWidth={2}
                  lineDashPattern={[6, 4]}
                />
              )}

              {/* Live Planes */}
              {filteredPlanes.map((plane) => {
                const isSelected = plane.id === selectedPlaneId;
                return (
                  <Marker
                    key={plane.id}
                    coordinate={{ latitude: plane.latitude, longitude: plane.longitude }}
                    anchor={{ x: 0.5, y: 0.5 }}
                    onPress={() => setSelectedPlaneId(plane.id)}
                  >
                    <View style={styles.nativePlaneMarker}>
                      <Ionicons
                        name="airplane"
                        size={isSelected ? 22 : 16}
                        color={isSelected ? theme.colors.accent : '#00FF66'}
                        style={{
                          transform: [{ rotate: `${plane.heading}deg` }],
                          shadowColor: isSelected ? theme.colors.accent : '#00FF66',
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.8,
                          shadowRadius: 5,
                        }}
                      />
                      <View style={[styles.nativePlaneTag, isSelected && styles.nativePlaneTagActive]}>
                        <Text style={styles.nativePlaneTagText}>{plane.flightNumber}</Text>
                        <Text style={styles.nativePlaneTagSub}>
                          {Math.round(plane.altitudeFeet / 100)}FL{plane.gate ? ` · G:${plane.gate}` : ''}
                        </Text>
                      </View>
                    </View>
                  </Marker>
                );
              })}
            </MapView>
          )}

          {/* Quick detail overlay for selected plane */}
          {selectedPlane && (
            <View style={styles.planeDetailOverlay}>
              <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
              <View style={styles.planeDetailContent}>
                <View style={styles.planeDetailHeader}>
                  <View style={styles.planeDetailTitleBlock}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                      <Text style={styles.planeDetailNumber}>{selectedPlane.flightNumber}</Text>
                      <Text style={styles.planeDetailAirline}>{getAirlineName(selectedPlane.flightNumber)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <Text style={styles.planeDetailRoute}>{selectedPlane.route}</Text>
                      {selectedPlane.gate && (
                        <>
                          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>•</Text>
                          <Text style={styles.planeDetailGate}>
                            {selectedPlane.terminal ? `T${selectedPlane.terminal} · ` : ''}Gate {selectedPlane.gate}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.planeDetailClose}
                    onPress={() => setSelectedPlaneId(null)}
                  >
                    <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>
                <View style={styles.planeDetailStatsRow}>
                  <View style={styles.planeStatBox}>
                    <Ionicons name="speedometer-outline" size={14} color={theme.colors.accent} />
                    <Text style={styles.planeStatVal}>{selectedPlane.speedKnots} kt</Text>
                    <Text style={styles.planeStatLbl}>Ground Speed</Text>
                  </View>
                  <View style={styles.planeStatBox}>
                    <Ionicons name="trending-up-outline" size={14} color={theme.colors.accent} />
                    <Text style={styles.planeStatVal}>{selectedPlane.altitudeFeet.toLocaleString()} ft</Text>
                    <Text style={styles.planeStatLbl}>Altitude</Text>
                  </View>
                  <View style={styles.planeStatBox}>
                    <Ionicons name="compass-outline" size={14} color={theme.colors.accent} />
                    <Text style={styles.planeStatVal}>{Math.round(selectedPlane.heading)}°</Text>
                    <Text style={styles.planeStatLbl}>Heading</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Bottom Sheet List of Flights */}
        <View style={styles.listContainer}>
          <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />

          {/* Tab Selector */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'arrival' && styles.tabButtonActive]}
              onPress={() => setActiveTab('arrival')}
            >
              <Ionicons
                name="arrow-down-circle-outline"
                size={16}
                color={activeTab === 'arrival' ? theme.colors.background : theme.colors.text}
              />
              <Text style={[styles.tabText, activeTab === 'arrival' && styles.tabTextActive]}>Arrivals</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'departure' && styles.tabButtonActive]}
              onPress={() => setActiveTab('departure')}
            >
              <Ionicons
                name="arrow-up-circle-outline"
                size={16}
                color={activeTab === 'departure' ? theme.colors.background : theme.colors.text}
              />
              <Text style={[styles.tabText, activeTab === 'departure' && styles.tabTextActive]}>Departures</Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBarBox}>
            <Ionicons name="search" size={16} color={theme.colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search flight number or city..."
              placeholderTextColor={theme.colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close" size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Flight List */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.accent} />
              <Text style={styles.loadingText}>Fetching live airport schedule...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredFlights}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const isSelected = item.id === selectedPlaneId;
                const statusColor =
                  item.statusLabel.toLowerCase().includes('delayed') ||
                  item.statusLabel.toLowerCase().includes('cancel')
                    ? theme.colors.error
                    : theme.colors.success;

                return (
                  <TouchableOpacity
                    style={[styles.flightRow, isSelected && styles.flightRowSelected]}
                    activeOpacity={0.7}
                    onPress={() => handleSelectPlane(item.id)}
                  >
                    <View style={styles.flightMainInfo}>
                      <View style={styles.flightLogoContainer}>
                        <Ionicons
                          name="airplane-outline"
                          size={16}
                          color={isSelected ? theme.colors.background : theme.colors.text}
                        />
                      </View>
                      <View style={styles.flightIdBlock}>
                        <Text style={[styles.flightNumberText, isSelected && { color: theme.colors.background }]}>
                          {item.flightNumber}
                        </Text>
                        <Text style={[styles.flightRouteText, isSelected && { color: 'rgba(255,255,255,0.7)' }]}>
                          {item.route}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.flightStatusBlock}>
                      <Text style={[styles.flightTimeText, isSelected && { color: theme.colors.background }]}>
                        {item.scheduledTime}
                      </Text>
                      <View style={styles.flightStatusTag}>
                        <View style={[styles.statusDot, { backgroundColor: isSelected ? '#FFFFFF' : statusColor }]} />
                        <Text style={[styles.flightStatusText, { color: isSelected ? '#FFFFFF' : statusColor }]}>
                          {item.statusLabel}
                        </Text>
                      </View>
                      {item.gate && (
                        <Text style={[styles.flightGateText, isSelected && { color: 'rgba(255,255,255,0.8)' }]}>
                          {item.terminal ? `T${item.terminal} · ` : ''}Gate {item.gate}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="airplane-outline" size={32} color={theme.colors.textMuted} />
                  <Text style={styles.emptyText}>No flights found matching criteria</Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: AppTheme, isDark: boolean) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      paddingTop: Platform.OS === 'ios' ? 44 : 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      overflow: 'hidden',
    },
    headerContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingVertical: 12,
    },
    headerTitleWrap: {
      flex: 1,
    },
    liveIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginBottom: 2,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#FF3B30',
    },
    liveLabel: {
      color: '#FF3B30',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1,
    },
    headerTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '900',
    },
    headerSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 12,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mapContainer: {
      flex: 1.1,
      backgroundColor: isDark ? '#0A0A0C' : '#F2F2F7',
    },
    planeDetailOverlay: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 108 : 84,
      left: 18,
      right: 18,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
      zIndex: 200,
    },
    planeDetailContent: {
      padding: 16,
    },
    planeDetailHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      paddingBottom: 10,
      marginBottom: 10,
    },
    planeDetailTitleBlock: {
      flex: 1,
    },
    planeDetailNumber: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '900',
    },
    planeDetailRoute: {
      color: theme.colors.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    planeDetailClose: {
      padding: 4,
    },
    planeDetailStatsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    planeStatBox: {
      flex: 1,
      alignItems: 'center',
      gap: 3,
    },
    planeStatVal: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '800',
      marginTop: 2,
    },
    planeStatLbl: {
      color: theme.colors.textMuted,
      fontSize: 9,
      fontWeight: '500',
    },
    listContainer: {
      flex: 1.0,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      overflow: 'hidden',
    },
    tabBar: {
      flexDirection: 'row',
      paddingHorizontal: 18,
      paddingVertical: 12,
      gap: 10,
    },
    tabButton: {
      flex: 1,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    tabButtonActive: {
      backgroundColor: theme.colors.primary,
    },
    tabText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '800',
    },
    tabTextActive: {
      color: theme.colors.background,
    },
    searchBarBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
      marginHorizontal: 18,
      marginBottom: 10,
      paddingHorizontal: 12,
      height: 38,
      borderRadius: 10,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    loadingText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    listContent: {
      paddingHorizontal: 18,
      paddingBottom: 24,
    },
    flightRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    flightRowSelected: {
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      paddingHorizontal: 12,
      borderBottomWidth: 0,
      marginVertical: 2,
    },
    flightMainInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    flightLogoContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    flightIdBlock: {
      flex: 1,
    },
    flightNumberText: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '900',
    },
    flightRouteText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    flightStatusBlock: {
      alignItems: 'flex-end',
    },
    flightTimeText: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    flightStatusTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 2,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    flightStatusText: {
      fontSize: 11,
      fontWeight: '800',
    },
    flightGateText: {
      color: theme.colors.textMuted,
      fontSize: 10,
      marginTop: 2,
      fontWeight: '600',
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
      gap: 10,
    },
    emptyText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    radarScreen: {
      flex: 1,
      position: 'relative',
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#050E09', // Deep dark radar green
    },
    radarCircle: {
      position: 'absolute',
      borderWidth: 1,
      borderColor: 'rgba(0, 255, 102, 0.15)',
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingTop: 8,
    },
    radarLabel: {
      color: 'rgba(0, 255, 102, 0.4)',
      fontSize: 9,
      fontWeight: '800',
    },
    radarCrosshairV: {
      position: 'absolute',
      width: 1,
      height: '100%',
      backgroundColor: 'rgba(0, 255, 102, 0.12)',
    },
    radarCrosshairH: {
      position: 'absolute',
      height: 1,
      width: '100%',
      backgroundColor: 'rgba(0, 255, 102, 0.12)',
    },
    radarSweep: {
      position: 'absolute',
      width: SCREEN_WIDTH * 0.9,
      height: SCREEN_WIDTH * 0.9,
      borderRadius: SCREEN_WIDTH * 0.45,
      borderLeftWidth: 1.5,
      borderLeftColor: 'rgba(0, 255, 102, 0.6)',
      backgroundColor: 'transparent',
    },
    radarAirportCenter: {
      position: 'absolute',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      backgroundColor: 'rgba(0, 255, 102, 0.25)',
      borderWidth: 1,
      borderColor: '#00FF66',
      zIndex: 10,
    },
    radarAirportText: {
      color: '#00FF66',
      fontSize: 10,
      fontWeight: '900',
    },
    radarPlane: {
      position: 'absolute',
      width: 32,
      height: 32,
      zIndex: 5,
    },
    radarPlaneBody: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    radarPlaneText: {
      color: '#00FF66',
      fontSize: 8,
      fontWeight: '700',
      marginTop: 2,
      backgroundColor: 'rgba(5, 14, 9, 0.8)',
      paddingHorizontal: 3,
      paddingVertical: 1,
      borderRadius: 2,
      overflow: 'hidden',
    },
    radarPlaneTextSelected: {
      color: '#00E5FF',
      fontWeight: '900',
      backgroundColor: 'rgba(0, 229, 255, 0.15)',
    },
    nativeAirportDot: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 229, 255, 0.2)',
      borderWidth: 1.5,
      borderColor: '#00E5FF',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    nativeAirportDotCore: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#00E5FF',
      marginBottom: 2,
    },
    nativeAirportDotText: {
      color: '#00E5FF',
      fontSize: 10,
      fontWeight: '900',
    },
    nativePlaneMarker: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    nativePlaneTag: {
      backgroundColor: 'rgba(10, 10, 12, 0.85)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.15)',
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 2,
      marginTop: 2,
      alignItems: 'center',
    },
    nativePlaneTagActive: {
      borderColor: theme.colors.accent,
      backgroundColor: 'rgba(0, 229, 255, 0.2)',
    },
    nativePlaneTagText: {
      color: '#00FF66',
      fontSize: 8,
      fontWeight: '800',
    },
    nativePlaneTagSub: {
      color: '#FFFFFF',
      fontSize: 7,
      fontWeight: '600',
      opacity: 0.8,
    },
    planeDetailAirline: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: '700',
    },
    planeDetailGate: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '800',
    },
  });

const darkMapStyle = [
  {
    elementType: 'geometry',
    stylers: [{ color: '#1b1b1d' }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#1b1b1d' }],
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#747476' }],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#aeaeae' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#8e8e93' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#152219' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#2c2c2e' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1c1c1e' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#8e8e93' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#3a3a3c' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#2c2c2e' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0d1b2a' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#3a4f66' }],
  },
];
