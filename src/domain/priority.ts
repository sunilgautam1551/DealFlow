import type { Deal } from './deal';
import { isClosedStage, type StageId } from './stages';
import { daysSince, daysUntil } from './time';

/**
 * "Which deals should I work on today?"
 *
 * A simple points-based score built from rules a sales manager would recognise.
 * Each rule that adds points also adds a short reason, so the UI can say *why*
 * a deal is near the top instead of being a black box.
 */

export interface PriorityAssessment {
  score: number;
  /** Short, human-readable reasons, e.g. "Closes in 3d". */
  reasons: string[];
}

/** Later stages are closer to revenue, so they count for more. */
const STAGE_POINTS: Record<StageId, number> = {
  new: 0,
  contacted: 5,
  demo: 10,
  proposal: 15,
  negotiation: 20,
  won: 0,
  lost: 0,
};

const HIGH_VALUE = 20_00_000; // ₹20 L
const MEDIUM_VALUE = 10_00_000; // ₹10 L

export function assessPriority(deal: Deal, now: number): PriorityAssessment {
  if (isClosedStage(deal.stage)) {
    return { score: 0, reasons: [] };
  }

  let score = STAGE_POINTS[deal.stage];
  const reasons: string[] = [];

  // Close date: overdue or imminent deals need attention first.
  const daysToClose = daysUntil(deal.expectedCloseAt, now);
  if (daysToClose < 0) {
    score += 35;
    reasons.push(`Overdue ${-daysToClose}d`);
  } else if (daysToClose <= 7) {
    score += 30;
    reasons.push(`Closes in ${daysToClose}d`);
  } else if (daysToClose <= 14) {
    score += 15;
  }

  // Silence: a deal nobody has touched in weeks is going cold.
  const idleDays = daysSince(deal.lastActivityAt, now);
  if (idleDays >= 30) {
    score += 25;
    reasons.push(`No contact ${idleDays}d`);
  } else if (idleDays >= 14) {
    score += 15;
    reasons.push(`No contact ${idleDays}d`);
  }

  // Size: bigger deals are worth more effort.
  if (deal.value >= HIGH_VALUE) {
    score += 20;
    reasons.push('High value');
  } else if (deal.value >= MEDIUM_VALUE) {
    score += 10;
  }

  return { score, reasons };
}
