import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useTheme } from '../src/theme/theme';
import { useAuth } from '../src/context/AuthContext';
import { useProfile } from '../src/context/ProfileContext';
import { DragPinLocationPicker } from '../src/components/DragPinLocationPicker';
import { AirportOption, AirportSearchService } from '../src/services/AirportSearchService';
import { MarketplaceCoordinate, MarketplaceLocationService } from '../src/services/MarketplaceLocationService';
import {
  CreateListingInput,
  GenderPreference,
  getListingCategoryLabel,
  getMarketplaceVertical,
  ListingCategory,
  LocalPickupMode,
  MarketplaceVertical,
} from '../src/types/marketplace';
import { MarketplaceService } from '../src/services/MarketplaceService';
import { getActiveOpsAirportCode } from '../src/utils/airportContext';
import { AppSyncService } from '../src/services/AppSyncService';
import { supabase } from '../src/lib/supabase';

const VERTICAL_OPTIONS = [
  { value: MarketplaceVertical.REAL_ESTATE, label: 'Real Estate' },
  { value: MarketplaceVertical.PRODUCTS, label: 'Products' },
  { value: MarketplaceVertical.SERVICES, label: 'Services' },
] as const;

const CATEGORY_OPTIONS: Record<MarketplaceVertical, ListingCategory[]> = {
  [MarketplaceVertical.REAL_ESTATE]: [
    ListingCategory.CRASH_PAD,
    ListingCategory.PRIVATE_ROOM,
    ListingCategory.LONG_TERM_STAY,
    ListingCategory.SHORT_TERM_STAY,
  ],
  [MarketplaceVertical.PRODUCTS]: [ListingCategory.ITEM],
  [MarketplaceVertical.SERVICES]: [ListingCategory.SERVICE],
};

const GENDER_OPTIONS = [
  { value: GenderPreference.MIXED, label: 'Mixed' },
  { value: GenderPreference.FEMALE, label: 'Female' },
  { value: GenderPreference.MALE, label: 'Male' },
] as const;

const PICKUP_MODE_OPTIONS: Array<{ value: LocalPickupMode; label: string }> = [
  { value: 'EXACT_AFTER_CONTACT', label: 'Exact spot after contact' },
  { value: 'PUBLIC_MEETUP', label: 'Public meetup' },
  { value: 'AIRPORT_HANDOFF', label: 'Airport handoff' },
  { value: 'DELIVERY_LOCAL', label: 'Local delivery' },
];

