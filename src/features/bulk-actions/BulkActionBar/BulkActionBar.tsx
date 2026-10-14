import { useAppDispatch, useAppSelector } from '../../../store';
import { selectDealById } from '../../../store/dealsSlice';
import { needsAttention } from '../../../store/syncSlice';
import {
  discardTargets,
  moveTargetsTo,
  retryTargets,
  selectActionTargets,
  selectAllVisible,
  selectFocusedId,
  selectionCleared,
  selectSelectedCount,
  selectVisibleIds,
} from '../../../store/viewSlice';
import { STAGES, type StageId } from '../../../types/deal';
import { formatNumber, pluralize } from '../../../utils/dealUtils';
import { BulkProgress } from '../BulkProgress/BulkProgress';
import { MoveDialog } from '../MoveDialog/MoveDialog';
import './BulkActionBar.css';

/**
 * BulkActionBar
 *
 * The toolbar above the list. Its actions apply to the ticked deals, or to
 * the focused row when nothing is ticked, so moving one deal and moving
 * 10,000 work the same way.
 *
 * - "Move to…" moves the deals to a stage.
 * - Retry / Discard appear when the deals have failed or conflicted saves.
 * - "Select all N" ticks every deal in the current view.
 *
 * Also shows a key hint, the bulk-move progress bars and the keyboard
 * "Move to…" dialog.
 */
export function BulkActionBar() {
  const dispatch = useAppDispatch();
  const selectedCount = useAppSelector(selectSelectedCount);
  const visibleCount = useAppSelector(selectVisibleIds).length;
  const focusedDeal = useAppSelector((state) => {
    const id = selectFocusedId(state);
    return id ? selectDealById(state, id) : undefined;
  });
  const targetsNeedDecision = useAppSelector((state) =>
    selectActionTargets(state).some((id) => needsAttention(state.sync.pending[id])),
  );

  const hasTargets = selectedCount > 0 || focusedDeal !== undefined;
  const targetLabel = selectedCount > 0 ? `${pluralize(selectedCount, 'deal')} selected` : focusedDeal?.company;

  return (
    <>
      <div className="toolbar" role="toolbar" aria-label="Deal actions">
        <span className="action-target">{targetLabel ?? 'No deal selected'}</span>

        <select
          aria-label="Move to stage"
          value=""
          disabled={!hasTargets}
          onChange={(event) => event.target.value && dispatch(moveTargetsTo(event.target.value as StageId))}
        >
          <option value="" disabled>
            Move to…
          </option>
          {STAGES.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.label}
            </option>
          ))}
        </select>

        {targetsNeedDecision && (
          <>
            <button type="button" onClick={() => dispatch(retryTargets())}>
              Retry / keep mine
            </button>
            <button type="button" onClick={() => dispatch(discardTargets())}>
              Discard / keep theirs
            </button>
          </>
        )}

        <span className="hint">
          In the list: <kbd>↑</kbd> <kbd>↓</kbd> move · <kbd>Space</kbd> select · <kbd>Shift</kbd>+<kbd>↑</kbd>
          <kbd>↓</kbd> select range · <kbd>Enter</kbd> move to stage · <kbd>Esc</kbd> clear
        </span>

        <span className="push-right">
          {selectedCount < visibleCount && (
            <button type="button" onClick={() => dispatch(selectAllVisible())}>
              Select all {formatNumber(visibleCount)}
            </button>
          )}
          {selectedCount > 0 && (
            <button type="button" onClick={() => dispatch(selectionCleared())}>
              Clear selection
            </button>
          )}
        </span>
      </div>

      <BulkProgress />
      <MoveDialog />
    </>
  );
}
