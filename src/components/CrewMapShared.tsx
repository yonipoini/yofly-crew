import React from 'react';
import { StyleSheet, Text, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme } from '../theme/theme';

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const parsePercent = (value: string) => Number(value.replace('%', ''));

export const getConnectorStyle = (
  leftA: string,
  topA: string,
  leftB: string,
  topB: string,
  isPrimary: boolean
) => {
  const startX = parsePercent(leftA);
  const startY = parsePercent(topA);
  const endX = parsePercent(leftB);
  const endY = parsePercent(topB);
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  const angle = (Math.atan2(deltaY, deltaX) * 180) / Math.PI;

  return {
    left: `${startX}%`,
    top: `${startY}%`,
    width: `${length}%`,
    transform: [{ translateY: -1 }, { rotate: `${angle}deg` }],
    opacity: isPrimary ? 0.55 : 0.38,
  } as const;
};

export type AirportBlueprintProps = {
  activeAirportCode: string;
  styles: any;
  theme: AppTheme;
};

export function AirportBlueprint({ activeAirportCode, styles, theme }: AirportBlueprintProps) {
  const code = activeAirportCode.toUpperCase();
  if (code === 'JFK') {
    return <JfkBlueprint styles={styles} theme={theme} />;
  }
  if (code === 'MCO') {
    return <McoBlueprint styles={styles} theme={theme} />;
  }
  return <GenericBlueprint activeAirportCode={code} styles={styles} theme={theme} />;
}

function McoBlueprint({ styles, theme }: { styles: any; theme: AppTheme }) {
  return (
    <View style={styles.blueprintWrap} pointerEvents="none">
      <View style={styles.blueprintCanvas}>
        {/* Lakes / Water */}
        <View style={[styles.blueprintWater, styles.blueprintWaterNorth]} />
        <View style={[styles.blueprintWater, styles.blueprintWaterEast]} />
        <View style={[styles.blueprintWater, styles.blueprintWaterSouth]} />

        {/* Roads & APM Tracks */}
        <View style={styles.blueprintHighway}>
          <Text style={styles.blueprintRoadLabel}>FL 528 (BEACHLINE)</Text>
        </View>
        <View style={styles.blueprintRoad}>
          <Text style={styles.blueprintRoadLabel}>JEFF FUQUA BLVD</Text>
        </View>

        {/* APM Tracks (Automated People Mover) connecting Main Terminal to Airsides */}
        <View style={styles.mcoApmTrackNW} />
        <View style={styles.mcoApmTrackNE} />
        <View style={styles.mcoApmTrackSW} />
        <View style={styles.mcoApmTrackSE} />

        {/* CENTRAL MAIN TERMINAL (A/B) - with internal walls & zones */}
        <View style={styles.mcoMainTerminalOuter}>
          <Text style={styles.mcoMainTerminalTitle}>MAIN TERMINAL A/B</Text>
          
          {/* North/South Divide line */}
          <View style={styles.mcoTerminalDivider} />

          {/* Terminal A Lobby */}
          <View style={styles.mcoTermALobby}>
            <Text style={styles.mcoInnerZoneText}>TERMINAL A (North)</Text>
            {/* Ticket Counter walls */}
            <View style={styles.mcoCounterRow} />
          </View>

          {/* Terminal B Lobby */}
          <View style={styles.mcoTermBLobby}>
            <Text style={styles.mcoInnerZoneText}>TERMINAL B (South)</Text>
            <View style={styles.mcoCounterRow} />
          </View>

          {/* Central Atrium */}
          <View style={styles.mcoAtriumLobby}>
            <Text style={[styles.mcoInnerZoneText, { fontSize: 8, opacity: 0.6 }]}>CENTRAL ATRIUM</Text>
          </View>

          {/* Security Checkpoint East/West */}
          <View style={styles.mcoSecurityCheckpointEast}>
            <Text style={styles.mcoSecurityText}>East Sec</Text>
          </View>
          <View style={styles.mcoSecurityCheckpointWest}>
            <Text style={styles.mcoSecurityText}>West Sec</Text>
          </View>

          {/* Baggage Claim Level 2 outline */}
          <View style={styles.mcoBaggageLvl2} />
        </View>

        {/* DETACHED AIRSIDES - with Gate Finger Walls */}
        
        {/* Airside 1 (Top-Left) */}
        <View style={styles.mcoAirside1Hub}>
          <View style={styles.mcoConcourseFinger1A} />
          <View style={styles.mcoConcourseFinger1B} />
          <View style={styles.mcoAirsideCore}>
            <Ionicons name="airplane" size={14} color={theme.colors.primary} />
            <Text style={styles.mcoAirsideTitle}>AS 1</Text>
          </View>
        </View>

        {/* Airside 2 (Top-Right) */}
        <View style={styles.mcoAirside2Hub}>
          <View style={styles.mcoConcourseFinger2A} />
          <View style={styles.mcoConcourseFinger2B} />
          <View style={styles.mcoAirsideCore}>
            <Ionicons name="airplane" size={14} color={theme.colors.primary} />
            <Text style={styles.mcoAirsideTitle}>AS 2</Text>
          </View>
        </View>

        {/* Airside 3 (Bottom-Left) */}
        <View style={styles.mcoAirside3Hub}>
          <View style={styles.mcoConcourseFinger3A} />
          <View style={styles.mcoConcourseFinger3B} />
          <View style={styles.mcoAirsideCore}>
            <Ionicons name="airplane" size={14} color={theme.colors.primary} />
            <Text style={styles.mcoAirsideTitle}>AS 3</Text>
          </View>
        </View>

        {/* Airside 4 (Bottom-Right) */}
        <View style={styles.mcoAirside4Hub}>
          <View style={styles.mcoConcourseFinger4A} />
          <View style={styles.mcoConcourseFinger4B} />
          <View style={styles.mcoAirsideCore}>
            <Ionicons name="airplane" size={14} color={theme.colors.primary} />
            <Text style={styles.mcoAirsideTitle}>AS 4</Text>
          </View>
        </View>

        {/* TERMINAL C (South Terminal Complex) */}
        <View style={styles.mcoTermCOuter}>
          <View style={styles.mcoTermCConcourse} />
          <View style={styles.mcoTermCGates} />
          <Text style={styles.mcoTermCTitle}>TERMINAL C</Text>
        </View>

        {/* Blueprint Badges */}
        <BlueprintBadge styles={styles} label="P" style={styles.blueprintParkingNorth} />
        <BlueprintBadge styles={styles} label="P" style={styles.blueprintParkingWest} />
        <BlueprintBadge styles={styles} label="P" style={styles.blueprintParkingEast} />
        <BlueprintBadge styles={styles} label="P" style={styles.blueprintParkingSouth} />
        <BlueprintBadge styles={styles} icon="bus" style={styles.blueprintTransport} />
        <BlueprintBadge styles={styles} icon="restaurant" style={styles.blueprintDining} />

        <View style={styles.blueprintLayerChip}>
          <Ionicons name="map-outline" size={13} color={theme.colors.primary} />
          <Text style={styles.blueprintLayerText}>MCO TERMINAL DIRECTORY</Text>
        </View>
      </View>
    </View>
  );
}

