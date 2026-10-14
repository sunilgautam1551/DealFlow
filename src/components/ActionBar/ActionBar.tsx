import { discardTargets, moveTargetsTo, retryTargets } from '../../app/commands';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { formatNumber, pluralize } from '../../domain/format';
import { STAGES, type StageId } from '../../domain/stages';
import { selectDealById } from '../../features/deals/dealsSlice';
import { selectSelectedCount } from '../../features/selection/selectionSlice';
import { clearSelection, selectAllVisible } from '../../features/selection/selectionThunks';
import { needsAttention } from '../../features/sync/syncSelectors';
import { selectActionTargets, selectFocusedId, selectVisibleIds } from '../../features/view/viewSelectors';
import styles from './ActionBar.module.css';

/**
 * Actions for the ticked deals, or for the focused row when nothing is ticked.
 * One bar for one deal and for 10,000, so there is only one way to learn.
 */
export function ActionBar() {
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
    <div className={styles.bar} aria-label="Deal actions" role="toolbar">
      <span className={styles.target}>{targetLabel ?? 'No deal selected'}</span>

      <select
        aria-label="Move to stage"
        value=""
        disabled={!hasTargets}
        onChange={(event) => dispatch(moveTargetsTo(event.target.value as StageId))}
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

      <span className={styles.selection}>
        {selectedCount < visibleCount && (
          <button type="button" onClick={() => dispatch(selectAllVisible())}>
            Select all {formatNumber(visibleCount)}
          </button>
        )}
        {selectedCount > 0 && (
          <button type="button" onClick={() => dispatch(clearSelection())}>
            Clear selection
          </button>
        )}
      </span>
    </div>
  );
}
