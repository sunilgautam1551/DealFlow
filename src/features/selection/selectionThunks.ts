import type { AppThunk } from '../../app/store';
import { focusChanged } from '../view/viewSlice';
import { moveFocus } from '../view/viewThunks';
import { selectionAdded, selectionCleared, selectionToggled } from './selectionSlice';

/** Click on a checkbox: tick/untick one deal. */
export const toggleSelection =
  (dealId: string): AppThunk =>
  (dispatch) => {
    dispatch(selectionToggled(dealId));
    dispatch(focusChanged(dealId));
  };

/** Shift+click: tick every visible deal between the last clicked one and this one. */
export const selectRangeTo =
  (dealId: string): AppThunk =>
  (dispatch, getState) => {
    const { visibleIds } = getState().view;
    const anchorId = getState().selection.anchorId;
    const from = anchorId ? visibleIds.indexOf(anchorId) : -1;
    const to = visibleIds.indexOf(dealId);

    if (from === -1 || to === -1) {
      dispatch(toggleSelection(dealId));
      return;
    }
    const [start, end] = from < to ? [from, to] : [to, from];
    dispatch(selectionAdded(visibleIds.slice(start, end + 1)));
    dispatch(focusChanged(dealId));
  };

/** Tick every deal in the current view (e.g. all 10,000 in a stage). */
export const selectAllVisible = (): AppThunk => (dispatch, getState) => {
  dispatch(selectionAdded(getState().view.visibleIds));
};

export const clearSelection = (): AppThunk => (dispatch) => {
  dispatch(selectionCleared());
};

/** Space: tick/untick the focused row. */
export const toggleFocusedSelection = (): AppThunk => (dispatch, getState) => {
  const { focusedId } = getState().view;
  if (focusedId) dispatch(selectionToggled(focusedId));
};

/** Shift+↑/↓: tick the focused row and the next one, then move focus there. */
export const extendSelection =
  (delta: number): AppThunk =>
  (dispatch, getState) => {
    const startId = getState().view.focusedId;
    if (!startId) return;
    dispatch(selectionAdded([startId]));
    dispatch(moveFocus(delta));
    const endId = getState().view.focusedId;
    if (endId) dispatch(selectionAdded([endId]));
  };
