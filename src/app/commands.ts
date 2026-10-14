import type { StageId } from '../domain/stages';
import { selectionCleared } from '../features/selection/selectionSlice';
import { discardChanges, moveDeals, retryChanges } from '../features/sync/syncThunks';
import { dialogOpened } from '../features/ui/uiSlice';
import { selectActionTargets } from '../features/view/viewSelectors';
import type { AppThunk } from './store';

/**
 * Actions the user triggers from buttons or the keyboard.
 *
 * They all work on the same "targets": the ticked deals, or the focused row
 * when nothing is ticked. So one deal and 10,000 deals are moved the same way.
 */

/** Move the targets to a stage. Clears the selection, since the deals have left. */
export const moveTargetsTo =
  (toStage: StageId): AppThunk =>
  (dispatch, getState) => {
    const targets = selectActionTargets(getState());
    if (targets.length === 0) return;
    dispatch(moveDeals(targets, toStage));
    dispatch(selectionCleared());
  };

/** Retry failed saves / keep my version of conflicts, for the targets. */
export const retryTargets = (): AppThunk => (dispatch, getState) => {
  dispatch(retryChanges(selectActionTargets(getState())));
};

/** Discard unsaved changes / keep the teammate's version, for the targets. */
export const discardTargets = (): AppThunk => (dispatch, getState) => {
  dispatch(discardChanges(selectActionTargets(getState())));
};

/** Opens the "Move to…" stage picker, if there is anything to move. */
export const openMoveDialog = (): AppThunk => (dispatch, getState) => {
  if (selectActionTargets(getState()).length > 0) dispatch(dialogOpened('move'));
};
