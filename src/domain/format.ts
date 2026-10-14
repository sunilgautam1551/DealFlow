import { daysSince, daysUntil } from './time';

/** Display formatting. Indian conventions: ₹5,00,000, and Lakh/Crore for large sums. */

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const numberFormatter = new Intl.NumberFormat('en-IN');

/** ₹5,00,000 */
export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

/** ₹12.4 Cr / ₹8.5 L, for tight spaces such as tab headers. */
export function formatCompactCurrency(value: number): string {
  if (value >= 1e7) return `₹${(value / 1e7).toFixed(1)} Cr`;
  if (value >= 1e5) return `₹${(value / 1e5).toFixed(1)} L`;
  return formatCurrency(value);
}

/** 50,000 */
export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** "today", "3d ago" */
export function formatDaysAgo(timestamp: number, now: number): string {
  const days = daysSince(timestamp, now);
  return days === 0 ? 'today' : `${days}d ago`;
}

/** "today", "in 5d", "3d overdue" */
export function formatDueIn(timestamp: number, now: number): string {
  const days = daysUntil(timestamp, now);
  if (days === 0) return 'today';
  return days > 0 ? `in ${days}d` : `${-days}d overdue`;
}

/** "1 deal", "1,204 deals" */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}
