import { memo, useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store';
import { selectDealById } from '../../../store/dealsSlice';
import {
  focusChanged,
  selectBuiltAt,
  selectFilters,
  selectIsSelected,
  selectRangeTo,
  stageFitsTab,
  toggleSelection,
} from '../../../store/viewSlice';
import { CURRENT_USER_ID, type Deal } from '../../../types/deal';
import {
  assessPriority,
  displayActor,
  formatCurrency,
  formatDaysAgo,
  formatDueIn,
  formatNumber,
  stageLabel,
  userName,
} from '../../../utils/dealUtils';
import { RowSaveStatus } from '../RowSaveStatus/RowSaveStatus';
import './DealRow.css';

/** DOM id of a row, used by the list's `aria-activedescendant`. */
export function rowElementId(dealId: string): string {
  return `deal-row-${dealId}`;
}

interface DealRowProps {
  id: string;
  /** 1-based position in the grid, for screen readers. */
  rowIndex: number;
  /** Pixel offset from the top (from the virtualizer). */
  top: number;
  isFocused: boolean;
}

/**
 * DealRow
 *
 * One deal in the list: checkbox, company, stage, value, owner, close date,
 * last contact, and a Notes cell with the most important thing about the row:
 * its save status if it has an unsaved move, otherwise "Moved to … by …" if a
 * teammate moved it off this tab, otherwise why it matters ("Overdue 3d"…).
 *
 * - Shows the user's unsaved move rather than the server's stage (dashed pill).
 * - Highlights briefly when a teammate changes the deal.
 * - If a teammate moved the deal off this tab, it stays in place, dimmed, with
 *   "Moved to Won by Rahul" until the user refreshes the list.
 * - Click focuses, Cmd/Ctrl+click ticks, Shift+click ticks a range.
 *
 * Reads its own data from the store, so it re-renders only when this deal,
 * its unsaved change or its checkbox changes.
 */
export const DealRow = memo(function DealRow({ id, rowIndex, top, isFocused }: DealRowProps) {
  const dispatch = useAppDispatch();
  const deal = useAppSelector((state) => selectDealById(state, id));
  const change = useAppSelector((state) => state.sync.pending[id]);
  const isSelected = useAppSelector((state) => selectIsSelected(state, id));
  const now = useAppSelector(selectBuiltAt);
  const tab = useAppSelector(selectFilters).tab;
  const flashing = useTeammateFlash(deal);

  if (!deal) return null;

  // Show the user's unsaved move rather than the server's stage.
  const stage = change?.toStage ?? deal.stage;
  const { reasons } = assessPriority({ ...deal, stage }, now);
  // A teammate moved it off this tab. It stays (dimmed) until the user refreshes.
  const movedAway = !stageFitsTab(stage, tab);

  const handleClick = (event: React.MouseEvent) => {
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
      className="row"
      data-focused={isFocused || undefined}
      data-selected={isSelected || undefined}
      data-flash={flashing || undefined}
      data-moved-away={movedAway || undefined}
      style={{ transform: `translateY(${top}px)` }}
      onClick={handleClick}
    >
      <span role="gridcell">
        <input
          type="checkbox"
          aria-label={`Select ${deal.company}`}
          tabIndex={-1} // the list handles keys itself (Space ticks the focused row)
          checked={isSelected}
          readOnly // handled in onClick, which can read the Shift key
          onClick={(event) => {
            event.stopPropagation();
            dispatch(event.shiftKey ? selectRangeTo(id) : toggleSelection(id));
          }}
        />
      </span>
      <span role="gridcell" className="company">
        <span className="company-name">{deal.company}</span>
        <span className="muted">{formatNumber(deal.licences)} licences</span>
      </span>
      <span role="gridcell">
        <span className="stage" data-stage={stage} data-unsaved={change ? true : undefined}>
          {stageLabel(stage)}
        </span>
      </span>
      <span role="gridcell" className="numeric">
        {formatCurrency(deal.value)}
      </span>
      <span role="gridcell">{deal.ownerId === CURRENT_USER_ID ? 'You' : userName(deal.ownerId)}</span>
      <span role="gridcell">{formatDueIn(deal.expectedCloseAt, now)}</span>
      <span role="gridcell">{formatDaysAgo(deal.lastActivityAt, now)}</span>
      <span role="gridcell" className="notes">
        {change ? (
          <RowSaveStatus change={change} />
        ) : movedAway ? (
          <span className="muted">
            Moved to {stageLabel(deal.stage)} by {displayActor(deal.updatedBy)}
          </span>
        ) : (
          reasons.map((reason) => (
            <span key={reason} className="reason">
              {reason}
            </span>
          ))
        )}
      </span>
    </div>
  );
});

/** True for 2 seconds after a teammate changes the deal, so the row can highlight. */
function useTeammateFlash(deal: Deal | undefined): boolean {
  const [flashing, setFlashing] = useState(false);
  const seenVersion = useRef(deal?.version);

  useEffect(() => {
    if (!deal || deal.version === seenVersion.current) return;
    seenVersion.current = deal.version;
    const byTeammate = deal.updatedBy !== CURRENT_USER_ID;
    setFlashing(byTeammate);
    if (!byTeammate) return;
    const timer = setTimeout(() => setFlashing(false), 2000);
    return () => clearTimeout(timer);
  }, [deal]);

  return flashing;
}
