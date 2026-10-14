import type { Deal, StageId } from '../types/deal';
import { isClosedStage, nextStage, STAGE_IDS, TEAMMATES } from '../utils/dealUtils';
import { createSeededRandom, generateDeal, generateDeals, pickOne, randomInt } from '../utils/generateDeals';

/**
 * The fake backend. It behaves like a real, imperfect one:
 *
 * - Latency: every request takes a random time in the configured range.
 * - Failures: saves fail at `failureRate`. Half fail before the change is
 *   applied, half after it ("the reply got lost"), the case where the app
 *   can't know whether its save worked.
 * - Conflicts: a move only succeeds if the deal is still in the stage the app
 *   expected, so two people moving the same deal can't overwrite each other.
 * - Teammates: while the app is connected, simulated teammates keep editing
 *   deals, and every change is pushed to the app.
 */

// --- Contract ----------------------------------------------------------------
// Everything the app uses. A real HTTP/WebSocket client would implement the same.

export interface MoveRequest {
  dealId: string;
  toStage: StageId;
  /** The stage the app thinks the deal is in. If it isn't, the move is a conflict. */
  expectedStage: StageId;
}

/** Per deal: a bulk request can partly succeed. `deal` is always the server's current version. */
export type MoveResult =
  | { dealId: string; status: 'ok'; deal: Deal }
  | { dealId: string; status: 'conflict'; deal: Deal }
  | { dealId: string; status: 'not_found' };

export class NetworkError extends Error {
  name = 'NetworkError';
}

export interface SimulationConfig {
  minLatencyMs: number;
  maxLatencyMs: number;
  /** 0–1: share of save requests that fail. */
  failureRate: number;
  /** Total changes made by all teammates per minute. */
  teammateChangesPerMinute: number;
  /** 0–1: chance, per deal in a save, that a teammate moves it just before the save lands. */
  raceChance: number;
}

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  minLatencyMs: 300,
  maxLatencyMs: 1500,
  failureRate: 0.1,
  teammateChangesPerMinute: 60,
  raceChance: 0.01,
};

export const DEFAULT_DEAL_COUNT = 50_000;

// --- Server --------------------------------------------------------------------

const TEAMMATE_TICK_MS = 500;
/** Delay between a change being saved and the push reaching the app. */
const PUSH_DELAY_MS = 150;
/** Share of teammate changes that add a new lead instead of editing a deal. */
const NEW_LEAD_SHARE = 0.05;
const SEED = 42;

class FakeServer {
  private deals = new Map<string, Deal>();
  /** Same ids as an array, to pick a random deal quickly. */
  private dealIds: string[] = [];
  private nextId = 1;
  private config = DEFAULT_SIMULATION_CONFIG;
  private listeners = new Set<(deals: Deal[]) => void>();
  /** Changes not yet pushed to listeners. */
  private outbox: Deal[] = [];
  private teammateTimer: ReturnType<typeof setInterval> | null = null;
  /** Teammate changes owed but not made yet (rates can be below 1 per tick). */
  private teammateBudget = 0;

  constructor(dealCount: number) {
    this.reset(dealCount);
  }

  /** Reads never fail: the brief is about unreliable *saves*. */
  async fetchDeals(): Promise<Deal[]> {
    await this.wait();
    return Array.from(this.deals.values());
  }

  async moveDeals(requests: MoveRequest[], actorId: string): Promise<MoveResult[]> {
    await this.wait();

    const fails = Math.random() < this.config.failureRate;
    if (fails && Math.random() < 0.5) throw new NetworkError('Request timed out');

    this.simulateRacingTeammates(requests);
    const results = requests.map((request) => this.applyMove(request, actorId));
    this.pushChanges();

    if (fails) throw new NetworkError('Connection lost before the server replied');
    return results;
  }

