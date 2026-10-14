import { configureStore, type ThunkAction, type UnknownAction } from '@reduxjs/toolkit';
import { setAutoFreeze } from 'immer';
import type { ThunkExtra } from './dependencies';
import { rootReducer, type RootState } from './rootReducer';

// Immer (used by RTK reducers) normally freezes the new state after every
// update. Freezing the 50,000-deal `entities` object costs ~15 ms per update,
// which made every realtime batch stutter. State is still never mutated:
// reducers go through Immer and deals are replaced, not edited.
setAutoFreeze(false);

/**
 * Creates the Redux store.
 *
 * It is a factory (not a module-level singleton) so tests can build an
 * isolated store with their own dependencies.
 */
export function createAppStore(extra: ThunkExtra) {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        thunk: { extraArgument: extra },
        // RTK's dev-only invariant checks walk the *entire* state tree after
        // every action. With 50,000 deals in state that makes every action
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
export type AppThunk<ReturnType = void> = ThunkAction<ReturnType, RootState, ThunkExtra, UnknownAction>;
