import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../app/rootReducer';
import { isClosedStage, STAGE_IDS, type StageId } from '../../domain/stages';
import { CURRENT_USER_ID } from '../../domain/users';
import { selectAllDeals } from '../deals/dealsSlice';
import { selectPending } from '../sync/syncSelectors';
import { filterDeals } from './buildVisibleIds';

export const selectFilters = (state: RootState) => state.view.filters;
export const selectVisibleIds = (state: RootState) => state.view.visibleIds;
export const selectFocusedId = (state: RootState) => state.view.focusedId;
export const selectBuiltAt = (state: RootState) => state.view.builtAt;

export interface StageTotals {
  count: number;
  value: number;
}

export interface TabCounts {
  today: number;
  all: number;
  byStage: Record<StageId, StageTotals>;
}

/**
 * Live deal counts (and stage values) for the tab headers, by effective stage
 * so the user's own moves show up immediately. One pass over all deals.
 */
export const selectTabCounts = createSelector([selectAllDeals, selectPending], (deals, pending): TabCounts => {
  const byStage = Object.fromEntries(STAGE_IDS.map((id) => [id, { count: 0, value: 0 }])) as Record<
    StageId,
    StageTotals
  >;
  let today = 0;

  for (const deal of deals) {
    const stage = pending[deal.id]?.toStage ?? deal.stage;
    byStage[stage].count += 1;
    byStage[stage].value += deal.value;
    if (deal.ownerId === CURRENT_USER_ID && !isClosedStage(stage)) today += 1;
  }

  return { today, all: deals.length, byStage };
});

/** Deals the user can act on: the ticked ones, or else the focused row. */
export function selectActionTargets(state: RootState): string[] {
  const selected = Object.keys(state.selection.ids);
  if (selected.length > 0) return selected;
  return state.view.focusedId ? [state.view.focusedId] : [];
}

export interface UnseenChanges {
  /** Deals that now belong in this view but are not on screen (e.g. new leads). */
  added: number;
  /** Deals on screen that no longer belong here (e.g. a teammate moved them). */
  removed: number;
}

/**
 * How far the list on screen has drifted from live data.
 *
 * The list is a snapshot (see `ViewState.visibleIds`), so teammates' changes
 * don't move rows under the user's cursor. Instead the user sees a count and
 * chooses when to refresh. Only filters, no sorting, so it stays cheap enough
 * to rerun on every realtime batch.
 */
export const selectUnseenChanges = createSelector(
  [selectAllDeals, selectPending, selectFilters, selectBuiltAt, selectVisibleIds],
  (deals, pending, filters, builtAt, visibleIds): UnseenChanges => {
    const liveIds = new Set(filterDeals(deals, pending, filters, builtAt).map((deal) => deal.id));
    const shownIds = new Set(visibleIds);

    let added = 0;
    for (const id of liveIds) if (!shownIds.has(id)) added += 1;
    let removed = 0;
    for (const id of shownIds) if (!liveIds.has(id)) removed += 1;

    return { added, removed };
  },
);
