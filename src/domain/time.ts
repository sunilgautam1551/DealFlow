export const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from `now` until `timestamp` (negative when it is in the past). */
export function daysUntil(timestamp: number, now: number): number {
  return Math.floor((timestamp - now) / DAY_MS);
}

/** Whole days since `timestamp` (0 for anything within the last 24 hours). */
export function daysSince(timestamp: number, now: number): number {
  return Math.max(0, Math.floor((now - timestamp) / DAY_MS));
}
