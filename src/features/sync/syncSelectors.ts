import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../app/rootReducer';
import type { StageId } from '../../domain/stages';
import type { BulkJob, PendingChange } from './syncSlice';

export const selectPending = (state: RootState) => state.sync.pending;
export const selectJobs = (state: RootState) => state.sync.jobs;

export function selectPendingChange(state: RootState, dealId: string): PendingChange | undefined {
  return state.sync.pending[dealId];
}

/** The stage the user sees: their unsaved change if there is one, otherwise the server's. */
export function selectEffectiveStage(state: RootState, dealId: string): StageId | undefined {
  return state.sync.pending[dealId]?.toStage ?? state.deals.entities[dealId]?.stage;
}

export function needsAttention(change: PendingChange | undefined): boolean {
  return change?.status === 'failed' || change?.status === 'conflict';
}

export interface SyncSummary {
  /** Queued or on the wire. */
  saving: number;
  failed: number;
  conflicts: number;
}

export const selectSyncSummary = createSelector([selectPending], (pending): SyncSummary => {
  const summary = { saving: 0, failed: 0, conflicts: 0 };
  for (const change of Object.values(pending)) {
    if (change.status === 'failed') summary.failed += 1;
    else if (change.status === 'conflict') summary.conflicts += 1;
    else summary.saving += 1;
  }
  return summary;
});

/** Up to `limit` queued changes that are ready to send now. */
export function selectNextBatch(state: RootState, now: number, limit: number): PendingChange[] {
  const batch: PendingChange[] = [];
  for (const change of Object.values(state.sync.pending)) {
    if (change.status === 'queued' && change.retryAt <= now) {
      batch.push(change);
      if (batch.length === limit) break;
    }
  }
  return batch;
}

/** The earliest scheduled retry among the given deals, if any. */
export function selectEarliestRetryAt(state: RootState, dealIds: string[]): number | null {
  let earliest: number | null = null;
  for (const dealId of dealIds) {
    const change = state.sync.pending[dealId];
    if (change?.status === 'queued' && (earliest === null || change.retryAt < earliest)) {
      earliest = change.retryAt;
    }
  }
  return earliest;
}

export interface JobProgress {
  total: number;
  /** Saved (or no longer part of this job). */
  done: number;
  /** Failed or conflicted: waiting for the user. */
  needAttention: number;
  /** Still queued or saving. */
  inProgress: number;
}

export function selectJobProgress(state: RootState, job: BulkJob): JobProgress {
  const progress = { total: job.dealIds.length, done: 0, needAttention: 0, inProgress: 0 };
  for (const dealId of job.dealIds) {
    const change = state.sync.pending[dealId];
    if (!change || change.jobId !== job.id) progress.done += 1;
    else if (needsAttention(change)) progress.needAttention += 1;
    else progress.inProgress += 1;
  }
  return progress;
}
