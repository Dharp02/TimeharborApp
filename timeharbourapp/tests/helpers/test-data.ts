/**
 * Shared test data generators and constants.
 */

export const TEST_PASSWORD = 'SecurePass123!';

export function uniqueEmail(prefix = 'e2e'): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}-${id}@example.com`;
}

export function uniqueName(prefix = 'E2E User'): string {
  return `${prefix} ${Date.now().toString(36)}`;
}
