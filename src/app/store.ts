import { configureStore, type ThunkAction, type UnknownAction } from '@reduxjs/toolkit';
import { rootReducer, type RootState } from './rootReducer';

/**
 * Creates the Redux store.
 *
 * It is a factory (not a module-level singleton) so tests can build an
 * isolated store with their own dependencies.
 */
export function createAppStore() {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        // RTK's dev-only invariant checks walk the *entire* state tree after
        // every action. With 50,000 deals in state that makes every keypress
        // take hundreds of milliseconds, so they are switched off.
        immutableCheck: false,
        serializableCheck: false,
      }),
  });
}

export type AppStore = ReturnType<typeof createAppStore>;
export type AppDispatch = AppStore['dispatch'];
export type { RootState };

/** Signature for hand-written thunks (multi-step logic that reads state). */
export type AppThunk<ReturnType = void> = ThunkAction<ReturnType, RootState, unknown, UnknownAction>;
