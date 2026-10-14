import type { AppThunk } from '../../app/store';
import { formatNumber, pluralize } from '../../domain/format';
import { stageLabel, type StageId } from '../../domain/stages';
import { CURRENT_USER_ID } from '../../domain/users';
import { toastShown } from '../notifications/notificationsSlice';
import {
  needsAttention,
  selectEarliestRetryAt,
  selectEffectiveStage,
  selectJobProgress,
  selectNextBatch,
  selectSyncSummary,
} from './syncSelectors';
import {
  batchFailed,
  batchSent,
  batchSucceeded,
  changesDiscarded,
  changesQueued,
  jobFinished,
  jobStarted,
  retryRequested,
  type PendingChange,
  type QueuedChange,
} from './syncSlice';

/** Deals per request. Bulk moves of thousands are split into batches. */
const BATCH_SIZE = 500;
/** Requests on the wire at once. Keeps big bulk moves from flooding the network. */
const MAX_PARALLEL_REQUESTS = 3;
/** Moves of at least this many deals get a progress bar and a summary toast. */
const BULK_JOB_MIN_SIZE = 10;

export interface StageChange {
  dealId: string;
  toStage: StageId;
}

/** Moves deals to one stage. */
export const moveDeals = (dealIds: string[], toStage: StageId): AppThunk => (dispatch) => {
  dispatch(queueStageChanges(dealIds.map((dealId) => ({ dealId, toStage }))));
};

/**
 * Records the user's moves (the UI updates at once) and starts saving them.
 * Each deal can go to a different stage, e.g. "advance every selected deal".
 */
export const queueStageChanges =
  (changes: StageChange[]): AppThunk =>
  (dispatch, getState) => {
    const state = getState();
    const queued: QueuedChange[] = [];

    for (const { dealId, toStage } of changes) {
      const deal = state.deals.entities[dealId];
      if (!deal || selectEffectiveStage(state, dealId) === toStage) continue;
      queued.push({ dealId, toStage, serverStage: deal.stage });
    }
    if (queued.length === 0) return;

    let jobId: string | undefined;
    if (queued.length >= BULK_JOB_MIN_SIZE) {
      jobId = `job-${Date.now()}`;
      dispatch(jobStarted({ id: jobId, label: describeMove(queued), dealIds: queued.map((c) => c.dealId) }));
    }

    dispatch(changesQueued({ changes: queued, jobId }));
    dispatch(flushPendingChanges());
  };

/** "Retry" / "Keep mine". */
export const retryChanges =
  (dealIds: string[]): AppThunk =>
  (dispatch) => {
    dispatch(retryRequested(dealIds));
    dispatch(flushPendingChanges());
  };

/** "Discard" / "Keep theirs". The deal goes back to what the server has. */
export const discardChanges =
  (dealIds: string[]): AppThunk =>
  (dispatch) => {
    dispatch(changesDiscarded(dealIds));
  };

/**
 * Sends queued changes, in batches, up to MAX_PARALLEL_REQUESTS at a time.
 *
 * Safe to call any time: each change is marked `saving` before its request
 * goes out, so a change is never sent twice at once.
 */
export const flushPendingChanges = (): AppThunk => (dispatch, getState) => {
  while (getState().sync.inFlightRequests < MAX_PARALLEL_REQUESTS) {
    const batch = selectNextBatch(getState(), Date.now(), BATCH_SIZE);
    if (batch.length === 0) return;
    dispatch(batchSent(batch.map((change) => change.dealId)));
    void dispatch(sendBatch(batch));
  }
};

/** Sends one batch and records the outcome. */
const sendBatch =
  (batch: PendingChange[]): AppThunk<Promise<void>> =>
  async (dispatch, _getState, { api }) => {
    const dealIds = batch.map((change) => change.dealId);
    const requests = batch.map(({ dealId, toStage, expectedStage }) => ({ dealId, toStage, expectedStage }));

    try {
      const results = await api.moveDeals(requests, CURRENT_USER_ID);
      dispatch(batchSucceeded(results));
    } catch (error) {
      dispatch(batchFailed({ dealIds, error: errorMessage(error), now: Date.now() }));
      dispatch(scheduleRetry(dealIds));
    }

    dispatch(reportProblems(dealIds));
    dispatch(finishCompletedJobs());
    dispatch(flushPendingChanges());
  };

/** Wakes the queue up when the next automatic retry is due. */
const scheduleRetry =
  (dealIds: string[]): AppThunk =>
  (dispatch, getState) => {
    const retryAt = selectEarliestRetryAt(getState(), dealIds);
    if (retryAt === null) return;
    setTimeout(() => dispatch(flushPendingChanges()), Math.max(0, retryAt - Date.now()));
  };

/**
 * Tells the user when single saves end up failed or in conflict.
 * (Bulk moves report once, when the whole job is done.)
 */
const reportProblems =
  (dealIds: string[]): AppThunk =>
  (dispatch, getState) => {
    const state = getState();
    const hasNewProblem = dealIds.some((dealId) => {
      const change = state.sync.pending[dealId];
      return needsAttention(change) && !change?.jobId;
    });
    if (!hasNewProblem) return;

    const { failed, conflicts } = selectSyncSummary(state);
    if (failed > 0) {
      dispatch(
        toastShown({
          id: 'save-failed',
          tone: 'error',
          message: `${pluralize(failed, 'change')} couldn't be saved. Kept on screen until you retry or discard.`,
          action: 'review',
        }),
      );
    }
    if (conflicts > 0) {
      dispatch(
        toastShown({
          id: 'save-conflict',
          tone: 'error',
          message: `${pluralize(conflicts, 'deal')} changed by a teammate before your save. Choose which version to keep.`,
          action: 'review',
        }),
      );
    }
  };

/** Removes bulk jobs whose deals are all resolved, with a one-line summary. */
const finishCompletedJobs = (): AppThunk => (dispatch, getState) => {
  for (const job of getState().sync.jobs) {
    const progress = selectJobProgress(getState(), job);
    if (progress.inProgress > 0) continue;

    dispatch(jobFinished(job.id));
    const problems = progress.needAttention;
    dispatch(
      toastShown({
        id: job.id,
        tone: problems > 0 ? 'error' : 'success',
        message:
          problems > 0
            ? `${job.label}: ${formatNumber(progress.done)} of ${formatNumber(progress.total)} saved, ${pluralize(problems, 'deal')} need attention.`
            : `${job.label}: done.`,
        action: problems > 0 ? 'review' : undefined,
      }),
    );
  }
};

// --- Helpers --------------------------------------------------------------------

/** "Moving 3,000 deals to Lost", or "Moving 12 deals" when targets differ. */
function describeMove(changes: QueuedChange[]): string {
  const target = changes[0].toStage;
  const sameTarget = changes.every((change) => change.toStage === target);
  return `Moving ${pluralize(changes.length, 'deal')}${sameTarget ? ` to ${stageLabel(target)}` : ''}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
