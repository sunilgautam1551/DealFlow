import { combineReducers } from '@reduxjs/toolkit';
import dealsReducer from '../features/deals/dealsSlice';
import notificationsReducer from '../features/notifications/notificationsSlice';
import selectionReducer from '../features/selection/selectionSlice';
import simulatorReducer from '../features/simulator/simulatorSlice';
import syncReducer from '../features/sync/syncSlice';
import uiReducer from '../features/ui/uiSlice';
import viewReducer from '../features/view/viewSlice';

/**
 * Every feature slice is registered here. Adding a feature = add its reducer
 * to this object; `RootState` updates automatically.
 */
export const rootReducer = combineReducers({
  /** Server truth: deals as the server last reported them. */
  deals: dealsReducer,
  /** The user's unsaved changes, layered on top of `deals`. */
  sync: syncReducer,
  view: viewReducer,
  selection: selectionReducer,
  notifications: notificationsReducer,
  ui: uiReducer,
  /** Settings of the fake backend (simulator panel). */
  simulator: simulatorReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
