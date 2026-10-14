import { createAsyncThunk, createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import type { ThunkExtra } from '../../app/dependencies';
import type { RootState } from '../../app/rootReducer';
import type { Deal } from '../../domain/deal';

/**
 * The deals as the server last told us. This is server truth only; the
 * user's unsaved changes live in the sync slice and are layered on top.
 *
 * Stored normalised (`ids` + `entities`) with RTK's entity adapter, so
 * looking up or updating one deal out of 50,000 is O(1).
 */

const dealsAdapter = createEntityAdapter<Deal>();

type LoadStatus = 'idle' | 'loading' | 'ready' | 'failed';

const initialState = dealsAdapter.getInitialState({
  loadStatus: 'idle' as LoadStatus,
});

export const loadDeals = createAsyncThunk<Deal[], void, { extra: ThunkExtra }>(
  'deals/load',
  (_, { extra }) => extra.api.fetchDeals(),
);

const dealsSlice = createSlice({
  name: 'deals',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadDeals.pending, (state) => {
        state.loadStatus = 'loading';
      })
      .addCase(loadDeals.fulfilled, (state, action) => {
        dealsAdapter.setAll(state, action.payload);
        state.loadStatus = 'ready';
      })
      .addCase(loadDeals.rejected, (state) => {
        state.loadStatus = 'failed';
      });
  },
});

export default dealsSlice.reducer;

// --- Selectors ----------------------------------------------------------------

const adapterSelectors = dealsAdapter.getSelectors((state: RootState) => state.deals);

/** All deals as an array (memoised: a new array only when deals change). */
export const selectAllDeals = adapterSelectors.selectAll;
export const selectDealById = adapterSelectors.selectById;
export const selectLoadStatus = (state: RootState) => state.deals.loadStatus;
