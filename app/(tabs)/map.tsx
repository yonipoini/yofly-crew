import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Keyboard, PanResponder, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Alert as RNAlert, Linking, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useFocusEffect, useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTheme, useTheme } from '../../src/theme/theme';
import { useProfile } from '../../src/context/ProfileContext';
import { useAuth } from '../../src/context/AuthContext';
import { CrewLockBanner } from '../../src/components/CrewLockBanner';
import { CrewMap } from '../../src/components/CrewMap';
import { Coordinates, CrewLocation, CrewSavedRoute, LocationType } from '../../src/types/locations';
import { LocationService } from '../../src/services/LocationService';
import { DeviceCoordinates, DeviceLocationService } from '../../src/services/DeviceLocationService';
import { getActiveOpsAirportCode, getAirportCoordinates, getAirportDisplayName } from '../../src/utils/airportContext';
import { AirportOption, AirportSearchService } from '../../src/services/AirportSearchService';
import { SavedLocationsService } from '../../src/services/SavedLocationsService';
import { AppSyncService } from '../../src/services/AppSyncService';
import { SavedRoutesService } from '../../src/services/SavedRoutesService';
import { MapPlaceIntelService } from '../../src/services/MapPlaceIntelService';
import { PlaceCrewInfoModal } from '../../src/components/PlaceCrewInfoModal';
import { AddPlaceModal } from '../../src/components/AddPlaceModal';
import { getLocationTypeLabel } from '../../src/utils/mapLocationPresentation';
import { DirectoryEntry, MapDirectorySheet } from '../../src/components/MapDirectorySheet';
import { AlertService } from '../../src/services/AlertService';
import { Alert } from '../../src/types/alerts';
import { PostAlertModal } from '../../src/components/PostAlertModal';
import mcoRealPlaces from '../../src/services/mcoRealPlaces.json';
import { FlightTrackerModal } from '../../src/components/FlightTrackerModal';
import { matchLocationQuery } from '../../src/utils/searchMatcher';

const { width, height } = Dimensions.get('window');
const HUB_DELTA = {
  latitudeDelta: 0.016,
  longitudeDelta: 0.016,
};
const DIRECTORY_DELTA = {
  latitudeDelta: 0.016,
  longitudeDelta: 0.016,
};
const DETAIL_DELTA = {
  latitudeDelta: 0.005,
  longitudeDelta: 0.005,
};
const USER_DELTA = {
  latitudeDelta: 0.016,
  longitudeDelta: 0.016,
};
const NAVIGATION_DELTA = {
  latitudeDelta: 0.0018,
  longitudeDelta: 0.0018,
};

const DEFAULT_CENTER = {
  latitude: 40.6413,
  longitude: -73.7781,
};

const normalizeAirportCode = (value?: string) => (value || '').trim().toUpperCase();

const matchLevel = (levelStr: string, filter: '1' | '2' | '3' | 'B'): boolean => {
  const norm = levelStr.toLowerCase();
  if (filter === '3') {
    return norm.includes('3') || norm.includes('departures') || norm.includes('ticketing') || norm.includes('lobby') || norm.includes('level 3');
  }
  if (filter === '2') {
    return norm.includes('2') || norm.includes('arrivals') || norm.includes('baggage') || norm.includes('level 2');
  }
  if (filter === '1') {
    return norm.includes('1') || norm.includes('ground') || norm.includes('curb') || norm.includes('shuttle') || norm.includes('transit') || norm.includes('level 1');
  }
  if (filter === 'B') {
    return norm.includes('b') || norm.includes('tunnel') || norm.includes('train') || norm.includes('basement') || norm.includes('lower') || norm.includes('level b');
  }
  return false;
};

