import type { Deal } from '../domain/deal';
import type { StageId } from '../domain/stages';

/**
 * The contract between the app and "the backend".
 *
 * The app only ever talks to {@link PipelineApi}, so the fake server could be
 * swapped for a real HTTP/WebSocket client without touching any feature code.
 */

/** One deal move inside a (possibly bulk) save request. */
export interface MoveRequest {
  dealId: string;
  toStage: StageId;
  /**
   * The stage the client believes the deal is in on the server.
   * The server rejects the move as a `conflict` if it differs, which means a
   * teammate moved the deal first. This is optimistic concurrency at the
   * field level: unrelated edits (e.g. a value change) do not cause conflicts.
   */
  expectedStage: StageId;
}

/** Per-deal outcome of a move request. Bulk requests can partially succeed. */
export type MoveResult =
  | { dealId: string; status: 'ok'; deal: Deal }
  /** `deal` is the current server version, so the client can show what changed. */
  | { dealId: string; status: 'conflict'; deal: Deal }
  | { dealId: string; status: 'not_found' };

/** Receives every deal the server changed (by anyone, including the current user). */
export type DealsListener = (deals: Deal[]) => void;

export interface PipelineApi {
  fetchDeals(): Promise<Deal[]>;
  /**
   * Moves deals between stages.
   * Rejects with {@link NetworkError} when the request fails as a whole.
   */
  moveDeals(requests: MoveRequest[], actorId: string): Promise<MoveResult[]>;
  /** Subscribes to realtime changes. Returns an unsubscribe function. */
  subscribe(listener: DealsListener): () => void;
}

/** Thrown when a request fails in transit (timeout, dropped connection…). */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

// --- Simulation ---------------------------------------------------------------

/** Knobs for the fake backend, adjustable at runtime from the simulator panel. */
export interface SimulationConfig {
  /** Each request takes a random time between min and max. */
  minLatencyMs: number;
  maxLatencyMs: number;
  /** Probability (0–1) that a save request fails. */
  failureRate: number;
  /** How many changes the simulated teammates make per minute, in total. */
  teammateChangesPerMinute: number;
  /**
   * Probability (0–1) that, for each deal in a save, a teammate moves that
   * same deal just before the save lands. Use it to demo conflicts.
   */
  raceChance: number;
}

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  minLatencyMs: 300,
  maxLatencyMs: 1500,
  failureRate: 0.1,
  teammateChangesPerMinute: 60,
  raceChance: 0.01,
};

/** Number of deals generated on startup (the brief's scale). */
export const DEFAULT_DEAL_COUNT = 50_000;

/** Controls only the simulator UI uses. A real backend would not have these. */
export interface SimulatorControls {
  configure(config: SimulationConfig): void;
  /** Replaces all data with a freshly generated dataset of `dealCount` deals. */
  reset(dealCount: number): void;
}
