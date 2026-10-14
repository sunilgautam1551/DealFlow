import type { StageId } from './stages';

/**
 * A potential sale. Deals are treated as immutable values: every change
 * produces a new object with a higher `version`.
 */
export interface Deal {
  id: string;
  company: string;
  licences: number;
  /** Deal value in rupees. */
  value: number;
  ownerId: string;
  stage: StageId;
  /** When the salesperson expects the deal to close (epoch ms). */
  expectedCloseAt: number;
  /** Last time anyone touched the deal (epoch ms). Used to spot deals going cold. */
  lastActivityAt: number;

  // --- Sync metadata (owned by the server) ---------------------------------
  /**
   * Increases by 1 on every server-side change. The client uses it to drop
   * stale updates, such as a realtime event arriving after a newer save response.
   */
  version: number;
  updatedAt: number;
  /** User id of whoever made the latest change. */
  updatedBy: string;
}
