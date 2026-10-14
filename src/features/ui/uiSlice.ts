import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * UI chrome state: which dialog/drawer is open.
 *
 * Kept in Redux (rather than component state) because the keyboard handler
 * and toolbar buttons need to open/close the same dialogs.
 */

export type DialogId = 'move';

export interface UiState {
  /** The modal dialog currently open, if any. Only one modal at a time. */
  openDialog: DialogId | null;
  /** Whether the network/teammate simulator drawer is visible. */
  simulatorOpen: boolean;
}

const initialState: UiState = {
  openDialog: null,
  simulatorOpen: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    dialogOpened(state, action: PayloadAction<DialogId>) {
      state.openDialog = action.payload;
    },
    dialogClosed(state) {
      state.openDialog = null;
    },
    simulatorToggled(state) {
      state.simulatorOpen = !state.simulatorOpen;
    },
  },
});

export const { dialogOpened, dialogClosed, simulatorToggled } = uiSlice.actions;
export default uiSlice.reducer;
