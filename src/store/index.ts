import { combineReducers, configureStore, type ThunkAction, type UnknownAction } from '@reduxjs/toolkit';
import { setAutoFreeze } from 'immer';
import { useDispatch, useSelector } from 'react-redux';
import dealsReducer from './dealsSlice';
import syncReducer from './syncSlice';
import uiReducer from './uiSlice';
import viewReducer from './viewSlice';

const rootReducer = combineReducers({
  /** Deals as the server last reported them. */
  deals: dealsReducer,
  /** The user's unsaved moves, shown on top of `deals`. */
  sync: syncReducer,
  /** Tab, filters, rows on screen, focus, selection. */
  view: viewReducer,
  /** Dialog, toasts, simulator settings. */
  ui: uiReducer,
});

// Performance with 50,000 deals in state:
// - Immer (used by RTK reducers) freezes the new state after every update.
//   Freezing the 50,000-deal object costs ~15 ms per update, so it's off.
//   Reducers still never mutate state; they go through Immer.
// - RTK's dev-only checks walk the whole state after every action, which
//   takes hundreds of ms here, so they're off too.
setAutoFreeze(false);

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({ immutableCheck: false, serializableCheck: false }),
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
export type AppThunk<ReturnType = void> = ThunkAction<ReturnType, RootState, unknown, UnknownAction>;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
