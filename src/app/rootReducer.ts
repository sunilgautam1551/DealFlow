import { combineReducers } from '@reduxjs/toolkit';
import dealsReducer from '../features/deals/dealsSlice';
import uiReducer from '../features/ui/uiSlice';
import viewReducer from '../features/view/viewSlice';

/**
 * Every feature slice is registered here. Adding a feature = add its reducer
 * to this object; `RootState` updates automatically.
 */
export const rootReducer = combineReducers({
  deals: dealsReducer,
  view: viewReducer,
  ui: uiReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
