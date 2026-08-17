/**
 * Tutoria offering-type mapping.
 *
 * The marketplace uses `marketplace_listings.kind` = 'course' | 'event' (0003).
 * The booking policy snapshot uses `offering_type` = 'tutor' | 'workshop' | 'class' | 'event'.
 *
 * Mapping rules:
 * - 'course' → 'class' (structured learning product delivered by a host)
 * - 'event'  → 'event' (one-time gathering, workshop, or live session)
 * - 'tutor'  → 'tutor' (1:1 or small-group tutoring — created directly, not via marketplace listing)
 * - 'workshop' → 'workshop' (hands-on session — created directly, not via marketplace listing)
 *
 * 'tutor' and 'workshop' offering types do NOT come from marketplace listings.
 * They are created via direct tutor/session creation flows. The mapping from
 * listing.kind only applies when a booking is made from a marketplace listing.
 *
 * 'course' is intentionally non-bookable under the shared booking engine in V1.
 * Only 'event' listings can be booked. 'tutor' and 'workshop' are bookable
 * via direct session creation.
 */

export type ListingKind = "course" | "event";
export type OfferingType = "tutor" | "workshop" | "class" | "event";

/**
 * Map a marketplace listing kind to a booking offering type.
 * Returns null for listing kinds that are not bookable.
 */
export function listingKindToOfferingType(kind: ListingKind): OfferingType | null {
  switch (kind) {
    case "event":
      return "event";
    case "course":
      // V1: courses are not bookable under the shared booking engine.
      return null;
  }
}

/**
 * All valid offering types for booking policy snapshots.
 */
export const VALID_OFFERING_TYPES: readonly OfferingType[] = [
  "tutor", "workshop", "class", "event",
] as const;

/**
 * Validate that a string is a valid offering type.
 */
export function isValidOfferingType(value: string): value is OfferingType {
  return (VALID_OFFERING_TYPES as readonly string[]).includes(value);
}