function JfkBlueprint({ styles, theme }: { styles: any; theme: AppTheme }) {
  return (
    <View style={styles.blueprintWrap} pointerEvents="none">
      <View style={styles.blueprintCanvas}>
        {/* Water / Parks */}
        <View style={[styles.blueprintWater, styles.blueprintWaterNorth, { left: '10%', top: '8%', width: '25%', height: '10%' }]} />
        <View style={[styles.blueprintWater, styles.blueprintWaterSouth, { right: '10%', bottom: '8%', width: '30%', height: '12%' }]} />

        {/* Roads & Highways */}
        <View style={[styles.blueprintHighway, { top: '15%', transform: [{ rotate: '2deg' }] }]}>
          <Text style={styles.blueprintRoadLabel}>VAN WYCK EXPWY</Text>
        </View>
        <View style={[styles.blueprintHighway, { top: '82%', transform: [{ rotate: '-4deg' }] }]}>
          <Text style={styles.blueprintRoadLabel}>JFK ACCESS RD</Text>
        </View>

        {/* Central AirTrain Ring */}
        <View style={styles.blueprintJfkTrack} />
        <Text style={styles.blueprintJfkTrackLabel}>JFK AirTrain Loop</Text>

        {/* Terminals in Loop */}
        <View style={[styles.blueprintTerminal, styles.blueprintJfkT8]}>
          <Text style={styles.blueprintTerminalText}>TERM 8</Text>
          <Text style={styles.blueprintTerminalSubtext}>American / Oneworld</Text>
        </View>

        <View style={[styles.blueprintTerminal, styles.blueprintJfkT7]}>
          <Text style={styles.blueprintTerminalText}>TERM 7</Text>
          <Text style={styles.blueprintTerminalSubtext}>International</Text>
        </View>

        <View style={[styles.blueprintTerminal, styles.blueprintJfkT5]}>
          <Text style={styles.blueprintTerminalText}>TERM 5</Text>
          <Text style={styles.blueprintTerminalSubtext}>JetBlue / T5</Text>
        </View>

        <View style={[styles.blueprintTerminal, styles.blueprintJfkT4]}>
          <Text style={styles.blueprintTerminalText}>TERM 4</Text>
          <Text style={styles.blueprintTerminalSubtext}>Delta / International</Text>
        </View>

        <View style={[styles.blueprintTerminal, styles.blueprintJfkT1]}>
          <Text style={styles.blueprintTerminalText}>TERM 1</Text>
          <Text style={styles.blueprintTerminalSubtext}>New Terminal One</Text>
        </View>

        <BlueprintBadge styles={styles} label="P" style={styles.blueprintJfkParkingCenter} />
        <BlueprintBadge styles={styles} icon="bus" style={styles.blueprintJfkTransport} />
        <BlueprintBadge styles={styles} icon="airplane" style={styles.blueprintJfkAirTrainNode} />

        <View style={styles.blueprintLayerChip}>
          <Ionicons name="map-outline" size={13} color={theme.colors.primary} />
          <Text style={styles.blueprintLayerText}>JFK TERMINAL DIRECTORY</Text>
        </View>
      </View>
    </View>
  );
}

