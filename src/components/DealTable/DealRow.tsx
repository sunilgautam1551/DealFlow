import { memo } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { formatCurrency, formatDaysAgo, formatDueIn, formatNumber } from '../../domain/format';
import { assessPriority } from '../../domain/priority';
import { stageLabel } from '../../domain/stages';
import { CURRENT_USER_ID, displayActor, userName } from '../../domain/users';
import { selectDealById } from '../../features/deals/dealsSlice';
import { selectIsSelected } from '../../features/selection/selectionSlice';
import { selectRangeTo, toggleSelection } from '../../features/selection/selectionThunks';
import { selectPendingChange } from '../../features/sync/syncSelectors';
import { stageFitsTab } from '../../features/view/buildVisibleIds';
import { selectBuiltAt, selectFilters } from '../../features/view/viewSelectors';
import { focusChanged } from '../../features/view/viewSlice';
import { RowSyncStatus } from './RowSyncStatus';
import { useTeammateFlash } from './useTeammateFlash';
import styles from './DealTable.module.css';

/** DOM id for a row, referenced by the grid's `aria-activedescendant`. */
export function rowElementId(dealId: string): string {
  return `deal-row-${dealId}`;
}

interface DealRowProps {
  id: string;
  /** 1-based position in the grid, for screen readers. */
  rowIndex: number;
  /** Pixel offset from the top of the list (from the virtualizer). */
  top: number;
  isFocused: boolean;
}

/**
 * One deal. Memoised, and reads its own data from the store, so it only
 * re-renders when *this* deal, its pending change or its checkbox changes.
 */
export const DealRow = memo(function DealRow({ id, rowIndex, top, isFocused }: DealRowProps) {
  const dispatch = useAppDispatch();
  const deal = useAppSelector((state) => selectDealById(state, id));
  const change = useAppSelector((state) => selectPendingChange(state, id));
  const isSelected = useAppSelector((state) => selectIsSelected(state, id));
  const now = useAppSelector(selectBuiltAt);
  const tab = useAppSelector(selectFilters).tab;
  const flashing = useTeammateFlash(deal);

  if (!deal) return null;

  // Show the user's unsaved move rather than the server stage.
  const stage = change?.toStage ?? deal.stage;
  // A teammate moved this deal off the current tab. It stays (dimmed) until the
  // user refreshes the list, so rows never vanish under the cursor.
  const movedAway = !stageFitsTab(stage, tab);
  const { reasons } = assessPriority({ ...deal, stage }, now);

  const handleRowClick = (event: React.MouseEvent) => {
    if (event.shiftKey) dispatch(selectRangeTo(id));
    else if (event.metaKey || event.ctrlKey) dispatch(toggleSelection(id));
    else dispatch(focusChanged(id));
  };

  return (
    <div
      id={rowElementId(id)}
      role="row"
      aria-rowindex={rowIndex}
      aria-selected={isSelected}
      className={styles.row}
      data-focused={isFocused || undefined}
      data-selected={isSelected || undefined}
      data-flash={flashing || undefined}
      data-moved-away={movedAway || undefined}
      style={{ transform: `translateY(${top}px)` }}
      onClick={handleRowClick}
    >
      <span role="gridcell">
        <input
          type="checkbox"
          aria-label={`Select ${deal.company}`}
          checked={isSelected}
          // Handled in onClick (not onChange) so we can read the Shift key for range selection.
          readOnly
          onClick={(event) => {
            event.stopPropagation();
            dispatch(event.shiftKey ? selectRangeTo(id) : toggleSelection(id));
          }}
        />
      </span>
      <span role="gridcell" className={styles.company}>
        <span className={styles.companyName}>{deal.company}</span>
        <span className={styles.muted}>{formatNumber(deal.licences)} licences</span>
      </span>
      <span role="gridcell">
        <span className={styles.stage} data-stage={stage} data-unsaved={change ? true : undefined}>
          {stageLabel(stage)}
        </span>
      </span>
      <span role="gridcell" className={styles.numeric}>
        {formatCurrency(deal.value)}
      </span>
      <span role="gridcell">{deal.ownerId === CURRENT_USER_ID ? 'You' : userName(deal.ownerId)}</span>
      <span role="gridcell">{formatDueIn(deal.expectedCloseAt, now)}</span>
      <span role="gridcell">{formatDaysAgo(deal.lastActivityAt, now)}</span>
      <span role="gridcell" className={styles.reasons}>
        {reasons.map((reason) => (
          <span key={reason} className={styles.reason}>
            {reason}
          </span>
        ))}
      </span>
      <span role="gridcell" className={styles.status}>
        {change ? (
          <RowSyncStatus change={change} />
        ) : (
          movedAway && (
            <span className={styles.muted}>
              Moved to {stageLabel(deal.stage)} by {displayActor(deal.updatedBy)}
            </span>
          )
        )}
      </span>
    </div>
  );
});
