import type { Deal } from '../domain/deal';
import { TEAMMATES } from '../domain/users';
import { createSeededRandom, pickOne, randomInt, type RandomSource } from './random';
import { generateDeal, generateDeals } from './seed';
import { NEW_LEAD_SHARE, planRacingStage, planTeammateEdit } from './teammates';
import {
  DEFAULT_SIMULATION_CONFIG,
  NetworkError,
  type DealsListener,
  type MoveRequest,
  type MoveResult,
  type PipelineApi,
  type SimulationConfig,
  type SimulatorControls,
} from './types';

/** How often simulated teammates get a chance to act. */
const TEAMMATE_TICK_MS = 500;
/** Delay between a change being committed and the realtime push reaching clients. */
const PUSH_DELAY_MS = 150;

export interface FakeServerOptions {
  dealCount: number;
  /** Seed for the generated dataset, so every run shows the same deals. */
  seed?: number;
  config?: Partial<SimulationConfig>;
  /** Source of randomness for runtime behaviour (failures, teammates). Injectable for tests. */
  random?: RandomSource;
}

/**
 * An in-memory backend that behaves like a real, imperfect one:
 *
 * - **Latency:** every request waits a random time within the configured range.
 * - **Failures:** saves fail at `failureRate`. Half of those fail *before* the
 *   change is applied ("request lost") and half *after* it ("response lost"):
 *   the classic case where the client cannot know whether its save worked.
 * - **Concurrency:** moves are compare-and-set on the stage (see
 *   {@link MoveRequest.expectedStage}), so concurrent edits produce conflicts
 *   instead of silently overwriting each other.
 * - **Teammates:** while anyone is subscribed, simulated teammates keep
 *   editing deals and every change is pushed to subscribers.
 */
export class FakeServer implements PipelineApi, SimulatorControls {
  private deals = new Map<string, Deal>();
  /** Parallel array of ids, so we can pick a random deal in O(1). */
  private dealIds: string[] = [];
  private nextDealIndex = 1;

  private config: SimulationConfig;
  private readonly random: RandomSource;
  private readonly seed: number;

  private listeners = new Set<DealsListener>();
  /** Changes committed since the last push to subscribers. */
  private outbox: Deal[] = [];
  private teammateTimer: ReturnType<typeof setInterval> | null = null;
  /** Fractional teammate changes carried between ticks (rates can be < 1 per tick). */
  private teammateBudget = 0;

  constructor(options: FakeServerOptions) {
    this.seed = options.seed ?? 42;
    this.random = options.random ?? Math.random;
    this.config = { ...DEFAULT_SIMULATION_CONFIG, ...options.config };
    this.reset(options.dealCount);
  }

  // --- PipelineApi ------------------------------------------------------------

  async fetchDeals(): Promise<Deal[]> {
    // Reads are not made to fail: the brief is about unreliable *saves*.
    await this.simulateLatency();
    return Array.from(this.deals.values());
  }

  async moveDeals(requests: MoveRequest[], actorId: string): Promise<MoveResult[]> {
    await this.simulateLatency();

    const failsInTransit = this.random() < this.config.failureRate;
    const loseRequest = failsInTransit && this.random() < 0.5;
    if (loseRequest) {
      throw new NetworkError('Request timed out');
    }

    this.simulateRacingTeammates(requests);
    const results = requests.map((request) => this.applyMove(request, actorId));
    this.flushOutbox();

    if (failsInTransit) {
      // The change was saved, but the client never hears back.
      throw new NetworkError('Connection lost before the server replied');
    }
    return results;
  }