function GenericBlueprint({ activeAirportCode, styles, theme }: { activeAirportCode: string; styles: any; theme: AppTheme }) {
  return (
    <View style={styles.blueprintWrap} pointerEvents="none">
      <View style={styles.blueprintCanvas}>
        <View style={[styles.blueprintWater, { left: '15%', top: '10%', width: '20%', height: '10%' }]} />
        
        <View style={styles.blueprintHighway}>
          <Text style={styles.blueprintRoadLabel}>AIRPORT ACCESS BLVD</Text>
        </View>

        <View style={[styles.blueprintTerminal, styles.blueprintGenericTerminalMain]}>
          <Text style={styles.blueprintTerminalText}>MAIN TERMINAL</Text>
          <Text style={styles.blueprintTerminalSubtext}>ticketing • baggage • check-in</Text>
        </View>

        <View style={[styles.blueprintAirside, styles.blueprintGenericConcourseA]}>
          <Ionicons name="airplane" size={14} color={theme.colors.primary} />
          <Text style={styles.blueprintAirsideText}>CONCOURSE A</Text>
          <Text style={[styles.blueprintTerminalSubtext, { fontSize: 8 }]}>Gates A1-A20</Text>
        </View>

        <View style={[styles.blueprintAirside, styles.blueprintGenericConcourseB]}>
          <Ionicons name="airplane" size={14} color={theme.colors.primary} />
          <Text style={styles.blueprintAirsideText}>CONCOURSE B</Text>
          <Text style={[styles.blueprintTerminalSubtext, { fontSize: 8 }]}>Gates B1-B20</Text>
        </View>

        <BlueprintBadge styles={styles} label="P" style={styles.blueprintGenericParking} />
        <BlueprintBadge styles={styles} icon="bus" style={styles.blueprintGenericTransport} />

        <View style={styles.blueprintLayerChip}>
          <Ionicons name="map-outline" size={13} color={theme.colors.primary} />
          <Text style={styles.blueprintLayerText}>{activeAirportCode} TERMINAL DIRECTORY</Text>
        </View>
      </View>
    </View>
  );
}

type BlueprintBadgeProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  label?: string;
  style: object;
  styles: any;
};

function BlueprintBadge({ icon, label, style, styles }: BlueprintBadgeProps) {
  return (
    <View style={[styles.blueprintBadge, style]}>
      {icon ? <Ionicons name={icon} size={17} color="#FFFFFF" /> : <Text style={styles.blueprintBadgeText}>{label}</Text>}
    </View>
  );
}

