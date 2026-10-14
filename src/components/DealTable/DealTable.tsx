import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { selectSelectedCount } from '../../features/selection/selectionSlice';
import { clearSelection, selectAllVisible } from '../../features/selection/selectionThunks';
import { selectFocusedId, selectVisibleIds } from '../../features/view/viewSelectors';
import { DealRow, rowElementId } from './DealRow';
import styles from './DealTable.module.css';

/** Fixed row height. Fixed heights keep virtualization simple and scrolling smooth. */
const ROW_HEIGHT = 44;

/**
 * The deal list.
 *
 * Virtualized: only the ~20 rows on screen (plus a small buffer) are in the
 * DOM, so scrolling stays smooth with 10,000+ rows. Each row subscribes to its
 * own deal, so a change to one deal re-renders one row.
 *
 * Accessibility: a `grid` whose focused row is announced via
 * `aria-activedescendant`, which works even though most rows are not rendered.
 */
export function DealTable() {
  const dispatch = useAppDispatch();
  const ids = useAppSelector(selectVisibleIds);
  const selectedCount = useAppSelector(selectSelectedCount);
  const focusedId = useAppSelector(selectFocusedId);
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: ids.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  // Keep the focused row visible (e.g. when focus moves with the keyboard).
  useEffect(() => {
    const index = focusedId ? ids.indexOf(focusedId) : -1;
    if (index >= 0) virtualizer.scrollToIndex(index);
  }, [focusedId, ids, virtualizer]);

  if (ids.length === 0) {
    return <div className={styles.empty}>No deals match this view.</div>;
  }

  return (
    <div
      ref={scrollRef}
      className={styles.scroller}
      role="grid"
      aria-label="Deals"
      aria-rowcount={ids.length + 1}
      aria-activedescendant={focusedId ? rowElementId(focusedId) : undefined}
      aria-multiselectable
      tabIndex={0}
    >
      <div className={`${styles.row} ${styles.header}`} role="row" aria-rowindex={1}>
        <span role="columnheader">
          <input
            type="checkbox"
            aria-label="Select all deals in this view"
            checked={selectedCount > 0 && selectedCount === ids.length}
            ref={(box) => {
              if (box) box.indeterminate = selectedCount > 0 && selectedCount < ids.length;
            }}
            onChange={() => dispatch(selectedCount > 0 ? clearSelection() : selectAllVisible())}
          />
        </span>
        <span role="columnheader">Company</span>
        <span role="columnheader">Stage</span>
        <span role="columnheader" className={styles.numeric}>
          Value
        </span>
        <span role="columnheader">Owner</span>
        <span role="columnheader">Expected close</span>
        <span role="columnheader">Last contact</span>
        <span role="columnheader">Why it matters</span>
        <span role="columnheader">Save status</span>
      </div>

      <div className={styles.body} style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => (
          <DealRow
            key={ids[item.index]}
            id={ids[item.index]}
            rowIndex={item.index + 2 /* 1-based, after the header row */}
            top={item.start}
            isFocused={ids[item.index] === focusedId}
          />
        ))}
      </div>
    </div>
  );
}
