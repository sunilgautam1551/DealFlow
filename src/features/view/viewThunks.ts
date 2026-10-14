import type { AppThunk } from '../../app/store';
import { loadDeals, selectAllDeals } from '../deals/dealsSlice';
import { buildVisibleIds } from './buildVisibleIds';
import { filtersChanged, visibleIdsReplaced, type ViewFilters } from './viewSlice';

/** Rebuilds the list of visible rows from the latest data. */
export const refreshView = (): AppThunk => (dispatch, getState) => {
  const state = getState();
  const now = Date.now();
  const ids = buildVisibleIds(selectAllDeals(state), state.view.filters, now);
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
