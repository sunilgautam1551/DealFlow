import { fakeApi } from '../services/fakeApi';
import { CURRENT_USER_ID, type StageId } from '../types/deal';
import { formatNumber, pluralize, stageLabel } from '../utils/dealUtils';
import { dealsReceived } from './dealsSlice';
import type { AppThunk } from './index';
import {
  batchFailed,
  batchSent,
  batchSucceeded,
  changesDiscarded,
  changesQueued,
  jobFinished,
  jobStarted,
  needsAttention,
  retryRequested,
  selectEffectiveStage,
  selectJobProgress,
  selectSyncSummary,
  type PendingChange,
} from './syncSlice';
import { toastShown } from './uiSlice';

/**
 * The save engine: sends the pending changes from `syncSlice` to the server
 * in batches, schedules automatic retries, and tells the user about problems
 * and finished bulk moves.
 */

/** Deals per request. */
const BATCH_SIZE = 500;
/** Requests at once, so a bulk move of thousands doesn't flood the network. */
const MAX_PARALLEL_REQUESTS = 3;
/** Moves of this many deals or more get a progress bar. */
const BULK_JOB_MIN_SIZE = 10;

/** Moves deals to a stage: the screen updates at once, saving starts in the background. */
export const moveDeals =
  (dealIds: string[], toStage: StageId): AppThunk =>
  (dispatch, getState) => {
    const state = getState();
    const changes = dealIds
      .filter((dealId) => state.deals.entities[dealId] && selectEffectiveStage(state, dealId) !== toStage)
      .map((dealId) => ({ dealId, toStage, serverStage: state.deals.entities[dealId].stage }));
    if (changes.length === 0) return;

    let jobId: string | undefined;
    if (changes.length >= BULK_JOB_MIN_SIZE) {
      jobId = `job-${Date.now()}`;
      const label = `Moving ${pluralize(changes.length, 'deal')} to ${stageLabel(toStage)}`;
      dispatch(jobStarted({ id: jobId, label, dealIds: changes.map((change) => change.dealId) }));
    }
    dispatch(changesQueued({ changes, jobId }));
    dispatch(flushPendingChanges());
  };

export const retryChanges =
  (dealIds: string[]): AppThunk =>
  (dispatch) => {
    dispatch(retryRequested(dealIds));
    dispatch(flushPendingChanges());
  };

export const discardChanges =
  (dealIds: string[]): AppThunk =>
  (dispatch) => {
    dispatch(changesDiscarded(dealIds));
  };

/**
 * Sends queued changes in batches, up to MAX_PARALLEL_REQUESTS at a time.
 * Safe to call any time: a change is marked `saving` before it's sent, so it
 * is never sent twice at once.
 */
const flushPendingChanges = (): AppThunk => (dispatch, getState) => {
  while (getState().sync.inFlightRequests < MAX_PARALLEL_REQUESTS) {
    const now = Date.now();
    const batch = Object.values(getState().sync.pending)
      .filter((change) => change.status === 'queued' && change.retryAt <= now)
      .slice(0, BATCH_SIZE);
    if (batch.length === 0) return;

    dispatch(batchSent(batch.map((change) => change.dealId)));
    void dispatch(sendBatch(batch));
  }
};

const sendBatch =
  (batch: PendingChange[]): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const dealIds = batch.map((change) => change.dealId);
    try {
      const requests = batch.map(({ dealId, toStage, expectedStage }) => ({ dealId, toStage, expectedStage }));
      const results = await fakeApi.moveDeals(requests, CURRENT_USER_ID);
      // Store the server's versions first, then clear the pending changes, so nothing flickers.
      dispatch(dealsReceived(results.flatMap((result) => (result.status === 'not_found' ? [] : [result.deal]))));
      dispatch(batchSucceeded(results));
    } catch (error) {
      dispatch(batchFailed({ dealIds, error: error instanceof Error ? error.message : 'Unknown error', now: Date.now() }));
      // Wake the queue up when the earliest retry is due.
      const waiting = dealIds.map((id) => getState().sync.pending[id]).filter((change) => change?.status === 'queued');
      if (waiting.length > 0) {
        const nextRetry = Math.min(...waiting.map((change) => change.retryAt));
        setTimeout(() => dispatch(flushPendingChanges()), Math.max(0, nextRetry - Date.now()));
      }
    }

    dispatch(reportProblems(dealIds));
    dispatch(finishCompletedJobs());
    dispatch(flushPendingChanges());
  };

/** Toasts when single moves end up failed or in conflict. Bulk moves report once, when done. */
const reportProblems =
  (dealIds: string[]): AppThunk =>
  (dispatch, getState) => {
    const state = getState();
    const hasNewProblem = dealIds.some((id) => needsAttention(state.sync.pending[id]) && !state.sync.pending[id].jobId);
    if (!hasNewProblem) return;

    const { failed, conflicts } = selectSyncSummary(state);
    if (failed > 0) {
      const message = `${pluralize(failed, 'change')} couldn't be saved. Kept on screen until you retry or discard.`;
      dispatch(toastShown({ id: 'save-failed', tone: 'error', message, showReview: true }));
    }
    if (conflicts > 0) {
      const message = `${pluralize(conflicts, 'deal')} changed by a teammate before your save. Choose which version to keep.`;
      dispatch(toastShown({ id: 'save-conflict', tone: 'error', message, showReview: true }));
    }
  };

/** Removes bulk jobs whose deals are all resolved, with a one-line summary. */
const finishCompletedJobs = (): AppThunk => (dispatch, getState) => {
  for (const job of getState().sync.jobs) {
    const { inProgress, needAttention, done, total } = selectJobProgress(getState(), job);
    if (inProgress > 0) continue;

    dispatch(jobFinished(job.id));
    const message =
      needAttention > 0
        ? `${job.label}: ${formatNumber(done)} of ${formatNumber(total)} saved, ${pluralize(needAttention, 'deal')} need attention.`
        : `${job.label}: done.`;
    dispatch(toastShown({ id: job.id, tone: needAttention > 0 ? 'error' : 'success', message, showReview: needAttention > 0 }));
  }
};
