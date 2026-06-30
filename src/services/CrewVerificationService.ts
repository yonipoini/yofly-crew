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

  if (normalized === 'FLIGHT ATTENDANT') return 'FA';
  if (normalized === 'PILOT') return 'PILOT';
  return normalized;
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
        .eq('is_active', true)
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

  async checkAirlineEmail(email: string, roleLabel: string): Promise<CrewVerificationCheckResult> {
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
    const match = domains.find((item) => {
      return item.domain === domain && item.acceptedRoles.includes(normalizedRole);
    });

    if (!match) {
      return {
        matched: false,
        normalizedEmail,
        domain,
        suggestedStatus: CrewVerificationStatus.PENDING_MANUAL,
        suggestedMethod: CrewVerificationMethod.MANUAL_REVIEW,
        reason: 'This domain is not yet on the approved crew list. Use manual review as the backup path.',
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
