import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { StageId } from '../../domain/stages';

/**
 * What the user is looking at: the active tab, filters, sort order, the rows
 * on screen and which row has keyboard focus.
 */

/** "today" = my open deals by priority; "all" = every deal; otherwise a single stage. */
export type ViewTab = 'today' | 'all' | StageId;

export type SortKey = 'priority' | 'value' | 'idle' | 'closeDate';

/** "all", or a user id. */
export type OwnerFilter = string;

export interface ViewFilters {
  tab: ViewTab;
  search: string;
  ownerId: OwnerFilter;
  /** Only show deals with no activity for at least this many days (0 = any). */
  minIdleDays: number;
  sort: SortKey;
}

export interface ViewState {
  filters: ViewFilters;
  /**
   * Ids of the rows on screen, in display order.
   *
   * This is a stored snapshot rather than a live selector on purpose: it is
   * rebuilt only when the user changes the view (see `refreshView`), so rows
   * never reorder or vanish under the user's cursor when teammates edit deals.
   */
  visibleIds: string[];
  /** When `visibleIds` was built. Used as "now" for priority and relative dates. */
  builtAt: number;
  /** The row with keyboard focus. */
  focusedId: string | null;
}

const initialState: ViewState = {
  filters: {
    tab: 'today',
    search: '',
    ownerId: 'all',
    minIdleDays: 0,
    sort: 'priority',
  },
  visibleIds: [],
  builtAt: Date.now(),
  focusedId: null,
};

const viewSlice = createSlice({
  name: 'view',
  initialState,
  reducers: {
    filtersChanged(state, action: PayloadAction<Partial<ViewFilters>>) {
      state.filters = { ...state.filters, ...action.payload };
    },

    visibleIdsReplaced(state, action: PayloadAction<{ ids: string[]; builtAt: number }>) {
      const { ids, builtAt } = action.payload;
      state.visibleIds = ids;
      state.builtAt = builtAt;
      // Keep focus on the same deal if it is still visible, otherwise start at the top.
      if (!state.focusedId || !ids.includes(state.focusedId)) {
        state.focusedId = ids[0] ?? null;
      }
    },

    focusChanged(state, action: PayloadAction<string | null>) {
      state.focusedId = action.payload;
    },
  },
});

export const { filtersChanged, visibleIdsReplaced, focusChanged } = viewSlice.actions;
export default viewSlice.reducer;
