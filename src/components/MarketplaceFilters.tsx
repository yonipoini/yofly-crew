import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useTheme } from '../theme/theme';
import { getListingCategoryLabel, ListingCategory } from '../types/marketplace';
import { AirportSearchService } from '../services/AirportSearchService';

interface MarketplaceFiltersProps {
  selectedAirport: string;
  selectedCategory: ListingCategory | 'ALL';
  localOnly?: boolean;
  browseLayoutMode?: 'LIST' | 'MAP';
  radiusMiles?: number;
  onSelectAirport: (code: string) => void;
  onSelectCategory: (cat: ListingCategory | 'ALL') => void;
  onToggleLocalOnly?: () => void;
  onSelectBrowseLayoutMode?: (mode: 'LIST' | 'MAP') => void;
  onSelectRadiusMiles?: (miles: number) => void;
}

const CATEGORY_OPTIONS: Array<{ id: ListingCategory | 'ALL'; label: string }> = [
  { id: 'ALL', label: 'All Types' },
  { id: ListingCategory.CRASH_PAD, label: getListingCategoryLabel(ListingCategory.CRASH_PAD) },
  { id: ListingCategory.PRIVATE_ROOM, label: getListingCategoryLabel(ListingCategory.PRIVATE_ROOM) },
  { id: ListingCategory.ITEM, label: getListingCategoryLabel(ListingCategory.ITEM) },
  { id: ListingCategory.SERVICE, label: getListingCategoryLabel(ListingCategory.SERVICE) },
];

const RADIUS_OPTIONS = [5, 10, 25, 50];

