import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { fakeApi } from '../services/fakeApi';
import { CURRENT_USER_ID, STAGES, type Deal, type StageId } from '../types/deal';
import { assessPriority, DAY_MS, isClosedStage } from '../utils/dealUtils';
import { loadDeals, pipelineReset, selectAllDeals } from './dealsSlice';
import type { AppThunk, RootState } from './index';
import {
  changesQueued,
  discardChanges,
  moveDeals,
  needsAttention,
  retryChanges,
  selectPending,
  type PendingChange,
} from './syncSlice';
import { dealCountChanged, moveDialogToggled } from './uiSlice';

/**
 * What the user is looking at: tab, filters, sort, the rows on screen, the
 * focused row and the ticked rows.
 */

/** "today" = my open deals by priority, "attention" = failed/conflicted saves, or a stage. */
export type ViewTab = 'today' | 'attention' | 'all' | StageId;
export type SortKey = 'priority' | 'value' | 'idle' | 'closeDate';

export interface ViewFilters {
  tab: ViewTab;
  search: string;
  /** "all" or a user id. */
  ownerId: string;
  /** Only deals with no contact for at least this many days (0 = any). */
  minIdleDays: number;
  sort: SortKey;
}

interface ViewState {
  filters: ViewFilters;
  /**
   * The rows on screen, in order. This is a snapshot, rebuilt only when the
   * user changes the view, so rows never jump or vanish under the cursor
   * while teammates edit deals. `selectUnseenChanges` counts what's changed since.
   */
  visibleIds: string[];
  /** When `visibleIds` was built. Used as "now" for priority and dates. */
  builtAt: number;
  focusedId: string | null;
  /** Ticked rows. A Record so "is this row ticked?" is instant. */
  selectedIds: Record<string, true>;
  /** Last row ticked without Shift: the start of a Shift+click range. */
  anchorId: string | null;
}

const initialState: ViewState = {
  filters: { tab: 'today', search: '', ownerId: 'all', minIdleDays: 0, sort: 'priority' },
  visibleIds: [],
  builtAt: Date.now(),
  focusedId: null,
  selectedIds: {},
  anchorId: null,
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
      if (!state.focusedId || !ids.includes(state.focusedId)) state.focusedId = ids[0] ?? null;

      // Never keep hidden deals ticked: a bulk action must only touch what the user can see.
      const visible = new Set(ids);
      for (const id of Object.keys(state.selectedIds)) {
        if (!visible.has(id)) delete state.selectedIds[id];
      }
      if (state.anchorId && !visible.has(state.anchorId)) state.anchorId = null;
    },

    focusChanged(state, action: PayloadAction<string | null>) {
      state.focusedId = action.payload;
    },

    selectionToggled(state, action: PayloadAction<string>) {
      const id = action.payload;
      if (state.selectedIds[id]) delete state.selectedIds[id];
      else state.selectedIds[id] = true;
      state.anchorId = id;
    },

    selectionAdded(state, action: PayloadAction<string[]>) {
      for (const id of action.payload) state.selectedIds[id] = true;
    },

    selectionCleared(state) {
      state.selectedIds = {};
      state.anchorId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // When the user moves deals off this tab, drop those rows at once (the
      // feedback they expect) and move focus to the next row.
      .addCase(changesQueued, (state, action) => {
        const leaving = new Set(
          action.payload.changes.filter((c) => !stageFitsTab(c.toStage, state.filters.tab)).map((c) => c.dealId),
        );
        if (leaving.size === 0) return;

        const oldIds = state.visibleIds;
        const focusIndex = state.focusedId ? oldIds.indexOf(state.focusedId) : -1;
        state.visibleIds = oldIds.filter((id) => !leaving.has(id));
        if (state.focusedId && leaving.has(state.focusedId)) {
          const nextId = oldIds.slice(focusIndex + 1).find((id) => !leaving.has(id));
          state.focusedId = nextId ?? state.visibleIds[state.visibleIds.length - 1] ?? null;
        }
      })
      .addCase(pipelineReset, (state) => ({ ...initialState, filters: state.filters }));
  },
});

export const { focusChanged, selectionToggled, selectionCleared } = viewSlice.actions;
const { filtersChanged, visibleIdsReplaced, selectionAdded } = viewSlice.actions;
export default viewSlice.reducer;

// --- Which deals belong in the view -------------------------------------------------

/** Whether a deal in `stage` belongs on `tab`, by stage alone. */
export function stageFitsTab(stage: StageId, tab: ViewTab): boolean {
  if (tab === 'today') return !isClosedStage(stage);
  if (tab === 'all' || tab === 'attention') return true;
  return stage === tab;
}

