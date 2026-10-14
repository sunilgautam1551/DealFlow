import { memo } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { formatCurrency, formatDaysAgo, formatDueIn, formatNumber } from '../../domain/format';
import { assessPriority } from '../../domain/priority';
import { stageLabel } from '../../domain/stages';
import { CURRENT_USER_ID, userName } from '../../domain/users';
import { selectDealById } from '../../features/deals/dealsSlice';
import { selectBuiltAt } from '../../features/view/viewSelectors';
import { focusChanged } from '../../features/view/viewSlice';
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

/** One deal. Memoised, and reads its own deal from the store. */
export const DealRow = memo(function DealRow({ id, rowIndex, top, isFocused }: DealRowProps) {
  const dispatch = useAppDispatch();
  const deal = useAppSelector((state) => selectDealById(state, id));
  const now = useAppSelector(selectBuiltAt);

  if (!deal) return null;

  const { reasons } = assessPriority(deal, now);

  return (
    <div
      id={rowElementId(id)}
      role="row"
      aria-rowindex={rowIndex}
      className={styles.row}
      data-focused={isFocused || undefined}
      style={{ transform: `translateY(${top}px)` }}
      onClick={() => dispatch(focusChanged(id))}
    >
      <span role="gridcell" className={styles.company}>
        <span className={styles.companyName}>{deal.company}</span>
        <span className={styles.muted}>{formatNumber(deal.licences)} licences</span>
      </span>
      <span role="gridcell">
        <span className={styles.stage} data-stage={deal.stage}>
          {stageLabel(deal.stage)}
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
    </div>
  );
});
