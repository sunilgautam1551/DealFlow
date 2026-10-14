import { createAction, createAsyncThunk, createEntityAdapter, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { fakeApi } from '../services/fakeApi';
import type { Deal } from '../types/deal';
import type { AppThunk, RootState } from './index';

/**
 * Deals exactly as the server last reported them ("server truth").
 * The user's unsaved moves live in the sync slice and are shown on top.
 *
 * Stored by id (`ids` + `entities`) with RTK's entity adapter, so finding or
 * updating one deal out of 50,000 is instant.
 */

const dealsAdapter = createEntityAdapter<Deal>();

const initialState = dealsAdapter.getInitialState({
  loadStatus: 'idle' as 'idle' | 'loading' | 'ready' | 'failed',
});

/** All data is being replaced (simulator "Regenerate"). Every slice that holds deal ids clears itself. */
export const pipelineReset = createAction('pipeline/reset');

export const loadDeals = createAsyncThunk('deals/load', () => fakeApi.fetchDeals());

const dealsSlice = createSlice({
  name: 'deals',
  initialState,
  reducers: {
    /**
     * New server versions of deals: realtime pushes and save responses.
     * Anything older than what we already have is ignored, because updates
     * can arrive out of order.
     */
    dealsReceived(state, action: PayloadAction<Deal[]>) {
      const newer = action.payload.filter((deal) => (state.entities[deal.id]?.version ?? 0) < deal.version);
      dealsAdapter.setMany(state, newer);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadDeals.pending, (state) => {
        state.loadStatus = 'loading';
      })
      .addCase(loadDeals.fulfilled, (state, action) => {
        // The realtime feed connects before loading, so a pushed version may be
        // newer than the (slightly older) full load. Keep the newer one.
        const deals = action.payload.map((deal) => {
          const existing = state.entities[deal.id];
          return existing && existing.version > deal.version ? existing : deal;
        });
        dealsAdapter.setAll(state, deals);
        state.loadStatus = 'ready';
      })
      .addCase(loadDeals.rejected, (state) => {
        state.loadStatus = 'failed';
      })
      .addCase(pipelineReset, () => initialState);
  },
});

export const { dealsReceived } = dealsSlice.actions;
export default dealsSlice.reducer;

const adapterSelectors = dealsAdapter.getSelectors((state: RootState) => state.deals);
export const selectAllDeals = adapterSelectors.selectAll;
export const selectDealById = adapterSelectors.selectById;

/** Pushes come in bursts; applying them together means one re-render, not hundreds. */
const REALTIME_BATCH_MS = 300;

/**
 * Listens to the server's realtime feed (teammates' changes, and echoes of our
 * own saves). Returns a function that disconnects.
 */
export const connectRealtime = (): AppThunk<() => void> => (dispatch) => {
  let buffer: Deal[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const unsubscribe = fakeApi.subscribe((deals) => {
    buffer = buffer.concat(deals);
    timer ??= setTimeout(() => {
      dispatch(dealsReceived(buffer));
      buffer = [];
      timer = null;
    }, REALTIME_BATCH_MS);
  });

  return () => {
    unsubscribe();
    if (timer) clearTimeout(timer);
  };
};
