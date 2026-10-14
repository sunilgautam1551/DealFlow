import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../app/rootReducer';
import { isClosedStage, STAGE_IDS, type StageId } from '../../domain/stages';
import { CURRENT_USER_ID } from '../../domain/users';
import { selectAllDeals } from '../deals/dealsSlice';

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

/** Live deal counts (and stage values) for the tab headers. One pass over all deals. */
export const selectTabCounts = createSelector([selectAllDeals], (deals): TabCounts => {
  const byStage = Object.fromEntries(STAGE_IDS.map((id) => [id, { count: 0, value: 0 }])) as Record<
    StageId,
    StageTotals
  >;
  let today = 0;

  for (const deal of deals) {
    byStage[deal.stage].count += 1;
    byStage[deal.stage].value += deal.value;
    if (deal.ownerId === CURRENT_USER_ID && !isClosedStage(deal.stage)) today += 1;
  }

  return { today, all: deals.length, byStage };
});
