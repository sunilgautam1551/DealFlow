import { createAsyncThunk, createEntityAdapter, createSlice, type EntityState } from '@reduxjs/toolkit';
import type { ThunkExtra } from '../../app/dependencies';
import type { RootState } from '../../app/rootReducer';
import type { Deal } from '../../domain/deal';
import { batchSucceeded } from '../sync/syncSlice';

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

/**
 * Stores server versions of deals, ignoring any that are older than what we
 * already have. Updates can arrive out of order (a save response and a
 * realtime push for the same change), and the version number settles which is newer.
 */
function storeIfNewer(state: EntityState<Deal, string>, deals: Deal[]): void {
  const newer = deals.filter((deal) => (state.entities[deal.id]?.version ?? 0) < deal.version);
  dealsAdapter.setMany(state, newer);
}

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
      })
      // Save responses carry the server's latest version of each deal (also for conflicts).
      .addCase(batchSucceeded, (state, action) => {
        const deals = action.payload.flatMap((result) => (result.status === 'not_found' ? [] : [result.deal]));
        storeIfNewer(state, deals);
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
