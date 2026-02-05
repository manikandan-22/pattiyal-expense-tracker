/**
 * Extract year from year-prefixed ID (format: YYYY-uuid)
 */
export function extractYearFromId(id: string): number | null {
  const match = id.match(/^(\d{4})-/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  return year >= 2000 && year <= 2100 ? year : null;
}