export const MarketplaceFilters: React.FC<MarketplaceFiltersProps> = ({
  selectedAirport,
  selectedCategory,
  localOnly = false,
  browseLayoutMode = 'LIST',
  radiusMiles = 25,
  onSelectAirport,
  onSelectCategory,
  onToggleLocalOnly,
  onSelectBrowseLayoutMode,
  onSelectRadiusMiles,
}) => {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [airportQuery, setAirportQuery] = React.useState(selectedAirport === 'ANY' ? '' : selectedAirport);
  const selectedAirportDetails =
    selectedAirport === 'ANY' ? null : AirportSearchService.getAirportByCode(selectedAirport);
  const airportSuggestions = React.useMemo(
    () => (airportQuery.trim().length > 0 ? AirportSearchService.searchUsAirports(airportQuery, 5) : []),
    [airportQuery]
  );

  React.useEffect(() => {
    setAirportQuery(selectedAirport === 'ANY' ? '' : selectedAirport);
  }, [selectedAirport]);

  const handleAirportQueryChange = (value: string) => {
    const nextValue = value.toUpperCase();
    setAirportQuery(nextValue);

    if (!nextValue.trim()) {
      onSelectAirport('ANY');
      return;
    }

    const exactAirport = AirportSearchService.resolveUsAirport(nextValue);
    if (exactAirport) {
      onSelectAirport(exactAirport.code);
    }
  };

  const handleSelectAirport = (airportCode: string) => {
    setAirportQuery(airportCode);
    onSelectAirport(airportCode);
  };

  const handleClearAirport = () => {
    setAirportQuery('');
    onSelectAirport('ANY');
  };

  return (
    <View style={styles.container}>
      {onSelectBrowseLayoutMode ? (
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeButton, browseLayoutMode === 'LIST' && styles.modeButtonActive]}
            onPress={() => onSelectBrowseLayoutMode('LIST')}
          >
            <Text style={[styles.modeButtonText, browseLayoutMode === 'LIST' && styles.modeButtonTextActive]}>
              Listing View
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, browseLayoutMode === 'MAP' && styles.modeButtonActive]}
            onPress={() => onSelectBrowseLayoutMode('MAP')}
          >
            <Text style={[styles.modeButtonText, browseLayoutMode === 'MAP' && styles.modeButtonTextActive]}>
              Map View
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.airportSearchWrap}>
        <View style={styles.airportSearchInputWrap}>
          <Ionicons name="search-outline" size={18} color={theme.colors.textMuted} />
          <TextInput
            value={airportQuery}
            onChangeText={handleAirportQueryChange}
            placeholder="Airport code or city"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            style={styles.airportSearchInput}
            maxLength={40}
          />
          {selectedAirport !== 'ANY' || airportQuery.trim().length > 0 ? (
            <TouchableOpacity
              style={styles.airportClearButton}
              onPress={handleClearAirport}
              accessibilityRole="button"
              accessibilityLabel="Clear airport filter"
            >
              <Ionicons name="close" size={16} color={theme.colors.text} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.airportStatusRow}>
          <TouchableOpacity
            style={[styles.airportChip, selectedAirport === 'ANY' && styles.airportChipActive]}
            onPress={handleClearAirport}
          >
            <Text style={[styles.airportChipText, selectedAirport === 'ANY' && styles.airportChipTextActive]}>
              All airports
            </Text>
          </TouchableOpacity>
          {selectedAirportDetails ? (
            <View style={styles.selectedAirportPill}>
              <Text style={styles.selectedAirportCode}>{selectedAirportDetails.code}</Text>
              <Text style={styles.selectedAirportName} numberOfLines={1}>
                {selectedAirportDetails.name}
              </Text>
            </View>
          ) : null}
        </View>

        {airportSuggestions.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionRow}>
            {airportSuggestions.map((airport) => {
              const active = selectedAirport === airport.code;

              return (
                <TouchableOpacity
                  key={airport.code}
                  style={[styles.airportSuggestion, active && styles.airportSuggestionActive]}
                  onPress={() => handleSelectAirport(airport.code)}
                >
                  <Text style={[styles.airportSuggestionCode, active && styles.airportSuggestionCodeActive]}>
                    {airport.code}
                  </Text>
                  <Text
                    style={[styles.airportSuggestionName, active && styles.airportSuggestionNameActive]}
                    numberOfLines={1}
                  >
                    {airport.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      {selectedAirport !== 'ANY' && onSelectRadiusMiles ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {RADIUS_OPTIONS.map((miles) => {
            const active = radiusMiles === miles;

            return (
              <TouchableOpacity
                key={miles}
                style={[styles.radiusChip, active && styles.radiusChipActive]}
                onPress={() => onSelectRadiusMiles(miles)}
              >
                <Text style={[styles.radiusChipText, active && styles.radiusChipTextActive]}>
                  {miles} mi
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {onToggleLocalOnly ? (
          <TouchableOpacity
            style={[styles.localChip, localOnly && styles.localChipActive]}
            onPress={onToggleLocalOnly}
          >
            <Text style={[styles.localChipText, localOnly && styles.localChipTextActive]}>
              Local pickup
            </Text>
          </TouchableOpacity>
        ) : null}
        {CATEGORY_OPTIONS.map((option) => {
          const active = selectedCategory === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              style={[styles.categoryChip, active && styles.categoryChipActive]}
              onPress={() => onSelectCategory(option.id)}
            >
              <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      gap: 12,
      paddingBottom: 12,
    },
    row: {
      paddingHorizontal: theme.spacing.md,
      gap: 10,
    },
    airportSearchWrap: {
      gap: 10,
      paddingHorizontal: theme.spacing.md,
    },
    airportSearchInputWrap: {
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      gap: 10,
    },
    airportSearchInput: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '800',
      paddingVertical: 10,
      outlineStyle: 'none' as never,
    },
    airportClearButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    airportStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    suggestionRow: {
      gap: 10,
      paddingRight: theme.spacing.md,
    },
    modeRow: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: theme.spacing.md,
    },
    modeButton: {
      flex: 1,
      alignItems: 'center',
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingVertical: 10,
    },
    modeButtonActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    modeButtonText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '900',
    },
    modeButtonTextActive: {
      color: theme.colors.background,
    },
    airportChip: {
      minWidth: 94,
      alignItems: 'center',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    airportChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    airportChipText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: '900',
    },
    airportChipTextActive: {
      color: theme.colors.background,
    },
    selectedAirportPill: {
      flex: 1,
      minHeight: 42,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.accent + '55',
      backgroundColor: theme.colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      gap: 8,
    },
    selectedAirportCode: {
      color: theme.colors.accent,
      fontSize: 13,
      fontWeight: '900',
    },
    selectedAirportName: {
      flex: 1,
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    airportSuggestion: {
      width: 170,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 2,
    },
    airportSuggestionActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary + '22',
    },
    airportSuggestionCode: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '900',
    },
    airportSuggestionCodeActive: {
      color: theme.colors.primary,
    },
    airportSuggestionName: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    airportSuggestionNameActive: {
      color: theme.colors.text,
    },
    categoryChip: {
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
      paddingHorizontal: 2,
      paddingBottom: 8,
      marginRight: 18,
    },
    categoryChipActive: {
      borderBottomColor: theme.colors.accent,
    },
    categoryChipText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      fontWeight: '800',
    },
    categoryChipTextActive: {
      color: theme.colors.accent,
    },
    localChip: {
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginRight: 8,
    },
    localChipActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    localChipText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '900',
    },
    localChipTextActive: {
      color: theme.colors.background,
    },
    radiusChip: {
      minWidth: 70,
      alignItems: 'center',
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    radiusChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    radiusChipText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: '900',
    },
    radiusChipTextActive: {
      color: theme.colors.background,
    },
  });
