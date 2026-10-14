import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { pipelineReset } from '../../app/actions';
import type { RootState } from '../../app/rootReducer';
import { visibleIdsReplaced } from '../view/viewSlice';

/**
 * Which deals are ticked for a bulk action.
 *
 * A Record (not an array) so "is this row selected?" is O(1) and each row
 * re-renders only when its own checkbox changes.
 */
export interface SelectionState {
  ids: Record<string, true>;
  /** Last row clicked without Shift: the start point for Shift+click ranges. */
  anchorId: string | null;
}

const initialState: SelectionState = {
  ids: {},
  anchorId: null,
};

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
    selectionCleared(state) {
      state.ids = {};
      state.anchorId = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(pipelineReset, () => initialState);
    // Never keep hidden deals selected: a bulk action must only touch what the user can see.
    builder.addCase(visibleIdsReplaced, (state, action) => {
      const visible = new Set(action.payload.ids);
      for (const id of Object.keys(state.ids)) {
        if (!visible.has(id)) delete state.ids[id];
      }
      if (state.anchorId && !visible.has(state.anchorId)) state.anchorId = null;
    });
  },
});

export const { selectionToggled, selectionAdded, selectionCleared } = selectionSlice.actions;
export default selectionSlice.reducer;

// --- Selectors ----------------------------------------------------------------

export const selectSelectedIdMap = (state: RootState) => state.selection.ids;

export function selectIsSelected(state: RootState, dealId: string): boolean {
  return state.selection.ids[dealId] === true;
}

export function selectSelectedCount(state: RootState): number {
  return Object.keys(state.selection.ids).length;
}
