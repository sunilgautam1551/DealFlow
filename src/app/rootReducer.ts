import { combineReducers } from '@reduxjs/toolkit';
import uiReducer from '../features/ui/uiSlice';

/**
 * Every feature slice is registered here. Adding a feature = add its reducer
 * to this object; `RootState` updates automatically.
 */
export const rootReducer = combineReducers({
  ui: uiReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
