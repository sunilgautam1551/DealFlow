import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { DEFAULT_DEAL_COUNT, DEFAULT_SIMULATION_CONFIG, fakeApi, type SimulationConfig } from '../services/fakeApi';
import type { AppThunk, RootState } from './index';

/**
 * Screen chrome: the move dialog, toasts and the simulator panel.
 */

/**
 * A short message about something that happened in the background.
 * Toasts have fixed ids: showing one with an existing id replaces it, so
 * there's one up-to-date "3 changes couldn't be saved" instead of a pile.
 */
export interface Toast {
  id: string;
  tone: 'success' | 'error';
  message: string;
  /** Show a "Review" button that opens the Needs attention tab. */
  showReview?: boolean;
  /** Changes when the toast is shown again, so its hide timer restarts. */
  shownAt: number;
}

interface UiState {
  moveDialogOpen: boolean;
  simulatorOpen: boolean;
  simulation: SimulationConfig;
  dealCount: number;
  toasts: Toast[];
}

const initialState: UiState = {
  moveDialogOpen: false,
  simulatorOpen: false,
  simulation: DEFAULT_SIMULATION_CONFIG,
  dealCount: DEFAULT_DEAL_COUNT,
  toasts: [],
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    moveDialogToggled(state, action: PayloadAction<boolean>) {
      state.moveDialogOpen = action.payload;
    },
    simulatorToggled(state) {
      state.simulatorOpen = !state.simulatorOpen;
    },
    simulationChanged(state, action: PayloadAction<Partial<SimulationConfig>>) {
      state.simulation = { ...state.simulation, ...action.payload };
    },
    dealCountChanged(state, action: PayloadAction<number>) {
      state.dealCount = action.payload;
    },
    toastShown(state, action: PayloadAction<Omit<Toast, 'shownAt'>>) {
      const toast = { ...action.payload, shownAt: Date.now() };
      state.toasts = [...state.toasts.filter((t) => t.id !== toast.id), toast];
    },
    toastDismissed(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter((toast) => toast.id !== action.payload);
    },
  },
});

export const { moveDialogToggled, simulatorToggled, dealCountChanged, toastShown, toastDismissed } = uiSlice.actions;
export default uiSlice.reducer;

/** Changes how the fake backend behaves, from the next request on. */
export const updateSimulation =
  (changes: Partial<SimulationConfig>): AppThunk =>
  (dispatch, getState) => {
    dispatch(uiSlice.actions.simulationChanged(changes));
    fakeApi.configure(getState().ui.simulation);
  };

export const selectToasts = (state: RootState) => state.ui.toasts;
