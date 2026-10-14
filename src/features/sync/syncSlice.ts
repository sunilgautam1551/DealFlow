import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { MoveResult } from '../../api/types';
import type { StageId } from '../../domain/stages';

/**
 * The user's changes that the server has not confirmed yet.
 *
 * How saving works (optimistic updates):
 * 1. A move is recorded here straight away, and the UI shows the deal in its
 *    new stage (pending change on top of server data, see `selectEffectiveStage`).
 * 2. The sync thunks send queued changes to the server in batches.
 * 3. On success the entry is removed; the deals slice now holds the new server
 *    version, so nothing visibly changes.
 * 4. On a network error the change is retried automatically with a delay. After
 *    MAX_ATTEMPTS it becomes `failed` and the user decides: retry or discard.
 * 5. If a teammate moved the deal first, the server reports a conflict and the
 *    user decides: keep mine (retry) or keep theirs (discard).
 *
 * The user's intent is never thrown away silently: it stays visible until it is
 * saved or the user discards it.
 */

export type PendingStatus = 'queued' | 'saving' | 'failed' | 'conflict';

export interface PendingChange {
  dealId: string;
  /** Where the user wants the deal. This is what the UI shows. */
  toStage: StageId;
  /** Where we believe the server has it. Sent so the server can detect conflicts. */
  expectedStage: StageId;
  status: PendingStatus;
  /** Network failures so far for this change. */
  failedAttempts: number;
  /** Don't send before this time (epoch ms). Used to space out automatic retries. */
  retryAt: number;
  error?: string;
  /** Set when status is `conflict`: what the teammate did. */
  conflict?: { serverStage: StageId; changedBy: string };
  /** The bulk move this change belongs to, if any (for progress reporting). */
  jobId?: string;
}

/** A large move the user started, shown as a progress bar until every deal is resolved. */
export interface BulkJob {
  id: string;
  label: string;
  dealIds: string[];
}

export interface SyncState {
  /** Pending changes keyed by deal id. At most one per deal. */
  pending: Record<string, PendingChange>;
  /** Requests currently on the wire. Used to limit parallel requests. */
  inFlightRequests: number;
  jobs: BulkJob[];
}

/** Total tries (first send + automatic retries) before asking the user. */
export const MAX_ATTEMPTS = 3;
/** Wait before automatic retry number 1, 2, … */
const RETRY_DELAYS_MS = [1000, 3000];

/** A change requested by the user, with the deal's current server stage. */
export interface QueuedChange {
  dealId: string;
  toStage: StageId;
  serverStage: StageId;
}

const initialState: SyncState = {
  pending: {},
  inFlightRequests: 0,
  jobs: [],
};

const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    /** The user moved deals. */
    changesQueued(state, action: PayloadAction<{ changes: QueuedChange[]; jobId?: string }>) {
      const { changes, jobId } = action.payload;
      for (const change of changes) {
        const existing = state.pending[change.dealId];

        if (existing?.status === 'saving') {
          // A request for this deal is already on the wire. Just update the
          // target; when the response arrives we send the new target next.
          existing.toStage = change.toStage;
          existing.jobId = jobId ?? existing.jobId;
          continue;
        }

        // Keep the original expectation, so a teammate's move made in the meantime
        // is still detected. After a conflict the user has seen the server
        // stage, so we start from there instead.
        const expectedStage =
          existing && existing.status !== 'conflict' ? existing.expectedStage : change.serverStage;

        if (change.toStage === expectedStage) {
          // Moved back to where the server has it: nothing left to save.
          delete state.pending[change.dealId];
          continue;
        }

        state.pending[change.dealId] = {
          dealId: change.dealId,
          toStage: change.toStage,
          expectedStage,
          status: 'queued',
          failedAttempts: 0,
          retryAt: 0,
          jobId,
        };
      }
    },

    /** A batch of queued changes was sent to the server. */
    batchSent(state, action: PayloadAction<string[]>) {
      state.inFlightRequests += 1;
      for (const dealId of action.payload) {
        state.pending[dealId].status = 'saving';
      }
    },

    /** The server answered. Results are per deal: some may be ok, some conflicts. */
    batchSucceeded(state, action: PayloadAction<MoveResult[]>) {
      state.inFlightRequests -= 1;
      for (const result of action.payload) {
        const change = state.pending[result.dealId];
        if (!change) continue;

        if (result.status === 'ok') {
          if (change.toStage === result.deal.stage) {
            delete state.pending[result.dealId];
          } else {
            // The user moved it again while this save was in flight: send that next.
            change.status = 'queued';
            change.expectedStage = result.deal.stage;
            change.failedAttempts = 0;
            change.retryAt = 0;
          }
        } else if (result.status === 'conflict') {
          change.status = 'conflict';
          change.conflict = { serverStage: result.deal.stage, changedBy: result.deal.updatedBy };
        } else {
          change.status = 'failed';
          change.error = 'This deal no longer exists';
        }
      }
    },

    /** The whole request failed in transit. Retry automatically, up to MAX_ATTEMPTS. */
    batchFailed(state, action: PayloadAction<{ dealIds: string[]; error: string; now: number }>) {
      const { dealIds, error, now } = action.payload;
      state.inFlightRequests -= 1;
      for (const dealId of dealIds) {
        const change = state.pending[dealId];
        if (!change) continue;
        change.failedAttempts += 1;
        change.error = error;
        if (change.failedAttempts >= MAX_ATTEMPTS) {
          change.status = 'failed';
        } else {
          change.status = 'queued';
          change.retryAt = now + RETRY_DELAYS_MS[change.failedAttempts - 1];
        }
      }
    },

    /** "Retry" on a failed save, or "Keep mine" on a conflict. */
    retryRequested(state, action: PayloadAction<string[]>) {
      for (const dealId of action.payload) {
        const change = state.pending[dealId];
        if (!change || (change.status !== 'failed' && change.status !== 'conflict')) continue;
        if (change.conflict) {
          // Keep mine: overwrite the teammate's stage on purpose.
          change.expectedStage = change.conflict.serverStage;
          change.conflict = undefined;
        }
        change.status = 'queued';
        change.failedAttempts = 0;
        change.retryAt = 0;
        change.error = undefined;
      }
    },

    /** "Discard" on a failed save, or "Keep theirs" on a conflict. */
    changesDiscarded(state, action: PayloadAction<string[]>) {
      for (const dealId of action.payload) {
        // A request on the wire cannot be recalled, so in-flight changes stay.
        if (state.pending[dealId]?.status !== 'saving') delete state.pending[dealId];
      }
    },

    jobStarted(state, action: PayloadAction<BulkJob>) {
      state.jobs.push(action.payload);
    },

    jobFinished(state, action: PayloadAction<string>) {
      state.jobs = state.jobs.filter((job) => job.id !== action.payload);
    },
  },
});

export const {
  changesQueued,
  batchSent,
  batchSucceeded,
  batchFailed,
  retryRequested,
  changesDiscarded,
  jobStarted,
  jobFinished,
} = syncSlice.actions;

export default syncSlice.reducer;
