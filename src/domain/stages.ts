/**
 * Pipeline stages, in order. The order is meaningful: it drives tab order and
 * the "advance / go back one stage" actions.
 */

export type StageId = 'new' | 'contacted' | 'demo' | 'proposal' | 'negotiation' | 'won' | 'lost';

export interface StageDefinition {
  id: StageId;
  label: string;
  /** Closed stages (Won/Lost) are the end of the pipeline: nothing to work on. */
  isClosed: boolean;
}

export const STAGES: readonly StageDefinition[] = [
  { id: 'new', label: 'New Lead', isClosed: false },
  { id: 'contacted', label: 'Contacted', isClosed: false },
  { id: 'demo', label: 'Demo Done', isClosed: false },
  { id: 'proposal', label: 'Proposal Sent', isClosed: false },
  { id: 'negotiation', label: 'Negotiation', isClosed: false },
  { id: 'won', label: 'Won', isClosed: true },
  { id: 'lost', label: 'Lost', isClosed: true },
];

export const STAGE_IDS: readonly StageId[] = STAGES.map((stage) => stage.id);

const stagesById = new Map(STAGES.map((stage) => [stage.id, stage]));

export function getStage(id: StageId): StageDefinition {
  return stagesById.get(id)!;
}

export function stageLabel(id: StageId): string {
  return getStage(id).label;
}

export function isClosedStage(id: StageId): boolean {
  return getStage(id).isClosed;
}

/**
 * The stage a deal moves to when it is "advanced".
 * Negotiation advances to Won; closed deals cannot advance.
 */
export function nextStage(id: StageId): StageId | null {
  if (isClosedStage(id)) return null;
  const index = STAGE_IDS.indexOf(id);
  return STAGE_IDS[index + 1] ?? null;
}

/**
 * The stage a deal moves to when it is "sent back".
 * Won/Lost deals re-open into Negotiation; New Lead has nowhere to go back to.
 */
export function previousStage(id: StageId): StageId | null {
  if (isClosedStage(id)) return 'negotiation';
  const index = STAGE_IDS.indexOf(id);
  return index > 0 ? STAGE_IDS[index - 1] : null;
}