export const createStyles = (theme: AppTheme, isDark: boolean) =>
  StyleSheet.create({
    map: {
      backgroundColor: isDark ? '#08111A' : '#E9F3F8',
      overflow: 'hidden',
    },
    panContainer: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: '100%',
      height: '100%',
    },
    alertMarkerWrap: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
      width: 44,
      height: 44,
      transform: [{ translateX: -22 }, { translateY: -22 }],
      zIndex: 200,
    },
    alertMarkerGlow: {
      position: 'absolute',
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(217, 107, 232, 0.35)', // Electric Pink Miami Vice glow
    },
    alertMarkerCore: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: '#D96BE8', // Electric Pink core
      borderWidth: 2,
      borderColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#D96BE8',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.9,
      shadowRadius: 8,
    },
    tempAlertMarkerWrap: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
      width: 44,
      height: 44,
      transform: [{ translateX: -22 }, { translateY: -22 }],
      zIndex: 300,
    },
    tempAlertMarkerGlow: {
      position: 'absolute',
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255, 152, 0, 0.4)', // Amber glow for adjusting pin
    },
    tempAlertMarkerCore: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: '#FF9800', // Amber/orange core for adjusting pin
      borderWidth: 2,
      borderColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#FF9800',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.9,
      shadowRadius: 8,
    },
    grid: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDark ? 'rgba(8, 17, 26, 0.95)' : 'rgba(233, 243, 248, 0.98)',
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(12, 32, 54, 0.08)',
      borderWidth: 1,
    },
    blueprintWrap: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDark ? '#071018' : '#EEF7FB',
      alignItems: 'center',
      justifyContent: 'center',
    },
    blueprintCanvas: {
      width: '76%',
      height: '86%',
      maxWidth: 620,
      maxHeight: 760,
      minWidth: 300,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(248, 252, 255, 0.94)' : '#FFFFFF',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(123, 210, 223, 0.2)' : 'rgba(28, 74, 92, 0.12)',
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 5,
      overflow: 'hidden',
    },
    blueprintWater: {
      position: 'absolute',
      backgroundColor: 'rgba(123, 210, 223, 0.62)',
      borderRadius: 999,
      transform: [{ rotate: '-18deg' }],
    },
    blueprintWaterNorth: {
      width: '18%',
      height: '8%',
      left: '26%',
      top: '15%',
    },
    blueprintWaterEast: {
      width: '22%',
      height: '10%',
      right: '9%',
      top: '43%',
    },
    blueprintWaterSouth: {
      width: '28%',
      height: '8%',
      left: '23%',
      bottom: '13%',
    },
    blueprintHighway: {
      position: 'absolute',
      left: '8%',
      right: '8%',
      top: '13%',
      height: 2,
      backgroundColor: 'rgba(79, 94, 105, 0.42)',
      transform: [{ rotate: '-5deg' }],
    },
    blueprintRoad: {
      position: 'absolute',
      left: '49%',
      top: '12%',
      width: 3,
      height: '74%',
      backgroundColor: 'rgba(79, 94, 105, 0.42)',
      borderRadius: 999,
      transform: [{ rotate: '6deg' }],
    },
    blueprintRoadSecondary: {
      left: '39%',
      top: '30%',
      height: '48%',
      opacity: 0.55,
      transform: [{ rotate: '-12deg' }],
    },
    blueprintRoadLabel: {
      position: 'absolute',
      color: '#5F6E78',
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0,
      minWidth: 86,
      left: 8,
      top: -17,
    },
    blueprintSpine: {
      position: 'absolute',
      left: '44%',
      top: '31%',
      width: '12%',
      height: '38%',
      borderRadius: 22,
      backgroundColor: 'rgba(28, 74, 92, 0.18)',
      borderWidth: 2,
      borderColor: 'rgba(28, 74, 92, 0.28)',
    },
    blueprintTerminal: {
      position: 'absolute',
      left: '39%',
      width: '22%',
      height: '11%',
      borderRadius: 8,
      backgroundColor: 'rgba(255, 247, 222, 0.95)',
      borderWidth: 1.5,
      borderColor: 'rgba(28, 74, 92, 0.25)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    blueprintTerminalNorth: {
      top: '28%',
    },
    blueprintTerminalSouth: {
      bottom: '23%',
      backgroundColor: 'rgba(231, 244, 248, 0.95)',
    },
    blueprintTerminalText: {
      color: '#1D4B5D',
      fontSize: 16,
      fontWeight: '900',
      letterSpacing: 0,
    },
    blueprintTerminalSubtext: {
      color: '#1D4B5D',
      fontSize: 9,
      fontWeight: '800',
      opacity: 0.6,
      marginTop: 1,
    },
    blueprintAirside: {
      position: 'absolute',
      width: '19%',
      height: '12%',
      borderRadius: 8,
      backgroundColor: 'rgba(255, 247, 222, 0.88)',
      borderWidth: 1.5,
      borderColor: 'rgba(28, 74, 92, 0.22)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    blueprintAirsideNW: {
      left: '17%',
      top: '31%',
      transform: [{ rotate: '-10deg' }],
    },
    blueprintAirsideNE: {
      right: '17%',
      top: '31%',
      transform: [{ rotate: '10deg' }],
    },
    blueprintAirsideSW: {
      left: '17%',
      bottom: '27%',
      transform: [{ rotate: '12deg' }],
    },
    blueprintAirsideSE: {
      right: '17%',
      bottom: '27%',
      transform: [{ rotate: '-12deg' }],
    },
    blueprintAirsideText: {
      color: '#1D4B5D',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0,
    },
    blueprintBadge: {
      position: 'absolute',
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: '#2F75B5',
      borderWidth: 2,
      borderColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#17334A',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.18,
      shadowRadius: 6,
      elevation: 4,
    },
    blueprintBadgeText: {
      color: '#FFFFFF',
      fontSize: 20,
      lineHeight: 22,
      fontWeight: '900',
      letterSpacing: 0,
    },
    blueprintParkingNorth: {
      left: '47%',
      top: '18%',
    },
    blueprintParkingWest: {
      left: '31%',
      top: '43%',
    },
    blueprintParkingEast: {
      right: '31%',
      top: '43%',
    },
    blueprintParkingSouth: {
      left: '47%',
      bottom: '14%',
    },
    blueprintTransport: {
      left: '43%',
      bottom: '24%',
      backgroundColor: '#255E8E',
    },
    blueprintDining: {
      right: '42%',
      bottom: '20%',
      backgroundColor: '#7B4CA0',
    },
    blueprintLayerChip: {
      position: 'absolute',
      right: 12,
      top: 12,
      minHeight: 34,
      borderRadius: 8,
      paddingHorizontal: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(255, 255, 255, 0.88)',
      borderWidth: 1,
      borderColor: 'rgba(28, 74, 92, 0.18)',
    },
    blueprintLayerText: {
      color: '#1D4B5D',
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0,
    },
    // JFK Blueprint Styles
    blueprintJfkTrack: {
      position: 'absolute',
      left: '23%',
      top: '25%',
      width: '54%',
      height: '50%',
      borderRadius: 999,
      borderWidth: 2.5,
      borderStyle: 'dashed',
      borderColor: 'rgba(28, 74, 92, 0.32)',
    },
    blueprintJfkTrackLabel: {
      position: 'absolute',
      left: '36%',
      top: '48%',
      fontSize: 10,
      fontWeight: '800',
      color: '#5F6E78',
      opacity: 0.65,
    },
    blueprintJfkT8: {
      position: 'absolute',
      left: '37%',
      top: '16%',
      width: '26%',
      height: '10%',
      borderRadius: 8,
      backgroundColor: 'rgba(255, 247, 222, 0.95)',
      borderWidth: 1.5,
      borderColor: 'rgba(28, 74, 92, 0.25)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    blueprintJfkT7: {
      position: 'absolute',
      right: '12%',
      top: '32%',
      width: '24%',
      height: '10%',
      borderRadius: 8,
      backgroundColor: 'rgba(231, 244, 248, 0.95)',
      borderWidth: 1.5,
      borderColor: 'rgba(28, 74, 92, 0.25)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    blueprintJfkT5: {
      position: 'absolute',
      right: '15%',
      bottom: '22%',
      width: '24%',
      height: '10%',
      borderRadius: 8,
      backgroundColor: 'rgba(255, 247, 222, 0.95)',
      borderWidth: 1.5,
      borderColor: 'rgba(28, 74, 92, 0.25)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    blueprintJfkT4: {
      position: 'absolute',
      left: '18%',
      bottom: '20%',
      width: '26%',
      height: '12%',
      borderRadius: 8,
      backgroundColor: 'rgba(231, 244, 248, 0.95)',
      borderWidth: 1.5,
      borderColor: 'rgba(28, 74, 92, 0.25)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    blueprintJfkT1: {
      position: 'absolute',
      left: '12%',
      top: '34%',
      width: '24%',
      height: '10%',
      borderRadius: 8,
      backgroundColor: 'rgba(255, 247, 222, 0.95)',
      borderWidth: 1.5,
      borderColor: 'rgba(28, 74, 92, 0.25)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    blueprintJfkParkingCenter: {
      left: '48%',
      top: '38%',
    },
    blueprintJfkTransport: {
      left: '38%',
      top: '55%',
      backgroundColor: '#255E8E',
    },
    blueprintJfkAirTrainNode: {
      right: '38%',
      top: '55%',
      backgroundColor: '#2F75B5',
    },
    // Generic Blueprint Styles
    blueprintGenericTerminalMain: {
      position: 'absolute',
      left: '25%',
      top: '40%',
      width: '50%',
      height: '15%',
      borderRadius: 8,
      backgroundColor: 'rgba(255, 247, 222, 0.95)',
      borderWidth: 1.5,
      borderColor: 'rgba(28, 74, 92, 0.25)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    blueprintGenericConcourseA: {
      position: 'absolute',
      left: '10%',
      top: '32%',
      width: '25%',
      height: '12%',
      borderRadius: 8,
      backgroundColor: 'rgba(231, 244, 248, 0.95)',
      borderWidth: 1.5,
      borderColor: 'rgba(28, 74, 92, 0.22)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    blueprintGenericConcourseB: {
      position: 'absolute',
      right: '10%',
      top: '32%',
      width: '25%',
      height: '12%',
      borderRadius: 8,
      backgroundColor: 'rgba(231, 244, 248, 0.95)',
      borderWidth: 1.5,
      borderColor: 'rgba(28, 74, 92, 0.22)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    blueprintGenericParking: {
      left: '48%',
      bottom: '28%',
    },
    blueprintGenericTransport: {
      left: '48%',
      top: '20%',
      backgroundColor: '#255E8E',
    },
    // Detailed MCO Blueprint Styles
    mcoApmTrackNW: {
      position: 'absolute',
      left: '23%',
      top: '29%',
      width: '18%',
      height: 3,
      borderStyle: 'dashed',
      borderWidth: 1.5,
      borderColor: 'rgba(28, 74, 92, 0.42)',
      transform: [{ rotate: '15deg' }],
    },
    mcoApmTrackNE: {
      position: 'absolute',
      right: '23%',
      top: '29%',
      width: '18%',
      height: 3,
      borderStyle: 'dashed',
      borderWidth: 1.5,
      borderColor: 'rgba(28, 74, 92, 0.42)',
      transform: [{ rotate: '-15deg' }],
    },
    mcoApmTrackSW: {
      position: 'absolute',
      left: '23%',
      bottom: '31%',
      width: '18%',
      height: 3,
      borderStyle: 'dashed',
      borderWidth: 1.5,
      borderColor: 'rgba(28, 74, 92, 0.42)',
      transform: [{ rotate: '-15deg' }],
    },
    mcoApmTrackSE: {
      position: 'absolute',
      right: '23%',
      bottom: '31%',
      width: '18%',
      height: 3,
      borderStyle: 'dashed',
      borderWidth: 1.5,
      borderColor: 'rgba(28, 74, 92, 0.42)',
      transform: [{ rotate: '15deg' }],
    },
    mcoMainTerminalOuter: {
      position: 'absolute',
      left: '34%',
      top: '28%',
      width: '32%',
      height: '30%',
      borderRadius: 12,
      backgroundColor: 'rgba(255, 252, 243, 0.98)',
      borderWidth: 2,
      borderColor: '#4F5E69',
      padding: 4,
      justifyContent: 'space-between',
      shadowColor: '#17334A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    mcoMainTerminalTitle: {
      color: '#1D4B5D',
      fontSize: 10,
      fontWeight: '900',
      textAlign: 'center',
      marginTop: 2,
    },
    mcoTerminalDivider: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: '50%',
      height: 1.5,
      backgroundColor: 'rgba(79, 94, 105, 0.3)',
    },
    mcoTermALobby: {
      position: 'absolute',
      left: 4,
      right: 4,
      top: '14%',
      height: '24%',
      borderWidth: 1,
      borderRadius: 4,
      borderColor: 'rgba(79, 94, 105, 0.25)',
      backgroundColor: 'rgba(28, 74, 92, 0.04)',
      justifyContent: 'center',
      paddingLeft: 4,
    },
    mcoTermBLobby: {
      position: 'absolute',
      left: 4,
      right: 4,
      bottom: '14%',
      height: '24%',
      borderWidth: 1,
      borderRadius: 4,
      borderColor: 'rgba(79, 94, 105, 0.25)',
      backgroundColor: 'rgba(28, 74, 92, 0.04)',
      justifyContent: 'center',
      paddingLeft: 4,
    },
    mcoInnerZoneText: {
      color: '#1D4B5D',
      fontSize: 7,
      fontWeight: '800',
    },
    mcoCounterRow: {
      position: 'absolute',
      right: 6,
      width: '40%',
      height: 4,
      backgroundColor: 'rgba(79, 94, 105, 0.35)',
      borderRadius: 2,
    },
    mcoAtriumLobby: {
      position: 'absolute',
      left: '30%',
      top: '38%',
      width: '40%',
      height: '24%',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderWidth: 1,
      borderColor: 'rgba(79, 94, 105, 0.3)',
      borderRadius: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mcoSecurityCheckpointEast: {
      position: 'absolute',
      right: -2,
      top: '38%',
      width: '28%',
      height: '24%',
      backgroundColor: 'rgba(235, 179, 8, 0.15)',
      borderWidth: 1.5,
      borderColor: '#EAB308',
      borderRadius: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mcoSecurityCheckpointWest: {
      position: 'absolute',
      left: -2,
      top: '38%',
      width: '28%',
      height: '24%',
      backgroundColor: 'rgba(235, 179, 8, 0.15)',
      borderWidth: 1.5,
      borderColor: '#EAB308',
      borderRadius: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mcoSecurityText: {
      color: '#A16207',
      fontSize: 7,
      fontWeight: '900',
    },
    mcoBaggageLvl2: {
      position: 'absolute',
      bottom: -2,
      left: '20%',
      right: '20%',
      height: 4,
      backgroundColor: 'rgba(79, 94, 105, 0.45)',
      borderBottomLeftRadius: 2,
      borderBottomRightRadius: 2,
    },
    mcoAirside1Hub: {
      position: 'absolute',
      left: '12%',
      top: '18%',
      width: '18%',
      height: '16%',
    },
    mcoAirsideCore: {
      position: 'absolute',
      left: '25%',
      top: '25%',
      width: '50%',
      height: '50%',
      borderRadius: 8,
      backgroundColor: 'rgba(255, 247, 222, 0.95)',
      borderWidth: 1.5,
      borderColor: '#4F5E69',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
    mcoAirsideTitle: {
      color: '#1D4B5D',
      fontSize: 9,
      fontWeight: '900',
    },
    mcoConcourseFinger1A: {
      position: 'absolute',
      left: 0,
      top: '10%',
      width: '45%',
      height: '25%',
      borderWidth: 1.5,
      borderColor: '#4F5E69',
      backgroundColor: 'rgba(255, 247, 222, 0.9)',
      borderRadius: 4,
      transform: [{ rotate: '-25deg' }],
    },
    mcoConcourseFinger1B: {
      position: 'absolute',
      left: 0,
      bottom: '10%',
      width: '45%',
      height: '25%',
      borderWidth: 1.5,
      borderColor: '#4F5E69',
      backgroundColor: 'rgba(255, 247, 222, 0.9)',
      borderRadius: 4,
      transform: [{ rotate: '25deg' }],
    },
    mcoAirside2Hub: {
      position: 'absolute',
      right: '12%',
      top: '18%',
      width: '18%',
      height: '16%',
    },
    mcoConcourseFinger2A: {
      position: 'absolute',
      right: 0,
      top: '10%',
      width: '45%',
      height: '25%',
      borderWidth: 1.5,
      borderColor: '#4F5E69',
      backgroundColor: 'rgba(255, 247, 222, 0.9)',
      borderRadius: 4,
      transform: [{ rotate: '25deg' }],
    },
    mcoConcourseFinger2B: {
      position: 'absolute',
      right: 0,
      bottom: '10%',
      width: '45%',
      height: '25%',
      borderWidth: 1.5,
      borderColor: '#4F5E69',
      backgroundColor: 'rgba(255, 247, 222, 0.9)',
      borderRadius: 4,
      transform: [{ rotate: '-25deg' }],
    },
    mcoAirside3Hub: {
      position: 'absolute',
      left: '12%',
      bottom: '18%',
      width: '18%',
      height: '16%',
    },
    mcoConcourseFinger3A: {
      position: 'absolute',
      left: 0,
      top: '10%',
      width: '45%',
      height: '25%',
      borderWidth: 1.5,
      borderColor: '#4F5E69',
      backgroundColor: 'rgba(255, 247, 222, 0.9)',
      borderRadius: 4,
      transform: [{ rotate: '25deg' }],
    },
    mcoConcourseFinger3B: {
      position: 'absolute',
      left: 0,
      bottom: '10%',
      width: '45%',
      height: '25%',
      borderWidth: 1.5,
      borderColor: '#4F5E69',
      backgroundColor: 'rgba(255, 247, 222, 0.9)',
      borderRadius: 4,
      transform: [{ rotate: '-25deg' }],
    },
    mcoAirside4Hub: {
      position: 'absolute',
      right: '12%',
      bottom: '18%',
      width: '18%',
      height: '16%',
    },
    mcoConcourseFinger4A: {
      position: 'absolute',
      right: 0,
      top: '10%',
      width: '45%',
      height: '25%',
      borderWidth: 1.5,
      borderColor: '#4F5E69',
      backgroundColor: 'rgba(255, 247, 222, 0.9)',
      borderRadius: 4,
      transform: [{ rotate: '-25deg' }],
    },
    mcoConcourseFinger4B: {
      position: 'absolute',
      right: 0,
      bottom: '10%',
      width: '45%',
      height: '25%',
      borderWidth: 1.5,
      borderColor: '#4F5E69',
      backgroundColor: 'rgba(255, 247, 222, 0.9)',
      borderRadius: 4,
      transform: [{ rotate: '25deg' }],
    },
    mcoTermCOuter: {
      position: 'absolute',
      left: '36%',
      bottom: '12%',
      width: '28%',
      height: '11%',
      borderRadius: 8,
      backgroundColor: 'rgba(231, 244, 248, 0.98)',
      borderWidth: 2,
      borderColor: '#4F5E69',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#17334A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    mcoTermCConcourse: {
      position: 'absolute',
      bottom: -8,
      width: '40%',
      height: '60%',
      borderWidth: 1.5,
      borderColor: '#4F5E69',
      backgroundColor: 'rgba(231, 244, 248, 0.95)',
      borderRadius: 4,
    },
    mcoTermCGates: {
      position: 'absolute',
      bottom: -12,
      width: '80%',
      height: 6,
      backgroundColor: 'rgba(79, 94, 105, 0.45)',
      borderRadius: 2,
    },
    mcoTermCTitle: {
      color: '#1D4B5D',
      fontSize: 11,
      fontWeight: '900',
      zIndex: 2,
    },
    airportTag: {
      position: 'absolute',
      right: 16,
      top: 18,
      backgroundColor: isDark ? 'rgba(10, 18, 28, 0.86)' : 'rgba(255, 255, 255, 0.88)',
      borderRadius: theme.roundness.md,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      maxWidth: 190,
    },
    airportTagCode: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.8,
    },
    airportTagName: {
      color: theme.colors.textMuted,
      fontSize: 11,
      marginTop: 2,
    },
    meWrap: {
      position: 'absolute',
      marginLeft: -18,
      marginTop: -28,
      alignItems: 'center',
    },
    meLabel: {
      backgroundColor: theme.colors.primary,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginBottom: 5,
    },
    meLabelText: {
      color: theme.colors.background,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.6,
    },
    meDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 3,
      borderColor: theme.colors.surface,
      backgroundColor: theme.colors.primary,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 5,
      elevation: 4,
    },
    meMarkerContainer: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999,
      transform: Platform.OS === 'web'
        ? ('translate(-50%, -85%)' as any)
        : undefined,
    },
    meMarkerBubble: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: theme.colors.surface,
      marginBottom: 3,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 3,
      elevation: 4,
    },
    meMarkerBubbleText: {
      color: theme.colors.background,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.4,
    },
    meAvatarContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.accent,
      borderWidth: 2,
      borderColor: theme.colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 5,
    },
    meAvatarImage: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    meAvatarInitials: {
      color: theme.colors.background,
      fontSize: 12,
      fontWeight: '900',
    },
    meMarkerDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.colors.accent,
      borderWidth: 1.5,
      borderColor: theme.colors.surface,
      marginTop: 2,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.12,
      shadowRadius: 2,
      elevation: 2,
    },
    airportConnector: {
      position: 'absolute',
      height: 2,
      backgroundColor: theme.colors.accent,
      transformOrigin: 'left center',
    },
    pinWrapper: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
      transform: Platform.OS === 'web'
        ? ('translate(-50%, -50%)' as any)
        : [{ translateX: -17 }, { translateY: -17 }],
    },
    pin: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.colors.accent,
      borderWidth: 2,
      borderColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.16,
      shadowRadius: 6,
      elevation: 4,
    },
    pinFavorite: {
      backgroundColor: theme.colors.primary,
      transform: [{ scale: 1.14 }],
    },
    pinSelected: {
      transform: [{ scale: 1.18 }],
      borderWidth: 3,
      shadowOpacity: 0.26,
      shadowRadius: 10,
    },
    pinPulse: {
      position: 'absolute',
      width: 52,
      height: 52,
      borderRadius: 26,
      borderWidth: 2,
      borderColor: theme.colors.accent,
      opacity: 0.4,
    },
    pinCompact: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1.5,
    },
    mallPin: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 14,
      borderWidth: 1.5,
      gap: 4,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
    mallPinSelected: {
      transform: Platform.OS === 'web'
        ? ('scale(1.15)' as any)
        : [{ scale: 1.15 }],
      shadowOpacity: 0.35,
      shadowRadius: 6,
      elevation: 8,
    },
    mallPinText: {
      color: theme.colors.background,
      fontSize: 10,
      fontWeight: '900',
    },
    legendCard: {
      position: 'absolute',
      left: 16,
      bottom: 18,
      backgroundColor: isDark ? 'rgba(10, 18, 28, 0.86)' : 'rgba(255, 255, 255, 0.9)',
      borderRadius: theme.roundness.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    legendCardBlueprint: {
      backgroundColor: isDark ? 'rgba(10, 18, 28, 0.92)' : 'rgba(255, 255, 255, 0.94)',
    },
    legendTitle: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '800',
    },
    legendText: {
      color: theme.colors.textMuted,
      fontSize: 11,
      marginTop: 3,
    },
    legendMeta: {
      color: theme.colors.accent,
      fontSize: 10,
      marginTop: 5,
      fontWeight: '700',
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
  });
