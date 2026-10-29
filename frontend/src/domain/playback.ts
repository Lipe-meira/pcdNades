export function renewalDelay(
  expiresAt?: string,
  now = Date.now(),
): number | null {
  if (!expiresAt || !Number.isFinite(Date.parse(expiresAt))) return null;
  return Math.min(
    2_147_000_000,
    Math.max(1000, Date.parse(expiresAt) - now - 30_000),
  );
}
