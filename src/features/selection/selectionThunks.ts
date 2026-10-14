import type { AppThunk } from '../../app/store';
import { focusChanged } from '../view/viewSlice';
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
