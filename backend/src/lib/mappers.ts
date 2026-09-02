/**
 * Generic row mapper utilities.
 * Provides type-safe mapping from Supabase response rows to domain objects.
 */

/**
 * Type for required fields in a mapped object.
 */
type RequiredFields<T> = {
  [K in keyof T]-?: T[K] extends undefined ? never : K;
}[keyof T];

/**
 * Type for optional fields in a mapped object.
 */
type OptionalFields<T> = {
  [K in keyof T]-?: T[K] extends undefined ? K : never;
}[keyof T];

/**
 * Mapper function type that converts a DB row to a domain object.
 */
export type RowMapper<T> = (row: Record<string, unknown>) => T;

/**
 * Create a row mapper with type-safe field mapping.
 *
 * @example
 * const mapUser = createMapper<User>()({
 *   id: "id",
 *   name: "full_name",
 *   email: "email",
 *   role: "user_role",  // will be cast to User["role"]
 * });
 */
export function createMapper<T>(): {
  map<M extends Partial<Record<keyof T, string>>>(
    mapping: M
  ): (row: Record<string, unknown>) => {
    [K in keyof M & keyof T]: T[K];
  };
} {
  return {
    map<M extends Partial<Record<keyof T, string>>>(
      mapping: M
    ): (row: Record<string, unknown>) => { [K in keyof M & keyof T]: T[K] } {
      return (row: Record<string, unknown>) => {
        const result = {} as { [K in keyof M & keyof T]: T[K] };
        for (const [destKey, srcKey] of Object.entries(mapping)) {
          const key = destKey as keyof M;
          result[key] = row[srcKey as string] as unknown as T[keyof T];
        }
        return result;
      };
    },
  };
}

/**
 * Map a row with explicit type casting.
 * Use this when the row has all required fields plus optional ones.
 */
export function mapRow<T>(
  row: Record<string, unknown>,
  requiredKeys: (keyof T)[],
  optionalKeys: (keyof T)[] = []
): T {
  const result = {} as T;

  for (const key of requiredKeys) {
    (result as Record<string, unknown>)[key as string] = row[key as string];
  }

  for (const key of optionalKeys) {
    if (row[key as string] !== undefined) {
      (result as Record<string, unknown>)[key as string] = row[key as string];
    }
  }

  return result;
}

/**
 * Map an array of rows.
 */
export function mapRows<T>(
  rows: Record<string, unknown>[] | null,
  mapper: RowMapper<T>
): T[] {
  return (rows ?? []).map(mapper);
}

/**
 * Generic mapper for simple entities with id and timestamps.
 */
export function mapSimpleEntity<T extends { id: string; created_at: string }>(
  row: Record<string, unknown>,
  requiredFields: string[],
  optionalFields: string[] = []
): T {
  const result = { id: row.id as string, created_at: row.created_at as string } as T;

  for (const field of requiredFields) {
    if (field === "id" || field === "created_at") continue;
    (result as Record<string, unknown>)[field] = row[field];
  }

  for (const field of optionalFields) {
    if (row[field] != null) {
      (result as Record<string, unknown>)[field] = row[field];
    }
  }

  return result;
}
