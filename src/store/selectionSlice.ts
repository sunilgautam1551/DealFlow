import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { STAGES, type StageId } from '../types/deal';
import { pipelineReset } from './dealsSlice';
import type { AppThunk, RootState } from './index';
import { discardChanges, moveDeals, retryChanges } from './syncThunks';
import { moveDialogToggled } from './uiSlice';
import { filtersChanged, focusChanged, moveFocus, visibleIdsReplaced } from './viewSlice';

/**
 * Which deals are ticked, and the actions that apply to them.
 *
 * Every action works on the "targets": the ticked deals, or the focused row
 * when nothing is ticked. So moving one deal and moving 10,000 work the same way.
 */

interface SelectionState {
  /** Ticked deal ids. A Record so "is this row ticked?" is instant. */
  ids: Record<string, true>;
  /** Last row ticked without Shift: the start of a Shift+click range. */
  anchorId: string | null;
}

const initialState: SelectionState = { ids: {}, anchorId: null };

const selectionSlice = createSlice({
  name: 'selection',
  initialState,
  reducers: {
    selectionToggled(state, action: PayloadAction<string>) {
      const id = action.payload;
      if (state.ids[id]) delete state.ids[id];
      else state.ids[id] = true;
      state.anchorId = id;
    },

    selectionAdded(state, action: PayloadAction<string[]>) {
      for (const id of action.payload) state.ids[id] = true;
    },

    selectionCleared() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      // A new tab starts with nothing ticked, so deals ticked in one view can't
      // be moved by accident from another.
      .addCase(filtersChanged, (state, action) => (action.payload.tab !== undefined ? initialState : state))
      // Never keep hidden deals ticked: a bulk action must only touch what the user can see.
      .addCase(visibleIdsReplaced, (state, action) => {
        const visible = new Set(action.payload.ids);
        for (const id of Object.keys(state.ids)) {
          if (!visible.has(id)) delete state.ids[id];
        }
        if (state.anchorId && !visible.has(state.anchorId)) state.anchorId = null;
      })
      .addCase(pipelineReset, () => initialState);
  },
});

export const { selectionToggled, selectionCleared } = selectionSlice.actions;
const { selectionAdded } = selectionSlice.actions;
export default selectionSlice.reducer;

// --- Selectors ----------------------------------------------------------------------

export const selectIsSelected = (state: RootState, id: string) => state.selection.ids[id] === true;
export const selectSelectedCount = (state: RootState) => Object.keys(state.selection.ids).length;

/** Deals an action applies to: the ticked ones, or else the focused row. */
export function selectActionTargets(state: RootState): string[] {
  const selected = Object.keys(state.selection.ids);
  if (selected.length > 0) return selected;
  return state.view.focusedId ? [state.view.focusedId] : [];
}

// --- Ticking rows (mouse and keyboard) ----------------------------------------------------

/** Click a checkbox, or Cmd/Ctrl+click a row: tick/untick one deal. */
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
    const { visibleIds, focusedId } = getState().view;
    const start = getState().selection.anchorId ?? focusedId;
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

// --- Actions on the targets -------------------------------------------------------------

/** "Move to…": moves the targets to a stage. Ignores anything that isn't a real stage. */
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

/** Enter on the list: open "Move to…", if there's anything to move. */
export const openMoveDialog = (): AppThunk => (dispatch, getState) => {
  if (selectActionTargets(getState()).length > 0) dispatch(moveDialogToggled(true));
};