/**
 * The deals that match the filters, unsorted. Deals are placed by the stage
 * the user sees (their unsaved move if any, otherwise the server's).
 */
function filterDeals(deals: Deal[], pending: Record<string, PendingChange>, filters: ViewFilters, now: number): Deal[] {
  const search = filters.search.trim().toLowerCase();
  return deals.filter((deal) => {
    const change = pending[deal.id];
    if (filters.tab === 'attention') {
      if (!needsAttention(change)) return false;
    } else {
      if (filters.tab === 'today' && deal.ownerId !== CURRENT_USER_ID) return false;
      if (!stageFitsTab(change?.toStage ?? deal.stage, filters.tab)) return false;
    }
    // "Today" is always the current user's deals, so the owner filter doesn't apply there.
    if (filters.tab !== 'today' && filters.ownerId !== 'all' && deal.ownerId !== filters.ownerId) return false;
    if (search && !deal.company.toLowerCase().includes(search)) return false;
    if (filters.minIdleDays > 0 && now - deal.lastActivityAt < filters.minIdleDays * DAY_MS) return false;
    return true;
  });
}

/** Sort keys, ascending: smaller is shown first. */
const SORT_VALUES: Record<SortKey, (deal: Deal, now: number) => number> = {
  priority: (deal, now) => -assessPriority(deal, now).score,
  value: (deal) => -deal.value,
  idle: (deal) => deal.lastActivityAt,
  closeDate: (deal) => deal.expectedCloseAt,
};

/** Filters and sorts all deals into the ids to show. ~40 ms for 50,000 deals. */
function buildVisibleIds(deals: Deal[], pending: Record<string, PendingChange>, filters: ViewFilters, now: number) {
  const sortValue = SORT_VALUES[filters.sort];
  return filterDeals(deals, pending, filters, now)
    .map((deal) => ({ id: deal.id, key: sortValue(deal, now) })) // compute each key once
    .sort((a, b) => a.key - b.key || Number(a.id) - Number(b.id))
    .map((item) => item.id);
}

// --- Selectors ------------------------------------------------------------------------

export const selectFilters = (state: RootState) => state.view.filters;
export const selectVisibleIds = (state: RootState) => state.view.visibleIds;
export const selectFocusedId = (state: RootState) => state.view.focusedId;
export const selectBuiltAt = (state: RootState) => state.view.builtAt;
export const selectIsSelected = (state: RootState, id: string) => state.view.selectedIds[id] === true;
export const selectSelectedCount = (state: RootState) => Object.keys(state.view.selectedIds).length;

/** Deals an action applies to: the ticked ones, or else the focused row. */
export function selectActionTargets(state: RootState): string[] {
  const selected = Object.keys(state.view.selectedIds);
  if (selected.length > 0) return selected;
  return state.view.focusedId ? [state.view.focusedId] : [];
}