  /** Realtime feed. Teammates only work while someone is listening. Returns an unsubscribe function. */
  subscribe(listener: (deals: Deal[]) => void): () => void {
    this.listeners.add(listener);
    this.teammateTimer ??= setInterval(() => this.runTeammates(), TEAMMATE_TICK_MS);
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0 && this.teammateTimer) {
        clearInterval(this.teammateTimer);
        this.teammateTimer = null;
      }
    };
  }

  // Simulator controls (a real backend wouldn't have these).

  configure(config: SimulationConfig): void {
    this.config = { ...config };
  }

  reset(dealCount: number): void {
    const deals = generateDeals(dealCount, SEED, Date.now());
    this.deals = new Map(deals.map((deal) => [deal.id, deal]));
    this.dealIds = deals.map((deal) => deal.id);
    this.nextId = dealCount + 1;
    this.outbox = [];
  }

  // --- Internals ----------------------------------------------------------------

  private applyMove({ dealId, toStage, expectedStage }: MoveRequest, actorId: string): MoveResult {
    const current = this.deals.get(dealId);
    if (!current) return { dealId, status: 'not_found' };
    // Already there (e.g. a retry after a lost reply): success, so retries are always safe.
    if (current.stage === toStage) return { dealId, status: 'ok', deal: current };
    // Someone else moved it first.
    if (current.stage !== expectedStage) return { dealId, status: 'conflict', deal: current };
    return { dealId, status: 'ok', deal: this.commit(current, { stage: toStage }, actorId) };
  }

  private simulateRacingTeammates(requests: MoveRequest[]): void {
    for (const request of requests) {
      const deal = this.deals.get(request.dealId);
      if (!deal || Math.random() >= this.config.raceChance) continue;
      const otherStages = STAGE_IDS.filter((stage) => stage !== deal.stage && stage !== request.toStage);
      this.commit(deal, { stage: pickOne(Math.random, otherStages) }, pickOne(Math.random, TEAMMATES).id);
    }
  }

  private runTeammates(): void {
    this.teammateBudget += (this.config.teammateChangesPerMinute * TEAMMATE_TICK_MS) / 60_000;
    while (this.teammateBudget >= 1) {
      this.teammateBudget -= 1;
      this.makeTeammateChange();
    }
    this.pushChanges();
  }

  /**
   * A typical teammate change: add a new lead (5%), or on an existing deal
   * advance it a stage (60%), mark it Lost (10%) or change its licence count.
   */
  private makeTeammateChange(): void {
    const actorId = pickOne(Math.random, TEAMMATES).id;

    if (Math.random() < NEW_LEAD_SHARE) {
      const id = this.nextId++;
      const deal = generateDeal(createSeededRandom(SEED + id), id, Date.now(), { stage: 'new', ownerId: actorId });
      this.dealIds.push(deal.id);
      this.commit(deal, {}, actorId);
      return;
    }

    const deal = this.deals.get(this.dealIds[randomInt(Math.random, 0, this.dealIds.length - 1)])!;
    const roll = Math.random();
    if (!isClosedStage(deal.stage) && roll < 0.6) {
      this.commit(deal, { stage: nextStage(deal.stage)! }, actorId);
    } else if (!isClosedStage(deal.stage) && roll < 0.7) {
      this.commit(deal, { stage: 'lost' }, actorId);
    } else {
      const licences = Math.max(1, Math.round(deal.licences * (0.8 + Math.random() * 0.4)));
      this.commit(deal, { licences, value: Math.round((deal.value / deal.licences) * licences) }, actorId);
    }
  }

  /** Saves a change as a new version and queues it for the realtime push. */
  private commit(deal: Deal, changes: Partial<Deal>, actorId: string): Deal {
    const now = Date.now();
    const updated = { ...deal, ...changes, version: deal.version + 1, updatedAt: now, updatedBy: actorId, lastActivityAt: now };
    this.deals.set(updated.id, updated);
    this.outbox.push(updated);
    return updated;
  }

  private pushChanges(): void {
    const batch = this.outbox;
    this.outbox = [];
    if (batch.length === 0) return;
    setTimeout(() => this.listeners.forEach((listener) => listener(batch)), PUSH_DELAY_MS);
  }

  private wait(): Promise<void> {
    const min = Math.min(this.config.minLatencyMs, this.config.maxLatencyMs);
    const max = Math.max(this.config.minLatencyMs, this.config.maxLatencyMs);
    return new Promise((resolve) => setTimeout(resolve, randomInt(Math.random, min, max)));
  }
}

/** The single backend instance the app talks to. */
export const fakeApi = new FakeServer(DEFAULT_DEAL_COUNT);
