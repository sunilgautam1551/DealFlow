import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { MoveResult } from '../services/fakeApi';
import type { StageId } from '../types/deal';
import { pipelineReset } from './dealsSlice';
import type { RootState } from './index';

/**
 * The user's moves that the server hasn't confirmed yet.
 *
 * How saving works:
 * 1. A move is stored here at once and the UI shows the deal in its new stage.
 * 2. Queued moves are sent in batches (see `syncThunks.ts`).
 * 3. Success: the entry is removed. The deals slice now has the new server
 *    version, so nothing visibly changes.
 * 4. Network error: retried automatically after a delay. After MAX_ATTEMPTS it
 *    becomes `failed` and the user chooses Retry or Discard.
 * 5. A teammate moved the deal first: the server says `conflict` and the user
 *    chooses Keep mine or Keep theirs.
 *
 * The user's change is never dropped silently: it stays on screen until it is
 * saved or the user discards it.
 *
 * This file holds the state and how it changes; `syncThunks.ts` does the
 * sending, retry timing and messages.
 */

export interface PendingChange {
  dealId: string;
  /** Where the user wants the deal. This is what the UI shows. */
  toStage: StageId;
  /** Where we believe the server has it. Sent so the server can detect conflicts. */
  expectedStage: StageId;
  status: 'queued' | 'saving' | 'failed' | 'conflict';
  failedAttempts: number;
  /** Don't send before this time (epoch ms). Spaces out automatic retries. */
  retryAt: number;
  error?: string;
  /** For conflicts: what the teammate did. */
  conflict?: { serverStage: StageId; changedBy: string };
  /** The bulk move this belongs to, for the progress bar. */
  jobId?: string;
}

/** A big move shown as a progress bar until all its deals are saved or need attention. */
export interface BulkJob {
  id: string;
  label: string;
  dealIds: string[];
}

interface SyncState {
  /** By deal id. At most one pending change per deal. */
  pending: Record<string, PendingChange>;
  /** Requests on the wire right now. */
  inFlightRequests: number;
  jobs: BulkJob[];
}

/** First try + automatic retries before asking the user. */
export const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [1000, 3000];

const initialState: SyncState = { pending: {}, inFlightRequests: 0, jobs: [] };

const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    changesQueued(
      state,
      action: PayloadAction<{ changes: { dealId: string; toStage: StageId; serverStage: StageId }[]; jobId?: string }>,
    ) {
      const { changes, jobId } = action.payload;
      for (const { dealId, toStage, serverStage } of changes) {
        const existing = state.pending[dealId];

        // Already on the wire: just change the target. It is sent once the response arrives.
        if (existing?.status === 'saving') {
          existing.toStage = toStage;
          existing.jobId = jobId ?? existing.jobId;
          continue;
        }

        // Keep the original expectation so a teammate's move in the meantime is
        // still caught. After a conflict the user has seen the server's stage.
        const expectedStage = existing && existing.status !== 'conflict' ? existing.expectedStage : serverStage;

        // Moved back to where the server has it: nothing to save.
        if (toStage === expectedStage) {
          delete state.pending[dealId];
          continue;
        }
        state.pending[dealId] = { dealId, toStage, expectedStage, status: 'queued', failedAttempts: 0, retryAt: 0, jobId };
      }
    },

    batchSent(state, action: PayloadAction<string[]>) {
      state.inFlightRequests += 1;
      for (const dealId of action.payload) state.pending[dealId].status = 'saving';
    },

    batchSucceeded(state, action: PayloadAction<MoveResult[]>) {
      state.inFlightRequests -= 1;
      for (const result of action.payload) {
        const change = state.pending[result.dealId];
        if (!change) continue;

        if (result.status === 'ok' && change.toStage === result.deal.stage) {
          delete state.pending[result.dealId];
        } else if (result.status === 'ok') {
          // The user moved it again while this save was in flight: send that next.
          Object.assign(change, { status: 'queued', expectedStage: result.deal.stage, failedAttempts: 0, retryAt: 0 });
        } else if (result.status === 'conflict') {
          change.status = 'conflict';
          change.conflict = { serverStage: result.deal.stage, changedBy: result.deal.updatedBy };
        } else {
          change.status = 'failed';
          change.error = 'This deal no longer exists';
        }
      }
    },

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

    /** "Retry" a failed save, or "Keep mine" on a conflict. */
    retryRequested(state, action: PayloadAction<string[]>) {
      for (const dealId of action.payload) {
        const change = state.pending[dealId];
        if (change?.status !== 'failed' && change?.status !== 'conflict') continue;
        if (change.conflict) change.expectedStage = change.conflict.serverStage; // overwrite theirs on purpose
        Object.assign(change, { status: 'queued', failedAttempts: 0, retryAt: 0, error: undefined, conflict: undefined });
      }
    },

    /** "Discard" a failed save, or "Keep theirs" on a conflict. */
    changesDiscarded(state, action: PayloadAction<string[]>) {
      for (const dealId of action.payload) {
        // A request already on the wire can't be recalled.
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
  extraReducers: (builder) => {
    builder.addCase(pipelineReset, () => initialState);
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

// --- Selectors ------------------------------------------------------------------

export const selectPending = (state: RootState) => state.sync.pending;
export const selectJobs = (state: RootState) => state.sync.jobs;

/** The stage the user sees: their unsaved move if there is one, otherwise the server's. */
export function selectEffectiveStage(state: RootState, dealId: string): StageId | undefined {
  return state.sync.pending[dealId]?.toStage ?? state.deals.entities[dealId]?.stage;
}

export function needsAttention(change: PendingChange | undefined): boolean {
  return change?.status === 'failed' || change?.status === 'conflict';
}

export const selectSyncSummary = createSelector([selectPending], (pending) => {
  const summary = { saving: 0, failed: 0, conflicts: 0 };
  for (const change of Object.values(pending)) {
    if (change.status === 'failed') summary.failed += 1;
    else if (change.status === 'conflict') summary.conflicts += 1;
    else summary.saving += 1;
  }
  return summary;
});

export function selectJobProgress(state: RootState, job: BulkJob) {
  const progress = { total: job.dealIds.length, done: 0, needAttention: 0, inProgress: 0 };
  for (const dealId of job.dealIds) {
    const change = state.sync.pending[dealId];
    if (!change || change.jobId !== job.id) progress.done += 1;
    else if (needsAttention(change)) progress.needAttention += 1;
    else progress.inProgress += 1;
  }
  return progress;
}
