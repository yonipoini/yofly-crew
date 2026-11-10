import { supabase } from '../lib/supabase';
import {
  AirlineDomainRecord,
  CrewVerificationCheckResult,
  CrewVerificationMethod,
  CrewVerificationStatus,
} from '../types/verification';

type AirlineDomainRow = {
  airline_name?: string | null;
  domain?: string | null;
  accepted_roles?: string[] | null;
  is_active?: boolean | null;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const normalizeRole = (roleLabel: string) => {
  const normalized = roleLabel.trim().toUpperCase();

  if (normalized === 'FLIGHT ATTENDANT' || normalized === 'CABIN CREW') return 'FA';
  if (normalized === 'PILOT' || normalized === 'CAPTAIN' || normalized === 'FIRST OFFICER') return 'PILOT';
  return normalized;
};

const normalizeAirlineForComparison = (name?: string | null) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/(airlines|airline|airways|air|inc|llc|corp|group|is)$/g, '');
};

const areAirlineNamesCompatible = (selectedAirline?: string | null, domainAirline?: string | null) => {
  if (!selectedAirline || !domainAirline) return true;
  const s = normalizeAirlineForComparison(selectedAirline);
  const d = normalizeAirlineForComparison(domainAirline);
  if (!s || !d) return true;
  if (s === 'yoflycrew' || d === 'yoflycrew') return true;
  return s.includes(d) || d.includes(s);
};

const extractDomain = (email: string) => {
  const [, domain = ''] = normalizeEmail(email).split('@');
  return domain;
};

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));

export const CrewVerificationService = {
  async getApprovedAirlineDomains(): Promise<AirlineDomainRecord[]> {
    try {
      const { data, error } = await supabase
        .from('airline_domains')
        .select('airline_name, domain, accepted_roles, is_active')
        .order('airline_name', { ascending: true });

      if (error) {
        console.warn('Unable to load airline domains:', error.message);
        return [];
      }

      return (data as AirlineDomainRow[] | null)?.flatMap((row) => {
        if (!row.domain || !row.airline_name) {
          return [];
        }

        return [
          {
            airlineName: row.airline_name,
            domain: row.domain.toLowerCase(),
            acceptedRoles: row.accepted_roles ?? ['PILOT', 'FA'],
            isActive: row.is_active ?? true,
          },
        ];
      }) ?? [];
    } catch (error) {
      console.warn('Crew verification domain lookup failed:', error);
      return [];
    }
  },

  async checkAirlineEmail(
    email: string,
    roleLabel: string,
    selectedAirline?: string
  ): Promise<CrewVerificationCheckResult> {
    const normalizedEmail = normalizeEmail(email);
    const domain = extractDomain(normalizedEmail);

    if (!isValidEmail(normalizedEmail)) {
      return {
        matched: false,
        normalizedEmail,
        domain,
        suggestedStatus: CrewVerificationStatus.UNVERIFIED,
        reason: 'Enter a valid airline work email address.',
      };
    }

    const domains = await this.getApprovedAirlineDomains();
    const normalizedRole = normalizeRole(roleLabel);

    // Find any domain record for this domain
    const match = domains.find((item) => item.domain === domain);

    if (!match) {
      return {
        matched: false,
        normalizedEmail,
        domain,
        suggestedStatus: CrewVerificationStatus.UNVERIFIED,
        reason: `Registration requires an approved airline work email address. The domain "@${domain}" is not recognized as an eligible airline domain.`,
      };
    }

    if (!match.isActive) {
      return {
        matched: false,
        normalizedEmail,
        domain,
        airlineName: match.airlineName,
        suggestedStatus: CrewVerificationStatus.REJECTED,
        reason: `The domain "@${domain}" (${match.airlineName}) is currently inactive for crew verification.`,
      };
    }

    if (!match.acceptedRoles.includes(normalizedRole)) {
      return {
        matched: false,
        normalizedEmail,
        domain,
        airlineName: match.airlineName,
        suggestedStatus: CrewVerificationStatus.REJECTED,
        reason: `The role "${roleLabel}" is not supported for domain "@${domain}" (${match.airlineName}).`,
      };
    }

    // Verify selected airline matches the domain airline
    if (selectedAirline && !areAirlineNamesCompatible(selectedAirline, match.airlineName)) {
      return {
        matched: false,
        normalizedEmail,
        domain,
        airlineName: match.airlineName,
        suggestedStatus: CrewVerificationStatus.UNVERIFIED,
        reason: `Your email domain "@${domain}" belongs to ${match.airlineName}, but you selected "${selectedAirline}". Please select ${match.airlineName} or use your ${selectedAirline} corporate email.`,
      };
    }

    return {
      matched: true,
      normalizedEmail,
      domain,
      airlineName: match.airlineName,
      suggestedStatus: CrewVerificationStatus.PENDING_EMAIL,
      suggestedMethod: CrewVerificationMethod.AIRLINE_EMAIL,
    };
  },

  getStatusLabel(status: CrewVerificationStatus) {
    switch (status) {
      case CrewVerificationStatus.PENDING_EMAIL:
        return 'Work Email Pending';
      case CrewVerificationStatus.VERIFIED_CREW:
        return 'Verified Crew';
      case CrewVerificationStatus.PENDING_MANUAL:
        return 'Manual Review';
      case CrewVerificationStatus.REJECTED:
        return 'Review Required';
      default:
        return 'Unverified';
    }
  },
};
