import type { AppThunk } from '../../app/store';
import { loadDeals, selectAllDeals } from '../deals/dealsSlice';
import { buildVisibleIds } from './buildVisibleIds';
import { filtersChanged, focusChanged, visibleIdsReplaced, type ViewFilters } from './viewSlice';

/** Rebuilds the list of visible rows from the latest data. */
export const refreshView = (): AppThunk => (dispatch, getState) => {
  const state = getState();
  const now = Date.now();
  const ids = buildVisibleIds(selectAllDeals(state), state.sync.pending, state.view.filters, now);
  dispatch(visibleIdsReplaced({ ids, builtAt: now }));
};

/** Changes tab/search/filters/sort and shows the result straight away. */
export const updateFilters =
  (changes: Partial<ViewFilters>): AppThunk =>
  (dispatch) => {
    dispatch(filtersChanged(changes));
    dispatch(refreshView());
  };

/** Initial load: fetch all deals, then build the first view. Runs once. */
export const loadPipeline = (): AppThunk<Promise<void>> => async (dispatch, getState) => {
  if (getState().deals.loadStatus !== 'idle') return;
  await dispatch(loadDeals());
  dispatch(refreshView());
};

/** Moves keyboard focus up (negative) or down (positive) the list, stopping at the ends. */
export const moveFocus =
  (delta: number): AppThunk =>
  (dispatch, getState) => {
    const { visibleIds, focusedId } = getState().view;
    if (visibleIds.length === 0) return;
    const current = focusedId ? visibleIds.indexOf(focusedId) : -1;
    const next = Math.min(visibleIds.length - 1, Math.max(0, current + delta));
    dispatch(focusChanged(visibleIds[next]));
  };

/** Moves keyboard focus to the first or last row (Home / End). */
export const focusEdge =
  (edge: 'first' | 'last'): AppThunk =>
  (dispatch, getState) => {
    const { visibleIds } = getState().view;
    if (visibleIds.length === 0) return;
    dispatch(focusChanged(edge === 'first' ? visibleIds[0] : visibleIds[visibleIds.length - 1]));
  };
