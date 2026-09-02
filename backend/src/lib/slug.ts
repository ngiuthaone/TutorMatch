/**
 * Slug generation and validation utilities.
 * Provides consistent slug creation across all services.
 */

const SLUG_MAX_LENGTH = 100;
const SLUG_INVALID_CHARS = /[^a-z0-9\s-]/g;
const SLUG_MULTIPLE_DASHES = /-+/g;
const SLUG_SINGLE_DASH = /^-|-$/g;

/**
 * Generate a URL-safe slug from a title string.
 * - Lowercase
 * - Remove non-alphanumeric characters
 * - Replace spaces with dashes
 * - Collapse multiple dashes
 * - Trim to 100 characters
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(SLUG_INVALID_CHARS, "")
    .replace(/\s+/g, "-")
    .replace(SLUG_MULTIPLE_DASHES, "-")
    .replace(SLUG_SINGLE_DASH, "")
    .slice(0, SLUG_MAX_LENGTH);
}

/**
 * Validate that a string is a proper slug.
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length <= SLUG_MAX_LENGTH;
}
