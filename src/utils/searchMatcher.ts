import { CrewLocation } from '../types/locations';

// Semantic keyword taxonomy mapping popular search terms to lists of related words, cuisines, or tags
export const SEARCH_TAXONOMY: Record<string, string[]> = {
  pizza: ['pizza', 'pizzeria', 'italian', 'slice', 'pie', 'gino', 'flatbread'],
  burgers: ['burger', 'hamburger', 'cheeseburger', 'shake shack', 'shack', 'grill', 'slider', 'fast food'],
  cafe: ['cafe', 'coffee', 'espresso', 'starbucks', 'dunkin', 'barista', 'peet', 'bakery', 'tea', 'latte'],
  coffee: ['coffee', 'cafe', 'espresso', 'starbucks', 'dunkin', 'barista', 'peet', 'bakery', 'tea', 'latte'],
  beer: ['beer', 'wine', 'bar', 'lounge', 'pub', 'draft', 'brewery', 'taproom', 'cocktail', 'nightlife', 'drinks'],
  wine: ['wine', 'beer', 'bar', 'lounge', 'pub', 'cocktail', 'nightlife', 'drinks', 'sommelier', 'cabernet'],
  bank: ['bank', 'atm', 'cash', 'money', 'exchange', 'currency', 'chase', 'terminal cash', 'finance'],
  atm: ['atm', 'bank', 'cash', 'money', 'exchange', 'currency', 'chase', 'terminal cash', 'finance'],
  chicken: ['chicken', 'chick-fil-a', 'wings', 'tenders', 'fried chicken', 'popeyes', 'poultry'],
  tacos: ['taco', 'taqueria', 'mexican', 'burrito', 'quesadilla', 'salsa', 'tortilla'],
  'sit down': ['restaurant', 'dining', 'table service', 'steakhouse', 'grill', 'bistro', 'sit-down', 'sit down', 'bar & grill'],
  restaurant: ['restaurant', 'dining', 'table service', 'steakhouse', 'grill', 'bistro', 'sit-down', 'sit down', 'bar & grill'],
  'car rentals': ['car rental', 'rentals', 'avis', 'hertz', 'enterprise', 'national car', 'budget', 'sixt', 'dollar', 'alamo'],
  hotel: ['hotel', 'motel', 'layover', 'crash pad', 'marriott', 'hilton', 'hyatt', 'twa', 'lodging', 'accommodation'],
  shopping: ['shop', 'shopping', 'retail', 'store', 'duty free', 'tumi', 'outlet', 'news', 'gift', 'convenience', 'magazine', 'cart']
};

/**
 * Matches a query against a location's properties, checking synonyms and taxonomy mapping.
 */
export function matchLocationQuery(location: CrewLocation, query: string): boolean {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return true;

  // 1. Check exact/substring name match
  const name = (location.name || '').toLowerCase();
  if (name.includes(cleanQuery)) return true;

  // 2. Check address, level, or zone details
  const address = (location.address || '').toLowerCase();
  const level = (location.level || '').toLowerCase();
  const zone = (location.zone || '').toLowerCase();
  if (address.includes(cleanQuery) || level.includes(cleanQuery) || zone.includes(cleanQuery)) return true;

  // 3. Check tags array if present
  if (location.tags && Array.isArray(location.tags)) {
    if (location.tags.some((tag: string) => tag.toLowerCase().includes(cleanQuery))) {
      return true;
    }
  }

  // 4. Expand query synonyms from taxonomy
  const synonyms = SEARCH_TAXONOMY[cleanQuery];
  if (synonyms) {
    for (const syn of synonyms) {
      if (
        name.includes(syn) ||
        address.includes(syn) ||
        (location.description && location.description.toLowerCase().includes(syn)) ||
        (location.cuisine && location.cuisine.toLowerCase().includes(syn)) ||
        (location.tags && location.tags.some((t: string) => t.toLowerCase().includes(syn)))
      ) {
        return true;
      }
    }
  }

  return false;
}