/** Live counts and values for the tab headers, by the stage the user sees. */
export const selectTabCounts = createSelector([selectAllDeals, selectPending], (deals, pending) => {
  const byStage = Object.fromEntries(STAGES.map((stage) => [stage.id, { count: 0, value: 0 }])) as Record<
    StageId,
    { count: number; value: number }
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

/**
 * How far the rows on screen have drifted from live data: deals that now
 * belong here (`added`) and deals that no longer do (`removed`). Shown as a
 * banner, so the user decides when the list changes.
 */
export const selectUnseenChanges = createSelector(
  [selectAllDeals, selectPending, selectFilters, selectBuiltAt, selectVisibleIds],
  (deals, pending, filters, builtAt, visibleIds) => {
    const liveIds = new Set(filterDeals(deals, pending, filters, builtAt).map((deal) => deal.id));
    const shownIds = new Set(visibleIds);
    let added = 0;
    for (const id of liveIds) if (!shownIds.has(id)) added += 1;
    let removed = 0;
    for (const id of shownIds) if (!liveIds.has(id)) removed += 1;
    return { added, removed };
  },
);

// --- Loading and refreshing --------------------------------------------------------------

/** Rebuilds the rows on screen from the latest data, keeping focus where it was. */
export const refreshView = (): AppThunk => (dispatch, getState) => {
  const state = getState();
  const now = Date.now();
  dispatch(visibleIdsReplaced({ ids: buildVisibleIds(selectAllDeals(state), state.sync.pending, state.view.filters, now), builtAt: now }));
};

/** Changes tab/search/filters/sort. A new view starts at the top. */
export const updateFilters =
  (changes: Partial<ViewFilters>): AppThunk =>
  (dispatch) => {
    dispatch(filtersChanged(changes));
    dispatch(focusChanged(null));
    dispatch(refreshView());
  };

/** Loads all deals and builds the first view. Runs once (React StrictMode calls effects twice). */
export const loadPipeline = (): AppThunk<Promise<void>> => async (dispatch, getState) => {
  if (getState().deals.loadStatus !== 'idle') return;
  await dispatch(loadDeals());
  dispatch(refreshView());
};

/** Simulator: replaces all data with `dealCount` fresh deals. Only offered when nothing is unsaved. */
export const regenerateDeals =
  (dealCount: number): AppThunk<Promise<void>> =>
  async (dispatch) => {
    fakeApi.reset(dealCount);
    dispatch(dealCountChanged(dealCount));
    dispatch(pipelineReset());
    await dispatch(loadPipeline());
  };

// --- Focus and selection (mouse and keyboard) -----------------------------------------------

/** ↑/↓: move focus, stopping at the ends. */
export const moveFocus =
  (delta: number): AppThunk =>
  (dispatch, getState) => {
    const { visibleIds, focusedId } = getState().view;
    if (visibleIds.length === 0) return;
    const current = focusedId ? visibleIds.indexOf(focusedId) : -1;
    dispatch(focusChanged(visibleIds[Math.min(visibleIds.length - 1, Math.max(0, current + delta))]));
  };

/** Home / End. */
export const focusEdge =
  (edge: 'first' | 'last'): AppThunk =>
  (dispatch, getState) => {
    const { visibleIds } = getState().view;
    if (visibleIds.length > 0) dispatch(focusChanged(edge === 'first' ? visibleIds[0] : visibleIds[visibleIds.length - 1]));
  };

/** Click a checkbox: tick/untick one deal. */
export const toggleSelection =
  (id: string): AppThunk =>
  (dispatch) => {
    dispatch(selectionToggled(id));
    dispatch(focusChanged(id));
  };

/** Shift+click: tick every row between the last ticked (or else the focused) row and this one. */
export const selectRangeTo =
  (id: string): AppThunk =>
  (dispatch, getState) => {
    const { visibleIds, anchorId, focusedId } = getState().view;
    const start = anchorId ?? focusedId;
    const from = start ? visibleIds.indexOf(start) : -1;
    const to = visibleIds.indexOf(id);
    if (from === -1 || to === -1) {
      dispatch(toggleSelection(id));
      return;
    }
    dispatch(selectionAdded(visibleIds.slice(Math.min(from, to), Math.max(from, to) + 1)));
    dispatch(focusChanged(id));
  };

/** Shift+↑/↓: tick the focused row and the next one, and move focus there. */
export const extendSelection =
  (delta: number): AppThunk =>
  (dispatch, getState) => {
    const startId = getState().view.focusedId;
    if (!startId) return;
    dispatch(selectionAdded([startId]));
    dispatch(moveFocus(delta));
    const endId = getState().view.focusedId;
    if (endId) dispatch(selectionAdded([endId]));
  };

/** Space: tick/untick the focused row. */
export const toggleFocusedSelection = (): AppThunk => (dispatch, getState) => {
  const { focusedId } = getState().view;
  if (focusedId) dispatch(selectionToggled(focusedId));
};

/** Tick every row in the view (e.g. all 10,000 in a stage). */
export const selectAllVisible = (): AppThunk => (dispatch, getState) => {
  dispatch(selectionAdded(getState().view.visibleIds));
};

// --- Actions on the ticked deals (or the focused row) -------------------------------------

export const moveTargetsTo =
  (toStage: StageId): AppThunk =>
  (dispatch, getState) => {
    const targets = selectActionTargets(getState());
    if (targets.length === 0 || !STAGES.some((stage) => stage.id === toStage)) return;
    dispatch(moveDeals(targets, toStage));
    dispatch(selectionCleared());
  };

/** Retry failed saves / keep my version of conflicts. */
export const retryTargets = (): AppThunk => (dispatch, getState) => {
  dispatch(retryChanges(selectActionTargets(getState())));
};

/** Discard failed saves / keep the teammate's version. */
export const discardTargets = (): AppThunk => (dispatch, getState) => {
  dispatch(discardChanges(selectActionTargets(getState())));
};

/** Enter: open "Move to…", if there's anything to move. */
export const openMoveDialog = (): AppThunk => (dispatch, getState) => {
  if (selectActionTargets(getState()).length > 0) dispatch(moveDialogToggled(true));
};
