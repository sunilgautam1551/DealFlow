import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { pipelineReset } from '../../app/actions';
import type { RootState } from '../../app/rootReducer';

/**
 * Short messages ("toasts") about things that happened in the background,
 * e.g. a save that failed.
 *
 * Toasts have stable ids: showing a toast with an existing id replaces it.
 * That keeps one up-to-date "3 changes couldn't be saved" message instead of
 * a pile of duplicates.
 */

export type ToastTone = 'success' | 'error' | 'info';

/** Buttons a toast can offer. Kept as names so state stays plain data. */
export type ToastAction = 'review';

export interface Toast {
  id: string;
  tone: ToastTone;
  message: string;
  action?: ToastAction;
  /** Changes when a toast is re-shown, so its auto-hide timer restarts. */
  shownAt: number;
}

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: { toasts: [] as Toast[] },
  reducers: {
    toastShown(state, action: PayloadAction<Omit<Toast, 'shownAt'>>) {
      const toast = { ...action.payload, shownAt: Date.now() };
      state.toasts = [...state.toasts.filter((t) => t.id !== toast.id), toast];
    },
    toastDismissed(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter((toast) => toast.id !== action.payload);
    },
  },
  extraReducers: (builder) => {
    builder.addCase(pipelineReset, (state) => {
      state.toasts = [];
    });
  },
});

export const { toastShown, toastDismissed } = notificationsSlice.actions;
export default notificationsSlice.reducer;

export const selectToasts = (state: RootState) => state.notifications.toasts;
