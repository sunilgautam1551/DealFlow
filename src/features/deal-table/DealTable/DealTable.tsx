import { useVirtualDeals } from '../../../hooks/useVirtualDeals';
import { useAppDispatch, useAppSelector } from '../../../store';
import {
  extendSelection,
  focusEdge,
  moveFocus,
  openMoveDialog,
  selectAllVisible,
  selectFocusedId,
  selectionCleared,
  selectSelectedCount,
  selectVisibleIds,
  toggleFocusedSelection,
} from '../../../store/viewSlice';
import { DealRow, rowElementId } from '../DealRow/DealRow';
import { UpdatesBanner } from '../UpdatesBanner/UpdatesBanner';
import './DealTable.css';

/**
 * DealTable
 *
 * The list of deals for the current tab and filters, with a header row
 * (including a "select all" checkbox) and the updates banner above it.
 *
 * Virtualized: only the rows on screen are rendered, so 10,000+ deals scroll
 * smoothly. The rows are a snapshot (see `viewSlice`), so they never jump
 * while teammates edit deals.
 *
 * Keyboard: the list is one Tab stop. ↑/↓ move between rows (Home/End jump),
 * Space ticks a row, Shift+↑/↓ ticks a range, Enter opens "Move to…", Esc
 * clears the selection. The focused row is announced with
 * `aria-activedescendant`, which works although most rows aren't rendered.
 */
export function DealTable() {
  const dispatch = useAppDispatch();
  const ids = useAppSelector(selectVisibleIds);
  const focusedId = useAppSelector(selectFocusedId);
  const selectedCount = useAppSelector(selectSelectedCount);
  const { scrollRef, virtualizer } = useVirtualDeals(ids, focusedId);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Buttons inside rows (Retry, Keep mine…) keep their normal Enter/Space.
    if (event.target instanceof HTMLButtonElement) return;

    switch (event.key) {
      case 'ArrowDown':
        dispatch(event.shiftKey ? extendSelection(1) : moveFocus(1));
        break;
      case 'ArrowUp':
        dispatch(event.shiftKey ? extendSelection(-1) : moveFocus(-1));
        break;
      case 'Home':
        dispatch(focusEdge('first'));
        break;
      case 'End':
        dispatch(focusEdge('last'));
        break;
      case ' ':
        dispatch(toggleFocusedSelection());
        break;
      case 'Enter':
        dispatch(openMoveDialog());
        break;
      case 'Escape':
        dispatch(selectionCleared());
        break;
      default:
        return;
    }
    event.preventDefault(); // stop Space/arrows from also scrolling the page
  };

  return (
    <>
      <UpdatesBanner />
      {ids.length === 0 ? (
        <div className="table-empty">No deals match this view.</div>
      ) : (
        <div
          ref={scrollRef}
          className="table"
          role="grid"
          aria-label="Deals"
          aria-rowcount={ids.length + 1}
          aria-multiselectable
          aria-activedescendant={focusedId ? rowElementId(focusedId) : undefined}
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          <div className="row row-header" role="row" aria-rowindex={1}>
            <span role="columnheader">
              <input
                type="checkbox"
                aria-label="Select all deals in this view"
                checked={selectedCount > 0 && selectedCount === ids.length}
                ref={(box) => {
                  if (box) box.indeterminate = selectedCount > 0 && selectedCount < ids.length;
                }}
                onChange={() => dispatch(selectedCount > 0 ? selectionCleared() : selectAllVisible())}
              />
            </span>
            <span role="columnheader">Company</span>
            <span role="columnheader">Stage</span>
            <span role="columnheader" className="numeric">
              Value
            </span>
            <span role="columnheader">Owner</span>
            <span role="columnheader">Expected close</span>
            <span role="columnheader">Last contact</span>
            <span role="columnheader">Why it matters</span>
            <span role="columnheader">Save status</span>
          </div>

          <div className="table-body" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => (
              <DealRow
                key={ids[item.index]}
                id={ids[item.index]}
                rowIndex={item.index + 2 /* 1-based, after the header */}
                top={item.start}
                isFocused={ids[item.index] === focusedId}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
