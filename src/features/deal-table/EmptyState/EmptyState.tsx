import { useAppDispatch, useAppSelector } from '../../../store';
import { selectFilters, selectHasNarrowingFilters, updateFilters } from '../../../store/viewSlice';
import './EmptyState.css';

/**
 * EmptyState
 *
 * Shown instead of the list when the current view has no deals. It says why
 * the view is empty, so it never looks broken:
 * - Needs attention: every change is saved (or still saving).
 * - Filters hide everything (e.g. after moving all matching deals to Lost):
 *   offers "Clear filters" to see the rest of the tab.
 * - Otherwise the tab itself is empty.
 */
export function EmptyState() {
  const dispatch = useAppDispatch();
  const tab = useAppSelector(selectFilters).tab;
  const hasFilters = useAppSelector(selectHasNarrowingFilters);

  if (tab === 'attention') {
    return (
      <div className="empty-state">
        <strong>Nothing needs your attention.</strong>
        <span className="muted">Every change is saved or still saving.</span>
      </div>
    );
  }

  if (hasFilters) {
    return (
      <div className="empty-state">
        <strong>No deals match these filters.</strong>
        <span className="muted">Deals you just moved to another stage are no longer listed here.</span>
        <button type="button" onClick={() => dispatch(updateFilters({ search: '', ownerId: 'all', minIdleDays: 0 }))}>
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <div className="empty-state">
      <strong>No deals here yet.</strong>
    </div>
  );
}