interface TerminalOption {
  label: string;
  zone: string;
  level: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

const MCO_SELECTOR_OPTIONS: { section: string; options: TerminalOption[] }[] = [
  {
    section: 'TERMINAL - A & B',
    options: [
      { label: 'A & B - Tunnel / Lower Level', zone: 'MAIN_AB', level: 'TUNNEL', icon: 'trail-sign-outline' },
      { label: 'A & B - Level 1 - Rental Cars / Transportation', zone: 'MAIN_AB', level: '1', icon: 'bus-outline' },
      { label: 'A & B - Level 2 - Arrivals / Baggage Claim', zone: 'MAIN_AB', level: '2', icon: 'briefcase-outline' },
      { label: 'A & B - Level 3 - Departing / Shops / Dining', zone: 'MAIN_AB', level: '3', icon: 'restaurant-outline' },
      { label: 'A & B - Level 4 - Hyatt / McCoy\'s', zone: 'MAIN_AB', level: '4', icon: 'business-outline' },
      { label: 'Gates 1-29 (Airside 1)', zone: 'AS1', level: 'AS_GATES', icon: 'airplane-outline' },
      { label: 'Gates 30-59 (Airside 3)', zone: 'AS3', level: 'AS_GATES', icon: 'airplane-outline' },
      { label: 'Gates 70-99 (Airside 4)', zone: 'AS4', level: 'AS_GATES', icon: 'airplane-outline' },
      { label: 'Gates 100-129 (Airside 2)', zone: 'AS2', level: 'AS_GATES', icon: 'airplane-outline' },
    ],
  },
  {
    section: 'TERMINAL - C',
    options: [
      { label: 'C - Level 1 - Ground Transportation', zone: 'MAIN_C', level: '1', icon: 'bus-outline' },
      { label: 'C - Level 2 - Departing / Dining / Gates 230-245', zone: 'MAIN_C', level: '2', icon: 'restaurant-outline' },
    ],
  },
  {
    section: 'TRAIN STATION',
    options: [
      { label: 'Train Station - Ground / Transit', zone: 'TRAIN', level: '1', icon: 'train-outline' },
      { label: 'Train Station - Train Platform', zone: 'TRAIN', level: 'TRAIN_PLATFORM', icon: 'subway-outline' },
    ],
  },
];

const JFK_SELECTOR_OPTIONS: { section: string; options: TerminalOption[] }[] = [
  {
    section: 'TERMINAL 1',
    options: [
      { label: 'Terminal 1 - Level 1 - Arrivals', zone: 'T1', level: '1', icon: 'briefcase-outline' },
      { label: 'Terminal 1 - Level 2 - Gates', zone: 'T1', level: '2', icon: 'airplane-outline' },
      { label: 'Terminal 1 - Level 3 - Departures', zone: 'T1', level: '3', icon: 'restaurant-outline' },
    ],
  },
  {
    section: 'TERMINAL 4',
    options: [
      { label: 'Terminal 4 - Level 1 - Arrivals', zone: 'T4', level: '1', icon: 'briefcase-outline' },
      { label: 'Terminal 4 - Level 2 - Gates', zone: 'T4', level: '2', icon: 'airplane-outline' },
      { label: 'Terminal 4 - Level 3 - Departures', zone: 'T4', level: '3', icon: 'restaurant-outline' },
      { label: 'Terminal 4 - Level 4 - Retail/Ticketing', zone: 'T4', level: '4', icon: 'cart-outline' },
    ],
  },
  {
    section: 'TERMINAL 5',
    options: [
      { label: 'Terminal 5 - Level 1 - Arrivals', zone: 'T5', level: '1', icon: 'briefcase-outline' },
      { label: 'Terminal 5 - Level 2 - Security/Gates', zone: 'T5', level: '2', icon: 'airplane-outline' },
      { label: 'Terminal 5 - Level 3 - Departures', zone: 'T5', level: '3', icon: 'restaurant-outline' },
    ],
  },
  {
    section: 'TERMINAL 7',
    options: [
      { label: 'Terminal 7 - Level 1 - Arrivals', zone: 'T7', level: '1', icon: 'briefcase-outline' },
      { label: 'Terminal 7 - Level 2 - Gates', zone: 'T7', level: '2', icon: 'airplane-outline' },
      { label: 'Terminal 7 - Level 3 - Departures/Check-in', zone: 'T7', level: '3', icon: 'restaurant-outline' },
    ],
  },
  {
    section: 'TERMINAL 8',
    options: [
      { label: 'Terminal 8 - Level 1 - Arrivals', zone: 'T8', level: '1', icon: 'briefcase-outline' },
      { label: 'Terminal 8 - Level 2 - Gates/Security', zone: 'T8', level: '2', icon: 'airplane-outline' },
      { label: 'Terminal 8 - Level 3 - Departures', zone: 'T8', level: '3', icon: 'restaurant-outline' },
    ],
  },
  {
    section: 'TWA HOTEL',
    options: [
      { label: 'TWA Hotel - Ground Level', zone: 'TWA', level: '1', icon: 'business-outline' },
      { label: 'TWA Hotel - Level 2 - Lobby / Bars', zone: 'TWA', level: '2', icon: 'wine-outline' },
    ],
  },
  {
    section: 'FEDERAL CIRCLE',
    options: [
      { label: 'Federal Circle - Level 1 - Rental Cars / Transit', zone: 'FED_CIRCLE', level: '1', icon: 'car-outline' },
      { label: 'Federal Circle - Level 2 - AirTrain Platform', zone: 'FED_CIRCLE', level: '2', icon: 'train-outline' },
    ],
  },
];

const matchLocationToMcoLayout = (
  location: CrewLocation,
  zone: string,
  level: string
): boolean => {
  if (zone === 'ALL' && level === 'ALL') {
    return true;
  }

  let normalizedLevel = level;
  if (level === 'B') {
    if (zone === 'MAIN_AB') normalizedLevel = 'TUNNEL';
    else if (zone === 'TRAIN') normalizedLevel = 'TRAIN_PLATFORM';
    else if (zone.startsWith('AS')) normalizedLevel = 'AS_GATES';
  }

  // 1. Match Terminal/Zone
  let zoneMatch = true;
  if (zone !== 'ALL') {
    const locZone = (location.zone || '').toLowerCase();
    const locName = (location.name || '').toLowerCase();
    const locShort = (location.shortLabel || '').toLowerCase();
    const locAddress = (location.address || '').toLowerCase();
    
    if (zone === 'MAIN_AB') {
      zoneMatch = locZone.includes('a/b') || locZone.includes('main terminal') || locName.includes('main terminal') || locShort.includes('main') || (!locZone && !locShort && locAddress.includes('main terminal'));
      // exclude airsides/gates from main terminal A/B
      if (locZone.includes('airside') || locZone.includes('gates') || locShort.includes('airside') || locShort.includes('gate') || locName.includes('gate') || locName.includes('airside')) {
        zoneMatch = false;
      }
    } else if (zone === 'AS1') {
      zoneMatch = locZone.includes('airside 1') || locShort.includes('airside 1') || locShort.includes('gates 1-29') || locName.includes('airside 1') || locName.includes('gates 1-29') || (location.coordinate.latitude > 28.433 && location.coordinate.longitude < -81.309);
    } else if (zone === 'AS3') {
      zoneMatch = locZone.includes('airside 3') || locShort.includes('airside 3') || locShort.includes('gates 30-59') || locName.includes('airside 3') || locName.includes('gates 30-59') || (location.coordinate.latitude > 28.433 && location.coordinate.longitude > -81.307);
    } else if (zone === 'AS4') {
      zoneMatch = locZone.includes('airside 4') || locShort.includes('airside 4') || locShort.includes('gates 70-99') || locName.includes('airside 4') || locName.includes('gates 70-99') || (location.coordinate.latitude < 28.428 && location.coordinate.longitude > -81.307);
    } else if (zone === 'AS2') {
      zoneMatch = locZone.includes('airside 2') || locShort.includes('airside 2') || locShort.includes('gates 100-129') || locName.includes('airside 2') || locName.includes('gates 100-129') || (location.coordinate.latitude < 28.428 && location.coordinate.longitude < -81.309);
    } else if (zone === 'MAIN_C') {
      zoneMatch = locZone.includes('terminal c') || locName.includes('terminal c') || locShort.includes('terminal c') || locAddress.includes('terminal c');
    } else if (zone === 'TRAIN') {
      zoneMatch = locZone.includes('train') || locZone.includes('transit') || locName.includes('train') || locName.includes('station') || locShort.includes('train');
    }
  }

  if (!zoneMatch) return false;

  // 2. Match Floor Level
  let levelMatch = true;
  if (normalizedLevel !== 'ALL') {
    const locLevel = (location.level || '').toLowerCase();
    const locName = (location.name || '').toLowerCase();
    
    if (normalizedLevel === '1') {
      levelMatch = locLevel.includes('1') || locLevel.includes('ground') || locLevel.includes('curb') || locLevel.includes('transport');
    } else if (normalizedLevel === '2') {
      levelMatch = locLevel.includes('2') || locLevel.includes('arrival') || locLevel.includes('baggage');
    } else if (normalizedLevel === '3') {
      levelMatch = locLevel.includes('3') || locLevel.includes('depart') || locLevel.includes('ticket') || locLevel.includes('lobby') || locLevel.includes('food court');
    } else if (normalizedLevel === '4') {
      levelMatch = locLevel.includes('4') || locLevel.includes('parking') || locName.includes('hyatt') || locName.includes("mccoy");
    } else if (normalizedLevel === 'TUNNEL') {
      levelMatch = locLevel.includes('tunnel') || locLevel.includes('b') || locLevel.includes('basement');
    } else if (normalizedLevel === 'TRAIN_PLATFORM') {
      levelMatch = locLevel.includes('platform') || locLevel.includes('train') || locLevel.includes('level 2') || locLevel.includes('2');
    } else if (normalizedLevel === 'AS_GATES') {
      levelMatch = locLevel.includes('gate') || locLevel.includes('post-security') || locLevel.includes('concourse');
    }
  }

  return levelMatch;
};

const matchLocationToJfkLayout = (
  location: CrewLocation,
  zone: string,
  level: string
): boolean => {
  if (zone === 'ALL' && level === 'ALL') {
    return true;
  }

  // 1. Match Terminal/Zone
  let zoneMatch = true;
  if (zone !== 'ALL') {
    const locZone = (location.zone || '').toLowerCase();
    const locName = (location.name || '').toLowerCase();
    const locShort = (location.shortLabel || '').toLowerCase();
    const locAddress = (location.address || '').toLowerCase();

    if (zone === 'T1') {
      zoneMatch = locZone.includes('t1') || locZone.includes('terminal 1') || locName.includes('terminal 1') || locShort.includes('t1') || locAddress.includes('terminal 1') || locAddress.includes('t1');
    } else if (zone === 'T4') {
      zoneMatch = locZone.includes('t4') || locZone.includes('terminal 4') || locName.includes('terminal 4') || locShort.includes('t4') || locAddress.includes('terminal 4') || locAddress.includes('t4');
    } else if (zone === 'T5') {
      zoneMatch = locZone.includes('t5') || locZone.includes('terminal 5') || locName.includes('terminal 5') || locShort.includes('t5') || locAddress.includes('terminal 5') || locAddress.includes('t5');
    } else if (zone === 'T7') {
      zoneMatch = locZone.includes('t7') || locZone.includes('terminal 7') || locName.includes('terminal 7') || locShort.includes('t7') || locAddress.includes('terminal 7') || locAddress.includes('t7');
    } else if (zone === 'T8') {
      zoneMatch = locZone.includes('t8') || locZone.includes('terminal 8') || locName.includes('terminal 8') || locShort.includes('t8') || locAddress.includes('terminal 8') || locAddress.includes('t8');
    } else if (zone === 'TWA') {
      zoneMatch = locZone.includes('twa') || locName.includes('twa hotel') || locShort.includes('twa') || locAddress.includes('twa');
    } else if (zone === 'FED_CIRCLE') {
      zoneMatch = locZone.includes('federal circle') || locZone.includes('fed circle') || locName.includes('federal circle') || locShort.includes('federal circle') || locAddress.includes('federal circle') || locName.includes('alamo') || locName.includes('hertz') || locName.includes('enterprise') || locName.includes('national car') || locName.includes('budget') || locName.includes('avis') || locName.includes('sixt') || locName.includes('dollar');
    }
  }

  if (!zoneMatch) return false;

  // 2. Match Floor Level
  let levelMatch = true;
  if (level !== 'ALL') {
    const locLevel = (location.level || '').toLowerCase();
    const locName = (location.name || '').toLowerCase();

    if (level === '1') {
      levelMatch = locLevel.includes('1') || locLevel.includes('ground') || locLevel.includes('arrival') || locLevel.includes('baggage') || locLevel.includes('curb') || locLevel.includes('transport') || locLevel.includes('level 1');
    } else if (level === '2') {
      levelMatch = locLevel.includes('2') || locLevel.includes('gate') || locLevel.includes('concourse') || locLevel.includes('security') || locLevel.includes('level 2');
    } else if (level === '3') {
      levelMatch = locLevel.includes('3') || locLevel.includes('depart') || locLevel.includes('ticket') || locLevel.includes('lobby') || locLevel.includes('food court') || locLevel.includes('level 3');
    } else if (level === '4') {
      levelMatch = locLevel.includes('4') || locLevel.includes('retail') || locLevel.includes('parking') || locLevel.includes('level 4') || locName.includes('lounge');
    }
  }

  return levelMatch;
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const getDistanceMiles = (left: Coordinates, right: Coordinates) => {
  const earthRadiusMiles = 3958.8;
  const deltaLat = toRadians(right.latitude - left.latitude);
  const deltaLon = toRadians(right.longitude - left.longitude);
  const startLat = toRadians(left.latitude);
  const endLat = toRadians(right.latitude);

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLon / 2) ** 2;

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

type MapDelta = {
  latitudeDelta: number;
  longitudeDelta: number;
};

type UtilityMode = 'ALL' | 'SAVED' | 'LAYOVER' | 'ROUTE';
type CuratedLayer = 'ALL' | 'COFFEE' | 'SAFE' | 'PHARMACY' | 'STOCKUP';
type MapDisplayMode = 'AIRPORT' | 'RADIUS';
type DirectoryCategory =
  | 'ALL'
  | 'SECURITY'
  | 'GATES'
  | 'FOOD'
  | 'COFFEE'
  | 'LOUNGES'
  | 'BAGGAGE'
  | 'TRANSPORT'
  | 'HOTELS'
  | 'SHOPS'
  | 'SERVICES';

const CATEGORY_FILTER_ITEMS: { id: DirectoryCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'ALL', label: 'All', icon: 'map-outline' },
  { id: 'SECURITY', label: 'Security & KCM', icon: 'shield-checkmark-outline' },
  { id: 'COFFEE', label: 'Coffee Resets', icon: 'cafe-outline' },
  { id: 'FOOD', label: 'Food & Dining', icon: 'restaurant-outline' },
  { id: 'TRANSPORT', label: 'Transit & Shuttles', icon: 'bus-outline' },
  { id: 'LOUNGES', label: 'Crew Lounges', icon: 'bed-outline' },
  { id: 'SHOPS', label: 'Shops & Retail', icon: 'cart-outline' },
  { id: 'SERVICES', label: 'Services', icon: 'cash-outline' },
];


const RADIUS_DELTA = {
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const UTILITY_OPTIONS: Array<{
  id: UtilityMode;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { id: 'ALL', label: 'All Spots', icon: 'grid-outline' },
  { id: 'SAVED', label: 'Saved', icon: 'bookmark-outline' },
  { id: 'LAYOVER', label: 'Layover Picks', icon: 'sparkles-outline' },
  { id: 'ROUTE', label: 'Safe Routes', icon: 'trail-sign-outline' },
];

const CURATED_LAYER_OPTIONS: Array<{ id: CuratedLayer; label: string }> = [
  { id: 'ALL', label: 'All utility' },
  { id: 'COFFEE', label: 'Best coffee' },
  { id: 'SAFE', label: 'Safe pickup' },
  { id: 'PHARMACY', label: 'Late-night pharmacy' },
  { id: 'STOCKUP', label: 'Stock-up' },
];

const DISPLAY_MODE_OPTIONS: Array<{
  id: MapDisplayMode;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { id: 'AIRPORT', label: 'Airport Core', icon: 'business-outline' },
  { id: 'RADIUS', label: 'Nearby Radius', icon: 'radio-outline' },
];

const CATEGORY_OPTIONS: Array<{
  type: LocationType | 'ALL';
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}> = [
  { type: 'ALL', icon: 'grid-outline', label: 'All' },
  { type: LocationType.RESTAURANT, icon: 'restaurant-outline', label: 'Dining' },
  { type: LocationType.COFFEE, icon: 'cafe-outline', label: 'Coffee' },
  { type: LocationType.GYM, icon: 'fitness-outline', label: 'Gyms' },
  { type: LocationType.SAFE_AREA, icon: 'shield-outline', label: 'Safe' },
  { type: LocationType.GROCERY, icon: 'cart-outline', label: 'Grocery' },
  { type: LocationType.PHARMACY, icon: 'medkit-outline', label: 'Pharmacy' },
  { type: LocationType.LOUNGE, icon: 'bed-outline', label: 'Rest' },
  { type: LocationType.NIGHTLIFE, icon: 'beer-outline', label: 'Bars' },
  { type: LocationType.SHOPPING, icon: 'cart-outline', label: 'Shops' },
  { type: LocationType.SERVICE, icon: 'cash-outline', label: 'Services' },
];

const DIRECTORY_CATEGORIES: Array<{
  id: DirectoryCategory;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { id: 'ALL', label: 'Explore All', icon: 'grid-outline' },
  { id: 'SECURITY', label: 'Security', icon: 'scan-outline' },
  { id: 'GATES', label: 'Gates', icon: 'trail-sign-outline' },
  { id: 'FOOD', label: 'Food', icon: 'restaurant-outline' },
  { id: 'COFFEE', label: 'Coffee', icon: 'cafe-outline' },
  { id: 'LOUNGES', label: 'Lounges', icon: 'bed-outline' },
  { id: 'BAGGAGE', label: 'Baggage', icon: 'briefcase-outline' },
  { id: 'TRANSPORT', label: 'Transport', icon: 'bus-outline' },
  { id: 'HOTELS', label: 'Hotels', icon: 'business-outline' },
  { id: 'SHOPS', label: 'Shops', icon: 'cart-outline' },
  { id: 'SERVICES', label: 'Services', icon: 'cash-outline' },
];

const DIRECTORY_BUSINESS_CATEGORIES: DirectoryCategory[] = ['FOOD', 'COFFEE', 'LOUNGES', 'HOTELS', 'SHOPS', 'SERVICES'];

const AIRPORT_DIRECTORY_HINTS: Record<string, Partial<Record<DirectoryCategory, DirectoryEntry[]>>> = {
  JFK: {
    SECURITY: [
      {
        id: 'jfk-security-t4',
        title: 'Terminal 4 Main Checkpoint',
        subtitle: 'International terminal security flow and KCM-adjacent crew timing',
        meta: 'T4',
        icon: 'scan-outline',
        level: 'Departures',
        zone: 'T4',
        sourceLabel: 'Curated',
        location: {
          id: 'jfk-security-t4',
          airportCode: 'JFK',
          name: 'Terminal 4 Main Checkpoint',
          type: LocationType.SAFE_AREA,
          coordinate: { latitude: 40.6420, longitude: -73.7770 },
          address: 'JFK Terminal 4 Departures',
          level: 'Departures',
          zone: 'T4',
          source: 'airport',
          airportCore: true,
          airportCoreKind: 'SECURITY'
        }
      },
      {
        id: 'jfk-security-t5',
        title: 'Terminal 5 Checkpoint',
        subtitle: 'JetBlue terminal security flow and crew report area',
        meta: 'T5',
        icon: 'scan-outline',
        level: 'Departures',
        zone: 'T5',
        sourceLabel: 'Curated',
        location: {
          id: 'jfk-security-t5',
          airportCode: 'JFK',
          name: 'Terminal 5 Checkpoint',
          type: LocationType.SAFE_AREA,
          coordinate: { latitude: 40.6468, longitude: -73.7777 },
          address: 'JFK Terminal 5 Departures',
          level: 'Departures',
          zone: 'T5',
          source: 'airport',
          airportCore: true,
          airportCoreKind: 'SECURITY'
        }
      },
    ],
    GATES: [
      {
        id: 'jfk-gates-t4-a',
        title: 'Terminal 4 A Gates',
        subtitle: 'International departures and arrivals flow',
        meta: 'A gates',
        icon: 'trail-sign-outline',
        level: 'Post-security',
        zone: 'T4',
        sourceLabel: 'Curated',
        location: {
          id: 'jfk-gates-t4-a',
          airportCode: 'JFK',
          name: 'Terminal 4 A Gates',
          type: LocationType.SERVICE,
          coordinate: { latitude: 40.6415, longitude: -73.7840 },
          address: 'Terminal 4 A Gates',
          level: 'Post-security',
          zone: 'T4',
          source: 'airport',
          airportCore: true,
          airportCoreKind: 'TERMINAL'
        }
      },
      {
        id: 'jfk-gates-t4-b',
        title: 'Terminal 4 B Gates',
        subtitle: 'Long concourse walk, check carts and hold rooms',
        meta: 'B gates',
        icon: 'trail-sign-outline',
        level: 'Post-security',
        zone: 'T4',
        sourceLabel: 'Curated',
        location: {
          id: 'jfk-gates-t4-b',
          airportCode: 'JFK',
          name: 'Terminal 4 B Gates',
          type: LocationType.SERVICE,
          coordinate: { latitude: 40.6410, longitude: -73.7790 },
          address: 'Terminal 4 B Gates',
          level: 'Post-security',
          zone: 'T4',
          source: 'airport',
          airportCore: true,
          airportCoreKind: 'TERMINAL'
        }
      },
    ],
    TRANSPORT: [
      {
        id: 'jfk-car-alamo',
        title: 'Alamo Rent A Car',
        subtitle: 'Federal Circle Rental Car Center, JFK Airport',
        meta: 'Federal Circle',
        icon: 'car-outline',
        level: '1',
        zone: 'FED_CIRCLE',
        crewNote: 'Take the AirTrain to Federal Circle Station. Alamo counter is on Level 1.',
        sourceLabel: 'Curated',
        location: {
          id: 'jfk-car-alamo',
          airportCode: 'JFK',
          name: 'Alamo Rent A Car',
          type: LocationType.SERVICE,
          coordinate: { latitude: 40.6586, longitude: -73.8070 },
          address: 'Federal Circle, Queens, NY 11430',
          level: '1',
          zone: 'FED_CIRCLE',
          source: 'airport'
        }
      },
      {
        id: 'jfk-car-enterprise',
        title: 'Enterprise Rent-A-Car',
        subtitle: 'Federal Circle Rental Car Center, JFK Airport',
        meta: 'Federal Circle',
        icon: 'car-outline',
        level: '1',
        zone: 'FED_CIRCLE',
        crewNote: 'Take the AirTrain to Federal Circle Station. Enterprise counter is on Level 1.',
        sourceLabel: 'Curated',
        location: {
          id: 'jfk-car-enterprise',
          airportCode: 'JFK',
          name: 'Enterprise Rent-A-Car',
          type: LocationType.SERVICE,
          coordinate: { latitude: 40.6586, longitude: -73.8070 },
          address: 'Federal Circle, Queens, NY 11430',
          level: '1',
          zone: 'FED_CIRCLE',
          source: 'airport'
        }
      },
      {
        id: 'jfk-car-national',
        title: 'National Car Rental',
        subtitle: 'Federal Circle Rental Car Center, JFK Airport',
        meta: 'Federal Circle',
        icon: 'car-outline',
        level: '1',
        zone: 'FED_CIRCLE',
        crewNote: 'Take the AirTrain to Federal Circle. National is located on Level 1.',
        sourceLabel: 'Curated',
        location: {
          id: 'jfk-car-national',
          airportCode: 'JFK',
          name: 'National Car Rental',
          type: LocationType.SERVICE,
          coordinate: { latitude: 40.6586, longitude: -73.8070 },
          address: 'Federal Circle, Queens, NY 11430',
          level: '1',
          zone: 'FED_CIRCLE',
          source: 'airport'
        }
      },
      {
        id: 'jfk-car-hertz',
        title: 'Hertz Car Rental',
        subtitle: 'Federal Circle Rental Car Center, JFK Airport',
        meta: 'Federal Circle',
        icon: 'car-outline',
        level: '1',
        zone: 'FED_CIRCLE',
        crewNote: 'Hertz rental counter is on Level 1 at Federal Circle.',
        sourceLabel: 'Curated',
        location: {
          id: 'jfk-car-hertz',
          airportCode: 'JFK',
          name: 'Hertz Car Rental',
          type: LocationType.SERVICE,
          coordinate: { latitude: 40.6586, longitude: -73.8070 },
          address: 'Federal Circle, Queens, NY 11430',
          level: '1',
          zone: 'FED_CIRCLE',
          source: 'airport'
        }
      },
      {
        id: 'jfk-car-sixt',
        title: 'Sixt Rent A Car',
        subtitle: 'Federal Circle Rental Car Center, JFK Airport',
        meta: 'Federal Circle',
        icon: 'car-outline',
        level: '1',
        zone: 'FED_CIRCLE',
        crewNote: 'Sixt counter is located on Level 1 at Federal Circle.',
        sourceLabel: 'Curated',
        location: {
          id: 'jfk-car-sixt',
          airportCode: 'JFK',
          name: 'Sixt Rent A Car',
          type: LocationType.SERVICE,
          coordinate: { latitude: 40.6586, longitude: -73.8070 },
          address: 'Federal Circle, Queens, NY 11430',
          level: '1',
          zone: 'FED_CIRCLE',
          source: 'airport'
        }
      },
      {
        id: 'jfk-car-budget',
        title: 'Budget Car Rental',
        subtitle: 'Federal Circle Rental Car Center, JFK Airport',
        meta: 'Federal Circle',
        icon: 'car-outline',
        level: '1',
        zone: 'FED_CIRCLE',
        crewNote: 'Budget rental counter is on Level 1 at Federal Circle.',
        sourceLabel: 'Curated',
        location: {
          id: 'jfk-car-budget',
          airportCode: 'JFK',
          name: 'Budget Car Rental',
          type: LocationType.SERVICE,
          coordinate: { latitude: 40.6586, longitude: -73.8070 },
          address: 'Federal Circle, Queens, NY 11430',
          level: '1',
          zone: 'FED_CIRCLE',
          source: 'airport'
        }
      },
      {
        id: 'jfk-car-dollar',
        title: 'Dollar Rent A Car',
        subtitle: 'Federal Circle Rental Car Center, JFK Airport',
        meta: 'Federal Circle',
        icon: 'car-outline',
        level: '1',
        zone: 'FED_CIRCLE',
        crewNote: 'Dollar counter is located on Level 1 at Federal Circle.',
        sourceLabel: 'Curated',
        location: {
          id: 'jfk-car-dollar',
          airportCode: 'JFK',
          name: 'Dollar Rent A Car',
          type: LocationType.SERVICE,
          coordinate: { latitude: 40.6586, longitude: -73.8070 },
          address: 'Federal Circle, Queens, NY 11430',
          level: '1',
          zone: 'FED_CIRCLE',
          source: 'airport'
        }
      },
    ],
    FOOD: [
      {
        id: 'jfk-food-shake-shack-t4',
        title: 'Shake Shack',
        subtitle: 'Terminal 4, near Gate B23, Post-Security',
        meta: 'Terminal 4',
        icon: 'restaurant-outline',
        level: '2',
        zone: 'T4',
        crewNote: 'Great burger option post-security in T4.',
        sourceLabel: 'Curated',
        location: {
          id: 'jfk-food-shake-shack-t4',
          airportCode: 'JFK',
          name: 'Shake Shack',
          type: LocationType.RESTAURANT,
          coordinate: { latitude: 40.6425, longitude: -73.7780 },
          address: 'JFK Terminal 4 Concourse B',
          level: '2',
          zone: 'T4',
          source: 'airport'
        }
      },
      {
        id: 'jfk-food-dunkin-t5',
        title: 'Dunkin\' Donuts',
        subtitle: 'Terminal 5, Food Court, Post-Security',
        meta: 'Terminal 5',
        icon: 'restaurant-outline',
        level: '2',
        zone: 'T5',
        crewNote: 'Quick breakfast and donuts in JetBlue T5.',
        sourceLabel: 'Curated',
        location: {
          id: 'jfk-food-dunkin-t5',
          airportCode: 'JFK',
          name: 'Dunkin\' Donuts',
          type: LocationType.RESTAURANT,
          coordinate: { latitude: 40.6468, longitude: -73.7777 },
          address: 'JFK Terminal 5 Departures',
          level: '2',
          zone: 'T5',
          source: 'airport'
        }
      },
    ],
    COFFEE: [
      {
        id: 'jfk-coffee-blue-bottle',
        title: 'Blue Bottle Coffee',
        subtitle: 'Terminal 4, near Gates B20-B22, Post-Security',
        meta: 'Terminal 4',
        icon: 'cafe-outline',
        level: '2',
        zone: 'T4',
        crewNote: 'High-quality coffee post-security.',
        sourceLabel: 'Curated',
        location: {
          id: 'jfk-coffee-blue-bottle',
          airportCode: 'JFK',
          name: 'Blue Bottle Coffee',
          type: LocationType.COFFEE,
          coordinate: { latitude: 40.6420, longitude: -73.7780 },
          address: 'JFK Terminal 4 Concourse B',
          level: '2',
          zone: 'T4',
          source: 'airport'
        }
      },
      {
        id: 'jfk-coffee-starbucks-t4',
        title: 'Starbucks',
        subtitle: 'Terminal 4, Retail Hall, Pre-Security',
        meta: 'Terminal 4',
        icon: 'cafe-outline',
        level: '3',
        zone: 'T4',
        crewNote: 'Pre-security coffee reset in T4 Departures lobby.',
        sourceLabel: 'Curated',
        location: {
          id: 'jfk-coffee-starbucks-t4',
          airportCode: 'JFK',
          name: 'Starbucks',
          type: LocationType.COFFEE,
          coordinate: { latitude: 40.6434, longitude: -73.7890 },
          address: 'JFK Terminal 4 Departures Lobby',
          level: '3',
          zone: 'T4',
          source: 'airport'
        }
      },
    ],
    LOUNGES: [
      {
        id: 'jfk-lounge-delta-t4',
        title: 'Delta Sky Club',
        subtitle: 'Terminal 4, Concourse B near Gate B32',
        meta: 'Terminal 4',
        icon: 'bed-outline',
        level: '2',
        zone: 'T4',
        crewNote: 'Delta flagship lounge at JFK.',
        sourceLabel: 'Curated',
        location: {
          id: 'jfk-lounge-delta-t4',
          airportCode: 'JFK',
          name: 'Delta Sky Club',
          type: LocationType.LOUNGE,
          coordinate: { latitude: 40.6430, longitude: -73.7810 },
          address: 'JFK Terminal 4 Concourse B',
          level: '2',
          zone: 'T4',
          source: 'airport'
        }
      },
      {
        id: 'jfk-lounge-centurion-t4',
        title: 'American Express Centurion Lounge',
        subtitle: 'Terminal 4, post-security departures level',
        meta: 'Terminal 4',
        icon: 'bed-outline',
        level: '2',
        zone: 'T4',
        crewNote: 'Multi-story Centurion Lounge with speakeasy bar.',
        sourceLabel: 'Curated',
        location: {
          id: 'jfk-lounge-centurion-t4',
          airportCode: 'JFK',
          name: 'American Express Centurion Lounge',
          type: LocationType.LOUNGE,
          coordinate: { latitude: 40.6428, longitude: -73.7788 },
          address: 'JFK Terminal 4 Post-Security',
          level: '2',
          zone: 'T4',
          source: 'airport'
        }
      },
    ],
    HOTELS: [
      {
        id: 'jfk-hotel-twa',
        title: 'TWA Hotel',
        subtitle: 'Connected to Terminal 5, JFK Airport',
        meta: 'TWA Hotel',
        icon: 'business-outline',
        level: '2',
        zone: 'TWA',
        crewNote: 'Historic TWA Flight Center converted to premium airport hotel.',
        sourceLabel: 'Curated',
        location: {
          id: 'jfk-hotel-twa',
          airportCode: 'JFK',
          name: 'TWA Hotel',
          type: LocationType.SERVICE,
          coordinate: { latitude: 40.6455, longitude: -73.7775 },
          address: '6000 Terminal 5, Queens, NY 11430',
          level: '2',
          zone: 'TWA',
          source: 'airport'
        }
      },
    ]
  },
  MCO: {
    SECURITY: [
      { id: 'mco-security-east', title: 'East Checkpoint', subtitle: 'Main terminal screening bank; verify KCM and crew timing before report', meta: 'East', icon: 'scan-outline', level: 'Departures', zone: 'A/B main terminal', crewNote: 'Good first check when the A-side flow is heavier.', sourceLabel: 'Curated' },
      { id: 'mco-security-west', title: 'West Checkpoint', subtitle: 'Main terminal alternate screening bank near A/B terminal flow', meta: 'West', icon: 'scan-outline', level: 'Departures', zone: 'A/B main terminal', crewNote: 'Useful fallback when crew reports show East backing up.', sourceLabel: 'Curated' },
      { id: 'mco-security-terminal-c', title: 'Terminal C Checkpoint', subtitle: 'Terminal C security flow for newer gate and international operations', meta: 'Terminal C', icon: 'scan-outline', level: 'Departures', zone: 'Terminal C', crewNote: 'Check terminal assignment before heading to the main terminal.', sourceLabel: 'Curated' },
    ],
    GATES: [
      { id: 'mco-gates-airsides', title: 'Airside Gate Pods', subtitle: 'Airside train connects terminal core to gates', meta: 'Airside 1-4', icon: 'trail-sign-outline', level: 'Post-security', zone: 'Main terminal airsides', crewNote: 'Build in train time when switching between terminal core and gate pods.', sourceLabel: 'Curated' },
      { id: 'mco-gates-c', title: 'Terminal C Gates', subtitle: 'Newer terminal gate and arrivals flow', meta: 'Terminal C', icon: 'trail-sign-outline', level: 'Post-security', zone: 'Terminal C', crewNote: 'Separate flow from A/B main terminal ops.', sourceLabel: 'Curated' },
    ],
    FOOD: [
      { id: 'mco-food-main-terminal', title: 'Main Terminal Food Court', subtitle: 'Quick dining options around the A/B terminal core', meta: 'Food', icon: 'restaurant-outline', level: 'Pre-security', zone: 'A/B terminal core', crewNote: 'Good for a fast meal before committing to an airside train.', sourceLabel: 'Curated' },
      { id: 'mco-food-airside', title: 'Airside Grab-And-Go', subtitle: 'Post-security snacks and faster counter-service options', meta: 'Airside', icon: 'fast-food-outline', level: 'Post-security', zone: 'Airside gates', crewNote: 'Best when report time is tight and you are already past screening.', sourceLabel: 'Curated' },
      { id: 'mco-food-terminal-c', title: 'Terminal C Dining', subtitle: 'Terminal C dining cluster for newer gate operations', meta: 'Terminal C', icon: 'restaurant-outline', level: 'Mixed', zone: 'Terminal C', crewNote: 'Use only if your assignment keeps you near Terminal C.', sourceLabel: 'Curated' },
    ],
    COFFEE: [
      { id: 'mco-coffee-main', title: 'A/B Coffee Reset', subtitle: 'Coffee options around the main terminal core and airside paths', meta: 'Coffee', icon: 'cafe-outline', level: 'Mixed', zone: 'A/B terminal', crewNote: 'Good reset before heading to baggage, shuttle, or gate train.', sourceLabel: 'Curated' },
      { id: 'mco-coffee-terminal-c', title: 'Terminal C Coffee', subtitle: 'Coffee and quick snacks around Terminal C flow', meta: 'Terminal C', icon: 'cafe-outline', level: 'Mixed', zone: 'Terminal C', crewNote: 'Helpful when Terminal C is your whole day.', sourceLabel: 'Curated' },
    ],
    LOUNGES: [
      { id: 'mco-rest-quiet-areas', title: 'Quiet Reset Areas', subtitle: 'Lower-noise seating pockets near terminal transitions', meta: 'Rest', icon: 'bed-outline', level: 'Mixed', zone: 'Terminal core', crewNote: 'Use between legs when restaurants are loud or crowded.', sourceLabel: 'Curated' },
      { id: 'mco-rest-terminal-c', title: 'Terminal C Seating', subtitle: 'Terminal C seating zones for longer sits', meta: 'Terminal C', icon: 'bed-outline', level: 'Mixed', zone: 'Terminal C', crewNote: 'Usually better when your next move stays in Terminal C.', sourceLabel: 'Curated' },
    ],
    BAGGAGE: [
      { id: 'mco-baggage-a-b', title: 'A/B Baggage Claim', subtitle: 'Main terminal claim areas and ground-level pickup flow', meta: 'Level 2', icon: 'briefcase-outline', level: 'Arrivals', zone: 'A/B main terminal', crewNote: 'Confirm whether pickup is A-side or B-side before heading down.', sourceLabel: 'Curated' },
      { id: 'mco-baggage-c', title: 'Terminal C Baggage Claim', subtitle: 'Terminal C arrival bag claim and curb access', meta: 'Terminal C', icon: 'briefcase-outline', level: 'Arrivals', zone: 'Terminal C', crewNote: 'Separate curb logic from the A/B main terminal.', sourceLabel: 'Curated' },
    ],
    TRANSPORT: [
      { id: 'mco-ground-a-b', title: 'A/B Ground Transport', subtitle: 'Rideshare, taxi, shuttle, and crew pickup areas around main terminal', meta: 'Level 1', icon: 'bus-outline', level: 'Ground', zone: 'A/B curbs', crewNote: 'Useful for hotel vans, crew pickup, and rideshare handoff.', sourceLabel: 'Curated' },
      { id: 'mco-train-terminal-c', title: 'Terminal C Train Link', subtitle: 'Terminal connector between C and the main terminal complex', meta: 'Train', icon: 'swap-horizontal-outline', level: 'Connector', zone: 'Terminal link', crewNote: 'Plan this transfer before short connection windows.', sourceLabel: 'Curated' },
    ],
    HOTELS: [
      { id: 'mco-hotel-onsite', title: 'On-Airport Hotel Access', subtitle: 'Airport-connected hotel path for fast crew rest or meetups', meta: 'On airport', icon: 'business-outline', level: 'Terminal', zone: 'Main terminal', crewNote: 'Best low-friction option when time between duty periods is tight.', sourceLabel: 'Curated' },
      { id: 'mco-hotel-shuttle', title: 'Hotel Shuttle Pickup', subtitle: 'Hotel van pickup areas around ground transport flow', meta: 'Shuttle', icon: 'bus-outline', level: 'Ground', zone: 'A/B curbs', crewNote: 'Always confirm pickup side with the hotel or crew report.', sourceLabel: 'Curated' },
    ],
    SHOPS: [
      { id: 'mco-shop-disney', title: 'Walt Disney World Store', subtitle: 'Iconic park merchandise and magic before your flight', meta: 'Shop', icon: 'cart-outline', level: 'Level 3', zone: 'Main terminal core', crewNote: 'Perfect for last-minute gifts or a bit of magic between legs.', sourceLabel: 'Curated' },
      { id: 'mco-shop-universal', title: 'Universal Orlando Store', subtitle: 'Movie-themed gear and theme park essentials', meta: 'Shop', icon: 'cart-outline', level: 'Level 3', zone: 'Main terminal core', crewNote: 'Check out the Harry Potter section during your crew rest.', sourceLabel: 'Curated' },
      { id: 'mco-shop-dunkin', title: "Dunkin'", subtitle: 'America runs on Dunkin, and so does MCO crew', meta: 'Food/Coffee', icon: 'cafe-outline', level: 'Mixed', zone: 'Main terminal / Airside', crewNote: 'Usually a fast line; good backup for terminal coffee resets.', sourceLabel: 'Curated' },
    ],
    SERVICES: [
      { id: 'mco-service-atm', title: 'ATM & Currency Exchange', subtitle: 'Travel cash and currency services', meta: 'Service', icon: 'cash-outline', level: 'Level 3', zone: 'Terminal hub', crewNote: 'Reliable if you need cash before heading to international gates.', sourceLabel: 'Curated' },
    ],
  },
  LAX: {
    SECURITY: [
      { id: 'lax-security-loop', title: 'Terminal Loop Checkpoints', subtitle: 'Checkpoint locations vary by terminal; confirm before curb drop', meta: 'T1-T8', icon: 'scan-outline' },
      { id: 'lax-security-tbit', title: 'Tom Bradley Checkpoint', subtitle: 'International terminal security and customs-adjacent flow', meta: 'TBIT', icon: 'scan-outline' },
    ],
    GATES: [
      { id: 'lax-gates-loop', title: 'Terminal Loop Gates', subtitle: 'Walk or shuttle between terminal areas', meta: 'T1-T8', icon: 'trail-sign-outline' },
      { id: 'lax-gates-tbit', title: 'Tom Bradley Gates', subtitle: 'International gate and customs flow', meta: 'TBIT', icon: 'trail-sign-outline' },
    ],
  },
  MIA: {
    SECURITY: [
      { id: 'mia-security-north', title: 'North Terminal Checkpoint', subtitle: 'D concourse security flow and long-walk timing', meta: 'North', icon: 'scan-outline' },
      { id: 'mia-security-central', title: 'Central / South Checkpoints', subtitle: 'Connection-heavy checkpoint areas across E, H, and J', meta: 'E-H-J', icon: 'scan-outline' },
    ],
    GATES: [
      { id: 'mia-gates-north', title: 'North Terminal Gates', subtitle: 'Long concourse flow and customs access', meta: 'D gates', icon: 'trail-sign-outline' },
      { id: 'mia-gates-central', title: 'Central / South Gates', subtitle: 'Connection-heavy gate areas', meta: 'E-H-J', icon: 'trail-sign-outline' },
    ],
  },
};

const findNearestAirport = (coords: Coordinates) => {
  return AirportSearchService.searchUsAirports('', 260)
    .map((airport) => ({
      airport,
      distanceMiles: getDistanceMiles(coords, {
        latitude: airport.latitude,
        longitude: airport.longitude,
      }),
    }))
    .sort((left, right) => left.distanceMiles - right.distanceMiles)[0] || null;
};

const isLocationInCategory = (location: CrewLocation, category: DirectoryCategory): boolean => {
  switch (category) {
    case 'ALL':
      return true;
    case 'SECURITY':
      return location.airportCoreKind === 'SECURITY';
    case 'GATES':
      return location.airportCoreKind === 'TERMINAL';
    case 'FOOD':
      return location.type === LocationType.RESTAURANT;
    case 'COFFEE':
      return location.type === LocationType.COFFEE || location.airportCoreKind === 'COFFEE';
    case 'LOUNGES':
      return location.type === LocationType.LOUNGE || location.airportCoreKind === 'LOUNGE';
    case 'BAGGAGE':
      return location.airportCoreKind === 'BAGGAGE';
    case 'TRANSPORT':
      return location.airportCoreKind === 'GROUND' || location.airportCoreKind === 'SHUTTLE';
    case 'HOTELS': {
      const searchText = `${location.name} ${location.address} ${location.primaryTypeDisplayName || ''}`.toLowerCase();
      return searchText.includes('hotel') || searchText.includes('lodging');
    }
    case 'SHOPS':
      return location.type === LocationType.SHOPPING;
    case 'SERVICES':
      return location.type === LocationType.SERVICE;
    default:
      return false;
  }
};
const isDuplicateTitle = (titleA: string, titleB: string): boolean => {
  const normA = (titleA || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const normB = (titleB || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  if (normA.length >= 5 && normB.length >= 5) {
    if (normA.startsWith(normB) || normB.startsWith(normA)) {
      return true;
    }
  }
  return false;
};

const sortSearchResults = (results: CrewLocation[], query: string): CrewLocation[] => {
  const q = query.toLowerCase().trim();
  if (!q) return results;

  return [...results].sort((a, b) => {
    const nameA = (a.name || '').toLowerCase();
    const nameB = (b.name || '').toLowerCase();

    // 1. Direct name starts with query
    const startsA = nameA.startsWith(q);
    const startsB = nameB.startsWith(q);
    if (startsA && !startsB) return -1;
    if (!startsA && startsB) return 1;

    // 2. Word in name starts with query
    const wordStartsA = nameA.split(/\s+/).some(word => word.startsWith(q));
    const wordStartsB = nameB.split(/\s+/).some(word => word.startsWith(q));
    if (wordStartsA && !wordStartsB) return -1;
    if (!wordStartsA && wordStartsB) return 1;

    // 3. Name contains query
    const containsA = nameA.includes(q);
    const containsB = nameB.includes(q);
    if (containsA && !containsB) return -1;
    if (!containsA && containsB) return 1;

    return 0;
  });
};

const buildDirectoryEntries = (
  airportCode: string,
  category: DirectoryCategory,
  airportCoreLocations: CrewLocation[],
  allLocations: CrewLocation[]
): DirectoryEntry[] => {
  const code = airportCode.toUpperCase();
  const hintEntries: DirectoryEntry[] = [];
  const airportHints = AIRPORT_DIRECTORY_HINTS[code];
  if (airportHints) {
    const categoryHints = airportHints[category];
    if (categoryHints) {
      hintEntries.push(...categoryHints);
    }
  }
  const coreEntry = (location: CrewLocation, meta: string): DirectoryEntry => ({
    id: location.id,
    title: location.name,
    subtitle: location.address,
    meta,
    level: location.level || (location.airportCoreKind ? 'Airport core' : undefined),
    zone: location.zone || location.shortLabel,
    crewNote: location.crewTip || location.crewIntelSummary,
    sourceLabel:
      location.source === 'places'
        ? 'Google'
        : location.source === 'crew'
          ? 'Crew'
          : location.source === 'airport'
            ? 'Airport'
            : 'Curated',
    icon:
      location.airportCoreKind === 'TERMINAL'
        ? 'business-outline'
        : location.airportCoreKind === 'GROUND' || location.airportCoreKind === 'SHUTTLE'
          ? 'bus-outline'
          : location.airportCoreKind === 'COFFEE'
            ? 'cafe-outline'
            : location.airportCoreKind === 'LOUNGE'
              ? 'bed-outline'
              : location.airportCoreKind === 'BAGGAGE'
                ? 'briefcase-outline'
                : location.airportCoreKind === 'SECURITY'
                  ? 'scan-outline'
                  : 'navigate-outline',
    location,
  });

  let rawEntries: DirectoryEntry[] = [];

  if (category === 'ALL') {
    const cats: DirectoryCategory[] = [
      'SECURITY',
      'GATES',
      'FOOD',
      'COFFEE',
      'LOUNGES',
      'BAGGAGE',
      'TRANSPORT',
      'HOTELS',
      'SHOPS',
      'SERVICES',
    ];
    let allEntries: DirectoryEntry[] = [];
    for (const c of cats) {
      allEntries = [...allEntries, ...buildDirectoryEntries(airportCode, c, airportCoreLocations, allLocations)];
    }
    const deduped: DirectoryEntry[] = [];
    const seenIds = new Set<string>();
    for (const entry of allEntries) {
      const idKey = entry.id;
      const isDup = seenIds.has(idKey) || deduped.some(e => isDuplicateTitle(e.title, entry.title));
      if (!isDup) {
        seenIds.add(idKey);
        deduped.push(entry);
      }
    }
    return deduped;
  }

  if (category === 'SECURITY') {
    rawEntries = airportCoreLocations
      .filter((location) => location.airportCoreKind === 'SECURITY')
      .map((location) => coreEntry(location, location.shortLabel || 'Checkpoint'));
  } else if (category === 'FOOD') {
    rawEntries = allLocations
      .filter((location) => location.type === LocationType.RESTAURANT)
      .slice(0, 16)
      .map((location) => coreEntry(location, location.shortLabel || getLocationTypeLabel(location.type)));
  } else if (category === 'COFFEE') {
    rawEntries = allLocations
      .filter((location) => location.type === LocationType.COFFEE || location.airportCoreKind === 'COFFEE')
      .slice(0, 16)
      .map((location) => coreEntry(location, location.shortLabel || 'Coffee'));
  } else if (category === 'LOUNGES') {
    rawEntries = allLocations
      .filter((location) => location.type === LocationType.LOUNGE || location.airportCoreKind === 'LOUNGE')
      .slice(0, 12)
      .map((location) => coreEntry(location, location.shortLabel || 'Lounge'));
  } else if (category === 'SHOPS') {
    rawEntries = allLocations
      .filter((location) => location.type === LocationType.SHOPPING)
      .slice(0, 16)
      .map((location) => coreEntry(location, location.shortLabel || 'Shop'));
  } else if (category === 'SERVICES') {
    rawEntries = allLocations
      .filter((location) => location.type === LocationType.SERVICE)
      .slice(0, 16)
      .map((location) => coreEntry(location, location.shortLabel || 'Service'));
  } else if (category === 'BAGGAGE') {
    rawEntries = airportCoreLocations
      .filter((location) => location.airportCoreKind === 'BAGGAGE')
      .map((location) => coreEntry(location, location.shortLabel || 'Baggage'));
  } else if (category === 'TRANSPORT') {
    rawEntries = airportCoreLocations
      .filter((location) => ['GROUND', 'SHUTTLE'].includes(location.airportCoreKind || ''))
      .map((location) => coreEntry(location, location.shortLabel || 'Ground'));
  } else if (category === 'HOTELS') {
    rawEntries = allLocations
      .filter((location) => {
        const searchText = `${location.name} ${location.address} ${location.primaryTypeDisplayName || ''}`.toLowerCase();
        return searchText.includes('hotel') || searchText.includes('lodging');
      })
      .slice(0, 12)
      .map((location) => coreEntry(location, location.shortLabel || 'Hotel'));
  }

  // Combine and deduplicate
  const combined = [...rawEntries, ...hintEntries];
  const deduped: DirectoryEntry[] = [];
  const seenIds = new Set<string>();

  for (const entry of combined) {
    const idKey = entry.id;
    const isDup = seenIds.has(idKey) || deduped.some(e => isDuplicateTitle(e.title, entry.title));

    if (!isDup) {
      seenIds.add(idKey);
      deduped.push(entry);
    } else {
      // Find the existing one and merge/update if this one has the location object
      const idx = deduped.findIndex((e) => e.id === idKey || isDuplicateTitle(e.title, entry.title));
      if (idx !== -1) {
        if (entry.location && !deduped[idx].location) {
          // Retain more specific fields from hints but keep the location coordinates
          deduped[idx] = {
            ...deduped[idx],
            ...entry,
            location: entry.location,
          };
        }
      }
    }
  }

  // Fallback defaults if absolutely empty
  if (deduped.length === 0) {
    if (category === 'SECURITY') {
      return [
        {
          id: `${code}-security-overview`,
          title: `${code} Security Checkpoints`,
          subtitle: 'Checkpoint, KCM, and screening flow will appear here as crew data is added',
          meta: 'Security',
          icon: 'scan-outline',
        },
      ];
    }
    if (category === 'FOOD') {
      return [
        {
          id: `${code}-food-directory`,
          title: 'Food And Coffee',
          subtitle: 'Terminal dining, coffee, grab-and-go, and crew reset options',
          meta: 'Directory',
          icon: 'restaurant-outline',
          sourceLabel: 'Curated',
        },
      ];
    }
    if (category === 'COFFEE') {
      return [
        {
          id: `${code}-coffee-directory`,
          title: 'Coffee And Grab-And-Go',
          subtitle: 'Crew coffee, quick snacks, and terminal reset spots',
          meta: 'Coffee',
          icon: 'cafe-outline',
          sourceLabel: 'Curated',
        },
      ];
    }
    if (category === 'LOUNGES') {
      return [
        {
          id: `${code}-lounges-directory`,
          title: 'Lounges And Quiet Areas',
          subtitle: 'Crew rest, quiet reset, and lounge-like areas around the terminal',
          meta: 'Rest',
          icon: 'bed-outline',
          sourceLabel: 'Curated',
        },
      ];
    }
    if (category === 'SHOPS') {
      return [
        {
          id: `${code}-shops-directory`,
          title: 'Airport Shopping',
          subtitle: 'Retail, newsstands, and travel essentials',
          meta: 'Retail',
          icon: 'cart-outline',
          sourceLabel: 'Curated',
        },
      ];
    }
    if (category === 'SERVICES') {
      return [
        {
          id: `${code}-services-directory`,
          title: 'Airport Services',
          subtitle: 'ATMs, currency, and travel assistance',
          meta: 'Service',
          icon: 'cash-outline',
          sourceLabel: 'Curated',
        },
      ];
    }
    if (category === 'BAGGAGE') {
      return [
        {
          id: `${code}-baggage-directory`,
          title: 'Baggage Claim',
          subtitle: 'Bag claim, arrivals flow, and pickup notes will appear here',
          meta: 'Arrivals',
          icon: 'briefcase-outline',
        },
      ];
    }
    if (category === 'TRANSPORT') {
      return [
        {
          id: `${code}-transport-overview`,
          title: 'Ground Transportation',
          subtitle: 'Rideshare, taxi, hotel shuttle, crew pickup, and inter-terminal transfer',
          meta: 'Curbside',
          icon: 'bus-outline',
        },
      ];
    }
    if (category === 'HOTELS') {
      return [
        {
          id: `${code}-hotel-directory`,
          title: 'Airport Hotels',
          subtitle: 'On-airport and near-airport hotel options for crew layovers',
          meta: 'Hotels',
          icon: 'business-outline',
          sourceLabel: 'Curated',
        },
      ];
    }
    if (category === 'GATES') {
      return [
        {
          id: `${code}-gates-overview`,
          title: `${code} Gate Directory`,
          subtitle: 'Gate groups, concourse flow, and level notes will appear here as airport data is added',
          meta: 'Coming online',
          icon: 'trail-sign-outline',
        },
      ];
    }
  }

  // Ensure transport has overview item if not present
  if (category === 'TRANSPORT' && !deduped.some((e) => e.id.includes('transport-overview'))) {
    deduped.push({
      id: `${code}-transport-overview`,
      title: 'Ground Transportation',
      subtitle: 'Rideshare, taxi, hotel shuttle, crew pickup, and inter-terminal transfer',
      meta: 'Curbside',
      icon: 'bus-outline',
    });
  }

  return deduped;
};

const getDirectoryMarkerLocations = (
  category: DirectoryCategory,
  airportCoreLocations: CrewLocation[],
  allLocations: CrewLocation[]
) => {
  const matchesAirportCoreKind = (kinds: string[]) =>
    airportCoreLocations.filter((location) => kinds.includes(location.airportCoreKind || ''));

  switch (category) {
    case 'ALL':
      return [...airportCoreLocations, ...allLocations];
    case 'SECURITY':
      return matchesAirportCoreKind(['SECURITY']);
    case 'GATES':
      return matchesAirportCoreKind(['TERMINAL']);
    case 'BAGGAGE':
      return matchesAirportCoreKind(['BAGGAGE']);
    case 'TRANSPORT':
      return matchesAirportCoreKind(['GROUND', 'SHUTTLE']);
    case 'COFFEE':
      return allLocations.filter(
        (location) => location.type === LocationType.COFFEE || location.airportCoreKind === 'COFFEE'
      );
    case 'FOOD':
      return allLocations.filter(
        (location) =>
          location.type === LocationType.RESTAURANT ||
          location.type === LocationType.COFFEE ||
          location.airportCoreKind === 'COFFEE'
      );
    case 'LOUNGES':
      return allLocations.filter(
        (location) => location.type === LocationType.LOUNGE || location.airportCoreKind === 'LOUNGE'
      );
    case 'HOTELS':
      return allLocations.filter((location) => {
        const searchText = `${location.name} ${location.address} ${location.primaryTypeDisplayName || ''}`.toLowerCase();
        return searchText.includes('hotel') || searchText.includes('lodging');
      });
    default:
      return airportCoreLocations;
  }
};

export default function MapScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const { profile } = useProfile();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const isMapboxActive = process.env.EXPO_PUBLIC_USE_MAPBOX === 'true';
  const lastLoadedCenter = useRef<Coordinates | null>(null);
  const didAutoFocusUserLocation = useRef(false);
  const latestAirportCode = useRef('');
  const loadLocationsRevision = useRef(0);
  const isNavigatingRef = useRef(false);
  const navigationStepsRef = useRef<any[]>([]);
  const currentNavStepIndexRef = useRef(0);
  const [locations, setLocations] = useState<CrewLocation[]>([]);
  const [savedLocations, setSavedLocations] = useState<CrewLocation[]>([]);
  const [savedRoutes, setSavedRoutes] = useState<CrewSavedRoute[]>([]);
  const [mapAlerts, setMapAlerts] = useState<Alert[]>([]);
  const [selectedType, setSelectedType] = useState<LocationType | 'ALL'>('ALL');
  const [utilityMode, setUtilityMode] = useState<UtilityMode>('ALL');
  const [curatedLayer, setCuratedLayer] = useState<CuratedLayer>('ALL');
  const [displayMode, setDisplayMode] = useState<MapDisplayMode>('AIRPORT');
  const [selectedDirectoryCategory, setSelectedDirectoryCategory] = useState<DirectoryCategory>('ALL');
  const [selectedDirectoryEntry, setSelectedDirectoryEntry] = useState<DirectoryEntry | null>(null);
  const [directorySearchQuery, setDirectorySearchQuery] = useState('');
  const [isDirectoryExpanded, setIsDirectoryExpanded] = useState(false);
  const [isTerminalSelectorVisible, setIsTerminalSelectorVisible] = useState(false);
  const [isRefreshingDirectoryBusinesses, setIsRefreshingDirectoryBusinesses] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<CrewLocation | null>(null);
  const [isUtilityPanelVisible, setIsUtilityPanelVisible] = useState(false);
  const [isAirportPanelExpanded, setIsAirportPanelExpanded] = useState(false);
  const [isLayerPanelExpanded, setIsLayerPanelExpanded] = useState(false);
  const [userLocation, setUserLocation] = useState<DeviceCoordinates | null>(null);
  const [detectedAirport, setDetectedAirport] = useState<(AirportOption & { distanceMiles: number }) | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationDestination, setNavigationDestination] = useState<CrewLocation | null>(null);
  const [navigationRouteGeometry, setNavigationRouteGeometry] = useState<[number, number][] | null>(null);
  const [navigationSteps, setNavigationSteps] = useState<any[]>([]);
  const [currentNavStepIndex, setCurrentNavStepIndex] = useState(0);
  const [navDistanceRemaining, setNavDistanceRemaining] = useState(0);
  const [navDurationRemaining, setNavDurationRemaining] = useState(0);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const [isPoiLoading, setIsPoiLoading] = useState(false);
  const [isPlaceIntelModalVisible, setIsPlaceIntelModalVisible] = useState(false);
  const [isAddPlaceModalVisible, setIsAddPlaceModalVisible] = useState(false);
  const [isPostAlertModalVisible, setIsPostAlertModalVisible] = useState(false);
  const [isFlightTrackerVisible, setIsFlightTrackerVisible] = useState(false);
  const [privateAlerts, setPrivateAlerts] = useState<Alert[]>([]);
  const [isAdjustingAlertPin, setIsAdjustingAlertPin] = useState(false);
  const [tempAlertCoordinate, setTempAlertCoordinate] = useState<Coordinates | null>(null);
  const [pendingAlertForm, setPendingAlertForm] = useState<{
    type: any;
    title: string;
    message: string;
    isPrivate: boolean;
    isLocationSpecific: boolean;
  } | null>(null);
  const [mapFocusCoordinates, setMapFocusCoordinates] = useState<Coordinates>(DEFAULT_CENTER);
  const [mapFocusDelta, setMapFocusDelta] = useState<MapDelta>(HUB_DELTA);
  const [mapFocusRevision, setMapFocusRevision] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [googleSearchResults, setGoogleSearchResults] = useState<CrewLocation[]>([]);
  const [isSearchingGoogle, setIsSearchingGoogle] = useState(false);
  const [airportSearchText, setAirportSearchText] = useState('');
  const searchedAirports = useMemo(() => {
    return AirportSearchService.searchUsAirports(airportSearchText, 5);
  }, [airportSearchText]);
  const profileActiveAirportCode =
    normalizeAirportCode(profile.baseAirport) || getActiveOpsAirportCode(profile);
  const previousProfileAirportCode = useRef(profileActiveAirportCode);
  const didManuallySelectMapAirport = useRef(false);
  const [mapAirportCode, setMapAirportCode] = useState(profileActiveAirportCode);
  const activeAirportCode = mapAirportCode;
  const [selectedTerminalZone, setSelectedTerminalZone] = useState<string>(() => {
    const initialAirport = profileActiveAirportCode || 'MCO';
    if (initialAirport === 'JFK') return 'T4';
    if (initialAirport === 'MCO') return 'MAIN_AB';
    return 'ALL';
  });
  const [selectedFloorLevel, setSelectedFloorLevel] = useState<string>(() => {
    const initialAirport = profileActiveAirportCode || 'MCO';
    if (initialAirport === 'JFK' || initialAirport === 'MCO') return '3';
    return 'ALL';
  });
  const activeAirportName = getAirportDisplayName(activeAirportCode);
  const activeAirportCenter = useMemo(
    () => getAirportCoordinates(activeAirportCode) || DEFAULT_CENTER,
    [activeAirportCode]
  );
  const recenterTarget = activeAirportCenter;
  latestAirportCode.current = activeAirportCode;

  const getActiveSelectorLabel = () => {
    const currentOptions = activeAirportCode === 'JFK' ? JFK_SELECTOR_OPTIONS : MCO_SELECTOR_OPTIONS;
    for (const section of currentOptions) {
      const match = section.options.find(
        (opt) => opt.zone === selectedTerminalZone && opt.level === selectedFloorLevel
      );
      if (match) {
        if (activeAirportCode === 'JFK') {
          if (selectedTerminalZone.startsWith('T')) {
            return `Terminal ${selectedTerminalZone.substring(1)} • L${selectedFloorLevel}`;
          }
          if (selectedTerminalZone === 'TWA') {
            return `TWA Hotel • L${selectedFloorLevel}`;
          }
          if (selectedTerminalZone === 'FED_CIRCLE') {
            return `Fed Circle • L${selectedFloorLevel}`;
          }
          return match.label;
        } else {
          if (selectedTerminalZone === 'MAIN_AB') {
            return `A & B • L${selectedFloorLevel}`;
          }
          if (selectedTerminalZone.startsWith('AS')) {
            return `Airside ${selectedTerminalZone.charAt(2)} Gates`;
          }
          if (selectedTerminalZone === 'MAIN_C') {
            return `Terminal C • L${selectedFloorLevel}`;
          }
          if (selectedTerminalZone === 'TRAIN') {
            return `Train • ${selectedFloorLevel === '1' ? 'Ground' : 'Platform'}`;
          }
          return match.label;
        }
      }
    }
    return 'Outdoor View';
  };
  const getSelectorLevelsForZone = () => {
    if (selectedTerminalZone === 'ALL') {
      return ['4', '3', '2', '1', 'B'];
    }
    const currentOptions = activeAirportCode === 'JFK' ? JFK_SELECTOR_OPTIONS : MCO_SELECTOR_OPTIONS;
    const section = currentOptions.find((sec) =>
      sec.options.some((opt) => opt.zone === selectedTerminalZone)
    );
    if (!section) return ['3', '2', '1', 'B'];
    
    // Get unique levels from options in this zone/terminal
    const levels = section.options
      .filter((opt) => opt.zone === selectedTerminalZone)
      .map((opt) => opt.level);
    
    // Sort levels in descending order: 4, 3, 2, 1, and map 'TUNNEL' / 'TRAIN_PLATFORM' / 'AS_GATES' to 'B'
    const sortedLevels: string[] = [];
    const levelOrder = ['4', '3', '2', '1', 'TUNNEL', 'B', 'TRAIN_PLATFORM', 'AS_GATES'];
    for (const lvl of levelOrder) {
      if (levels.includes(lvl)) {
        const mapped = (lvl === 'TUNNEL' || lvl === 'B' || lvl === 'TRAIN_PLATFORM' || lvl === 'AS_GATES') ? 'B' : lvl;
        if (!sortedLevels.includes(mapped)) {
          sortedLevels.push(mapped);
        }
      }
    }
    return sortedLevels.length > 0 ? sortedLevels : ['3', '2', '1', 'B'];
  };

  const quickAirportCodes = useMemo(() => {
    const candidateCodes = [
      detectedAirport?.code,
      activeAirportCode,
      profile.preferences.layoverAirport,
      profile.preferences.tripAirport,
      profile.baseAirport,
      ...profile.preferences.favoriteAirports,
    ];

    return Array.from(
      new Set(
        candidateCodes
          .filter((airportCode): airportCode is string => Boolean(airportCode))
          .map((airportCode) => airportCode.toUpperCase())
          .filter((airportCode) => /^[A-Z]{3,4}$/.test(airportCode))
      )
    ).slice(0, 6);
  }, [
    activeAirportCode,
    detectedAirport?.code,
    profile.baseAirport,
    profile.preferences.favoriteAirports,
    profile.preferences.layoverAirport,
    profile.preferences.tripAirport,
  ]);
  const utilityOptions = useMemo(() => UTILITY_OPTIONS, []);
  const safeTop = Math.max(insets.top, 20) + 12;
  const overlayBottom = tabBarHeight + 24;
  const launcherBottom = tabBarHeight + 36;
  const actionBottom = tabBarHeight + 76;
  const actionRaisedBottom = tabBarHeight + 258;
  const hubTop = safeTop + (locationError ? 56 : 0);
  const mapControlOffset = 70;
  const expandedPanelTop = hubTop + 128;
  const showAirportCoreMode = displayMode === 'AIRPORT';
  const showRadiusMode = displayMode === 'RADIUS';
  const currentModeLabel =
    profile.preferences.opsContextMode === 'LAYOVER'
      ? 'Layover context'
      : profile.preferences.opsContextMode === 'TRIP'
        ? 'Trip context'
        : profile.preferences.opsContextMode === 'MANUAL'
          ? 'Manual focus'
          : 'Base context';

  useEffect(() => {
    const profileAirportChanged = profileActiveAirportCode !== previousProfileAirportCode.current;

    if (profileAirportChanged) {
      didManuallySelectMapAirport.current = false;
      setMapAirportCode(profileActiveAirportCode);
      previousProfileAirportCode.current = profileActiveAirportCode;
      return;
    }

    if (didManuallySelectMapAirport.current) {
      previousProfileAirportCode.current = profileActiveAirportCode;
      return;
    }

    if (mapAirportCode === previousProfileAirportCode.current) {
      setMapAirportCode(profileActiveAirportCode);
    }

    previousProfileAirportCode.current = profileActiveAirportCode;
  }, [mapAirportCode, profileActiveAirportCode]);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    const targetDelta = displayMode === 'AIRPORT'
      ? isDirectoryExpanded
        ? DIRECTORY_DELTA
        : HUB_DELTA
      : RADIUS_DELTA;

    const directoryVerticalOffset = displayMode === 'AIRPORT' && isDirectoryExpanded 
      ? (targetDelta.latitudeDelta * 0.22) 
      : 0;

    setMapFocusCoordinates({
      latitude: activeAirportCenter.latitude - directoryVerticalOffset,
      longitude: activeAirportCenter.longitude,
    });
    setMapFocusDelta(targetDelta);
    setMapFocusRevision((current) => current + 1);
  }, [activeAirportCenter.latitude, activeAirportCenter.longitude, displayMode, isDirectoryExpanded]);

