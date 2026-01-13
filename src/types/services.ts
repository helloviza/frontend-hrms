// apps/frontend/src/types/services.ts

/**
 * Who owns the service mapping: a Vendor or a Business (corporate client).
 */
export type ServiceOwnerType = "VENDOR" | "BUSINESS";

/**
 * Normalised list of services we support across the HRMS / Travel stack.
 */
export type ServiceKind =
  | "FLIGHT"
  | "HOTEL"
  | "CAB"
  | "VISA"
  | "MICE"
  | "FOREX"
  | "ESIM"
  | "HOLIDAY"
  | "CORPORATE_GIFTING"
  | "DECOR";

/**
 * Optional metadata for a given service capability.
 * This is intentionally generic so backend can evolve over time.
 */
export interface ServiceCapabilityMeta {
  /** Free-text notes (e.g. "UAE, Saudi & Qatar only") */
  notes?: string;

  /** Higher number = higher priority/preference among multiple vendors */
  priorityLevel?: number;

  /** Whether this partner supports true 24x7 operations for this service */
  support24x7?: boolean;

  /** For VISA services: list of supported countries (e.g. ["UAE", "USA"]) */
  visaCountries?: string[];

  /** Typical turnaround time in days (for visa, MICE, etc.) */
  tatInDays?: number;

  /** For MICE: offsite / R&R / conference / exhibition / wedding, etc. */
  eventTypes?: string[];

  /** Maximum recommended group size this partner can handle comfortably */
  maxGroupSize?: number;

  /** For holidays / hotels: key destinations, cities or regions */
  destinations?: string[];

  /** Minimum and maximum pax for packages, events, etc. */
  minPax?: number;
  maxPax?: number;
}

/**
 * Core service mapping record – can be attached to a Vendor or a Business.
 * Backend will usually persist this in a dedicated collection/table.
 */
export interface ServiceCapability {
  /** Unique ID for this capability record */
  id: string;

  /** Whether this belongs to a VENDOR or BUSINESS */
  ownerType: ServiceOwnerType;

  /** The vendor/business master ID or token this record is mapped to */
  ownerId: string;

  /** Which service this capability refers to (FLIGHT/HOTEL/VISA etc.) */
  kind: ServiceKind;

  /** Toggle on/off without deleting the record */
  enabled: boolean;

  /** Optional structured metadata */
  meta?: ServiceCapabilityMeta;

  createdAt?: string;
  updatedAt?: string;
}
