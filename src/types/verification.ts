export enum CrewVerificationStatus {
  UNVERIFIED = 'UNVERIFIED',
  PENDING_EMAIL = 'PENDING_EMAIL',
  VERIFIED_CREW = 'VERIFIED_CREW',
  PENDING_MANUAL = 'PENDING_MANUAL',
  REJECTED = 'REJECTED',
}

export enum CrewVerificationMethod {
  AIRLINE_EMAIL = 'AIRLINE_EMAIL',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
}

export interface AirlineDomainRecord {
  airlineName: string;
  domain: string;
  acceptedRoles: string[];
  isActive: boolean;
}

export interface CrewVerificationCheckResult {
  matched: boolean;
  normalizedEmail: string;
  domain: string;
  airlineName?: string;
  suggestedStatus: CrewVerificationStatus;
  suggestedMethod?: CrewVerificationMethod;
  reason?: string;
}