  useEffect(() => {
    setSelectedDirectoryEntry(null);
  }, [activeAirportCode]);

  useEffect(() => {
    const query = directorySearchQuery.trim();
    if (query.length < 2) {
      setGoogleSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsSearchingGoogle(true);
      try {
        const results = await LocationService.searchGooglePlaces({
          query,
          center: activeAirportCenter,
        });
        
        const annotated = await MapPlaceIntelService.annotateLocations(results);
        setGoogleSearchResults(annotated);
      } catch (err) {
        console.error('Error searching Google Places:', err);
      } finally {
        setIsSearchingGoogle(false);
      }
    }, 600);

    return () => clearTimeout(delayDebounce);
  }, [directorySearchQuery, activeAirportCenter]);


  const focusMap = useCallback((coords: Coordinates, delta: MapDelta = DETAIL_DELTA) => {
    setMapFocusCoordinates(coords);
    setMapFocusDelta(delta);
    setMapFocusRevision((current) => current + 1);
  }, []);

  const loadLocations = useCallback(async (center?: Coordinates, includeProviderPlaces = false, bypassCache = false) => {
    const requestRevision = loadLocationsRevision.current + 1;
    loadLocationsRevision.current = requestRevision;
    const requestAirportCode = activeAirportCode;
    const searchCenter = center || activeAirportCenter;
    if (!includeProviderPlaces) {
      setIsLoadingLocations(true);
    }
    setIsRefreshingDirectoryBusinesses(includeProviderPlaces);

    try {
      const data = await LocationService.getLocations({
        hubCode: requestAirportCode,
        center: searchCenter,
        includeProviderPlaces,
        bypassCache,
      });
      const annotatedData = await MapPlaceIntelService.annotateLocations(data);
      const nextSavedLocations = await SavedLocationsService.getSavedLocations(requestAirportCode);
      const nextSavedRoutes = await SavedRoutesService.getSavedRoutes(requestAirportCode);

      if (
        latestAirportCode.current !== requestAirportCode ||
        loadLocationsRevision.current !== requestRevision
      ) {
        return;
      }

      const savedIds = new Set(nextSavedLocations.map((location) => location.id));
      const routeIds = new Set(nextSavedRoutes.map((route) => route.locationId));

      lastLoadedCenter.current = searchCenter;

      startTransition(() => {
        setSavedRoutes(nextSavedRoutes);
        setSavedLocations(nextSavedLocations.map((location) => ({ ...location, isSaved: true })));
        const nextLocations = annotatedData.map((location) => ({
            ...location,
            isSaved: savedIds.has(location.id),
            isRouteSaved: routeIds.has(location.id),
          }));
        setLocations(nextLocations);
        setSelectedLocation((current) => {
          if (!current) {
            return null;
          }

          return nextLocations.find((location) => location.id === current.id) || current;
        });
      });
    } finally {
      setIsLoadingLocations(false);
      setIsRefreshingDirectoryBusinesses(false);
    }
  }, [activeAirportCenter, activeAirportCode]);

  useEffect(() => {
    let isMounted = true;
    let subscription: { remove: () => void } | null = null;

    const initializeMap = async () => {
      setSelectedLocation(null);
      setIsUtilityPanelVisible(false);
      setIsPlaceIntelModalVisible(false);
      setIsAddPlaceModalVisible(false);
      setUtilityMode('ALL');
      setCuratedLayer('ALL');
      setSelectedType('ALL');
      focusMap(activeAirportCenter, HUB_DELTA);
      await loadLocations(activeAirportCenter, true, false);

      try {
        const permission = await DeviceLocationService.requestForegroundPermission();
        if (!isMounted) return;

        if (permission.status !== 'granted') {
          setLocationError(`Location permission is off. Showing ${activeAirportCode} hub view instead.`);
          return;
        }

        setLocationError(null);

        // Check for Capt. Riley mock location for testing Orlando Airport (MCO)
        if (profile?.fullName?.toLowerCase().startsWith('capt. riley')) {
          const mcoCoords = { latitude: 28.43115, longitude: -81.30808 };
          setUserLocation(mcoCoords);
          setMapAirportCode('MCO');
          focusMap(mcoCoords, HUB_DELTA);
          await loadLocations(mcoCoords, true, true);
          return;
        }

        // Fetch location asynchronously without blocking map initialization
        DeviceLocationService.getCurrentLocation()
          .then((currentLocation) => {
            if (!isMounted || !currentLocation) return;
            setUserLocation(currentLocation);
            const nearestAirport = findNearestAirport(currentLocation);
            if (nearestAirport && nearestAirport.distanceMiles <= 50) {
              setDetectedAirport({
                ...nearestAirport.airport,
                distanceMiles: nearestAirport.distanceMiles,
              });

              // Defaults to the nearest airport if user hasn't manually selected yet
              if (!didManuallySelectMapAirport.current) {
                const normalizedCode = nearestAirport.airport.code.toUpperCase();
                const nextAirportCenter = getAirportCoordinates(normalizedCode) || activeAirportCenter;
                setMapAirportCode(normalizedCode);
                focusMap(nextAirportCenter, displayMode === 'AIRPORT' ? HUB_DELTA : RADIUS_DELTA);
                didManuallySelectMapAirport.current = false; // preserve default mode
              }
            }

            if (
              !didAutoFocusUserLocation.current &&
              getDistanceMiles(activeAirportCenter, currentLocation) <= 25
            ) {
              focusMap(currentLocation, USER_DELTA);
              didAutoFocusUserLocation.current = true;
            }
          })
          .catch((err) => {
            console.warn('Non-blocking location read skipped or failed:', err);
          });

        subscription = await DeviceLocationService.watchLocation((coords) => {
          if (!isMounted) return;
          if (profile?.fullName?.toLowerCase().startsWith('capt. riley')) return;
          setUserLocation(coords);
          const nearestAirport = findNearestAirport(coords);
          if (nearestAirport && nearestAirport.distanceMiles <= 50) {
            setDetectedAirport({
              ...nearestAirport.airport,
              distanceMiles: nearestAirport.distanceMiles,
            });

            // Auto-switch to nearby airport if user hasn't manually selected yet
            if (!didManuallySelectMapAirport.current) {
              const normalizedCode = nearestAirport.airport.code.toUpperCase();
              if (normalizedCode !== activeAirportCode) {
                const nextAirportCenter = getAirportCoordinates(normalizedCode) || activeAirportCenter;
                setMapAirportCode(normalizedCode);
                focusMap(nextAirportCenter, displayMode === 'AIRPORT' ? HUB_DELTA : RADIUS_DELTA);
                didManuallySelectMapAirport.current = false; // preserve default mode
              }
            }
          }

          // In-App Turn-by-Turn Waypoint Advancement Logic
          if (isNavigatingRef.current && navigationStepsRef.current.length > 0) {
            const steps = navigationStepsRef.current;
            const currentIndex = currentNavStepIndexRef.current;
            
            if (currentIndex < steps.length) {
              const currentStep = steps[currentIndex];
              const stepLocation = currentStep.maneuver.location;
              if (stepLocation && stepLocation.length === 2) {
                const stepCoords = {
                  latitude: stepLocation[1],
                  longitude: stepLocation[0],
                };
                
                const distanceToNextStep = getDistanceMiles(coords, stepCoords) * 1609.34; // in meters
                
                // If user is within 15 meters of the waypoint, advance to next step
                if (distanceToNextStep < 15 && currentIndex < steps.length - 1) {
                  const nextIndex = currentIndex + 1;
                  setCurrentNavStepIndex(nextIndex);
                  currentNavStepIndexRef.current = nextIndex;
                }
              }
              
              // Recalculate remaining total path distance
              let remainingMeters = 0;
              for (let i = currentIndex; i < steps.length; i++) {
                remainingMeters += steps[i].distance;
              }
              setNavDistanceRemaining(remainingMeters);
              setNavDurationRemaining(remainingMeters / 1.4); // walking pace ~1.4 m/s
            }
          }
        });
      } catch (error) {
        if (!isMounted) return;
        setLocationError(`Unable to read device location right now. Showing ${activeAirportCode} hub view.`);
        console.warn('Failed to initialize device location:', error);
      }
    };

    void initializeMap();

    return () => {
      isMounted = false;
      if (subscription && typeof subscription.remove === 'function') {
        try {
          subscription.remove();
        } catch (e) {
          console.warn('Failed to remove location subscription:', e);
        }
      }
    };
  }, [activeAirportCenter, activeAirportCode, focusMap, loadLocations]);

  // Removed auto-polling Google Places to protect API quotas. 
  // Directory fetches are strictly manual via the 'Refresh Businesses' button now.

  useFocusEffect(
    useCallback(() => {
      // Pass 'false' to use the storage cache for instant tab focus loading.
      void loadLocations(lastLoadedCenter.current || activeAirportCenter, true, false);
    }, [activeAirportCenter, loadLocations])
  );

  useEffect(() => {
    const unsubscribe = AppSyncService.subscribe((event) => {
      if (event === 'profile') {
        void loadLocations(activeAirportCenter, true, false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeAirportCenter, loadLocations]);

  // Sync terminal level selector automatically when selectedLocation changes
  useEffect(() => {
    if (selectedLocation && (activeAirportCode === 'MCO' || activeAirportCode === 'JFK') && displayMode === 'AIRPORT') {
      if (selectedLocation.x !== undefined && selectedLocation.y !== undefined) {
        const locZone = (selectedLocation.zone || '').toLowerCase();
        const locLevel = (selectedLocation.level || '').toLowerCase();
        const locName = (selectedLocation.name || '').toLowerCase();
        const locShort = (selectedLocation.shortLabel || '').toLowerCase();
        const locAddress = (selectedLocation.address || '').toLowerCase();

        let matchedZone = '';
        let matchedLevel = '';

        if (activeAirportCode === 'JFK') {
          if (locZone.includes('t1') || locZone.includes('terminal 1') || locName.includes('terminal 1') || locShort.includes('t1') || locAddress.includes('terminal 1')) {
            matchedZone = 'T1';
          } else if (locZone.includes('t4') || locZone.includes('terminal 4') || locName.includes('terminal 4') || locShort.includes('t4') || locAddress.includes('terminal 4')) {
            matchedZone = 'T4';
          } else if (locZone.includes('t5') || locZone.includes('terminal 5') || locName.includes('terminal 5') || locShort.includes('t5') || locAddress.includes('terminal 5')) {
            matchedZone = 'T5';
          } else if (locZone.includes('t7') || locZone.includes('terminal 7') || locName.includes('terminal 7') || locShort.includes('t7') || locAddress.includes('terminal 7')) {
            matchedZone = 'T7';
          } else if (locZone.includes('t8') || locZone.includes('terminal 8') || locName.includes('terminal 8') || locShort.includes('t8') || locAddress.includes('terminal 8')) {
            matchedZone = 'T8';
          } else if (locZone.includes('twa') || locName.includes('twa hotel') || locShort.includes('twa') || locAddress.includes('twa')) {
            matchedZone = 'TWA';
          } else if (locZone.includes('federal circle') || locZone.includes('fed circle') || locName.includes('federal circle') || locShort.includes('federal circle') || locAddress.includes('federal circle') || locName.includes('alamo') || locName.includes('hertz') || locName.includes('enterprise') || locName.includes('national car') || locName.includes('budget') || locName.includes('avis') || locName.includes('sixt') || locName.includes('dollar')) {
            matchedZone = 'FED_CIRCLE';
          }

          if (matchedZone) {
            if (locLevel.includes('1') || locLevel.includes('ground') || locLevel.includes('arrival') || locLevel.includes('baggage') || locLevel.includes('curb') || locLevel.includes('transport') || locLevel.includes('level 1')) {
              matchedLevel = '1';
            } else if (locLevel.includes('2') || locLevel.includes('gate') || locLevel.includes('concourse') || locLevel.includes('security') || locLevel.includes('level 2')) {
              matchedLevel = '2';
            } else if (locLevel.includes('4') || locLevel.includes('retail') || locLevel.includes('parking') || locLevel.includes('level 4') || locName.includes('lounge')) {
              matchedLevel = '4';
            } else {
              matchedLevel = '3';
            }
          }
        } else {
          // MCO
          if (
            locZone.includes('airside 1') ||
            locShort.includes('gates 1-29') ||
            locName.includes('gates 1-29') ||
            locName.includes('airside 1')
          ) {
            matchedZone = 'AS1';
            matchedLevel = 'AS_GATES';
          } else if (
            locZone.includes('airside 2') ||
            locShort.includes('gates 100-129') ||
            locName.includes('gates 100-129') ||
            locName.includes('airside 2')
          ) {
            matchedZone = 'AS2';
            matchedLevel = 'AS_GATES';
          } else if (
            locZone.includes('airside 3') ||
            locShort.includes('gates 30-59') ||
            locName.includes('gates 30-59') ||
            locName.includes('airside 3')
          ) {
            matchedZone = 'AS3';
            matchedLevel = 'AS_GATES';
          } else if (
            locZone.includes('airside 4') ||
            locShort.includes('gates 70-99') ||
            locName.includes('gates 70-99') ||
            locName.includes('airside 4')
          ) {
            matchedZone = 'AS4';
            matchedLevel = 'AS_GATES';
          } else if (
            locZone.includes('terminal c') ||
            locName.includes('terminal c') ||
            locShort.includes('terminal c')
          ) {
            matchedZone = 'MAIN_C';
            if (locLevel.includes('1') || locLevel.includes('ground') || locLevel.includes('transport')) {
              matchedLevel = '1';
            } else {
              matchedLevel = '2';
            }
          } else if (
            locZone.includes('train') ||
            locName.includes('train') ||
            locShort.includes('train') ||
            locName.includes('station')
          ) {
            matchedZone = 'TRAIN';
            if (locLevel.includes('platform') || locLevel.includes('train')) {
              matchedLevel = 'TRAIN_PLATFORM';
            } else {
              matchedLevel = '1';
            }
          } else {
            matchedZone = 'MAIN_AB';
            if (locLevel.includes('tunnel') || locLevel.includes('basement') || locLevel.includes('b')) {
              matchedLevel = 'TUNNEL';
            } else if (locLevel.includes('1')) {
              matchedLevel = '1';
            } else if (locLevel.includes('2')) {
              matchedLevel = '2';
            } else if (locLevel.includes('4')) {
              matchedLevel = '4';
            } else {
              matchedLevel = '3';
            }
          }
        }

        if (matchedZone && matchedLevel) {
          setSelectedTerminalZone(matchedZone);
          setSelectedFloorLevel(matchedLevel);
        }
      } else {
        // Selection does not have x,y coords (outdoor/unmapped), reset selector to Outdoor View
        setSelectedTerminalZone('ALL');
        setSelectedFloorLevel('ALL');
      }
    }
  }, [selectedLocation, activeAirportCode, displayMode]);

  useEffect(() => {
    let active = true;
    const fetchMapAlerts = async () => {
      const data = await AlertService.getAlerts(activeAirportCode);
      const localStr = await AsyncStorage.getItem(`yofly_private_alerts:${activeAirportCode}`);
      let localAlerts: Alert[] = [];
      if (localStr) {
        try {
          const parsed: Alert[] = JSON.parse(localStr);
          const nowStr = new Date().toISOString();
          localAlerts = parsed.filter((a) => a.expiresAt > nowStr);
          if (localAlerts.length !== parsed.length) {
            await AsyncStorage.setItem(`yofly_private_alerts:${activeAirportCode}`, JSON.stringify(localAlerts));
          }
        } catch (e) {
          console.warn('Failed to parse local private alerts', e);
        }
      }
      if (active) {
        setMapAlerts(data.filter((a) => typeof a.latitude === 'number' && typeof a.longitude === 'number'));
        setPrivateAlerts(localAlerts);
      }
    };
    void fetchMapAlerts();

    const sub = AlertService.subscribeToAlerts(activeAirportCode, (newAlert) => {
      if (typeof newAlert.latitude === 'number' && typeof newAlert.longitude === 'number') {
        setMapAlerts((prev) => {
          if (prev.some((a) => a.id === newAlert.id)) return prev;
          return [newAlert, ...prev];
        });
      }
    });

    return () => {
      active = false;
      // sub automatically handles unsubscribe since it's fire-and-forget in AlertService, but typically we'd return a sub.unsubscribe()
    };
  }, [activeAirportCode]);

  const locationsForUtilityMode = useMemo(() => {
    if (utilityMode === 'SAVED') {
      return savedLocations;
    }

    if (utilityMode === 'LAYOVER') {
      return locations.filter((location) =>
        location.type === LocationType.COFFEE ||
        location.type === LocationType.RESTAURANT ||
        location.type === LocationType.GYM ||
        location.type === LocationType.GROCERY
      );
    }

    if (utilityMode === 'ROUTE') {
      return locations.filter((location) => location.isRouteSaved);
    }

    return locations;
  }, [locations, savedLocations, utilityMode]);

  const curatedLocations = useMemo(() => {
    if (curatedLayer === 'ALL') {
      return locationsForUtilityMode;
    }

    if (curatedLayer === 'COFFEE') {
      return locationsForUtilityMode.filter((location) =>
        [LocationType.COFFEE, LocationType.RESTAURANT].includes(location.type)
      );
    }

    if (curatedLayer === 'SAFE') {
      return locationsForUtilityMode.filter((location) => location.type === LocationType.SAFE_AREA);
    }

    if (curatedLayer === 'PHARMACY') {
      return locationsForUtilityMode.filter((location) => location.type === LocationType.PHARMACY);
    }

    return locationsForUtilityMode.filter((location) =>
      [LocationType.GROCERY, LocationType.PHARMACY].includes(location.type)
    );
  }, [curatedLayer, locationsForUtilityMode]);

  const airportHintLocations = useMemo(() => {
    const code = activeAirportCode.toUpperCase();
    const hintsObj = AIRPORT_DIRECTORY_HINTS[code];
    if (!hintsObj) return [];
    
    const locationsList: CrewLocation[] = [];
    Object.values(hintsObj).forEach((categoryHints) => {
      if (categoryHints) {
        categoryHints.forEach((entry) => {
          if (entry.location) {
            locationsList.push(entry.location);
          }
        });
      }
    });
    return locationsList;
  }, [activeAirportCode]);

  const mcoLocalLocations = useMemo(() => {
    if (activeAirportCode !== 'MCO') return [];
    return (mcoRealPlaces as any[]).map((place): CrewLocation => ({
      id: place.id || place.key,
      airportCode: 'MCO',
      name: place.name,
      type: place.type as LocationType,
      coordinate: {
        latitude: place.latitude,
        longitude: place.longitude,
      },
      address: place.address || '',
      rating: place.rating,
      reviewCount: place.review_count,
      isCrewFavorite: place.crew_favorite,
      source: 'airport',
      airportCore: place.airport_core,
      shortLabel: place.short_label,
      level: place.level,
      zone: place.zone,
      x: place.x,
      y: place.y,
      crewTip: place.crew_note,
    }));
  }, [activeAirportCode]);

  const categoryCounts = useMemo(() => {
    const nextCounts: Partial<Record<LocationType | 'ALL', number>> = {
      ALL: curatedLocations.length,
      [LocationType.RESTAURANT]: 0,
      [LocationType.COFFEE]: 0,
      [LocationType.GYM]: 0,
      [LocationType.GROCERY]: 0,
      [LocationType.NIGHTLIFE]: 0,
      [LocationType.SAFE_AREA]: 0,
      [LocationType.PHARMACY]: 0,
      [LocationType.LOUNGE]: 0,
    };

    curatedLocations.forEach((location) => {
      nextCounts[location.type] = (nextCounts[location.type] || 0) + 1;
    });

    return nextCounts;
  }, [curatedLocations]);
  const utilityCounts = useMemo(
    () => ({
      ALL: locations.length,
      SAVED: savedLocations.length,
      LAYOVER: locations.filter((location) =>
        [
          LocationType.COFFEE,
          LocationType.RESTAURANT,
          LocationType.GYM,
          LocationType.GROCERY,
        ].includes(location.type)
      ).length,
      ROUTE: savedRoutes.length,
    }),
    [locations, savedLocations.length, savedRoutes.length]
  );

  const filteredLocations =
    selectedType === 'ALL'
      ? curatedLocations
      : curatedLocations.filter((location) => location.type === selectedType);
  const airportCoreLocations = useMemo(() => filteredLocations.filter((location) => location.airportCore), [filteredLocations]);
  const directoryCategoryLabel =
    DIRECTORY_CATEGORIES.find((category) => category.id === selectedDirectoryCategory)?.label || 'All categories';
  const rawDirectoryEntries = useMemo(
    () => buildDirectoryEntries(activeAirportCode, selectedDirectoryCategory, airportCoreLocations, locations),
    [activeAirportCode, airportCoreLocations, locations, selectedDirectoryCategory]
  );
  const directoryEntries = useMemo(() => {
    const query = directorySearchQuery.trim().toLowerCase();

    if (!query) {
      return rawDirectoryEntries;
    }

    const coreEntry = (location: CrewLocation): DirectoryEntry => ({
      id: location.id,
      title: location.name,
      subtitle: location.address || '',
      meta: location.shortLabel || getLocationTypeLabel(location.type),
      level: location.level || (location.airportCoreKind ? 'Airport core' : undefined),
      zone: location.zone || location.shortLabel,
      crewNote: location.crewTip || location.crewIntelSummary,
      sourceLabel:
        location.source === 'places'
          ? 'Google'
          : location.source === 'crew'
            ? 'Crew'
            : location.source === 'airport'
              ? 'Airport'
              : 'Curated',
      icon:
        location.airportCoreKind === 'TERMINAL'
          ? 'business-outline'
          : location.airportCoreKind === 'GROUND' || location.airportCoreKind === 'SHUTTLE'
            ? 'bus-outline'
            : location.type === LocationType.COFFEE || location.airportCoreKind === 'COFFEE'
              ? 'cafe-outline'
              : location.type === LocationType.RESTAURANT
                ? 'restaurant-outline'
                : location.airportCoreKind === 'LOUNGE' || location.type === LocationType.LOUNGE
                  ? 'bed-outline'
                  : location.airportCoreKind === 'BAGGAGE'
                    ? 'briefcase-outline'
                    : location.airportCoreKind === 'SECURITY'
                      ? 'scan-outline'
                      : 'navigate-outline',
      location,
    });

    const allLocs = [...airportCoreLocations, ...locations, ...googleSearchResults];
    const dedupedLocations = new Map<string, CrewLocation>();
    allLocs.forEach(loc => dedupedLocations.set(loc.id, loc));

    const locEntries = Array.from(dedupedLocations.values()).map(loc => coreEntry(loc));

     const combinedEntries = [...rawDirectoryEntries];
     const seenIds = new Set(combinedEntries.map(e => e.id));
 
     // Offline MCO database search matching
     if (activeAirportCode === 'MCO') {
       const mcoQueryMatches = (mcoRealPlaces as any[])
         .filter((place) =>
           [place.name, place.address, place.level, place.zone, place.crew_note]
             .filter((val): val is string => Boolean(val))
             .some((val) => val.toLowerCase().includes(query))
         )
         .map((place): DirectoryEntry => ({
           id: place.id || place.key,
           title: place.name,
           subtitle: place.address || '',
           meta: place.short_label || 'Spot',
           level: place.level,
           zone: place.zone,
           crewNote: place.crew_note || '',
           sourceLabel: 'Curated',
           icon:
             place.type === 'SHOPPING'
               ? 'cart-outline'
               : place.type === 'RESTAURANT'
                 ? 'restaurant-outline'
                 : place.type === 'COFFEE'
                   ? 'cafe-outline'
                   : place.type === 'LOUNGE'
                     ? 'bed-outline'
                     : place.type === 'SERVICE'
                       ? 'cash-outline'
                       : 'navigate-outline',
           location: {
             id: place.id || place.key,
             airportCode: 'MCO',
             name: place.name,
             type: place.type as LocationType,
             coordinate: {
               latitude: place.latitude,
               longitude: place.longitude,
             },
             address: place.address,
             rating: place.rating,
             reviewCount: place.review_count,
             isCrewFavorite: place.crew_favorite,
             source: 'airport',
             airportCore: place.airport_core,
             shortLabel: place.short_label,
             level: place.level,
             zone: place.zone,
             x: place.x,
             y: place.y,
             crewTip: place.crew_note,
           },
         }));
 
       mcoQueryMatches.forEach(entry => {
         const isDup = seenIds.has(entry.id) || combinedEntries.some(e => isDuplicateTitle(e.title, entry.title));
         if (!isDup) {
           seenIds.add(entry.id);
           combinedEntries.push(entry);
         }
       });
     }
 
     locEntries.forEach(entry => {
       const isDup = seenIds.has(entry.id) || combinedEntries.some(e => isDuplicateTitle(e.title, entry.title));
       if (!isDup) {
         seenIds.add(entry.id);
         combinedEntries.push(entry);
       }
     });

    const filtered = combinedEntries.filter((entry) => {
      if (entry.location) {
        return matchLocationQuery(entry.location, query);
      }
      return [
        entry.title,
        entry.subtitle,
        entry.meta,
        entry.level,
        entry.zone,
        entry.crewNote,
        entry.sourceLabel,
      ]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(query));
    });

    return filtered.sort((a, b) => {
      const nameA = (a.title || '').toLowerCase();
      const nameB = (b.title || '').toLowerCase();

      // 1. Direct name starts with query
      const startsA = nameA.startsWith(query);
      const startsB = nameB.startsWith(query);
      if (startsA && !startsB) return -1;
      if (!startsA && startsB) return 1;

      // 2. Word in name starts with query
      const wordStartsA = nameA.split(/\s+/).some(word => word.startsWith(query));
      const wordStartsB = nameB.split(/\s+/).some(word => word.startsWith(query));
      if (wordStartsA && !wordStartsB) return -1;
      if (!wordStartsA && wordStartsB) return 1;

      // 3. Name contains query
      const containsA = nameA.includes(query);
      const containsB = nameB.includes(query);
      if (containsA && !containsB) return -1;
      if (!containsA && containsB) return 1;

      return 0;
    });
  }, [directorySearchQuery, rawDirectoryEntries, airportCoreLocations, locations, googleSearchResults, activeAirportCode]);
  const directorySummaryCount = useMemo(
    () =>
      buildDirectoryEntries(activeAirportCode, 'SECURITY', airportCoreLocations, locations).length +
      buildDirectoryEntries(activeAirportCode, 'FOOD', airportCoreLocations, locations).length +
      buildDirectoryEntries(activeAirportCode, 'TRANSPORT', airportCoreLocations, locations).length,
    [activeAirportCode, airportCoreLocations, locations]
  );
  const airportLegendItems = useMemo(() => {
    const labelByKind = {
      TERMINAL: 'Terminal',
      SECURITY: 'Security',
      GROUND: 'Ground transfer',
      SHUTTLE: 'Shuttle',
      LOUNGE: 'Quiet reset',
      BAGGAGE: 'Baggage',
      COFFEE: 'Coffee reset',
    } as const;

    const deduped = new Map<string, { code: string; label: string }>();

    airportCoreLocations.forEach((location) => {
      if (!location.shortLabel) {
        return;
      }

      const preferredLabel =
        location.airportCoreKind && labelByKind[location.airportCoreKind]
          ? labelByKind[location.airportCoreKind]
          : location.name;

      if (!deduped.has(location.shortLabel)) {
        deduped.set(location.shortLabel, {
          code: location.shortLabel,
          label: preferredLabel,
        });
      }
    });

    return [...deduped.values()].slice(0, 8);
  }, [airportCoreLocations]);
  const radiusLocations = useMemo(() => filteredLocations.filter((location) => !location.airportCore), [filteredLocations]);
  const directoryMarkerLocations = useMemo(() => {
    const matches = getDirectoryMarkerLocations(selectedDirectoryCategory, airportCoreLocations, locations);
    const airportCoreMatches = matches.filter((location) => location.airportCore);
    const businessMatches = matches.filter((location) => !location.airportCore);

    if (selectedDirectoryCategory === 'SECURITY') {
      return airportCoreMatches.slice(0, 3);
    }

    if (selectedDirectoryCategory === 'GATES') {
      return airportCoreMatches.slice(0, 4);
    }

    if (selectedDirectoryCategory === 'TRANSPORT') {
      return airportCoreMatches.slice(0, 4);
    }

    return [...airportCoreMatches.slice(0, 3), ...businessMatches.slice(0, 4)].slice(0, 6);
  }, [airportCoreLocations, locations, selectedDirectoryCategory]);
  const displayedLocations = useMemo(() => {
    const query = directorySearchQuery.trim().toLowerCase();

    let base = displayMode === 'AIRPORT'
      ? filteredLocations
      : (radiusLocations.length > 0 ? radiusLocations : filteredLocations);

    // 1. Filter by selected category in the directory sheet when no search query is active (only in AIRPORT mode)
    if (displayMode === 'AIRPORT' && selectedDirectoryCategory && !query) {
      base = base.filter((location) => isLocationInCategory(location, selectedDirectoryCategory));
    }

    // 2. Filter by search query (applies in both modes)
    if (query) {
      // Filter base (local db locations) using semantic taxonomy matcher
      base = base.filter((location) => matchLocationQuery(location, query));

      // Also get matching hints
      const matchingHints = airportHintLocations.filter((location) => matchLocationQuery(location, query));

      // Also get matching MCO local locations if active airport is MCO
      const matchingMcoLocs = mcoLocalLocations.filter((location) => matchLocationQuery(location, query));

      // Merge base and matching hints, avoiding duplicates by ID and duplicate title
      const localIds = new Set(base.map((l) => l.id));
      matchingHints.forEach((hint) => {
        const isDup = localIds.has(hint.id) || base.some(l => isDuplicateTitle(l.name, hint.name));
        if (!isDup) {
          localIds.add(hint.id);
          base.push(hint);
        }
      });

      // Merge MCO local locations, avoiding duplicates
      matchingMcoLocs.forEach((loc) => {
        const isDup = localIds.has(loc.id) || base.some(l => isDuplicateTitle(l.name, loc.name));
        if (!isDup) {
          localIds.add(loc.id);
          base.push(loc);
        }
      });

      // Merge with Google search results, avoiding duplicates by ID and duplicate title
      googleSearchResults.forEach((l) => {
        const isDup = localIds.has(l.id) || base.some(existing => isDuplicateTitle(existing.name, l.name));
        if (!isDup) {
          localIds.add(l.id);
          base.push(l);
        }
      });

      // Sort base by starts-with name relevance
      base = sortSearchResults(base, query);
    }

    // 2b. Filter by selected terminal zone and floor level concurrently (only when not searching or category filtering)
    if (!query && selectedDirectoryCategory === 'ALL') {
      if (activeAirportCode === 'MCO') {
        base = base.filter((location) => {
          return matchLocationToMcoLayout(location, selectedTerminalZone, selectedFloorLevel);
        });
      } else if (activeAirportCode === 'JFK') {
        base = base.filter((location) => {
          return matchLocationToJfkLayout(location, selectedTerminalZone, selectedFloorLevel);
        });
      } else if (selectedFloorLevel !== 'ALL') {
        // Fallback for non-MCO/non-JFK airports to filter by simple levels
        base = base.filter((location) => {
          const lvl = location.level || '';
          return matchLevel(lvl, selectedFloorLevel as any);
        });
      }
    }

    // 3. Distance and highlight filters for AIRPORT mode
    if (displayMode === 'AIRPORT') {
      base = base.filter((location) => {
        if (location.airportCore) {
          return true;
        }
        const distMiles = getDistanceMiles(activeAirportCenter, location.coordinate);
        return distMiles <= 1.55;
      });

      // Ensure selectedDirectoryEntry's location is always included so it's shown/highlighted
      if (selectedDirectoryEntry?.location) {
        const hasSelected = base.some((loc) => loc.id === selectedDirectoryEntry.location?.id);
        if (!hasSelected) {
          base.push(selectedDirectoryEntry.location);
        }
      }
    }

    return base;
  }, [
    activeAirportCenter,
    displayMode,
    filteredLocations,
    radiusLocations,
    selectedDirectoryEntry,
    selectedDirectoryCategory,
    directorySearchQuery,
    googleSearchResults,
    selectedTerminalZone,
    selectedFloorLevel,
    airportHintLocations,
    mcoLocalLocations,
  ]);
  const displayedSpotCount = displayedLocations.length;
  const airportCorePaths = useMemo(() => {
    if (displayMode !== 'AIRPORT') {
      return [];
    }

    if (airportCoreLocations.length < 2) {
      return airportCoreLocations.map((location) => [activeAirportCenter, location.coordinate]);
    }

    const ordered = [...airportCoreLocations].sort((left, right) => {
      const leftAngle = Math.atan2(
        left.coordinate.latitude - activeAirportCenter.latitude,
        left.coordinate.longitude - activeAirportCenter.longitude
      );
      const rightAngle = Math.atan2(
        right.coordinate.latitude - activeAirportCenter.latitude,
        right.coordinate.longitude - activeAirportCenter.longitude
      );

      return leftAngle - rightAngle;
    });

    const ringPath = ordered.map((location) => location.coordinate);
    return [
      [ringPath[ringPath.length - 1], ...ringPath],
      ...ordered.map((location) => [activeAirportCenter, location.coordinate]),
    ];
  }, [activeAirportCenter, airportCoreLocations, displayMode]);
  const recommendationLocations = useMemo(
    () => displayedLocations.slice(0, 1),
    [displayedLocations]
  );
  const utilityHighlights = useMemo(() => {
    const buildHighlight = (
      id: string,
      title: string,
      icon: keyof typeof Ionicons.glyphMap,
      types: LocationType[]
    ) => {
      const match = locations.find((location) => types.includes(location.type));
      if (!match) {
        return null;
      }

      return {
        id,
        title,
        icon,
        location: match,
        subtitle: match.name,
        detail: match.routeContext || match.bestWindow || match.recommendedFor || match.crewTip || 'Crew utility pick',
      };
    };

    return [
      buildHighlight('coffee', `Best coffee around ${activeAirportCode}`, 'cafe-outline', [
        LocationType.COFFEE,
        LocationType.RESTAURANT,
      ]),
      buildHighlight('pickup', `Crew-safe pickup near ${activeAirportCode}`, 'shield-checkmark-outline', [
        LocationType.SAFE_AREA,
      ]),
      buildHighlight('pharmacy', `Late-night pharmacy near ${activeAirportCode}`, 'medkit-outline', [
        LocationType.PHARMACY,
        LocationType.GROCERY,
      ]),
    ].filter((item): item is NonNullable<typeof item> => Boolean(item)).slice(0, 2);
  }, [activeAirportCode, locations]);
  const emptyLocationMessage =
    utilityMode === 'SAVED'
      ? `No saved crew spots yet for ${activeAirportCode}.`
      : utilityMode === 'ROUTE'
        ? `No saved crew routes yet for ${activeAirportCode}. Save one from a location card.`
      : displayMode === 'AIRPORT'
        ? `No airport-core markers are loaded for ${activeAirportCode} yet.`
      : selectedType === 'ALL'
        ? `No nearby crew spots are loaded for ${activeAirportCode} yet.`
        : `No ${selectedType.toLowerCase().replace('_', ' ')} spots are loaded near ${activeAirportCode} yet.`;

  const getMarkerIcon = (location: CrewLocation) => {
    if (location.airportCore) {
      switch (location.airportCoreKind) {
        case 'TERMINAL':
          return 'business';
        case 'SECURITY':
          return 'scan';
        case 'GROUND':
          return 'swap-horizontal';
        case 'SHUTTLE':
          return 'bus';
        case 'LOUNGE':
          return 'bed';
        case 'BAGGAGE':
          return 'briefcase';
        case 'COFFEE':
          return 'cafe';
        default:
          return 'airplane';
      }
    }

    switch (location.type) {
      case LocationType.RESTAURANT:
        return 'restaurant';
      case LocationType.COFFEE:
        return 'cafe';
      case LocationType.GYM:
        return 'fitness';
      case LocationType.GROCERY:
        return 'cart';
      case LocationType.PHARMACY:
        return 'medkit';
      case LocationType.SAFE_AREA:
        return 'shield-checkmark';
      case LocationType.NIGHTLIFE:
        return 'wine';
      case LocationType.LOUNGE:
        return 'bed';
      case LocationType.SHOPPING:
        return 'cart';
      case LocationType.SERVICE:
        return 'cash';
      default:
        return 'location';
    }
  };

  const handleToggleSaved = async (location: CrewLocation) => {
    const nextSavedLocations = await SavedLocationsService.toggleSavedLocation(activeAirportCode, location);
    const savedIds = new Set(nextSavedLocations.map((item) => item.id));

    setSavedLocations(nextSavedLocations.map((item) => ({ ...item, isSaved: true })));
    setLocations((current) =>
      current.map((item) =>
        item.id === location.id
          ? { ...item, isSaved: savedIds.has(item.id) }
          : { ...item, isSaved: savedIds.has(item.id) }
      )
    );
    setSelectedLocation((current) =>
      current && current.id === location.id
        ? { ...current, isSaved: savedIds.has(location.id) }
        : current
    );
  };

  const handleSelectAirport = (airportCode: string) => {
    const normalizedAirportCode = airportCode.toUpperCase();
    const nextAirportCenter = getAirportCoordinates(normalizedAirportCode) || activeAirportCenter;
    didManuallySelectMapAirport.current = true;
    setMapAirportCode(normalizedAirportCode);
    setSelectedLocation(null);
    setIsUtilityPanelVisible(false);
    setIsAirportPanelExpanded(false);
    setIsLayerPanelExpanded(false);
    setIsDirectoryExpanded(false);

    // Set appropriate defaults for the terminal selector depending on the airport
    if (normalizedAirportCode === 'MCO') {
      setSelectedTerminalZone('MAIN_AB');
      setSelectedFloorLevel('3');
    } else if (normalizedAirportCode === 'JFK') {
      setSelectedTerminalZone('T4');
      setSelectedFloorLevel('3'); // T4 Level 3 Departures
    } else {
      setSelectedTerminalZone('ALL');
      setSelectedFloorLevel('ALL');
    }

    focusMap(nextAirportCenter, displayMode === 'AIRPORT' ? HUB_DELTA : RADIUS_DELTA);
  };

  const handleFocusBaseAirport = () => {
    const baseAirportCode = normalizeAirportCode(profile.baseAirport) || profileActiveAirportCode;
    handleSelectAirport(baseAirportCode);
    didManuallySelectMapAirport.current = false;
  };

  const handleFocusNearbyAirport = () => {
    if (!detectedAirport) {
      return;
    }

    handleSelectAirport(detectedAirport.code);
  };

  const handleSelectDisplayMode = (mode: MapDisplayMode) => {
    setDisplayMode(mode);
    setSelectedLocation(null);
    setIsUtilityPanelVisible(false);
    setIsPlaceIntelModalVisible(false);
    setIsAddPlaceModalVisible(false);
    setUtilityMode('ALL');
    setCuratedLayer('ALL');
    setSelectedType('ALL');
    focusMap(activeAirportCenter, mode === 'AIRPORT' ? HUB_DELTA : RADIUS_DELTA);
  };

  const handleSelectUtilityMode = (mode: UtilityMode) => {
    setUtilityMode(mode);
    setSelectedType('ALL');
    if (mode === 'ROUTE') {
      setCuratedLayer('ALL');
    }
  };

  const hydrateGooglePlace = async (location: CrewLocation) => {
    if (location.source !== 'places' || !location.googlePlaceId) {
      return location;
    }

    const detailedLocation = await LocationService.getGooglePlaceDetails({
      airportCode: activeAirportCode,
      placeId: location.googlePlaceId,
      name: location.name,
      coordinate: location.coordinate,
    });

    if (!detailedLocation) {
      return location;
    }

    const annotatedLocation = await MapPlaceIntelService.annotateLocation({
      ...location,
      ...detailedLocation,
      isSaved: location.isSaved,
      isRouteSaved: location.isRouteSaved,
    });

    setLocations((current) =>
      current.map((item) => (item.id === location.id ? annotatedLocation : item))
    );

    return annotatedLocation;
  };

  const handleSelectLocation = async (location: CrewLocation | null, shouldFocus = false) => {
    setIsUtilityPanelVisible(false);
    setIsPlaceIntelModalVisible(false);
    setIsAddPlaceModalVisible(false);
    setIsAirportPanelExpanded(false);
    setIsLayerPanelExpanded(false);
    setSelectedLocation(location);

    if (!location) {
      return;
    }

    // Automatically switch SVG map terminal and floor for MCO locations
    if (activeAirportCode === 'MCO') {
      const locZone = (location.zone || '').trim().toUpperCase();
      const locLevel = (location.level || '').trim().toUpperCase();
      const locName = (location.name || '').trim().toUpperCase();
      const locAddress = (location.address || '').trim().toUpperCase();

      let targetZone = selectedTerminalZone;
      let targetLevel = selectedFloorLevel;

      if (locZone.includes('AIRSIDE 1') || locLevel.includes('1-29') || locAddress.includes('AIRSIDE 1')) {
        targetZone = 'AS1';
        targetLevel = 'AS_GATES';
      } else if (locZone.includes('AIRSIDE 2') || locLevel.includes('100-129') || locAddress.includes('AIRSIDE 2')) {
        targetZone = 'AS2';
        targetLevel = 'AS_GATES';
      } else if (locZone.includes('AIRSIDE 3') || locLevel.includes('30-59') || locAddress.includes('AIRSIDE 3')) {
        targetZone = 'AS3';
        targetLevel = 'AS_GATES';
      } else if (locZone.includes('AIRSIDE 4') || locLevel.includes('70-99') || locAddress.includes('AIRSIDE 4')) {
        targetZone = 'AS4';
        targetLevel = 'AS_GATES';
      } else if (locZone.includes('TERMINAL C') || locAddress.includes('TERMINAL C')) {
        targetZone = 'MAIN_C';
        if (locLevel.includes('1')) {
          targetLevel = '1';
        } else {
          targetLevel = '2';
        }
      } else if (locZone.includes('TRAIN') || locName.includes('TRAIN') || locAddress.includes('TRAIN')) {
        targetZone = 'TRAIN';
        if (locLevel.includes('PLATFORM') || locLevel.includes('2') || locName.includes('PLATFORM')) {
          targetLevel = 'TRAIN_PLATFORM';
        } else {
          targetLevel = '1';
        }
      } else if (locZone.includes('MAIN') || locAddress.includes('MAIN') || locLevel.includes('LEVEL') || locLevel.includes('TUNNEL') || locLevel.includes('B')) {
        // Main Terminal A/B
        targetZone = 'MAIN_AB';
        if (locLevel.includes('TUNNEL') || locLevel.includes('B')) {
          targetLevel = 'TUNNEL';
        } else if (locLevel.includes('1')) {
          targetLevel = '1';
        } else if (locLevel.includes('2')) {
          targetLevel = '2';
        } else if (locLevel.includes('4')) {
          targetLevel = '4';
        } else {
          targetLevel = '3';
        }
      }

      if (targetZone !== selectedTerminalZone || targetLevel !== selectedFloorLevel) {
        setSelectedTerminalZone(targetZone);
        setSelectedFloorLevel(targetLevel);
      }
    }

    if (shouldFocus) {
      focusMap(location.coordinate, DETAIL_DELTA);
    }

    if (location.source !== 'places' || !location.googlePlaceId) {
      return;
    }

    setIsPoiLoading(true);
    try {
      const hydratedLocation = await hydrateGooglePlace(location);
      setSelectedLocation(hydratedLocation);
    } finally {
      setIsPoiLoading(false);
    }
  };

  const handleSelectRecommendation = (location: CrewLocation) => {
    void handleSelectLocation(location, true);
  };

  const handleSelectDirectoryEntry = (entry: DirectoryEntry) => {
    setIsUtilityPanelVisible(false);
    setIsPlaceIntelModalVisible(false);
    setIsAddPlaceModalVisible(false);
    setIsAirportPanelExpanded(false);
    setIsLayerPanelExpanded(false);
    setIsDirectoryExpanded(true);
    setSelectedDirectoryEntry(entry);

    if (entry.location) {
      void handleSelectLocation(entry.location, true);
      return;
    }

    setSelectedLocation(null);
    focusMap(
      {
        latitude: activeAirportCenter.latitude - (DIRECTORY_DELTA.latitudeDelta * 0.22),
        longitude: activeAirportCenter.longitude,
      },
      DIRECTORY_DELTA
    );
  };

  const handleRefreshDirectoryBusinesses = () => {
    setIsDirectoryExpanded(true);
    setSelectedDirectoryCategory((current) =>
      DIRECTORY_BUSINESS_CATEGORIES.includes(current) ? current : 'FOOD'
    );
    void loadLocations(activeAirportCenter, true, true);
  };

  const handleToggleRoute = async (location: CrewLocation) => {
    const nextSavedRoutes = await SavedRoutesService.toggleSavedRoute(activeAirportCode, location);
    const routeIds = new Set(nextSavedRoutes.map((route) => route.locationId));
    setSavedRoutes(nextSavedRoutes);
    setLocations((current) =>
      current.map((item) => ({
        ...item,
        isRouteSaved: routeIds.has(item.id),
      }))
    );
    setSelectedLocation((current) =>
      current && current.id === location.id
        ? { ...current, isRouteSaved: routeIds.has(location.id) }
        : current
    );
  };

  const handleSelectSavedRoute = (route: CrewSavedRoute) => {
    const matchingLocation = locations.find((location) => location.id === route.locationId);
    if (matchingLocation) {
      void handleSelectLocation(matchingLocation, true);
      return;
    }

    focusMap(route.coordinate, DETAIL_DELTA);
  };

  const formatSavedRouteDate = (savedAt: string) => {
    const parsed = new Date(savedAt);
    if (Number.isNaN(parsed.getTime())) {
      return 'Saved route';
    }

    return `Saved ${parsed.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  };

  const promptOpenNativeMaps = (name: string, coordinate: Coordinates) => {
    const label = encodeURIComponent(name);
    const url = Platform.OS === 'ios'
      ? `maps://?q=${label}&ll=${coordinate.latitude},${coordinate.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${label}`;

    RNAlert.alert(
      name,
      "Would you like to open this spot in your device's native Maps app to view detailed reviews, photos, directories, and hours?",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Maps',
          onPress: async () => {
            try {
              await Linking.openURL(url);
            } catch (e) {
              RNAlert.alert('Error', 'Unable to open maps application.');
            }
          }
        }
      ]
    );
  };

  const openNativeMapsDirectly = (name: string, coordinate: Coordinates) => {
    const cleanName = name.trim();
    const isGenericSpot =
      !cleanName ||
      cleanName.toLowerCase().includes('map spot') ||
      cleanName.toLowerCase().includes('coordinate') ||
      cleanName.toLowerCase().includes('selected location');

    let url = '';
    if (Platform.OS === 'ios') {
      if (isGenericSpot) {
        // Drop a pin with the directions button so the user can navigate to the exact coordinate
        url = `maps://?ll=${coordinate.latitude},${coordinate.longitude}&q=${encodeURIComponent(cleanName || 'Crew Spot')}`;
      } else {
        // Clean up descriptors like "- Level 2" or "(Terminal 4)" to ensure Apple Maps matches the brand
        const cleanParts = cleanName.split(/\s+[\-\(:]\s*/);
        const searchQuery = encodeURIComponent(cleanParts[0]?.trim() || cleanName);
        url = `maps://?q=${searchQuery}&sll=${coordinate.latitude},${coordinate.longitude}&z=18`;
      }
    } else {
      if (isGenericSpot) {
        url = `https://www.google.com/maps/search/?api=1&query=${coordinate.latitude},${coordinate.longitude}`;
      } else {
        const cleanParts = cleanName.split(/\s+[\-\(:]\s*/);
        const searchQuery = encodeURIComponent(cleanParts[0]?.trim() || cleanName);
        url = `https://www.google.com/maps/search/?api=1&query=${searchQuery}`;
      }
    }

    Linking.openURL(url).catch(() => {
      RNAlert.alert('Error', 'Unable to open Maps application.');
    });
  };

  const formatDistance = (meters: number) => {
    const feet = meters * 3.28084;
    if (feet >= 528) {
      const miles = feet / 5280;
      return `${miles.toFixed(1)} mi`;
    }
    return `${Math.round(feet)} ft`;
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.round(seconds / 60);
    if (minutes < 1) {
      return '< 1 min';
    }
    return `${minutes} min`;
  };

  const getNavDirectionIcon = (modifier?: string): keyof typeof Ionicons.glyphMap => {
    if (!modifier) return 'arrow-up-outline';
    const mod = modifier.toLowerCase();
    if (mod.includes('elevator') || mod.includes('stairs') || mod.includes('escalator') || mod.includes('level')) return 'swap-vertical-outline';
    if (mod.includes('left')) return 'arrow-back-outline';
    if (mod.includes('right')) return 'arrow-forward-outline';
    if (mod.includes('straight')) return 'arrow-up-outline';
    if (mod.includes('arrive')) return 'flag-outline';
    if (mod.includes('depart')) return 'navigate-outline';
    return 'arrow-up-outline';
  };

  const startInAppNavigation = async (destinationName: string, destCoords: Coordinates) => {
    if (!userLocation) {
      RNAlert.alert('Location Unavailable', 'Cannot start navigation without GPS signal.');
      return;
    }

    const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
    if (!token) {
      RNAlert.alert('Configuration Error', 'Mapbox access token is missing.');
      return;
    }

    try {
      setIsPoiLoading(true);
      const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${userLocation.longitude},${userLocation.latitude};${destCoords.longitude},${destCoords.latitude}?geometries=geojson&steps=true&access_token=${token}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch route details from Mapbox.');
      }
      
      const data = await response.json();
      if (!data.routes || data.routes.length === 0) {
        throw new Error('No walking route found to this location.');
      }

      const route = data.routes[0];
      const geometry = route.geometry.coordinates; // Array of [longitude, latitude]
      const steps = route.legs[0].steps; // Array of maneuver steps
      
      // Vertical floor level change directions logic
      const findNearestVerticalTransit = (userCoords: Coordinates) => {
        let nearest: CrewLocation | null = null;
        let minDistance = Infinity;
        
        for (const loc of locations) {
          const name = (loc.name || '').toLowerCase();
          const short = (loc.shortLabel || '').toLowerCase();
          const address = (loc.address || '').toLowerCase();
          
          const isVerticalTransit = 
            name.includes('elevator') || name.includes('stairs') || name.includes('escalator') ||
            short.includes('elevator') || short.includes('stairs') || short.includes('escalator') ||
            address.includes('elevator') || address.includes('stairs') || address.includes('escalator');
            
          if (isVerticalTransit) {
            const dist = getDistanceMiles(userCoords, loc.coordinate);
            if (dist < minDistance) {
              minDistance = dist;
              nearest = loc;
            }
          }
        }
        return nearest;
      };

      const destinationLocation = selectedLocation && 
        selectedLocation.coordinate.latitude === destCoords.latitude && 
        selectedLocation.coordinate.longitude === destCoords.longitude
          ? selectedLocation
          : locations.find(loc => 
              loc.coordinate.latitude === destCoords.latitude && 
              loc.coordinate.longitude === destCoords.longitude
            );

      let needsLevelChange = false;
      let targetLevelName = '';
      
      if (selectedFloorLevel && selectedFloorLevel !== 'ALL' && destinationLocation?.level) {
        const destLevelStr = destinationLocation.level.toLowerCase();
        const currentLevelStr = selectedFloorLevel.toLowerCase();
        
        const getNormalizedLevelKey = (lvl: string) => {
          if (lvl.includes('3')) return '3';
          if (lvl.includes('2') || lvl.includes('arrival') || lvl.includes('baggage')) return '2';
          if (lvl.includes('1') || lvl.includes('ground') || lvl.includes('transport') || lvl.includes('shuttle')) return '1';
          if (lvl.includes('4') || lvl.includes('hyatt')) return '4';
          if (lvl.includes('tunnel') || lvl.includes('b') || lvl.includes('basement')) return 'B';
          if (lvl.includes('platform')) return 'TRAIN_PLATFORM';
          if (lvl.includes('gate') || lvl.includes('concourse')) return 'AS_GATES';
          return lvl;
        };
        
        const normDest = getNormalizedLevelKey(destLevelStr);
        const normCurrent = getNormalizedLevelKey(currentLevelStr);
        
        if (normDest !== normCurrent) {
          needsLevelChange = true;
          if (normDest === '3') targetLevelName = 'Level 3 (Departures/Dining)';
          else if (normDest === '2') targetLevelName = 'Level 2 (Arrivals/Baggage)';
          else if (normDest === '1') targetLevelName = 'Level 1 (Ground Transportation)';
          else if (normDest === '4') targetLevelName = 'Level 4 (Hyatt/Parking)';
          else if (normDest === 'B') targetLevelName = 'the Tunnel/Lower Level';
          else if (normDest === 'TRAIN_PLATFORM') targetLevelName = 'the Train Platform';
          else if (normDest === 'AS_GATES') targetLevelName = 'Airside Gates';
          else targetLevelName = destinationLocation.level;
        }
      }

      if (needsLevelChange) {
        let verticalTransitCoords = userLocation;
        const nearestVT = findNearestVerticalTransit(userLocation);
        if (nearestVT) {
          verticalTransitCoords = nearestVT.coordinate;
        }
        
        const distanceToVT = getDistanceMiles(userLocation, verticalTransitCoords) * 1609.34; // meters
        const durationToVT = distanceToVT / 1.4; // seconds
        
        const customStep = {
          maneuver: {
            modifier: 'elevator',
            instruction: `Take the nearest elevator, escalator, or stairs to ${targetLevelName} for ${destinationName}`,
            type: 'level_change',
            location: [verticalTransitCoords.longitude, verticalTransitCoords.latitude],
          },
          distance: distanceToVT > 0 ? distanceToVT : 15,
          duration: durationToVT > 0 ? durationToVT : 30,
        };
        steps.unshift(customStep);
        
        route.distance += customStep.distance;
        route.duration += customStep.duration;
      }
      
      setNavigationRouteGeometry(geometry);
      setNavigationSteps(steps);
      setCurrentNavStepIndex(0);
      currentNavStepIndexRef.current = 0;
      navigationStepsRef.current = steps;
      
      setNavDistanceRemaining(route.distance);
      setNavDurationRemaining(route.duration);
      
      setNavigationDestination(destinationLocation || {
        id: 'temp-dest-' + Date.now(),
        name: destinationName,
        coordinate: destCoords,
        type: LocationType.SAFE_AREA,
        airportCode: activeAirportCode,
        rating: 0,
        reviewCount: 0,
        isCrewFavorite: false,
        address: '',
        source: 'fallback',
      });
      
      setIsNavigating(true);
      isNavigatingRef.current = true;
      
      // Close overlapping views
      setIsDirectoryExpanded(false);
      setIsUtilityPanelVisible(false);
      setDirectorySearchQuery(''); // clear search input and results to clean up bottom view
      setSelectedLocation(null); // dismiss card to show navigation map clearly
      
      // Focus map on start coordinate with deep zoom
      focusMap(userLocation, NAVIGATION_DELTA);
    } catch (error: any) {
      console.warn('Navigation route fetching failed:', error);
      RNAlert.alert('Routing Failed', error?.message || 'Could not fetch directions.');
    } finally {
      setIsPoiLoading(false);
    }
  };

  const stopInAppNavigation = () => {
    setIsNavigating(false);
    isNavigatingRef.current = false;
    setNavigationDestination(null);
    setNavigationRouteGeometry(null);
    setNavigationSteps([]);
    navigationStepsRef.current = [];
    setCurrentNavStepIndex(0);
    currentNavStepIndexRef.current = 0;
    setNavDistanceRemaining(0);
    setNavDurationRemaining(0);
  };

  const handleNavigationPress = (location: CrewLocation) => {
    RNAlert.alert(
      'Navigate to ' + location.name,
      'Choose navigation option:',
      [
        {
          text: '🌐 Start In-App Walk Guidance',
          onPress: () => void startInAppNavigation(location.name, location.coordinate),
        },
        {
          text: '🗺️ Open in Apple Maps',
          onPress: () => openNativeMapsDirectly(location.name, location.coordinate),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleSelectPoi = async (poi: { placeId: string; name: string; coordinate: Coordinates }) => {
    const poiId = poi.placeId || `poi-${poi.coordinate.latitude.toFixed(6)}-${poi.coordinate.longitude.toFixed(6)}`;
    const existing = locations.find(loc => loc.id === poiId);
    
    let targetLocation: CrewLocation;

    if (existing) {
      targetLocation = existing;
    } else {
      targetLocation = {
        id: poiId,
        name: poi.name,
        type: LocationType.RESTAURANT,
        coordinate: poi.coordinate,
        airportCode: activeAirportCode,
        airportCore: false,
        source: 'places',
        googlePlaceId: poi.placeId || undefined,
        isRouteSaved: false,
        rating: 0,
        reviewCount: 0,
        isCrewFavorite: false,
        address: '',
      };

      setLocations((current) => [...current, targetLocation]);
    }

    void handleSelectLocation(targetLocation, true);
  };

  const handleSelectMapPoint = async (coordinate: Coordinates, position?: { x: number; y: number }) => {
    if (isAdjustingAlertPin) {
      setTempAlertCoordinate(coordinate);
      return;
    }

    if (isDirectoryExpanded || isAirportPanelExpanded || isLayerPanelExpanded || isUtilityPanelVisible) {
      setIsDirectoryExpanded(false);
      setIsAirportPanelExpanded(false);
      setIsLayerPanelExpanded(false);
      setIsUtilityPanelVisible(false);
      return;
    }

    if (position) {
      // Top header region containing airport switcher and quick controls
      const headerThreshold = hubTop + 130;
      if (position.y < headerThreshold) {
        return;
      }

      // Bottom region containing legend card, tab bar, zoom buttons, or selected preview card
      const bottomOffset = selectedLocation ? 320 : 120;
      if (position.y > height - bottomOffset) {
        return;
      }
    }

    if (userLocation) {
      const distToUser = getDistanceMiles(coordinate, userLocation);
      if (distToUser <= 0.015) {
        return;
      }
    }

    const nearestLoadedLocation = locations
      .filter((loc) => {
        const isSelected = selectedLocation?.id === loc.id;
        const isCustomUserMarker = loc.source === 'crew';
        if (isSelected) return true;
        if (!isCustomUserMarker) return false;
        
        if (activeAirportCode === 'MCO') {
          return matchLocationToMcoLayout(loc, selectedTerminalZone, selectedFloorLevel);
        } else if (activeAirportCode === 'JFK') {
          return matchLocationToJfkLayout(loc, selectedTerminalZone, selectedFloorLevel);
        } else if (selectedFloorLevel !== 'ALL') {
          const lvl = loc.level || '';
          return matchLevel(lvl, selectedFloorLevel as any);
        }
        return true;
      })
      .map((location) => ({
        location,
        distanceMiles: getDistanceMiles(coordinate, location.coordinate),
      }))
      .filter((item) => item.distanceMiles <= 0.008)
      .sort((left, right) => left.distanceMiles - right.distanceMiles)[0]?.location;

    if (nearestLoadedLocation) {
      void handleSelectLocation(nearestLoadedLocation);
      return;
    }

    setIsPoiLoading(true);
    setSelectedLocation(null);
    setIsUtilityPanelVisible(false);
    setIsPlaceIntelModalVisible(false);
    setIsAddPlaceModalVisible(false);

    try {
      let poiLocation = await LocationService.getGooglePlaceFromMapTap({
        airportCode: activeAirportCode,
        coordinate,
      });

      if (!poiLocation) {
        poiLocation = {
          id: `tap-${coordinate.latitude.toFixed(6)}-${coordinate.longitude.toFixed(6)}`,
          name: 'Map Spot',
          type: LocationType.SERVICE,
          coordinate,
          airportCode: activeAirportCode,
          airportCore: false,
          source: 'places',
          isRouteSaved: false,
          rating: 0,
          reviewCount: 0,
          isCrewFavorite: false,
          address: `${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}`,
          level: selectedFloorLevel,
        };
      } else if (!poiLocation.level) {
        poiLocation.level = selectedFloorLevel;
      }

      const annotatedPoi = await MapPlaceIntelService.annotateLocation(poiLocation);
      
      setLocations((current) => {
        if (current.some((loc) => loc.id === annotatedPoi.id)) {
          return current;
        }
        return [...current, annotatedPoi];
      });

      setSelectedLocation(annotatedPoi);
    } finally {
      setIsPoiLoading(false);
    }
  };

  const handleAddCrewInfo = async (payload: { note: string; deal?: string }) => {
    if (!selectedLocation) {
      return;
    }

    await MapPlaceIntelService.addNote(selectedLocation, payload);
    const annotatedLocation = await MapPlaceIntelService.annotateLocation(selectedLocation);

    setSelectedLocation(annotatedLocation);
    setLocations((current) =>
      current.map((location) => (location.id === annotatedLocation.id ? annotatedLocation : location))
    );
  };

  const handleCreateCustomPlace = async (payload: {
    name: string;
    type: LocationType;
    level?: string;
    zone?: string;
    note?: string;
  }) => {
    if (!selectedLocation) {
      return;
    }

    const newLocation = await LocationService.addCustomLocation({
      name: payload.name,
      type: payload.type,
      coordinate: selectedLocation.coordinate,
      address: selectedLocation.address,
      level: payload.level,
      zone: payload.zone,
    });

    if (payload.note && payload.note.trim()) {
      await MapPlaceIntelService.addNote(newLocation, {
        note: payload.note,
      });
    }

    const annotated = await MapPlaceIntelService.annotateLocation(newLocation);

    setLocations((current) => {
      const filtered = current.filter((loc) => loc.id !== selectedLocation.id);
      return [...filtered, annotated];
    });
    setSelectedLocation(annotated);
    RNAlert.alert('Success', `${payload.name} has been added to the crew directory!`);
  };

  const handleDeletePrivateAlert = async (id: string) => {
    try {
      const localStr = await AsyncStorage.getItem(`yofly_private_alerts:${activeAirportCode}`);
      if (localStr) {
        const parsed: Alert[] = JSON.parse(localStr);
        const filtered = parsed.filter((a) => a.id !== id);
        await AsyncStorage.setItem(`yofly_private_alerts:${activeAirportCode}`, JSON.stringify(filtered));
        setPrivateAlerts(filtered);
        RNAlert.alert('Success', 'Private note deleted.');
      }
    } catch (e) {
      console.warn('Failed to delete private alert', e);
      RNAlert.alert('Error', 'Failed to delete the private note.');
    }
  };

  const handleAlertPress = (alert: Alert) => {
    const timeStr = new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const typeLabel = alert.type.replace('_', ' ');
    const visibilityStr = alert.isPrivate ? '🔒 Private Note' : '👥 Public Crew Intel';
    
    RNAlert.alert(
      `${alert.title}`,
      `${alert.message}\n\nCategory: ${typeLabel}\nReported at: ${timeStr}\nScope: ${visibilityStr}`,
      alert.isPrivate 
        ? [
            { text: 'OK', style: 'cancel' },
            { 
              text: 'Delete Note', 
              style: 'destructive',
              onPress: () => handleDeletePrivateAlert(alert.id)
            }
          ]
        : [{ text: 'OK', style: 'cancel' }]
    );
  };

  return (
    <View style={styles.container}>

      {locationError && !isDirectoryExpanded && (
        <View style={[styles.locationBanner, { top: safeTop }]}>
          <Ionicons name="locate-outline" size={16} color={theme.colors.background} />
          <Text style={styles.locationBannerText}>{locationError}</Text>
        </View>
      )}

      <CrewMap
        activeAirportCode={activeAirportCode}
        activeAirportName={activeAirportName}
        alerts={[...mapAlerts, ...privateAlerts]}
        tempAlertCoordinate={tempAlertCoordinate}
        onTempAlertCoordinateChange={setTempAlertCoordinate}
        onAlertPress={handleAlertPress}
        center={activeAirportCenter}
        focusCoordinates={mapFocusCoordinates}
        focusDelta={mapFocusDelta}
        focusRevision={mapFocusRevision}
        airportCorePaths={airportCorePaths}
        getMarkerIcon={getMarkerIcon}
        height={height}
        isDark={isDark}
        locations={displayedLocations}
        mapMode={displayMode}
        activeBlueprintOverlay={null}
        savedRoutes={savedRoutes}
        selectedLocationId={selectedLocation?.id || selectedDirectoryEntry?.id}
        selectedLocationCoordinate={selectedLocation?.coordinate}
        onMapPress={handleSelectMapPoint}
        onLegendPress={() => setIsDirectoryExpanded(true)}
        onSelectLocation={(location) => void handleSelectLocation(location)}
        onCalloutPress={(location) => handleNavigationPress(location)}
        onSelectPoi={handleSelectPoi}
        theme={theme}
        userLocation={userLocation}
        width={width}
        tabBarHeight={tabBarHeight}
        userProfile={{
          fullName: profile.fullName,
          avatarUri: profile.avatarUri,
          roleLabel: profile.roleLabel,
          airline: profile.airline,
          aircraft: profile.aircraft
        }}
        onMePress={() => router.push('/profile')}
        showLegend={false}
        selectedTerminalZone={selectedTerminalZone}
        selectedFloorLevel={selectedFloorLevel}
        navigationRouteGeometry={navigationRouteGeometry}
      />

      {/* Dark overlay scrim disabled per crew feedback to keep map visible */}

      {isNavigating && navigationSteps.length > 0 ? (
        (() => {
          const currentStep = navigationSteps[currentNavStepIndex];
          const modifier = currentStep?.maneuver?.modifier;
          const instruction = currentStep?.maneuver?.instruction || 'Continue walking along route';
          const stepMeters = currentStep?.distance || 0;
          const totalSteps = navigationSteps.length;
          const percentComplete = totalSteps > 0 ? (currentNavStepIndex / totalSteps) * 100 : 0;
          
          return (
            <View style={[styles.navigationOverlay, { top: safeTop }]}>
              <View style={styles.navCard}>
                <View style={styles.navMainRow}>
                  <View style={styles.navIconBadge}>
                    <Ionicons 
                      name={getNavDirectionIcon(modifier)} 
                      size={20} 
                      color={theme.colors.background} 
                    />
                  </View>
                  <View style={styles.navInstructionContainer}>
                    <Text style={styles.navInstructionText} numberOfLines={2}>
                      {instruction}
                    </Text>
                    <Text style={styles.navStepDistanceText}>
                      For {formatDistance(stepMeters)}
                    </Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.navEndButton}
                    onPress={stopInAppNavigation}
                  >
                    <Ionicons name="close" size={18} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.navFooterRow}>
                  <Text style={styles.navSummaryText}>
                    {formatDuration(navDurationRemaining)} ({formatDistance(navDistanceRemaining)}) remaining
                  </Text>
                  <View style={styles.navProgressBarBackground}>
                    <View style={[styles.navProgressBarFill, { width: `${percentComplete}%` }]} />
                  </View>
                </View>
              </View>
            </View>
          );
        })()
      ) : !isDirectoryExpanded ? (
        <View style={[styles.mapTopDock, { top: hubTop }]}>
          <TouchableOpacity
            style={styles.hubSummaryButton}
            onPress={() => {
              setIsAirportPanelExpanded((current) => {
                if (!current) setIsDirectoryExpanded(false);
                return !current;
              });
            }}
          >
            <View style={styles.hubBadgeCodeWrap}>
              <Text style={styles.hubBadgeCode}>{activeAirportCode}</Text>
            </View>
            <View style={styles.hubBadgeCopy}>
              <Text style={styles.hubBadgeEyebrow}>
                {detectedAirport?.code === activeAirportCode ? 'Near You' : 'Active Hub'}
              </Text>
              <Text style={styles.hubBadgeName} numberOfLines={1}>
                {activeAirportName}
              </Text>
            </View>
            <Ionicons
              name={isAirportPanelExpanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={theme.colors.accent}
            />
          </TouchableOpacity>
        </View>
      ) : null}


      {isAirportPanelExpanded ? (
        <View style={[styles.expandedMapPanel, { top: expandedPanelTop }]}>
          <TouchableOpacity
            style={[
              styles.detectedAirportCard,
              profileActiveAirportCode === activeAirportCode && styles.detectedAirportCardActive,
            ]}
            onPress={handleFocusBaseAirport}
          >
            <View style={styles.detectedAirportIcon}>
              <Ionicons name="home" size={15} color={theme.colors.background} />
            </View>
            <View style={styles.detectedAirportCopy}>
              <Text style={styles.detectedAirportLabel}>Base hub</Text>
              <Text style={styles.detectedAirportName} numberOfLines={1}>
                {profileActiveAirportCode} - {getAirportDisplayName(profileActiveAirportCode)}
              </Text>
            </View>
            {profileActiveAirportCode === activeAirportCode ? (
              <Ionicons name="checkmark-circle" size={18} color={theme.colors.accent} />
            ) : null}
          </TouchableOpacity>
          {detectedAirport ? (
            <TouchableOpacity
              style={[
                styles.detectedAirportCard,
                detectedAirport.code === activeAirportCode && styles.detectedAirportCardActive,
              ]}
              onPress={handleFocusNearbyAirport}
            >
              <View style={styles.detectedAirportIcon}>
                <Ionicons name="navigate" size={15} color={theme.colors.background} />
              </View>
              <View style={styles.detectedAirportCopy}>
                <Text style={styles.detectedAirportLabel}>Closest airport</Text>
                <Text style={styles.detectedAirportName} numberOfLines={1}>
                  {detectedAirport.code} - {detectedAirport.name}
                </Text>
              </View>
              <Text style={styles.detectedAirportDistance}>{detectedAirport.distanceMiles.toFixed(1)} mi</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.airportSearchDivider} />
          
          <View style={styles.airportSearchContainer}>
            <Ionicons name="search" size={14} color={theme.colors.textMuted} style={styles.airportSearchIcon} />
            <TextInput
              style={styles.airportSearchInput}
              placeholder="Search other airports..."
              placeholderTextColor={theme.colors.textMuted}
              value={airportSearchText}
              onChangeText={setAirportSearchText}
              autoCapitalize="characters"
              clearButtonMode="while-editing"
            />
          </View>

          {airportSearchText.length > 0 && (
            <ScrollView 
              style={styles.airportSearchResults}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
            >
              {searchedAirports.map((airport) => (
                <TouchableOpacity
                  key={airport.code}
                  style={styles.airportSearchResultItem}
                  onPress={() => {
                    handleSelectAirport(airport.code);
                    setAirportSearchText('');
                    Keyboard.dismiss();
                  }}
                >
                  <Ionicons name="airplane-outline" size={14} color={theme.colors.accent} />
                  <Text style={styles.airportSearchResultCode}>{airport.code}</Text>
                  <Text style={styles.airportSearchResultName} numberOfLines={1}>
                    {airport.name}
                  </Text>
                </TouchableOpacity>
              ))}
              {searchedAirports.length === 0 && (
                <View style={{ padding: 12, alignItems: 'center' }}>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: '700' }}>
                    No matching airports found
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      ) : null}




      {!selectedLocation && !isLoadingLocations && showRadiusMode && utilityMode === 'ROUTE' && savedRoutes.length > 0 && isUtilityPanelVisible && !isMapboxActive ? (
        <View style={[styles.recommendationCard, { bottom: overlayBottom }]}>
          <View style={styles.utilitySheetHandleWrap}>
            <View style={styles.utilitySheetHandle} />
          </View>
          <View style={styles.recommendationHeader}>
            <View>
              <Text style={styles.recommendationEyebrow}>Saved Routes</Text>
              <Text style={styles.recommendationTitle}>Crew paths around {activeAirportCode}</Text>
            </View>
            <TouchableOpacity onPress={() => setIsUtilityPanelVisible(false)} style={styles.panelCloseButton}>
              <Ionicons name="chevron-down" size={16} color={theme.colors.accent} />
              <Text style={styles.panelCloseText}>Hide</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.routeSummaryRow}>
            <View style={styles.routeSummaryPill}>
              <Ionicons name="trail-sign-outline" size={13} color={theme.colors.accent} />
              <Text style={styles.routeSummaryText}>
                {savedRoutes.length} saved route{savedRoutes.length === 1 ? '' : 's'}
              </Text>
            </View>
            <Text style={styles.routeSummaryHint}>Tap one to jump back into that spot</Text>
          </View>
          {savedRoutes.map((route) => (
            <TouchableOpacity
              key={route.id}
              style={styles.recommendationRow}
              onPress={() => handleSelectSavedRoute(route)}
            >
              <View style={styles.recommendationIconWrap}>
                <Ionicons name="trail-sign-outline" size={16} color={theme.colors.background} />
              </View>
              <View style={styles.recommendationCopy}>
                <Text style={styles.recommendationName} numberOfLines={1}>
                  {route.destinationName}
                </Text>
                <Text style={styles.recommendationReason} numberOfLines={2}>
                  {route.categorySummary || route.routeHint || 'Saved crew route'}
                </Text>
                <View style={styles.routeMetaRow}>
                  <View style={styles.routeMetaPill}>
                    <Text style={styles.routeMetaPillText}>{getLocationTypeLabel(route.destinationType)}</Text>
                  </View>
                  <Text style={styles.routeMetaHint}>{formatSavedRouteDate(route.savedAt)}</Text>
                </View>
              </View>
              <Text style={styles.recommendationDistance}>Route</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : !selectedLocation && !isLoadingLocations && showRadiusMode && recommendationLocations.length > 0 && isUtilityPanelVisible && !isMapboxActive ? (
        <View style={[styles.recommendationCard, { bottom: overlayBottom }]}>
          <View style={styles.utilitySheetHandleWrap}>
            <View style={styles.utilitySheetHandle} />
          </View>
          <View style={styles.recommendationHeader}>
            <View>
              <Text style={styles.recommendationEyebrow}>Crew Utility</Text>
              <Text style={styles.recommendationTitle}>Best Picks Around {activeAirportCode}</Text>
            </View>
            <TouchableOpacity onPress={() => setIsUtilityPanelVisible(false)} style={styles.panelCloseButton}>
              <Ionicons name="chevron-down" size={16} color={theme.colors.accent} />
              <Text style={styles.panelCloseText}>Hide</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.curatedRailInline}
          >
            {CURATED_LAYER_OPTIONS.map((option) => {
              const active = option.id === curatedLayer;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.curatedChip, active && styles.curatedChipActive]}
                  onPress={() => setCuratedLayer(option.id)}
                >
                  <Text style={[styles.curatedChipText, active && styles.curatedChipTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {utilityHighlights.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.utilityHighlightRail}
            >
              {utilityHighlights.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.utilityHighlightCard}
                  onPress={() => handleSelectRecommendation(item.location)}
                >
                  <View style={styles.utilityHighlightIconWrap}>
                    <Ionicons name={item.icon} size={14} color={theme.colors.background} />
                  </View>
                  <View style={styles.utilityHighlightCopy}>
                    <Text style={styles.utilityHighlightTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.utilityHighlightSubtitle} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                    <Text style={styles.utilityHighlightDetail} numberOfLines={2}>
                      {item.detail}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}
          {recommendationLocations.map((location) => (
            <TouchableOpacity
              key={location.id}
              style={styles.recommendationRow}
              onPress={() => handleSelectRecommendation(location)}
            >
              <View style={styles.recommendationIconWrap}>
                <Ionicons
                  name={getMarkerIcon(location) as keyof typeof Ionicons.glyphMap}
                  size={16}
                  color={theme.colors.background}
                />
              </View>
              <View style={styles.recommendationCopy}>
                <Text style={styles.recommendationName} numberOfLines={1}>
                  {location.name}
                </Text>
                <Text style={styles.recommendationReason} numberOfLines={1}>
                  {location.recommendedFor || location.crewTip}
                </Text>
              </View>
              <Text style={styles.recommendationDistance}>
                {location.distanceFromHotel || 'Nearby'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {!isLoadingLocations && displayMode !== 'AIRPORT' && displayedLocations.length === 0 && !isMapboxActive ? (
        <View style={[styles.emptyCard, { bottom: overlayBottom }]}>
          <Ionicons name="location-outline" size={28} color={theme.colors.accent} />
          <Text style={styles.emptyCardTitle}>No Spots Yet</Text>
          <Text style={styles.emptyCardText}>{emptyLocationMessage}</Text>
        </View>
      ) : null}

      {!selectedLocation && !isLoadingLocations && showRadiusMode && (recommendationLocations.length > 0 || savedRoutes.length > 0) && !isUtilityPanelVisible && !isMapboxActive ? (
        <TouchableOpacity
          style={[styles.utilityLauncher, { bottom: launcherBottom }]}
          onPress={() => setIsUtilityPanelVisible(true)}
        >
          <View style={styles.utilityLauncherIcon}>
            <Ionicons
              name={utilityMode === 'ROUTE' ? 'trail-sign-outline' : 'sparkles-outline'}
              size={16}
              color={theme.colors.background}
            />
          </View>
          <View style={styles.utilityLauncherCopy}>
            <Text style={styles.utilityLauncherEyebrow}>
              {utilityMode === 'ROUTE' ? 'Saved Routes' : 'Crew Utility'}
            </Text>
            <Text style={styles.utilityLauncherTitle}>
              {utilityMode === 'ROUTE' ? `Open ${savedRoutes.length} route${savedRoutes.length === 1 ? '' : 's'}` : `Open picks around ${activeAirportCode}`}
            </Text>
          </View>
          <Ionicons name="chevron-up" size={18} color={theme.colors.accent} />
        </TouchableOpacity>
      ) : null}

          {recenterTarget && !isUtilityPanelVisible && !isNavigating && (
        <View
          style={[
            styles.mapActionStack,
            { bottom: actionBottom },
            selectedLocation && styles.mapActionStackRaised,
            selectedLocation && { bottom: actionRaisedBottom },
          ]}
        >
          {!selectedLocation && (
            <TouchableOpacity
              style={[styles.mapActionButton, { backgroundColor: '#5856D6' }]}
              onPress={() => {
                const label = encodeURIComponent(`${activeAirportCode} Airport`);
                const url = `maps://?q=${label}&ll=${activeAirportCenter.latitude},${activeAirportCenter.longitude}`;
                Linking.openURL(url).catch(() => {
                  RNAlert.alert('Error', 'Unable to open native Maps app.');
                });
              }}
            >
              <Ionicons name="map" size={16} color="#FFFFFF" />
              <Text style={[styles.mapActionText, { color: '#FFFFFF' }]}>Apple Maps</Text>
            </TouchableOpacity>
          )}
          {userLocation && !isMapboxActive ? (
            <TouchableOpacity
              style={styles.mapActionButton}
              onPress={() => focusMap(userLocation, USER_DELTA)}
            >
              <Ionicons name="navigate" size={16} color={theme.colors.background} />
              <Text style={styles.mapActionText}>Me</Text>
            </TouchableOpacity>
          ) : null}
          {!isMapboxActive && (
            <TouchableOpacity
              style={[styles.mapActionButton, styles.mapActionButtonSecondary]}
              onPress={() => focusMap(recenterTarget, displayMode === 'AIRPORT' ? HUB_DELTA : RADIUS_DELTA)}
            >
              <Ionicons name="airplane-outline" size={16} color={theme.colors.background} />
              <Text style={styles.mapActionText}>{activeAirportCode}</Text>
            </TouchableOpacity>
          )}
          {!isMapboxActive && (
            <TouchableOpacity
              style={styles.mapActionButton}
              onPress={() => {
                const nextMode = displayMode === 'AIRPORT' ? 'RADIUS' : 'AIRPORT';
                handleSelectDisplayMode(nextMode);
                focusMap(recenterTarget, nextMode === 'AIRPORT' ? HUB_DELTA : RADIUS_DELTA);
              }}
            >
              <Ionicons
                name={displayMode === 'AIRPORT' ? 'map-outline' : 'business-outline'}
                size={16}
                color={theme.colors.background}
              />
              <Text style={styles.mapActionText}>
                {displayMode === 'AIRPORT' ? 'Radius' : 'Terminal'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.mapActionButton, { backgroundColor: '#FF2D55' }]}
            onPress={() => setIsFlightTrackerVisible(true)}
          >
            <Ionicons name="airplane" size={16} color="#FFFFFF" style={{ transform: [{ rotate: '45deg' }] }} />
            <Text style={[styles.mapActionText, { color: '#FFFFFF' }]}>Live Tracker</Text>
          </TouchableOpacity>
        </View>
      )}
      {selectedLocation ? (
        <View style={[styles.selectedLocationCard, { bottom: tabBarHeight + 16 }]}>
          {/* Header Row with Close button */}
          <View style={styles.selectedCardHeader}>
            <View style={styles.selectedCardTitleWrap}>
              <View style={styles.selectedCardCategoryRow}>
                <Ionicons
                  name={
                    selectedLocation.isCrewFavorite
                      ? 'star'
                      : selectedLocation.airportCoreKind === 'SECURITY'
                      ? 'shield-checkmark'
                      : 'location'
                  }
                  size={14}
                  color={
                    selectedLocation.isCrewFavorite
                      ? '#FFD166'
                      : selectedLocation.airportCoreKind === 'SECURITY'
                      ? '#FF6B6B'
                      : theme.colors.accent
                  }
                />
                <Text style={styles.selectedCardCategory}>
                  {getLocationTypeLabel(selectedLocation.type)}
                </Text>
                {selectedLocation.level ? (
                  <Text style={styles.selectedCardLabelBadge}>
                    Level {selectedLocation.level}
                  </Text>
                ) : null}
                {selectedLocation.zone ? (
                  <Text style={styles.selectedCardLabelBadge}>
                    {selectedLocation.zone}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.selectedCardTitle} numberOfLines={1}>
                {selectedLocation.name}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.selectedCardCloseButton}
              onPress={() => setSelectedLocation(null)}
            >
              <Ionicons name="close" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Details / Rating & Address */}
          <View style={styles.selectedCardBody}>
            {selectedLocation.rating && selectedLocation.rating > 0 ? (
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={13} color="#FFD166" />
                <Text style={styles.ratingText}>
                  {selectedLocation.rating.toFixed(1)}{' '}
                  {selectedLocation.reviewCount ? `(${selectedLocation.reviewCount} reviews)` : ''}
                </Text>
              </View>
            ) : null}

            {selectedLocation.address ? (
              <Text style={styles.selectedCardAddress} numberOfLines={1}>
                {selectedLocation.address}
              </Text>
            ) : null}

            {/* Crew Note or placeholder */}
            {selectedLocation.crewTip || selectedLocation.crewIntelSummary ? (
              <View style={styles.crewNoteBubble}>
                <Ionicons name="chatbubble-ellipses-outline" size={14} color={theme.colors.accent} />
                <Text style={styles.crewNoteText} numberOfLines={2}>
                  "{selectedLocation.crewTip || selectedLocation.crewIntelSummary}"
                </Text>
              </View>
            ) : (
              <Text style={styles.noCrewNoteText} numberOfLines={1}>
                No crew notes added yet. Be the first!
              </Text>
            )}
          </View>

          {/* Action Row */}
          <View style={styles.selectedCardActions}>
            {selectedLocation.id.startsWith('tap-') ? (
              <>
                <TouchableOpacity
                  style={[styles.actionPrimaryButton, { backgroundColor: theme.colors.accent }]}
                  onPress={() => setIsAddPlaceModalVisible(true)}
                >
                  <Ionicons name="add-circle-outline" size={16} color={theme.colors.background} />
                  <Text style={styles.actionPrimaryText}>Add to Directory</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionSecondaryButton}
                  onPress={() => handleNavigationPress(selectedLocation)}
                >
                  <Ionicons name="navigate-outline" size={16} color={theme.colors.text} />
                  <Text style={styles.actionSecondaryText}>Navigate</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.actionPrimaryButton, { backgroundColor: theme.colors.accent }]}
                  onPress={() => {
                    handleNavigationPress(selectedLocation);
                  }}
                >
                  <Ionicons name="navigate" size={16} color={theme.colors.background} />
                  <Text style={styles.actionPrimaryText} numberOfLines={1}>Navigate</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionSecondaryButton}
                  onPress={() => setIsPlaceIntelModalVisible(true)}
                >
                  <Ionicons name="create-outline" size={16} color={theme.colors.text} />
                  <Text style={styles.actionSecondaryText}>Crew Notes</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionSecondaryButton,
                    selectedLocation.isRouteSaved && styles.actionSecondaryButtonActive
                  ]}
                  onPress={() => handleToggleRoute(selectedLocation)}
                >
                  <Ionicons
                    name={selectedLocation.isRouteSaved ? 'bookmark' : 'bookmark-outline'}
                    size={16}
                    color={selectedLocation.isRouteSaved ? theme.colors.accent : theme.colors.text}
                  />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      ) : null}

      {isPoiLoading ? (
        <View style={[styles.poiLoadingBadge, { top: hubTop + 56 }]}>
          <Ionicons name="sparkles-outline" size={14} color={theme.colors.background} />
          <Text style={styles.poiLoadingText}>Loading place details...</Text>
        </View>
      ) : null}

      <PlaceCrewInfoModal
        visible={isPlaceIntelModalVisible && Boolean(selectedLocation)}
        placeName={selectedLocation?.name || 'Crew spot'}
        onClose={() => setIsPlaceIntelModalVisible(false)}
        onSave={handleAddCrewInfo}
      />

      <AddPlaceModal
        visible={isAddPlaceModalVisible && Boolean(selectedLocation)}
        coordinate={selectedLocation ? selectedLocation.coordinate : null}
        onClose={() => setIsAddPlaceModalVisible(false)}
        onSave={handleCreateCustomPlace}
      />

      <PostAlertModal
        visible={isPostAlertModalVisible}
        onClose={() => {
          setIsPostAlertModalVisible(false);
          setPendingAlertForm(null);
          setTempAlertCoordinate(null);
        }}
        initialCoordinate={tempAlertCoordinate || selectedLocation?.coordinate || null}
        initialType={pendingAlertForm?.type}
        initialTitle={pendingAlertForm?.title}
        initialMessage={pendingAlertForm?.message}
        initialIsPrivate={pendingAlertForm?.isPrivate}
        initialIsLocationSpecific={pendingAlertForm?.isLocationSpecific}
        onAdjustLocationStart={(type, title, message, isPrivate, isLocationSpecific) => {
          setPendingAlertForm({ type, title, message, isPrivate, isLocationSpecific });
          const targetCoord = tempAlertCoordinate || selectedLocation?.coordinate || mapFocusCoordinates;
          setTempAlertCoordinate(targetCoord);
          setMapFocusCoordinates(targetCoord);
          setMapFocusRevision((current) => current + 1);
          setIsPostAlertModalVisible(false);
          setIsAdjustingAlertPin(true);
        }}
        onReport={async (type, title, message, isPrivateReport, coordinate) => {
          const finalCoord = coordinate || userLocation || mapFocusCoordinates;
          const expiresAtStr = new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString();
          
          if (isPrivateReport) {
            const newAlert: Alert = {
              id: `private-${Date.now()}`,
              type,
              title,
              message,
              location: activeAirportCode,
              latitude: finalCoord.latitude,
              longitude: finalCoord.longitude,
              createdAt: new Date().toISOString(),
              expiresAt: expiresAtStr,
              userId: user?.id || 'anonymous',
              username: profile.fullName || 'Me',
              isPrivate: true,
            };
            
            try {
              const localStr = await AsyncStorage.getItem(`yofly_private_alerts:${activeAirportCode}`);
              let localAlerts: Alert[] = [];
              if (localStr) {
                try {
                  localAlerts = JSON.parse(localStr);
                } catch (e) {
                  console.warn(e);
                }
              }
              localAlerts.unshift(newAlert);
              await AsyncStorage.setItem(`yofly_private_alerts:${activeAirportCode}`, JSON.stringify(localAlerts));
              setPrivateAlerts(localAlerts);
              RNAlert.alert('Success', 'Private note saved on your map!');
            } catch (e) {
              console.warn('Failed to save private alert', e);
              RNAlert.alert('Save Failed', 'Could not save private note locally.');
            }
          } else {
            try {
              await AlertService.createAlert({
                type,
                title,
                message,
                location: activeAirportCode,
                latitude: finalCoord.latitude,
                longitude: finalCoord.longitude,
                expiresAt: expiresAtStr,
              });
              RNAlert.alert('Success', 'Crew report shared publicly!');
            } catch (e: any) {
              console.warn('Failed to post map alert', e);
              RNAlert.alert(
                'Publishing Failed',
                e instanceof Error ? e.message : 'An unknown error occurred while posting the crew report.'
              );
            }
          }
          setPendingAlertForm(null);
          setTempAlertCoordinate(null);
        }}
      />

      <FlightTrackerModal
        visible={isFlightTrackerVisible}
        onClose={() => setIsFlightTrackerVisible(false)}
        airportCode={activeAirportCode}
        airportName={activeAirportName}
        airportCenter={activeAirportCenter}
        theme={theme}
        isDark={isDark}
      />

      {displayMode === 'AIRPORT' && !isMapboxActive && (
        (activeAirportCode === 'MCO' || activeAirportCode === 'JFK') ? (
          <>
            <View style={styles.indoorSelectorPillContainer}>
              <TouchableOpacity
                style={styles.indoorSelectorPill}
                activeOpacity={0.8}
                onPress={() => setIsTerminalSelectorVisible(true)}
              >
                <Ionicons name="map-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.indoorSelectorPillText}>
                  {selectedTerminalZone === 'ALL' && selectedFloorLevel === 'ALL'
                    ? 'Outdoor View'
                    : getActiveSelectorLabel()}
                </Text>
                <Ionicons name="chevron-down" size={14} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Modal
              transparent={true}
              animationType="fade"
              visible={isTerminalSelectorVisible}
              onRequestClose={() => setIsTerminalSelectorVisible(false)}
            >
              <TouchableOpacity 
                style={styles.selectorModalOverlay} 
                activeOpacity={1} 
                onPress={() => setIsTerminalSelectorVisible(false)}
              >
                <BlurView tint="dark" intensity={85} style={styles.selectorBlurContainer}>
                  <TouchableOpacity 
                    activeOpacity={1} 
                    style={[styles.selectorSheet, { backgroundColor: theme.colors.background }]}
                  >
                    <View style={styles.selectorHeader}>
                      <Text style={[styles.selectorTitle, { color: theme.colors.text }]}>
                        {activeAirportCode === 'JFK' ? 'JFK Terminal & Building Maps' : 'MCO Terminal & Floor Maps'}
                      </Text>
                      <TouchableOpacity onPress={() => setIsTerminalSelectorVisible(false)} style={styles.selectorCloseBtn}>
                        <Ionicons name="close-circle" size={24} color={theme.colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                    
                    <ScrollView contentContainerStyle={styles.selectorScrollContent}>
                      <TouchableOpacity
                        style={[
                          styles.selectorItem,
                          selectedTerminalZone === 'ALL' && selectedFloorLevel === 'ALL' && styles.selectorItemActive
                        ]}
                        onPress={() => {
                          setSelectedTerminalZone('ALL');
                          setSelectedFloorLevel('ALL');
                          setIsTerminalSelectorVisible(false);
                        }}
                      >
                        <Ionicons name="globe-outline" size={18} color={selectedTerminalZone === 'ALL' && selectedFloorLevel === 'ALL' ? '#FFF' : theme.colors.primary} />
                        <Text style={[
                          styles.selectorItemText,
                          selectedTerminalZone === 'ALL' && selectedFloorLevel === 'ALL' && styles.selectorItemTextActive,
                          { color: selectedTerminalZone === 'ALL' && selectedFloorLevel === 'ALL' ? '#FFF' : theme.colors.text }
                        ]}>
                          General Outdoor Map (Show All)
                        </Text>
                      </TouchableOpacity>
                      
                      <View style={styles.selectorDivider} />
                      
                      {(activeAirportCode === 'JFK' ? JFK_SELECTOR_OPTIONS : MCO_SELECTOR_OPTIONS).map((section) => (
                        <View key={section.section} style={styles.selectorSection}>
                          <Text style={styles.selectorSectionHeader}>{section.section}</Text>
                          {section.options.map((opt) => {
                            const isSelected = selectedTerminalZone === opt.zone && selectedFloorLevel === opt.level;
                            return (
                              <TouchableOpacity
                                key={opt.label}
                                style={[styles.selectorItem, isSelected && styles.selectorItemActive]}
                                onPress={() => {
                                  setSelectedTerminalZone(opt.zone);
                                  setSelectedFloorLevel(opt.level);
                                  setIsTerminalSelectorVisible(false);
                                  
                                  // Focus camera on the selected zone
                                  let targetCoords = activeAirportCenter;
                                  let targetDelta = HUB_DELTA;
                                  if (activeAirportCode === 'JFK') {
                                    if (opt.zone === 'T1') {
                                      targetCoords = { latitude: 40.6435, longitude: -73.7895 };
                                      targetDelta = { latitudeDelta: 0.006, longitudeDelta: 0.006 };
                                    } else if (opt.zone === 'T4') {
                                      targetCoords = { latitude: 40.6425, longitude: -73.7785 };
                                      targetDelta = { latitudeDelta: 0.006, longitudeDelta: 0.006 };
                                    } else if (opt.zone === 'T5') {
                                      targetCoords = { latitude: 40.6460, longitude: -73.7745 };
                                      targetDelta = { latitudeDelta: 0.006, longitudeDelta: 0.006 };
                                    } else if (opt.zone === 'T7') {
                                      targetCoords = { latitude: 40.6475, longitude: -73.7725 };
                                      targetDelta = { latitudeDelta: 0.006, longitudeDelta: 0.006 };
                                    } else if (opt.zone === 'T8') {
                                      targetCoords = { latitude: 40.6470, longitude: -73.7885 };
                                      targetDelta = { latitudeDelta: 0.006, longitudeDelta: 0.006 };
                                    } else if (opt.zone === 'TWA') {
                                      targetCoords = { latitude: 40.6455, longitude: -73.7775 };
                                      targetDelta = { latitudeDelta: 0.004, longitudeDelta: 0.004 };
                                    } else if (opt.zone === 'FED_CIRCLE') {
                                      targetCoords = { latitude: 40.6586, longitude: -73.8070 };
                                      targetDelta = { latitudeDelta: 0.004, longitudeDelta: 0.004 };
                                    }
                                  } else { // MCO
                                    if (opt.zone === 'MAIN_AB') {
                                      targetCoords = { latitude: 28.4310, longitude: -81.3078 };
                                      targetDelta = { latitudeDelta: 0.006, longitudeDelta: 0.006 };
                                    } else if (['AS1', 'AS2', 'AS3', 'AS4'].includes(opt.zone)) {
                                      targetCoords = { latitude: 28.4310, longitude: -81.3080 };
                                      targetDelta = { latitudeDelta: 0.012, longitudeDelta: 0.012 };
                                    } else if (opt.zone === 'MAIN_C') {
                                      targetCoords = { latitude: 28.4180, longitude: -81.3072 };
                                      targetDelta = { latitudeDelta: 0.006, longitudeDelta: 0.006 };
                                    } else if (opt.zone === 'TRAIN') {
                                      targetCoords = { latitude: 28.4190, longitude: -81.3022 };
                                      targetDelta = { latitudeDelta: 0.004, longitudeDelta: 0.004 };
                                    }
                                  }
                                  focusMap(targetCoords, targetDelta);
                                }}
                              >
                                <Ionicons 
                                  name={opt.icon || 'location-outline'} 
                                  size={18} 
                                  color={isSelected ? '#FFF' : theme.colors.primary} 
                                />
                                <Text style={[
                                  styles.selectorItemText,
                                  isSelected && styles.selectorItemTextActive,
                                  { color: isSelected ? '#FFF' : theme.colors.text }
                                ]}>
                                  {opt.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ))}
                    </ScrollView>
                  </TouchableOpacity>
                </BlurView>
              </TouchableOpacity>
            </Modal>
          </>
        ) : (
          <View style={styles.verticalFloorSelector}>
            {getSelectorLevelsForZone().map((lvl, index, arr) => {
              const active = selectedFloorLevel === lvl;
              return (
                <React.Fragment key={lvl}>
                  <TouchableOpacity
                    style={[styles.floorSelectorButton, active && styles.floorSelectorButtonActive]}
                    onPress={() => {
                      setSelectedFloorLevel((current) => (current === lvl ? 'ALL' : lvl));
                    }}
                  >
                    <Text style={[styles.floorSelectorText, active && styles.floorSelectorTextActive]}>
                      {lvl}
                    </Text>
                  </TouchableOpacity>
                  {index < arr.length - 1 && <View style={styles.floorDivider} />}
                </React.Fragment>
              );
            })}
          </View>
        )
      )}

      {!isNavigating && !selectedLocation && !isUtilityPanelVisible && (displayMode !== 'AIRPORT' || isMapboxActive) && (
        <View style={[styles.floatingBottomControls, { bottom: keyboardHeight > 0 ? keyboardHeight + 8 : tabBarHeight + 16 }]}>
          {directorySearchQuery.trim().length > 0 && (
            <View style={styles.floatingSearchResultsContainer}>
              <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                {displayedLocations.slice(0, 10).map((loc) => (
                  <TouchableOpacity
                    key={loc.id}
                    style={styles.searchResultItem}
                    activeOpacity={0.7}
                    onPress={() => {
                      void handleSelectLocation(loc);
                    }}
                  >
                    <Ionicons name={getMarkerIcon(loc)} size={16} color={theme.colors.accent} />
                    <View style={styles.searchResultTextContainer}>
                      <Text style={styles.searchResultTitle}>{loc.name}</Text>
                      <Text style={styles.searchResultSubtitle}>
                        {loc.level ? `Level ${loc.level}` : 'Terminal Spot'} {loc.zone ? `· ${loc.zone}` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {displayedLocations.length === 0 && (
                  <Text style={styles.noResultsText}>No spots found matching query</Text>
                )}
              </ScrollView>
            </View>
          )}

          <View style={styles.floatingSearchInputBox}>
            <Ionicons name="search" size={18} color={theme.colors.accent} />
            <TextInput
              value={directorySearchQuery}
              onChangeText={setDirectorySearchQuery}
              placeholder="Search dining, gates, shops..."
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.floatingSearchInput}
            />
            {isSearchingGoogle ? (
              <ActivityIndicator size="small" color={theme.colors.accent} style={{ marginRight: 8 }} />
            ) : directorySearchQuery ? (
              <TouchableOpacity
                style={styles.floatingSearchClear}
                onPress={() => setDirectorySearchQuery('')}
              >
                <Ionicons name="close" size={14} color={theme.colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.floatingBlueprintButton}
            onPress={() => {
              if (!profile.verifiedCrew) {
                RNAlert.alert(
                  'Verification Required',
                  'Sharing new crew intel is locked until your crew verification is complete.'
                );
                return;
              }
              setIsPostAlertModalVisible(true);
            }}
          >
            <Ionicons name="radio-outline" size={18} color={theme.colors.background} />
            <Text style={styles.floatingBlueprintButtonText}>Report Intel</Text>
          </TouchableOpacity>
        </View>
      )}

      {displayMode === 'AIRPORT' && !selectedLocation && !isUtilityPanelVisible && !isMapboxActive && !isNavigating && (
        <MapDirectorySheet
          theme={theme}
          activeAirportCode={activeAirportCode}
          directorySummaryCount={directorySummaryCount}
          isDirectoryExpanded={isDirectoryExpanded}
          setIsDirectoryExpanded={setIsDirectoryExpanded}
          directorySearchQuery={directorySearchQuery}
          setDirectorySearchQuery={setDirectorySearchQuery}
          selectedDirectoryCategory={selectedDirectoryCategory}
          setSelectedDirectoryCategory={setSelectedDirectoryCategory}
          selectedDirectoryEntry={selectedDirectoryEntry}
          setSelectedDirectoryEntry={setSelectedDirectoryEntry}
          isRefreshingDirectoryBusinesses={isRefreshingDirectoryBusinesses}
          handleRefreshDirectoryBusinesses={handleRefreshDirectoryBusinesses}
          directoryEntries={directoryEntries}
          handleSelectDirectoryEntry={handleSelectDirectoryEntry}
          DIRECTORY_CATEGORIES={DIRECTORY_CATEGORIES}
          bottomInset={tabBarHeight}
          selectedFloorLevel={selectedFloorLevel}
          setSelectedFloorLevel={setSelectedFloorLevel}
          onReportIntelPress={() => {
            if (!profile.verifiedCrew) {
              RNAlert.alert(
                'Verification Required',
                'Sharing new crew intel is locked until your crew verification is complete.'
              );
              return;
            }
            setIsPostAlertModalVisible(true);
          }}
        />
      )}
      {isAdjustingAlertPin && (
        <View style={[styles.adjustPinContainer, { bottom: (tabBarHeight || 0) + 16 }]}>
          <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={styles.adjustPinContent}>
            <View style={styles.adjustPinHeader}>
              <Ionicons name="location" size={20} color={theme.colors.accent} />
              <View style={styles.adjustPinCopy}>
                <Text style={styles.adjustPinTitle}>Set Intel Location</Text>
                <Text style={styles.adjustPinSubtitle}>
                  {tempAlertCoordinate 
                    ? `Tap map to position: ${tempAlertCoordinate.latitude.toFixed(5)}, ${tempAlertCoordinate.longitude.toFixed(5)}`
                    : 'Tap map to drop your intel pin'}
                </Text>
              </View>
            </View>
            <View style={styles.adjustPinActions}>
              <TouchableOpacity
                style={[styles.adjustPinButton, styles.adjustPinButtonCancel]}
                onPress={() => {
                  setIsAdjustingAlertPin(false);
                  setIsPostAlertModalVisible(true);
                }}
              >
                <Text style={styles.adjustPinButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.adjustPinButton, styles.adjustPinButtonConfirm, !tempAlertCoordinate && styles.adjustPinButtonDisabled]}
                onPress={() => {
                  if (tempAlertCoordinate) {
                    setIsAdjustingAlertPin(false);
                    setIsPostAlertModalVisible(true);
                  }
                }}
                disabled={!tempAlertCoordinate}
              >
                <Text style={styles.adjustPinButtonTextConfirm}>Confirm Spot</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {isNavigating && navigationDestination && (
        <View style={[styles.navBottomPanel, { bottom: tabBarHeight + 16 }]}>
          <View style={styles.navBottomContent}>
            <View style={styles.navBottomInfoRow}>
              <View style={styles.navBottomIconContainer}>
                <Ionicons
                  name={getMarkerIcon(navigationDestination) as any}
                  size={22}
                  color={theme.colors.accent}
                />
              </View>
              <View style={styles.navBottomTextContainer}>
                <Text style={styles.navBottomTitle} numberOfLines={1}>
                  {navigationDestination.name}
                </Text>
                <Text style={styles.navBottomSubtitle} numberOfLines={1}>
                  {navigationDestination.level ? `Level ${navigationDestination.level}` : 'Airport Spot'}
                  {navigationDestination.zone ? ` • ${navigationDestination.zone}` : ''}
                </Text>
              </View>
            </View>

            {(navigationDestination.crewTip || navigationDestination.crewIntelSummary) ? (
              <View style={styles.navBottomNoteContainer}>
                <Ionicons name="chatbubble-ellipses-outline" size={14} color={theme.colors.textMuted} style={{ marginRight: 6 }} />
                <Text style={styles.navBottomNoteText} numberOfLines={2}>
                  {navigationDestination.crewTip || navigationDestination.crewIntelSummary}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.navBottomEndButton}
              activeOpacity={0.8}
              onPress={stopInAppNavigation}
            >
              <Ionicons name="stop-circle" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.navBottomEndButtonText}>End Walk Navigation</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: AppTheme, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    navigationOverlay: {
      position: 'absolute',
      left: theme.spacing.md,
      right: theme.spacing.md,
      zIndex: 115,
    },
    navCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: isDark ? 'rgba(10, 18, 28, 0.94)' : 'rgba(255, 255, 255, 0.96)',
      padding: 14,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.22,
      shadowRadius: 16,
      elevation: 6,
    },
    navMainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    navIconBadge: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navInstructionContainer: {
      flex: 1,
    },
    navInstructionText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.text,
      lineHeight: 18,
    },
    navStepDistanceText: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 2,
      fontWeight: '600',
    },
    navEndButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    navFooterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    navSummaryText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.text,
    },
    navProgressBarBackground: {
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.border,
      flex: 1,
      marginLeft: 12,
      overflow: 'hidden',
    },
    navProgressBarFill: {
      height: '100%',
      backgroundColor: theme.colors.accent,
    },
    mapTopDock: {
      position: 'absolute',
      left: theme.spacing.md,
      right: theme.spacing.md,
      zIndex: 112,
    },

    hubSummaryButton: {
      minHeight: 58,
      borderRadius: 29,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: isDark ? 'rgba(14, 14, 14, 0.8)' : 'rgba(255, 255, 255, 0.82)',
      paddingHorizontal: 12,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 16,
      elevation: 4,
    },
    mapQuickControls: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 48,
    },
    mapQuickControlsScrollContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 16,
    },
    mapQuickButton: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: isDark ? 'rgba(14, 14, 14, 0.8)' : 'rgba(255, 255, 255, 0.82)',
      paddingHorizontal: 10,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 3,
    },
    mapQuickButtonActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    mapQuickButtonText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '900',
    },
    mapQuickButtonTextActive: {
      color: theme.colors.background,
    },
    mapQuickIconButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: isDark ? 'rgba(14, 14, 14, 0.8)' : 'rgba(255, 255, 255, 0.82)',
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 3,
    },
    expandedMapPanel: {
      position: 'absolute',
      left: theme.spacing.md,
      right: theme.spacing.md,
      zIndex: 111,
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: isDark ? 'rgba(14, 14, 14, 0.75)' : 'rgba(255, 255, 255, 0.75)',
      padding: 12,
      gap: 10,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 16,
      elevation: 4,
    },
    panelHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    panelTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '900',
    },
    panelSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      marginTop: 3,
    },
    panelMeta: {
      color: theme.colors.accent,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    panelCloseIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.cardSoft,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    panelChipRail: {
      gap: 8,
      paddingRight: 4,
    },
    detectedAirportCard: {
      minHeight: 56,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.accent + '38',
      backgroundColor: theme.colors.accent + '13',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    detectedAirportCardActive: {
      borderColor: theme.colors.accent,
      backgroundColor: theme.colors.accent + '22',
    },
    detectedAirportIcon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.accent,
    },
    detectedAirportCopy: {
      flex: 1,
    },
    detectedAirportLabel: {
      color: theme.colors.accent,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 2,
    },
    detectedAirportName: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '800',
    },
    detectedAirportDistance: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '900',
    },
    airportSearchDivider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: 4,
    },
    airportSearchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: theme.roundness.md,
      backgroundColor: theme.colors.cardSoft,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 10,
      height: 38,
    },
    airportSearchIcon: {
      marginRight: 6,
    },
    airportSearchInput: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '700',
      padding: 0,
    },
    airportSearchResults: {
      maxHeight: 180,
      backgroundColor: theme.colors.cardSoft,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 4,
    },
    airportSearchResultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border + '33',
    },
    airportSearchResultCode: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: '900',
      width: 32,
    },
    airportSearchResultName: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '700',
    },
    locationBanner: {
      position: 'absolute',
      left: theme.spacing.md,
      right: theme.spacing.md,
      zIndex: 120,
      backgroundColor: theme.colors.accent,
      borderRadius: theme.roundness.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 16,
      elevation: 3,
    },
    locationBannerText: {
      color: theme.colors.background,
      fontSize: 13,
      fontWeight: '700',
      flex: 1,
    },
    poiLoadingBadge: {
      position: 'absolute',
      right: theme.spacing.md,
      zIndex: 120,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.colors.accent,
      borderRadius: theme.roundness.full,
      paddingHorizontal: 10,
      paddingVertical: 8,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 16,
      elevation: 3,
    },
    poiLoadingText: {
      color: theme.colors.background,
      fontSize: 11,
      fontWeight: '800',
    },
    hubBadge: {
      position: 'absolute',
      left: theme.spacing.md,
      maxWidth: width - theme.spacing.md * 2 - 70,
      zIndex: 110,
      backgroundColor: isDark ? 'rgba(14, 14, 14, 0.92)' : 'rgba(255, 255, 255, 0.96)',
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 12,
      paddingVertical: 9,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
      elevation: 4,
    },
    hubBadgeCopy: {
      flex: 1,
    },
    hubBadgeCodeWrap: {
      minWidth: 48,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: theme.roundness.full,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hubBadgeCode: {
      color: theme.colors.background,
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 0.6,
    },
    hubBadgeEyebrow: {
      color: theme.colors.accent,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 2,
    },
    hubBadgeName: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '700',
    },
    focusSummaryCard: {
      position: 'absolute',
      left: theme.spacing.md,
      right: theme.spacing.md,
      zIndex: 109,
      backgroundColor: isDark ? 'rgba(14, 14, 14, 0.82)' : 'rgba(255, 255, 255, 0.92)',
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 6,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 16,
      elevation: 3,
    },
    focusSummaryTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    focusSummaryModePill: {
      borderRadius: theme.roundness.full,
      backgroundColor: theme.colors.accent + '18',
      borderWidth: 1,
      borderColor: theme.colors.accent + '33',
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    focusSummaryModeText: {
      color: theme.colors.accent,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    focusSummaryAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: theme.roundness.full,
      backgroundColor: theme.colors.surface + 'B0',
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    focusSummaryActionText: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: '800',
    },
    focusSummaryTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    focusSummaryBody: {
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '600',
    },
    controlRailWrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      zIndex: 105,
    },
    airportRail: {
      paddingHorizontal: theme.spacing.md,
      gap: 8,
    },
    airportChip: {
      backgroundColor: isDark ? 'rgba(18, 18, 18, 0.92)' : 'rgba(255, 255, 255, 0.94)',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.roundness.full,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    airportChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    airportChipText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '800',
    },
    airportChipTextActive: {
      color: theme.colors.background,
    },
    utilityChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isDark ? 'rgba(18, 18, 18, 0.92)' : 'rgba(255, 255, 255, 0.94)',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.roundness.full,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    utilityChipActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    utilityChipText: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: '700',
    },
    utilityChipTextActive: {
      color: theme.colors.background,
    },
    utilityCountPill: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 5,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.cardSoft,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    utilityCountPillActive: {
      backgroundColor: theme.colors.background + '33',
      borderColor: theme.colors.background + '55',
    },
    utilityCountText: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: '900',
    },
    utilityCountTextActive: {
      color: theme.colors.background,
    },
    displayModeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isDark ? 'rgba(18, 18, 18, 0.9)' : 'rgba(255, 255, 255, 0.94)',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.roundness.full,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    displayModeChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    displayModeChipText: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: '800',
    },
    displayModeChipTextActive: {
      color: theme.colors.background,
    },
    airportLegendCard: {
      position: 'absolute',
      left: theme.spacing.md,
      right: theme.spacing.md,
      zIndex: 101,
      backgroundColor: isDark ? 'rgba(14, 14, 14, 0.78)' : 'rgba(255, 255, 255, 0.88)',
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 10,
      paddingVertical: 9,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 14,
      elevation: 3,
    },
    airportLegendHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    airportLegendBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.accent,
      borderRadius: theme.roundness.full,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    airportLegendBadgeText: {
      color: theme.colors.background,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.3,
    },
    airportLegendHint: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: '700',
    },
    airportLegendRail: {
      gap: 8,
      paddingBottom: 2,
    },
    airportLegendPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.colors.surface + 'B8',
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    airportLegendGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    airportLegendItem: {
      minWidth: '30%',
      backgroundColor: theme.colors.surface + 'C0',
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    airportLegendCode: {
      color: theme.colors.accent,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    airportLegendLabel: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: '700',
    },
    curatedChip: {
      backgroundColor: isDark ? 'rgba(18, 18, 18, 0.92)' : 'rgba(255, 255, 255, 0.94)',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.roundness.full,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    curatedChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    curatedChipText: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: '700',
    },
    curatedChipTextActive: {
      color: theme.colors.background,
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isDark ? 'rgba(18, 18, 18, 0.92)' : 'rgba(255, 255, 255, 0.94)',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.roundness.full,
      paddingHorizontal: 11,
      paddingVertical: 8,
    },
    categoryChipActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    categoryChipText: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: '800',
    },
    categoryChipTextActive: {
      color: theme.colors.background,
    },
    categoryCountText: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: '900',
    },
    map: {
      width,
      height,
    },
    directoryMapScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.32)' : 'rgba(5, 18, 28, 0.16)',
      zIndex: 20,
    },
    meMarkerWrap: {
      alignItems: 'center',
    },
    meMarkerLabel: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.surface,
      marginBottom: 6,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 4,
      elevation: 4,
    },
    meMarkerLabelText: {
      color: theme.colors.background,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.6,
    },
    meMarkerOuter: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.colors.primary + '47',
      borderWidth: 3,
      borderColor: theme.colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.22,
      shadowRadius: 6,
      elevation: 6,
    },
    meMarkerInner: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: theme.colors.primary,
    },
    markerContainer: {
      backgroundColor: theme.colors.accent,
      padding: 8,
      borderRadius: 20,
      borderWidth: 2,
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
      transform: [{ scale: 1.2 }],
    },
    emptyCard: {
      position: 'absolute',
      left: theme.spacing.md,
      right: theme.spacing.md,
      bottom: 112,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      alignItems: 'center',
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 16,
      elevation: 4,
    },
    emptyCardTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginTop: 8,
    },
    emptyCardText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 6,
      textAlign: 'center',
    },
    recommendationCard: {
      position: 'absolute',
      left: theme.spacing.md,
      right: theme.spacing.md,
      bottom: 112,
      backgroundColor: isDark ? 'rgba(18, 18, 18, 0.94)' : theme.colors.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
      maxHeight: 252,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 14,
      elevation: 4,
    },
    directorySheet: {
      position: 'absolute',
      left: theme.spacing.md,
      right: theme.spacing.md,
      zIndex: 30,
      backgroundColor: isDark ? 'rgba(13, 13, 18, 0.75)' : 'rgba(255, 255, 255, 0.75)',
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
      maxHeight: Math.min(440, height - 170),
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 16,
      elevation: 30,
    },
    directorySheetCollapsed: {
      height: 78,
      overflow: 'hidden',
    },
    directorySheetHandleWrap: {
      alignItems: 'center',
      marginTop: -2,
      marginBottom: 8,
    },
    directorySheetHandle: {
      width: 42,
      height: 5,
      borderRadius: 999,
      backgroundColor: theme.colors.textMuted + '66',
    },
    directoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 10,
    },
    directoryTitleWrap: {
      flex: 1,
    },
    directoryBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: theme.roundness.full,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginBottom: 6,
    },
    directoryBadgeText: {
      color: theme.colors.background,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.5,
    },
    directoryTitle: {
      color: theme.colors.text,
      fontSize: 17,
      fontWeight: '900',
    },
    directorySubtitle: {
      color: theme.colors.textMuted,
      fontSize: 13,
      marginTop: 2,
    },
    directoryCollapseHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    directoryCollapseHintText: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: '700',
    },

    directoryRecenterButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.accent + '18',
      borderWidth: 1,
      borderColor: theme.colors.accent + '44',
    },
    directoryTabs: {
      gap: 6,
      paddingBottom: 8,
    },
    directoryTab: {
      height: 32,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: isDark ? 'rgba(28, 28, 28, 0.9)' : theme.colors.cardSoft,
      paddingHorizontal: 10,
    },
    directoryTabActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    directoryTabText: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: '800',
    },
    directoryTabTextActive: {
      color: theme.colors.text,
      fontWeight: '900',
    },
    directoryTabIcon: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    directoryTabIconActive: {
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
    },
    directorySearchBox: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.28)' : '#F5F8FA',
      paddingHorizontal: 14,
      marginBottom: 8,
    },
    directorySearchInput: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '800',
      paddingVertical: 10,
    },
    directorySearchClear: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.cardSoft,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    directoryFilterBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 8,
    },
    directoryFilterPill: {
      flex: 1,
      minHeight: 38,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      borderRadius: theme.roundness.full,
      backgroundColor: theme.colors.cardSoft,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 12,
    },
    directoryFilterText: {
      flex: 1,
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: '900',
    },
    directorySourceBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.24)' : theme.colors.cardSoft,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginBottom: 8,
    },
    directorySourceCopy: {
      flex: 1,
    },
    directorySourceLabel: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: '900',
    },
    directorySourceText: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: '700',
      marginTop: 2,
    },
    directoryBusinessButton: {
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: theme.roundness.full,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 10,
    },
    directoryBusinessButtonDisabled: {
      opacity: 0.65,
    },
    directoryBusinessButtonText: {
      color: theme.colors.background,
      fontSize: 10,
      fontWeight: '900',
    },
    directoryLoadingState: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      backgroundColor: theme.colors.accent + '0A',
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.accent + '1A',
    },
    directoryLoadingText: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: '600',
    },
    directoryList: {
      maxHeight: 168,
    },
    directoryListWithDetail: {
      maxHeight: 104,
    },
    directoryDetailCard: {
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.accent + '55',
      backgroundColor: theme.colors.accent + '10',
      padding: 10,
      marginBottom: 8,
    },
    directoryDetailHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    },
    directoryDetailIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    directoryDetailCopy: {
      flex: 1,
    },
    directoryDetailEyebrow: {
      color: theme.colors.accent,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    directoryDetailTitle: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '900',
      marginTop: 2,
    },
    directoryDetailClose: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
    },
    directoryDetailText: {
      color: theme.colors.textMuted,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: '700',
      marginTop: 8,
    },
    directoryDetailNote: {
      color: theme.colors.accent,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: '800',
      marginTop: 7,
    },
    directoryDetailChipRail: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
      marginTop: 9,
    },
    directoryRow: {
      minHeight: 76,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    directoryRowSelected: {
      backgroundColor: theme.colors.accent + '0F',
      borderRadius: theme.roundness.lg,
      paddingHorizontal: 8,
      marginHorizontal: -4,
    },
    directoryRowIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    directoryRowCopy: {
      flex: 1,
    },
    directoryRowTitle: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '900',
    },
    directoryRowSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 11,
      lineHeight: 15,
      marginTop: 2,
      fontWeight: '600',
    },
    directoryRowNote: {
      color: theme.colors.accent,
      fontSize: 10,
      lineHeight: 14,
      marginTop: 4,
      fontWeight: '800',
    },
    directoryRowChipRail: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
      marginTop: 6,
    },
    directoryRowChip: {
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    directoryLevelChip: {
      backgroundColor: theme.colors.primary + '18',
      borderColor: theme.colors.primary + '33',
    },
    directoryLevelChipText: {
      color: theme.colors.primary,
      fontSize: 9,
      fontWeight: '900',
    },
    directoryZoneChip: {
      backgroundColor: theme.colors.accent + '18',
      borderColor: theme.colors.accent + '33',
    },
    directoryZoneChipText: {
      color: theme.colors.accent,
      fontSize: 9,
      fontWeight: '900',
    },
    directoryRowChipText: {
      color: theme.colors.textMuted,
      fontSize: 9,
      fontWeight: '900',
    },
    directoryMetaPill: {
      maxWidth: 88,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    directoryMetaText: {
      color: theme.colors.accent,
      fontSize: 10,
      fontWeight: '900',
    },
    directoryEmptyState: {
      minHeight: 126,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
      gap: 6,
    },
    directoryEmptyTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '900',
    },
    directoryEmptyText: {
      color: theme.colors.textMuted,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: '700',
      textAlign: 'center',
    },
    utilitySheetHandleWrap: {
      alignItems: 'center',
      marginTop: -2,
      marginBottom: 10,
    },
    utilitySheetHandle: {
      width: 44,
      height: 5,
      borderRadius: 999,
      backgroundColor: theme.colors.textMuted + '55',
    },
    curatedRailInline: {
      gap: 8,
      paddingBottom: 8,
    },
    recommendationHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    routeSummaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 6,
    },
    routeSummaryPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.accent + '2A',
      backgroundColor: theme.colors.accent + '14',
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    routeSummaryText: {
      color: theme.colors.accent,
      fontSize: 11,
      fontWeight: '800',
    },
    routeSummaryHint: {
      flex: 1,
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: '700',
      textAlign: 'right',
    },
    panelCloseButton: {
      minWidth: 58,
      height: 32,
      paddingHorizontal: 10,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      justifyContent: 'center',
      backgroundColor: theme.colors.accent + '14',
      borderWidth: 1,
      borderColor: theme.colors.accent + '2A',
    },
    panelCloseText: {
      color: theme.colors.accent,
      fontSize: 11,
      fontWeight: '800',
    },
    recommendationEyebrow: {
      color: theme.colors.accent,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    recommendationTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '800',
      marginTop: 2,
    },
    recommendationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    utilityHighlightRail: {
      gap: 8,
      paddingBottom: 8,
    },
    utilityHighlightCard: {
      width: 204,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 9,
      flexDirection: 'row',
      gap: 8,
      alignItems: 'flex-start',
    },
    utilityHighlightIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    utilityHighlightCopy: {
      flex: 1,
    },
    utilityHighlightTitle: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: '800',
      marginBottom: 3,
    },
    utilityHighlightSubtitle: {
      color: theme.colors.accent,
      fontSize: 11,
      fontWeight: '700',
      marginBottom: 3,
    },
    utilityHighlightDetail: {
      color: theme.colors.textMuted,
      fontSize: 10,
      lineHeight: 14,
    },
    recommendationIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recommendationCopy: {
      flex: 1,
    },
    recommendationName: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    recommendationReason: {
      color: theme.colors.textMuted,
      fontSize: 11,
      marginTop: 2,
    },
    routeMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 6,
    },
    routeMetaPill: {
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    routeMetaPillText: {
      color: theme.colors.text,
      fontSize: 10,
      fontWeight: '800',
    },
    routeMetaHint: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: '700',
    },
    recommendationDistance: {
      color: theme.colors.accent,
      fontSize: 11,
      fontWeight: '800',
    },
    utilityLauncher: {
      position: 'absolute',
      left: theme.spacing.md,
      right: theme.spacing.md,
      bottom: 108,
      backgroundColor: isDark ? 'rgba(18, 18, 18, 0.94)' : theme.colors.surface,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 14,
      elevation: 4,
    },
    utilityLauncherIcon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    utilityLauncherCopy: {
      flex: 1,
    },
    utilityLauncherEyebrow: {
      color: theme.colors.accent,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    utilityLauncherTitle: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '700',
      marginTop: 2,
    },
    mapActionStack: {
      position: 'absolute',
      right: theme.spacing.md,
      bottom: 118,
      gap: 10,
      zIndex: 120,
    },
    mapActionStackRaised: {
      bottom: 330,
    },
    mapActionButton: {
      minWidth: 74,
      height: 42,
      paddingHorizontal: 12,
      borderRadius: 21,
      backgroundColor: theme.colors.accent,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: theme.colors.surface,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 8,
      elevation: 6,
    },
    mapActionButtonSecondary: {
      backgroundColor: theme.colors.primary,
    },
    mapActionText: {
      color: theme.colors.background,
      fontSize: 12,
      fontWeight: '900',
    },
    selectedLocationCard: {
      position: 'absolute',
      left: theme.spacing.md,
      right: theme.spacing.md,
      zIndex: 111,
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: isDark ? 'rgba(14, 14, 14, 0.95)' : 'rgba(255, 255, 255, 0.97)',
      padding: 16,
      gap: 12,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 16,
      elevation: 6,
    },
    selectedCardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    selectedCardTitleWrap: {
      flex: 1,
      gap: 4,
    },
    selectedCardCategoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    selectedCardCategory: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    selectedCardLabelBadge: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      fontSize: 9,
      fontWeight: '700',
      color: theme.colors.text,
    },
    selectedCardTitle: {
      color: theme.colors.text,
      fontSize: 17,
      fontWeight: '900',
    },
    selectedCardCloseButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 10,
    },
    selectedCardBody: {
      gap: 6,
    },
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    ratingText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '700',
    },
    selectedCardAddress: {
      color: theme.colors.textMuted,
      fontSize: 12,
    },
    crewNoteBubble: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: isDark ? 'rgba(0, 245, 212, 0.08)' : 'rgba(0, 245, 212, 0.05)',
      padding: 10,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(0, 245, 212, 0.15)' : 'rgba(0, 245, 212, 0.1)',
      marginTop: 4,
    },
    crewNoteText: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 12,
      fontStyle: 'italic',
      lineHeight: 16,
    },
    noCrewNoteText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontStyle: 'italic',
      marginTop: 4,
    },
    selectedCardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
    },
    actionPrimaryButton: {
      flex: 1,
      height: 40,
      borderRadius: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      shadowColor: '#5856D6',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 3,
    },
    actionPrimaryText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '900',
    },
    actionSecondaryButton: {
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    actionSecondaryText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    actionSecondaryButtonActive: {
      borderColor: theme.colors.accent,
      backgroundColor: isDark ? 'rgba(0, 245, 212, 0.08)' : 'rgba(0, 245, 212, 0.05)',
    },
    indoorSelectorPillContainer: {
      position: 'absolute',
      right: theme.spacing.md,
      top: Platform.OS === 'ios' ? 136 : 116,
      zIndex: 110,
    },
    indoorSelectorPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(20, 20, 20, 0.88)' : 'rgba(255, 255, 255, 0.94)',
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: theme.colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    indoorSelectorPillText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '800',
    },
    selectorModalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
    },
    selectorBlurContainer: {
      width: '100%',
      maxHeight: height * 0.75,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: 'hidden',
    },
    selectorSheet: {
      width: '100%',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 32,
    },
    selectorHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.08)',
      paddingBottom: 12,
    },
    selectorTitle: {
      fontSize: 16,
      fontWeight: '800',
    },
    selectorCloseBtn: {
      padding: 4,
    },
    selectorScrollContent: {
      paddingBottom: 20,
    },
    selectorItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      marginVertical: 4,
      gap: 12,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
    },
    selectorItemActive: {
      backgroundColor: theme.colors.primary,
    },
    selectorItemText: {
      fontSize: 13,
      fontWeight: '700',
      flex: 1,
    },
    selectorItemTextActive: {
      fontWeight: '800',
    },
    selectorDivider: {
      height: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      marginVertical: 8,
    },
    selectorSection: {
      marginVertical: 8,
    },
    selectorSectionHeader: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1,
      marginBottom: 6,
      textTransform: 'uppercase',
    },
    verticalFloorSelector: {
      position: 'absolute',
      right: theme.spacing.md,
      top: height * 0.32,
      zIndex: 110,
      backgroundColor: isDark ? 'rgba(20, 20, 20, 0.85)' : 'rgba(255, 255, 255, 0.9)',
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 4,
      gap: 6,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
      elevation: 4,
    },
    floorSelectorButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    floorSelectorButtonActive: {
      backgroundColor: theme.colors.accent,
    },
    floorSelectorText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '800',
    },
    floorSelectorTextActive: {
      color: theme.colors.background,
      fontWeight: '900',
    },
    floorDivider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginHorizontal: 6,
    },
    floatingBottomControls: {
      position: 'absolute',
      left: theme.spacing.md,
      right: theme.spacing.md,
      zIndex: 110,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    floatingSearchInputBox: {
      flex: 1,
      height: 48,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: isDark ? 'rgba(20, 20, 20, 0.9)' : 'rgba(255, 255, 255, 0.95)',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 4,
    },
    floatingSearchInput: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '700',
      marginLeft: 8,
      paddingVertical: 10,
    },
    floatingSearchClear: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    floatingBlueprintButton: {
      height: 48,
      paddingHorizontal: 16,
      borderRadius: 24,
      backgroundColor: theme.colors.accent,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.14,
      shadowRadius: 10,
      elevation: 4,
    },
    floatingBlueprintButtonText: {
      color: theme.colors.background,
      fontSize: 13,
      fontWeight: '900',
    },
    floatingSearchResultsContainer: {
      position: 'absolute',
      bottom: 56,
      left: 0,
      right: 0,
      backgroundColor: isDark ? 'rgba(20, 20, 20, 0.96)' : 'rgba(255, 255, 255, 0.98)',
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.sm,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 12,
      elevation: 6,
      flexDirection: 'column',
    },
    searchResultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      gap: 12,
    },
    searchResultTextContainer: {
      flex: 1,
    },
    searchResultTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    searchResultSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 11,
      marginTop: 2,
    },
    noResultsText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontStyle: 'italic',
      textAlign: 'center',
      paddingVertical: 16,
    },
    adjustPinContainer: {
      position: 'absolute',
      left: 16,
      right: 16,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
      zIndex: 220,
    },
    adjustPinContent: {
      padding: 16,
      gap: 12,
    },
    adjustPinHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    adjustPinCopy: {
      flex: 1,
    },
    adjustPinTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: 'bold',
    },
    adjustPinSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
      marginTop: 2,
    },
    adjustPinActions: {
      flexDirection: 'row',
      gap: 10,
    },
    adjustPinButton: {
      flex: 1,
      height: 40,
      borderRadius: theme.roundness.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    adjustPinButtonCancel: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    adjustPinButtonConfirm: {
      backgroundColor: theme.colors.accent,
    },
    adjustPinButtonDisabled: {
      opacity: 0.5,
    },
    adjustPinButtonTextCancel: {
      color: theme.colors.text,
      fontWeight: '600',
      fontSize: 13,
    },
    adjustPinButtonTextConfirm: {
      color: theme.colors.background,
      fontWeight: 'bold',
      fontSize: 13,
    },
    navBottomPanel: {
      position: 'absolute',
      left: theme.spacing.md,
      right: theme.spacing.md,
      zIndex: 111,
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: isDark ? 'rgba(14, 14, 14, 0.95)' : 'rgba(255, 255, 255, 0.97)',
      padding: 16,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 16,
      elevation: 6,
    },
    navBottomContent: {
      gap: 12,
    },
    navBottomInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    navBottomIconContainer: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDark ? 'rgba(114, 221, 225, 0.15)' : 'rgba(47, 175, 192, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    navBottomTextContainer: {
      flex: 1,
      justifyContent: 'center',
    },
    navBottomTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '800',
    },
    navBottomSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
    },
    navBottomNoteContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: theme.roundness.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    navBottomNoteText: {
      flex: 1,
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
      fontStyle: 'italic',
    },
    navBottomEndButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FF3B30',
      height: 46,
      borderRadius: 23,
      shadowColor: '#FF3B30',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 3,
    },
    navBottomEndButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '800',
    },
  });
