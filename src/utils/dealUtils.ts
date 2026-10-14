import { CURRENT_USER_ID, STAGES, USERS, type Deal, type StageId } from '../types/deal';

// --- Stages -------------------------------------------------------------------

export const STAGE_IDS: readonly StageId[] = STAGES.map((stage) => stage.id);

export function stageLabel(id: StageId): string {
  return STAGES.find((stage) => stage.id === id)!.label;
}

export function isClosedStage(id: StageId): boolean {
  return STAGES.find((stage) => stage.id === id)!.isClosed;
}

/** New Lead → Contacted → … → Negotiation → Won. Closed deals have no next stage. */
export function nextStage(id: StageId): StageId | null {
  if (isClosedStage(id)) return null;
  return STAGE_IDS[STAGE_IDS.indexOf(id) + 1] ?? null;
}

// --- Users --------------------------------------------------------------------

export const TEAMMATES = USERS.filter((user) => user.id !== CURRENT_USER_ID);

export function userName(id: string): string {
  return USERS.find((user) => user.id === id)?.name ?? 'Unknown user';
}

/** "you" for the current user, otherwise the teammate's first name. */
export function displayActor(id: string): string {
  return id === CURRENT_USER_ID ? 'you' : userName(id).split(' ')[0];
}

// --- Time ---------------------------------------------------------------------

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days until `timestamp` (negative when it has passed). */
export function daysUntil(timestamp: number, now: number): number {
  return Math.floor((timestamp - now) / DAY_MS);
}

/** Whole days since `timestamp`. */
export function daysSince(timestamp: number, now: number): number {
  return Math.max(0, Math.floor((now - timestamp) / DAY_MS));
}

// --- Priority ("which deals should I work on today?") -------------------------

const STAGE_POINTS: Record<StageId, number> = {
  new: 0,
  contacted: 5,
  demo: 10,
  proposal: 15,
  negotiation: 20, // later stages are closer to revenue
  won: 0,
  lost: 0,
};

/**
 * A simple points score from rules a sales manager would recognise. Every rule
 * that adds points also adds a short reason, so the UI can say *why* a deal
 * is near the top.
 */
export function assessPriority(deal: Deal, now: number): { score: number; reasons: string[] } {
  if (isClosedStage(deal.stage)) return { score: 0, reasons: [] };

  let score = STAGE_POINTS[deal.stage];
  const reasons: string[] = [];

  const daysToClose = daysUntil(deal.expectedCloseAt, now);
  if (daysToClose < 0) {
    score += 35;
    reasons.push(`Overdue ${-daysToClose}d`);
  } else if (daysToClose <= 7) {
    score += 30;
    reasons.push(daysToClose === 0 ? 'Closes today' : `Closes in ${daysToClose}d`);
  } else if (daysToClose <= 14) {
    score += 15;
  }

  const idleDays = daysSince(deal.lastActivityAt, now);
  if (idleDays >= 14) {
    score += idleDays >= 30 ? 25 : 15;
    reasons.push(`No contact ${idleDays}d`);
  }

  if (deal.value >= 20_00_000) {
    score += 20;
    reasons.push('High value');
  } else if (deal.value >= 10_00_000) {
    score += 10;
  }

  return { score, reasons };
}

// --- Formatting (Indian conventions: ₹5,00,000, Lakh, Crore) -------------------

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const numberFormatter = new Intl.NumberFormat('en-IN');

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

/** ₹12.4 Cr / ₹8.5 L */
export function formatCompactCurrency(value: number): string {
  if (value >= 1e7) return `₹${(value / 1e7).toFixed(1)} Cr`;
  if (value >= 1e5) return `₹${(value / 1e5).toFixed(1)} L`;
  return formatCurrency(value);
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** "1 deal", "1,204 deals" */
export function pluralize(count: number, singular: string): string {
  return `${formatNumber(count)} ${count === 1 ? singular : `${singular}s`}`;
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