  subscribe(listener: DealsListener): () => void {
    this.listeners.add(listener);
    this.startTeammates();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stopTeammates();
    };
  }

  // --- SimulatorControls --------------------------------------------------------

  configure(config: SimulationConfig): void {
    this.config = { ...config };
  }

  reset(dealCount: number): void {
    const deals = generateDeals(dealCount, this.seed, Date.now());
    this.deals = new Map(deals.map((deal) => [deal.id, deal]));
    this.dealIds = deals.map((deal) => deal.id);
    this.nextDealIndex = dealCount + 1;
    this.outbox = [];
  }

  // --- Moves ----------------------------------------------------------------------

  private applyMove(request: MoveRequest, actorId: string): MoveResult {
    const current = this.deals.get(request.dealId);
    if (!current) {
      return { dealId: request.dealId, status: 'not_found' };
    }
    // Already where the client wants it, e.g. a retry after a "response lost"
    // failure. Treating this as success makes retries safe (idempotent).
    if (current.stage === request.toStage) {
      return { dealId: current.id, status: 'ok', deal: current };
    }
    // Someone moved it since the client last saw it: let the user decide.
    if (current.stage !== request.expectedStage) {
      return { dealId: current.id, status: 'conflict', deal: current };
    }
    const updated = this.commit(current, { stage: request.toStage }, actorId);
    return { dealId: updated.id, status: 'ok', deal: updated };
  }

  /** With probability `raceChance`, a teammate moves a deal right before the user's save lands. */
  private simulateRacingTeammates(requests: MoveRequest[]): void {
    if (this.config.raceChance <= 0) return;
    for (const request of requests) {
      const deal = this.deals.get(request.dealId);
      if (!deal || this.random() >= this.config.raceChance) continue;
      const stage = planRacingStage(deal, request.toStage, this.random);
      this.commit(deal, { stage }, pickOne(this.random, TEAMMATES).id);
    }
  }

  // --- Teammates ----------------------------------------------------------------

  private startTeammates(): void {
    if (this.teammateTimer) return;
    this.teammateTimer = setInterval(() => this.runTeammateTick(), TEAMMATE_TICK_MS);
  }

  private stopTeammates(): void {
    if (this.teammateTimer) clearInterval(this.teammateTimer);
    this.teammateTimer = null;
  }

  private runTeammateTick(): void {
    this.teammateBudget += (this.config.teammateChangesPerMinute * TEAMMATE_TICK_MS) / 60_000;
    while (this.teammateBudget >= 1) {
      this.teammateBudget -= 1;
      this.makeTeammateChange();
    }
    this.flushOutbox();
  }

  private makeTeammateChange(): void {
    const actorId = pickOne(this.random, TEAMMATES).id;

    if (this.random() < NEW_LEAD_SHARE) {
      const index = this.nextDealIndex++;
      // A seeded source per new deal keeps names varied without touching the dataset seed.
      const deal = generateDeal(createSeededRandom(this.seed + index), index, Date.now(), {
        stage: 'new',
        ownerId: actorId,
      });
      this.dealIds.push(deal.id);
      this.commit(deal, {}, actorId);
      return;
    }

    const deal = this.deals.get(this.dealIds[randomInt(this.random, 0, this.dealIds.length - 1)]);
    if (deal) this.commit(deal, planTeammateEdit(deal, this.random), actorId);
  }

  // --- Storage + realtime push --------------------------------------------------

  /** Applies a change as a new immutable version and queues it for the realtime push. */
  private commit(deal: Deal, changes: Partial<Deal>, actorId: string): Deal {
    const now = Date.now();
    const updated: Deal = {
      ...deal,
      ...changes,
      version: deal.version + 1,
      updatedAt: now,
      updatedBy: actorId,
      lastActivityAt: now,
    };
    this.deals.set(updated.id, updated);
    this.outbox.push(updated);
    return updated;
  }

  private flushOutbox(): void {
    if (this.outbox.length === 0 || this.listeners.size === 0) {
      this.outbox = [];
      return;
    }
    const batch = this.outbox;
    this.outbox = [];
    setTimeout(() => this.listeners.forEach((listener) => listener(batch)), PUSH_DELAY_MS);
  }

  private simulateLatency(): Promise<void> {
    const min = Math.min(this.config.minLatencyMs, this.config.maxLatencyMs);
    const max = Math.max(this.config.minLatencyMs, this.config.maxLatencyMs);
    return new Promise((resolve) => setTimeout(resolve, randomInt(this.random, min, max)));
  }
}
