import type { Deal } from '../domain/deal';
import { isClosedStage, nextStage, STAGE_IDS, type StageId } from '../domain/stages';
import type { RandomSource } from './random';

/**
 * Decides *what* a simulated teammate does to a deal. Pure functions, so the
 * behaviour is easy to read and tweak; the server decides *when*.
 */

/** Share of teammate changes that create a brand-new lead instead of editing. */
export const NEW_LEAD_SHARE = 0.05;

/**
 * A typical teammate edit:
 * - 60% advance an open deal one stage (the normal flow of work),
 * - 10% mark an open deal Lost,
 * - otherwise re-negotiate the number of licences (changes the value).
 */
export function planTeammateEdit(deal: Deal, random: RandomSource): Partial<Deal> {
  const roll = random();
  if (!isClosedStage(deal.stage)) {
    if (roll < 0.6) return { stage: nextStage(deal.stage)! };
    if (roll < 0.7) return { stage: 'lost' };
  }
  const licences = Math.max(1, Math.round(deal.licences * (0.8 + random() * 0.4)));
  const pricePerLicence = deal.value / deal.licences;
  return { licences, value: Math.round(pricePerLicence * licences) };
}

/**
 * Stage a teammate moves a deal to when racing the current user's save:
 * anything other than where it is now and where the user is moving it.
 */
export function planRacingStage(deal: Deal, userTargetStage: StageId, random: RandomSource): StageId {
  const options = STAGE_IDS.filter((stage) => stage !== deal.stage && stage !== userTargetStage);
  return options[Math.floor(random() * options.length)];
}
