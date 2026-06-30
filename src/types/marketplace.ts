export enum ListingCategory {
  CRASH_PAD = 'CRASH_PAD',
  PRIVATE_ROOM = 'PRIVATE_ROOM',
  LONG_TERM_STAY = 'LONG_TERM_STAY',
  SHORT_TERM_STAY = 'SHORT_TERM_STAY',
  ITEM = 'ITEM',
  SERVICE = 'SERVICE',
}

export enum MarketplaceVertical {
  REAL_ESTATE = 'REAL_ESTATE',
  PRODUCTS = 'PRODUCTS',
  SERVICES = 'SERVICES',
}

export enum GenderPreference {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  MIXED = 'MIXED',
}

export interface Listing {
  id: string;
  hostId?: string;
  title: string;
  category: ListingCategory;
  priceMonthly: number;
  airportCode: string;
  distanceToAirport: string;
  bedsAvailable: number;
  genderPreference: GenderPreference;
  isCrewVerified: boolean;
  imageUrl?: string;
  imageUrls: string[];
  imageRefs?: string[];
  description: string;
  amenities: string[];
  hostName: string;
  hostBaseAirport?: string;
  hostJoinedAt?: string;
  hostListingCount?: number;
  createdAt: string; // ISO string
  details?: ListingDetails;
}

export interface CreateListingInput {
  title: string;
  category: ListingCategory;
  priceMonthly: number;
  airportCode: string;
  distanceToAirport: string;
  bedsAvailable: number;
  genderPreference: GenderPreference;
  description: string;
  amenities: string[];
  imageUrl?: string;
  imageUrls: string[];
  details?: ListingDetails;
}

export interface HousingListingDetails {
  bathrooms?: string;
  leaseType?: string;
  parking?: string;
  petPolicy?: string;
}

export interface ProductListingDetails {
  condition?: string;
  brand?: string;
  fulfillment?: string;
}

export interface ServiceListingDetails {
  availabilityWindows?: string;
  deliveryRadius?: string;
  bookingMethod?: string;
}

export type LocalPickupMode = 'EXACT_AFTER_CONTACT' | 'PUBLIC_MEETUP' | 'AIRPORT_HANDOFF' | 'DELIVERY_LOCAL';

export interface LocalListingDetails {
  isLocalPickup: boolean;
  pickupMode?: LocalPickupMode;
  pickupAddress?: string;
  mapAreaLabel?: string;
  latitude?: number;
  longitude?: number;
}

export interface MarketplaceListingDetails {
  status?: 'ACTIVE' | 'PAUSED';
  listedAt?: string;
  lastRenewedAt?: string;
  renewEligibleAt?: string;
  expiresAt?: string;
  updatedAt?: string;
}

export interface ListingDetails {
  housing?: HousingListingDetails;
  product?: ProductListingDetails;
  service?: ServiceListingDetails;
  local?: LocalListingDetails;
  marketplace?: MarketplaceListingDetails;
}

export const getMarketplaceVertical = (category: ListingCategory): MarketplaceVertical => {
  switch (category) {
    case ListingCategory.CRASH_PAD:
    case ListingCategory.PRIVATE_ROOM:
    case ListingCategory.LONG_TERM_STAY:
    case ListingCategory.SHORT_TERM_STAY:
      return MarketplaceVertical.REAL_ESTATE;
    case ListingCategory.ITEM:
      return MarketplaceVertical.PRODUCTS;
    case ListingCategory.SERVICE:
    default:
      return MarketplaceVertical.SERVICES;
  }
};

export const getListingCategoryLabel = (category: ListingCategory) => {
  switch (category) {
    case ListingCategory.CRASH_PAD:
      return 'Crash Pad';
    case ListingCategory.PRIVATE_ROOM:
      return 'Private Room';
    case ListingCategory.LONG_TERM_STAY:
      return 'Long-Term Stay';
    case ListingCategory.SHORT_TERM_STAY:
      return 'Short-Term Stay';
    case ListingCategory.ITEM:
      return 'Product';
    case ListingCategory.SERVICE:
      return 'Service';
    default:
      return category;
  }
};

export const getMarketplaceVerticalLabel = (vertical: MarketplaceVertical | 'ALL') => {
  switch (vertical) {
    case MarketplaceVertical.REAL_ESTATE:
      return 'Real Estate';
    case MarketplaceVertical.PRODUCTS:
      return 'Products';
    case MarketplaceVertical.SERVICES:
      return 'Services';
    case 'ALL':
    default:
      return 'Everything';
  }
};