export default function CreateListingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { profile, isReady: isProfileReady } = useProfile();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const activeAirportCode = getActiveOpsAirportCode(profile);
  const [draft, setDraft] = useState<CreateListingInput>({
    title: '',
    category: ListingCategory.CRASH_PAD,
    priceMonthly: 450,
    airportCode: activeAirportCode,
    distanceToAirport: '',
    bedsAvailable: 1,
    genderPreference: GenderPreference.MIXED,
    description: '',
    amenities: [],
    imageUrl: '',
    imageUrls: [],
  });
  const [amenitiesInput, setAmenitiesInput] = useState('');
  const [airportQuery, setAirportQuery] = useState(activeAirportCode);
  const [selectedAirport, setSelectedAirport] = useState<AirportOption | null>(
    AirportSearchService.resolveUsAirport(activeAirportCode)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState<'idle' | 'uploading' | 'saving'>('idle');
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [existingImageRefs, setExistingImageRefs] = useState<string[]>([]);
  const [selectedVertical, setSelectedVertical] = useState<MarketplaceVertical>(
    getMarketplaceVertical(ListingCategory.CRASH_PAD)
  );
  const [bathrooms, setBathrooms] = useState('');
  const [leaseType, setLeaseType] = useState('');
  const [parking, setParking] = useState('');
  const [petPolicy, setPetPolicy] = useState('');
  const [productCondition, setProductCondition] = useState('');
  const [productBrand, setProductBrand] = useState('');
  const [productFulfillment, setProductFulfillment] = useState('');
  const [serviceAvailability, setServiceAvailability] = useState('');
  const [serviceRadius, setServiceRadius] = useState('');
  const [serviceBookingMethod, setServiceBookingMethod] = useState('');
  const [isLocalPickup, setIsLocalPickup] = useState(true);
  const [hasSupabaseSession, setHasSupabaseSession] = useState(Boolean(user?.id));
  const [remoteMarketplaceVerified, setRemoteMarketplaceVerified] = useState<boolean | null>(null);
  const [pickupMode, setPickupMode] = useState<LocalPickupMode>('EXACT_AFTER_CONTACT');
  const [pickupAddress, setPickupAddress] = useState('');
  const [mapAreaLabel, setMapAreaLabel] = useState('');
  const [pinCoordinate, setPinCoordinate] = useState<MarketplaceCoordinate>(
    MarketplaceLocationService.getAirportCenter(activeAirportCode)
  );
  const [isMatchingAddress, setIsMatchingAddress] = useState(false);
  const [locationMatchMessage, setLocationMatchMessage] = useState('');
  const [isLoadingExisting, setIsLoadingExisting] = useState(Boolean(id));
  const [didTouchAirport, setDidTouchAirport] = useState(Boolean(id));
  const submitPressLock = useRef(false);

  const airportSuggestions = useMemo(
    () => AirportSearchService.searchUsAirports(airportQuery, 3),
    [airportQuery]
  );

  const showSuggestions =
    airportQuery.trim().length > 0 &&
    (!selectedAirport || airportQuery.trim().toUpperCase() !== selectedAirport.code);

  const updateField = <K extends keyof CreateListingInput>(key: K, value: CreateListingInput[K]) => {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const isHousing = getMarketplaceVertical(draft.category) === MarketplaceVertical.REAL_ESTATE;
  const isProduct = getMarketplaceVertical(draft.category) === MarketplaceVertical.PRODUCTS;
  const isService = getMarketplaceVertical(draft.category) === MarketplaceVertical.SERVICES;
  const resolvedAirport =
    selectedAirport ||
    AirportSearchService.resolveUsAirport(airportQuery) ||
    null;
  const hasAuthSession = hasSupabaseSession || Boolean(user?.id) || profile.verifiedCrew || profile.verifiedMarketplace;
  const hasMarketplaceAccess =
    hasAuthSession && (profile.verifiedCrew || profile.verifiedMarketplace || remoteMarketplaceVerified);
  const canPublish =
    draft.title.trim().length > 0 &&
    draft.description.trim().length > 0 &&
    Boolean(resolvedAirport) &&
    draft.priceMonthly > 0 &&
    (!isHousing || draft.bedsAvailable > 0);

  const pricePlaceholder = isHousing ? 'Monthly price' : isProduct ? 'Listing price' : 'Starting price';
  const logisticsPlaceholder = isHousing
    ? '10 min from airport'
    : isProduct
      ? 'Meet at terminal / crew lounge'
      : 'Service area or delivery details';
  const descriptionPlaceholder = isHousing
    ? 'Describe the space, setup, nearby access, and any house rules crew should know.'
    : isProduct
      ? 'Describe the item, condition, what is included, and how handoff works.'
      : 'Describe the service, availability, and how crew should book or coordinate.';
  const amenitiesPlaceholder = isHousing
    ? 'Amenities, comma separated'
    : isProduct
      ? 'Item details, comma separated'
      : 'Service perks, comma separated';
  const amenitiesHint = isHousing
    ? 'Example: WiFi, Laundry, Quiet hours, Blackout curtains, Parking'
    : isProduct
      ? 'Example: Bluetooth, Case included, Receipt available, Charger'
      : 'Example: Airport pickup, Meal prep, Late-night availability, Crew discount';
  const detailsTitle = isHousing ? 'Space Details' : isProduct ? 'Product Details' : 'Service Details';
  const detailsIntro = isHousing
    ? 'Give crew enough specifics to decide if the stay actually works for their trip pattern.'
    : isProduct
      ? 'Show what the item is, how good the condition is, and how the handoff works.'
      : 'Explain what the service covers, where it is available, and what crew should expect.';
  const isEditing = Boolean(id);
  const publishHelper = submitStage === 'uploading'
    ? 'Uploading your private listing photo.'
    : submitStage === 'saving'
      ? 'Saving your listing to the verified crew marketplace.'
      : isHousing
        ? 'Housing posts stay visible only inside the verified crew marketplace.'
        : isProduct
          ? 'Product listings stay limited to verified crew buyers and sellers.'
          : 'Service listings stay limited to verified crew contact and booking.';
  const submitLabel = !hasAuthSession
    ? 'Sign in to publish'
    : !hasMarketplaceAccess
      ? 'Crew verification required'
      : submitStage === 'uploading'
        ? 'Uploading Photo...'
        : submitStage === 'saving'
          ? isEditing ? 'Saving Changes...' : 'Publishing Listing...'
          : isEditing ? 'Save Changes' : 'Publish Listing';
  const submitDisabled = !canPublish || isSubmitting || isLoadingExisting;

  useEffect(() => {
    let active = true;

    const refreshSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      const sessionUserId = session?.user?.id;
      setHasSupabaseSession(Boolean(sessionUserId));

      if (!sessionUserId) {
        setRemoteMarketplaceVerified(null);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('verified_crew, verified_marketplace')
        .eq('id', sessionUserId)
        .maybeSingle();

      if (active) {
        setRemoteMarketplaceVerified(
          error ? null : Boolean(data?.verified_crew || data?.verified_marketplace)
        );
      }
    };

    void refreshSession();

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!id) {
      setIsLoadingExisting(false);
      return;
    }

    let active = true;

    const loadListing = async () => {
      const existing = await MarketplaceService.getListingById(id);

      if (!active || !existing) {
        setIsLoadingExisting(false);
        return;
      }

      setDraft({
        title: existing.title,
        category: existing.category,
        priceMonthly: existing.priceMonthly,
        airportCode: existing.airportCode,
        distanceToAirport: existing.distanceToAirport,
        bedsAvailable: existing.bedsAvailable,
        genderPreference: existing.genderPreference,
        description: existing.description,
        amenities: existing.amenities,
        imageUrl: existing.imageUrl,
        imageUrls: existing.imageUrls,
        details: existing.details,
      });
      setSelectedVertical(getMarketplaceVertical(existing.category));
      setAirportQuery(existing.airportCode);
      setSelectedAirport(AirportSearchService.resolveUsAirport(existing.airportCode));
      setAmenitiesInput(existing.amenities.join(', '));
      setBathrooms(existing.details?.housing?.bathrooms || '');
      setLeaseType(existing.details?.housing?.leaseType || '');
      setParking(existing.details?.housing?.parking || '');
      setPetPolicy(existing.details?.housing?.petPolicy || '');
      setProductCondition(existing.details?.product?.condition || '');
      setProductBrand(existing.details?.product?.brand || '');
      setProductFulfillment(existing.details?.product?.fulfillment || '');
      setServiceAvailability(existing.details?.service?.availabilityWindows || '');
      setServiceRadius(existing.details?.service?.deliveryRadius || '');
      setServiceBookingMethod(existing.details?.service?.bookingMethod || '');
      setIsLocalPickup(existing.details?.local?.isLocalPickup ?? true);
      setPickupMode(existing.details?.local?.pickupMode || 'EXACT_AFTER_CONTACT');
      setPickupAddress('');
      setMapAreaLabel(existing.details?.local?.mapAreaLabel || '');
      setPinCoordinate({
        latitude:
          typeof existing.details?.local?.latitude === 'number'
            ? existing.details.local.latitude
            : MarketplaceLocationService.getAirportCenter(existing.airportCode).latitude,
        longitude:
          typeof existing.details?.local?.longitude === 'number'
            ? existing.details.local.longitude
            : MarketplaceLocationService.getAirportCenter(existing.airportCode).longitude,
      });
      setImageUris(existing.imageUrls);
      setExistingImageRefs(existing.imageRefs || []);
      setIsLoadingExisting(false);
    };

    void loadListing();

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (id || !isProfileReady || didTouchAirport) {
      return;
    }

    const nextAirport = AirportSearchService.resolveUsAirport(activeAirportCode);
    setSelectedAirport(nextAirport);
    setAirportQuery(nextAirport?.code || activeAirportCode);
    updateField('airportCode', nextAirport?.code || activeAirportCode);
    setPinCoordinate(MarketplaceLocationService.getAirportCenter(nextAirport?.code || activeAirportCode));
  }, [activeAirportCode, didTouchAirport, id, isProfileReady]);

  const handleSelectAirport = (airport: AirportOption) => {
    setDidTouchAirport(true);
    setSelectedAirport(airport);
    setAirportQuery(airport.code);
    updateField('airportCode', airport.code);
    setPinCoordinate(MarketplaceLocationService.getAirportCenter(airport.code));
    setLocationMatchMessage('');
  };

  const handleSelectVertical = (vertical: MarketplaceVertical) => {
    setSelectedVertical(vertical);
    const nextCategory = CATEGORY_OPTIONS[vertical][0];
    updateField('category', nextCategory);
  };

  const handleSubmit = async () => {
    if (!draft.title.trim() || !draft.description.trim()) {
      Alert.alert('Missing Info', 'Add a title and description before publishing a listing.');
      return;
    }

    if (!resolvedAirport) {
      Alert.alert('Missing Airport', 'Pick a valid US airport for this listing.');
      return;
    }

    if (draft.priceMonthly <= 0) {
      Alert.alert('Missing Price', 'Add a valid monthly price or listing price before publishing.');
      return;
    }

    if (isHousing && draft.bedsAvailable <= 0) {
      Alert.alert('Missing Beds', 'Housing listings should include how many beds are available.');
      return;
    }

    setIsSubmitting(true);

    try {
      let uploadedImagePaths: string[] = [];
      let finalImageRefs = existingImageRefs.filter((_, index) => Boolean(imageUris[index]));
      const newImageUris = imageUris.filter((_, index) => !existingImageRefs[index]);

      if (newImageUris.length > 0) {
        if (!user) {
          throw new Error('You need to be signed in to upload listing photos.');
        }

        setSubmitStage('uploading');
        uploadedImagePaths = await MarketplaceService.uploadListingImages(user.id, newImageUris);
        finalImageRefs = [...finalImageRefs, ...uploadedImagePaths];
      }

      setSubmitStage('saving');
      const localDetails = {
        isLocalPickup,
        pickupMode,
        mapAreaLabel: mapAreaLabel.trim() || undefined,
        latitude: pinCoordinate.latitude,
        longitude: pinCoordinate.longitude,
      };
      const verticalDetails = isHousing
        ? {
            housing: {
              bathrooms: bathrooms.trim() || undefined,
              leaseType: leaseType.trim() || undefined,
              parking: parking.trim() || undefined,
              petPolicy: petPolicy.trim() || undefined,
            },
          }
        : isProduct
          ? {
              product: {
                condition: productCondition.trim() || undefined,
                brand: productBrand.trim() || undefined,
                fulfillment: productFulfillment.trim() || undefined,
              },
            }
          : {
              service: {
                availabilityWindows: serviceAvailability.trim() || undefined,
                deliveryRadius: serviceRadius.trim() || undefined,
                bookingMethod: serviceBookingMethod.trim() || undefined,
              },
            };
      const marketplaceDetails = (draft.details as { marketplace?: unknown } | undefined)?.marketplace;
      const payload: CreateListingInput = {
        ...draft,
        airportCode: resolvedAirport.code,
        distanceToAirport:
          draft.distanceToAirport.trim() ||
          mapAreaLabel.trim() ||
          `${resolvedAirport.code} area`,
        imageUrl: finalImageRefs[0] || undefined,
        imageUrls: finalImageRefs,
        amenities: amenitiesInput
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        details: {
          ...verticalDetails,
          local: localDetails,
          ...(marketplaceDetails ? { marketplace: marketplaceDetails } : {}),
        },
      };

      if (isEditing && id) {
        await MarketplaceService.updateListing(id, payload);
        AppSyncService.emit('marketplace');
        Alert.alert('Listing Updated', 'Your crew marketplace listing has been updated.');
        router.replace(`/listing/${id}`);
        return;
      }

      const listingId = await MarketplaceService.createListing(payload);

      AppSyncService.emit('marketplace');
      Alert.alert('Listing Posted', 'Your crew marketplace listing is now live.');
      router.replace(`/listing/${listingId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create listing.';
      Alert.alert('Listing Failed', message);
    } finally {
      setIsSubmitting(false);
      setSubmitStage('idle');
    }
  };

  const handleSubmitPress = () => {
    if (submitPressLock.current || !canPublish || isSubmitting || isLoadingExisting) {
      return;
    }

    if (!hasAuthSession) {
      Alert.alert(
        'Sign In Required',
        'Sign in with your airline work email before publishing marketplace listings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/auth') },
        ]
      );
      return;
    }

    if (!hasMarketplaceAccess) {
      Alert.alert(
        'Crew Verification Required',
        'Complete crew verification with your airline work email before publishing listings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Request Review', onPress: () => router.push('/manual-review') },
        ]
      );
      return;
    }

    submitPressLock.current = true;
    void handleSubmit().finally(() => {
      submitPressLock.current = false;
    });
  };

  const handlePickListingPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Photo Permission', 'Allow photo access to upload a marketplace listing photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      allowsMultipleSelection: true,
      selectionLimit: 6,
      quality: 0.9,
    });

    if (!result.canceled && result.assets.length > 0) {
      setImageUris(result.assets.map((asset) => asset.uri).filter(Boolean));
      setExistingImageRefs([]);
    }
  };

  const removeImageAtIndex = (index: number) => {
    setImageUris((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setExistingImageRefs((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleMatchAddressToPin = async () => {
    if (!resolvedAirport) {
      Alert.alert('Pick Airport First', 'Choose the airport this listing serves before matching an address.');
      return;
    }

    if (!pickupAddress.trim()) {
      Alert.alert('Add Address', 'Enter an address, cross street, neighborhood, or pickup note first.');
      return;
    }

    setIsMatchingAddress(true);

    try {
      const result = await MarketplaceLocationService.geocodeAddress(pickupAddress, resolvedAirport.code);
      setPinCoordinate(result.coordinate);
      if (!mapAreaLabel.trim()) {
        setMapAreaLabel(result.label);
      }
      setLocationMatchMessage(
        result.source === 'google'
          ? 'Address matched. You can still drag the pin to keep the public marker approximate.'
          : result.message || 'Address verification is off. Drag the pin near the public pickup area.'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to match that address right now.';
      Alert.alert('Address Match Failed', message);
    } finally {
      setIsMatchingAddress(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditing ? 'Edit Listing' : 'New Listing'}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {isLoadingExisting ? (
            <View style={styles.card}>
              <Text style={styles.helperText}>Loading listing details...</Text>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Listing Basics</Text>
                <TextInput
                  style={styles.input}
                  value={draft.title}
                  onChangeText={(value) => updateField('title', value)}
                  placeholder="Listing title"
                  placeholderTextColor={theme.colors.textMuted}
                />
                <Text style={styles.helperText}>
                  Keep it specific: airport, room type, and one strong detail usually converts best.
                </Text>

                <Text style={styles.fieldLabel}>Category</Text>
                <Text style={styles.helperText}>
                  Start broad, then pick the listing type crew should expect to see.
                </Text>
                <View style={styles.chipRow}>
                  {VERTICAL_OPTIONS.map((option) => {
                    const active = selectedVertical === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => handleSelectVertical(option.value)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.fieldLabel}>Subcategory</Text>
                <View style={styles.chipRow}>
                  {CATEGORY_OPTIONS[selectedVertical].map((category) => {
                    const active = draft.category === category;
                    return (
                      <TouchableOpacity
                        key={category}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => updateField('category', category)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {getListingCategoryLabel(category)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.fieldLabel}>Base airport</Text>
                <Text style={styles.helperText}>
                  Use the airport this listing really serves, not just the city name.
                </Text>
                <View style={styles.searchInputWrap}>
                  <Ionicons name="search" size={18} color={theme.colors.textMuted} />
                  <TextInput
                    value={airportQuery}
                    onChangeText={(value) => {
                      setDidTouchAirport(true);
                      setAirportQuery(value);
                      setSelectedAirport(null);
                    }}
                    placeholder="Search airport code or name"
                    placeholderTextColor={theme.colors.textMuted}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    style={styles.searchInput}
                  />
                </View>

                {showSuggestions && (
                  <View style={styles.suggestionsCard}>
                    {airportSuggestions.map((airport) => (
                      <TouchableOpacity
                        key={airport.code}
                        style={styles.suggestionRow}
                        onPress={() => handleSelectAirport(airport)}
                      >
                        <Text style={styles.suggestionCode}>{airport.code}</Text>
                        <Text style={styles.suggestionName} numberOfLines={1}>
                          {airport.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {selectedAirport && (
                  <View style={styles.selectedAirportCard}>
                    <Ionicons name="airplane" size={16} color={theme.colors.background} />
                    <Text style={styles.selectedAirportCode}>{selectedAirport.code}</Text>
                    <Text style={styles.selectedAirportName} numberOfLines={1}>
                      {selectedAirport.name}
                    </Text>
                  </View>
                )}

                <View style={styles.localPickupHeader}>
                  <View style={styles.localPickupCopy}>
                    <Text style={styles.fieldLabel}>Local listing map</Text>
                    <Text style={styles.helperText}>
                      Show buyers only the general pickup area. Exact address details stay private until contact.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.togglePill, isLocalPickup && styles.togglePillActive]}
                    onPress={() => setIsLocalPickup((current) => !current)}
                  >
                    <Text style={[styles.togglePillText, isLocalPickup && styles.togglePillTextActive]}>
                      {isLocalPickup ? 'Local' : 'Hidden'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {isLocalPickup ? (
                  <>
                    <Text style={styles.fieldLabel}>Pickup style</Text>
                    <View style={styles.chipRow}>
                      {PICKUP_MODE_OPTIONS.map((option) => {
                        const active = pickupMode === option.value;
                        return (
                          <TouchableOpacity
                            key={option.value}
                            style={[styles.chip, active && styles.chipActive]}
                            onPress={() => setPickupMode(option.value)}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>
                              {option.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <Text style={styles.fieldLabel}>Public map label</Text>
                    <TextInput
                      style={styles.input}
                      value={mapAreaLabel}
                      onChangeText={setMapAreaLabel}
                      placeholder="Example: Kew Gardens, employee lot, hotel row"
                      placeholderTextColor={theme.colors.textMuted}
                    />
                    <Text style={styles.fieldLabel}>Address or pickup note</Text>
                    <Text style={styles.helperText}>
                      Used only to place the public area pin. Exact address details are not saved to the listing.
                    </Text>
                    <View style={styles.addressMatchRow}>
                      <View style={styles.addressField}>
                        <TextInput
                          style={styles.input}
                          value={pickupAddress}
                          onChangeText={(value) => {
                            setPickupAddress(value);
                            setLocationMatchMessage('');
                          }}
                          placeholder="Address, cross street, city/state, or meetup note"
                          placeholderTextColor={theme.colors.textMuted}
                        />
                      </View>
                      <TouchableOpacity
                        style={[styles.matchAddressButton, isMatchingAddress && styles.matchAddressButtonDisabled]}
                        onPress={handleMatchAddressToPin}
                        disabled={isMatchingAddress}
                      >
                        <Ionicons name="locate-outline" size={16} color={theme.colors.background} />
                        <Text style={styles.matchAddressText}>
                          {isMatchingAddress ? 'Placing...' : 'Place'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {locationMatchMessage ? (
                      <View style={styles.locationMatchNotice}>
                        <Ionicons name="information-circle-outline" size={15} color={theme.colors.accent} />
                        <Text style={styles.locationMatchNoticeText}>{locationMatchMessage}</Text>
                      </View>
                    ) : null}
                    <DragPinLocationPicker
                      airportCode={resolvedAirport?.code || draft.airportCode}
                      coordinate={pinCoordinate}
                      onChange={setPinCoordinate}
                    />
                  </>
                ) : null}

                <Text style={styles.helperText}>
                  {imageUris.length > 0
                    ? `${imageUris.length} photo${imageUris.length === 1 ? '' : 's'} selected for this listing.`
                    : 'Add up to 6 photos so crew can quickly trust what they are seeing.'}
                </Text>

                <View style={styles.row}>
                  <View style={styles.halfField}>
                    <Text style={styles.fieldLabel}>{isHousing ? 'Price' : isProduct ? 'Price' : 'Starting price'}</Text>
                    <TextInput
                      style={[styles.input, styles.halfInput]}
                      value={String(draft.priceMonthly)}
                      onChangeText={(value) => updateField('priceMonthly', Number(value.replace(/[^0-9]/g, '')) || 0)}
                      placeholder={pricePlaceholder}
                      placeholderTextColor={theme.colors.textMuted}
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={styles.halfField}>
                    <Text style={styles.fieldLabel}>{isHousing ? 'Airport access' : isProduct ? 'Pickup / handoff' : 'Coverage area'}</Text>
                    <TextInput
                      style={[styles.input, styles.halfInput]}
                      value={draft.distanceToAirport}
                      onChangeText={(value) => updateField('distanceToAirport', value)}
                      placeholder={logisticsPlaceholder}
                      placeholderTextColor={theme.colors.textMuted}
                    />
                  </View>
                </View>

                {isHousing && (
                  <>
                    <View style={styles.row}>
                      <TextInput
                        style={[styles.input, styles.halfInput]}
                        value={String(draft.bedsAvailable)}
                        onChangeText={(value) => updateField('bedsAvailable', Number(value.replace(/[^0-9]/g, '')) || 0)}
                        placeholder="Beds"
                        placeholderTextColor={theme.colors.textMuted}
                        keyboardType="number-pad"
                      />
                    </View>

                    <Text style={styles.fieldLabel}>Gender preference</Text>
                    <View style={styles.chipRow}>
                      {GENDER_OPTIONS.map((option) => {
                        const active = draft.genderPreference === option.value;
                        return (
                          <TouchableOpacity
                            key={option.value}
                            style={[styles.chip, active && styles.chipActive]}
                            onPress={() => updateField('genderPreference', option.value)}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <Text style={styles.fieldLabel}>Bathrooms</Text>
                    <TextInput
                      style={styles.input}
                      value={bathrooms}
                      onChangeText={setBathrooms}
                      placeholder="1 bath, 2 shared baths, etc."
                      placeholderTextColor={theme.colors.textMuted}
                    />
                    <Text style={styles.fieldLabel}>Lease type</Text>
                    <TextInput
                      style={styles.input}
                      value={leaseType}
                      onChangeText={setLeaseType}
                      placeholder="Month-to-month, flexible, 6 months"
                      placeholderTextColor={theme.colors.textMuted}
                    />
                    <Text style={styles.fieldLabel}>Parking</Text>
                    <TextInput
                      style={styles.input}
                      value={parking}
                      onChangeText={setParking}
                      placeholder="Garage, driveway, street, none"
                      placeholderTextColor={theme.colors.textMuted}
                    />
                    <Text style={styles.fieldLabel}>Pet policy</Text>
                    <TextInput
                      style={styles.input}
                      value={petPolicy}
                      onChangeText={setPetPolicy}
                      placeholder="No pets, cats ok, small dogs ok"
                      placeholderTextColor={theme.colors.textMuted}
                    />
                  </>
                )}

                {isProduct && (
                  <>
                    <Text style={styles.fieldLabel}>Condition</Text>
                    <TextInput
                      style={styles.input}
                      value={productCondition}
                      onChangeText={setProductCondition}
                      placeholder="Like new, excellent, lightly used"
                      placeholderTextColor={theme.colors.textMuted}
                    />
                    <Text style={styles.fieldLabel}>Brand</Text>
                    <TextInput
                      style={styles.input}
                      value={productBrand}
                      onChangeText={setProductBrand}
                      placeholder="Bose, Apple, LuggageWorks"
                      placeholderTextColor={theme.colors.textMuted}
                    />
                    <Text style={styles.fieldLabel}>Fulfillment</Text>
                    <TextInput
                      style={styles.input}
                      value={productFulfillment}
                      onChangeText={setProductFulfillment}
                      placeholder="Meetup only, shipping available, airport handoff"
                      placeholderTextColor={theme.colors.textMuted}
                    />
                  </>
                )}

                {isService && (
                  <>
                    <Text style={styles.fieldLabel}>Availability windows</Text>
                    <TextInput
                      style={styles.input}
                      value={serviceAvailability}
                      onChangeText={setServiceAvailability}
                      placeholder="Weeknights, reserve days, weekends"
                      placeholderTextColor={theme.colors.textMuted}
                    />
                    <Text style={styles.fieldLabel}>Delivery radius</Text>
                    <TextInput
                      style={styles.input}
                      value={serviceRadius}
                      onChangeText={setServiceRadius}
                      placeholder="JFK hotels, 10-mile radius, airport lot only"
                      placeholderTextColor={theme.colors.textMuted}
                    />
                    <Text style={styles.fieldLabel}>Booking method</Text>
                    <TextInput
                      style={styles.input}
                      value={serviceBookingMethod}
                      onChangeText={setServiceBookingMethod}
                      placeholder="DM first, text to book, 24h notice"
                      placeholderTextColor={theme.colors.textMuted}
                    />
                  </>
                )}
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>{detailsTitle}</Text>
                <Text style={styles.helperText}>{detailsIntro}</Text>
                <TextInput
                  style={styles.textArea}
                  value={draft.description}
                  onChangeText={(value) => updateField('description', value)}
                  placeholder={descriptionPlaceholder}
                  placeholderTextColor={theme.colors.textMuted}
                  multiline
                />
                <TextInput
                  style={styles.input}
                  value={amenitiesInput}
                  onChangeText={setAmenitiesInput}
                  placeholder={amenitiesPlaceholder}
                  placeholderTextColor={theme.colors.textMuted}
                />
                <Text style={styles.helperText}>
                  {amenitiesHint}
                </Text>
                <Text style={styles.fieldLabel}>Listing photos</Text>
                <TouchableOpacity style={styles.imagePickerCard} onPress={handlePickListingPhoto}>
                  {imageUris.length > 0 ? (
                    <>
                      <Image source={{ uri: imageUris[0] }} style={styles.imagePreview} />
                      <View style={styles.imageOverlay}>
                        <Ionicons name="camera-reverse-outline" size={18} color={theme.colors.background} />
                        <Text style={styles.imageOverlayText}>
                          {imageUris.length > 1 ? `Replace Gallery (${imageUris.length})` : 'Change Photo'}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Ionicons name="images-outline" size={20} color={theme.colors.textMuted} />
                      <Text style={styles.imagePlaceholderText}>Attach listing photos</Text>
                      <Text style={styles.imagePlaceholderHint}>
                        Add up to 6 crew-only photos so the listing reads like a real gallery.
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                {imageUris.length > 0 && (
                  <>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.galleryStrip}
                    >
                      {imageUris.map((uri, index) => (
                        <View key={`${uri}-${index}`} style={styles.galleryThumbWrap}>
                          <Image source={{ uri }} style={styles.galleryThumb} />
                          <TouchableOpacity
                            style={styles.galleryRemoveButton}
                            onPress={() => removeImageAtIndex(index)}
                            disabled={isSubmitting}
                          >
                            <Ionicons name="close" size={12} color={theme.colors.background} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                    <TouchableOpacity
                      style={styles.removePhotoButton}
                      onPress={() => {
                        setImageUris([]);
                        setExistingImageRefs([]);
                      }}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.removePhotoText}>Clear Gallery</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>

              <View style={styles.submitCard}>
                <TouchableOpacity
                  accessibilityRole="button"
                  testID="listing-submit-button"
                  style={[styles.submitButton, submitDisabled && styles.submitButtonDisabled]}
                  onPress={handleSubmitPress}
                  disabled={submitDisabled}
                >
                  <Text style={styles.submitText}>{submitLabel}</Text>
                </TouchableOpacity>
                <Text style={styles.submitHelper}>
                  {publishHelper}
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    flex: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.md,
    },
    iconButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: '800',
    },
    headerSpacer: {
      width: 42,
    },
    content: {
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    sectionTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 4,
    },
    fieldLabel: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '700',
      marginTop: 4,
    },
    helperText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: -2,
    },
    input: {
      height: 52,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      color: theme.colors.text,
      paddingHorizontal: 14,
      fontSize: 16,
    },
    textArea: {
      minHeight: 120,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      color: theme.colors.text,
      paddingHorizontal: 14,
      paddingVertical: 14,
      fontSize: 16,
      textAlignVertical: 'top',
    },
    row: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      alignItems: 'flex-end',
    },
    halfField: {
      flex: 1,
      gap: 6,
    },
    halfInput: {
      flex: 1,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    chip: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.roundness.full,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: theme.colors.background,
    },
    chipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    chipText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    chipTextActive: {
      color: theme.colors.background,
    },
    searchInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      paddingHorizontal: theme.spacing.md,
      minHeight: 52,
    },
    searchInput: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    suggestionsCard: {
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      overflow: 'hidden',
    },
    suggestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    suggestionCode: {
      color: theme.colors.accent,
      fontSize: 13,
      fontWeight: '900',
      width: 40,
    },
    suggestionName: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    selectedAirportCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: theme.roundness.md,
      backgroundColor: theme.colors.accent,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    selectedAirportCode: {
      color: theme.colors.background,
      fontSize: 13,
      fontWeight: '900',
    },
    selectedAirportName: {
      flex: 1,
      color: theme.colors.background,
      fontSize: 13,
      fontWeight: '700',
    },
    localPickupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
      padding: theme.spacing.md,
    },
    localPickupCopy: {
      flex: 1,
      gap: 4,
    },
    togglePill: {
      minWidth: 76,
      alignItems: 'center',
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    togglePillActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    togglePillText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '900',
    },
    togglePillTextActive: {
      color: theme.colors.background,
    },
    addressMatchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    addressField: {
      flex: 1,
    },
    matchAddressButton: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: theme.roundness.md,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 14,
    },
    matchAddressButtonDisabled: {
      opacity: 0.6,
    },
    matchAddressText: {
      color: theme.colors.background,
      fontSize: 13,
      fontWeight: '900',
    },
    locationMatchNotice: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 7,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.accent + '44',
      backgroundColor: theme.colors.accent + '10',
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    locationMatchNoticeText: {
      flex: 1,
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '700',
    },
    imagePickerCard: {
      minHeight: 180,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    imagePreview: {
      width: '100%',
      height: 180,
    },
    imageOverlay: {
      position: 'absolute',
      right: 12,
      bottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.colors.background + 'D9',
      borderRadius: theme.roundness.full,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    imageOverlayText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '800',
    },
    galleryStrip: {
      gap: 10,
      paddingTop: 8,
      paddingBottom: 4,
    },
    galleryThumbWrap: {
      position: 'relative',
      marginRight: 2,
    },
    galleryThumb: {
      width: 86,
      height: 86,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
    },
    galleryRemoveButton: {
      position: 'absolute',
      right: 6,
      top: 6,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: theme.colors.background + 'D9',
      alignItems: 'center',
      justifyContent: 'center',
    },
    imagePlaceholder: {
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
    },
    imagePlaceholderText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
    },
    imagePlaceholderHint: {
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      textAlign: 'center',
    },
    removePhotoButton: {
      alignSelf: 'flex-start',
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.colors.background,
    },
    removePhotoText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '800',
    },
    submitCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    submitButton: {
      borderRadius: theme.roundness.full,
      backgroundColor: theme.colors.primary,
      paddingVertical: 18,
      alignItems: 'center',
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitText: {
      color: theme.colors.background,
      fontSize: 18,
      fontWeight: '900',
    },
    submitHelper: {
      color: theme.colors.textMuted,
      fontSize: 12,
      textAlign: 'center',
      marginTop: 10,
      paddingHorizontal: theme.spacing.sm,
    },
  });
