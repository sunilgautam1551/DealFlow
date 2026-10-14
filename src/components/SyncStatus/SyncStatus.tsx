import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { pluralize } from '../../domain/format';
import { selectSyncSummary } from '../../features/sync/syncSelectors';
import { updateFilters } from '../../features/view/viewThunks';
import styles from './SyncStatus.module.css';

/**
 * Always-visible save indicator in the header: the one place that answers
 * "did my changes save?". Problems link straight to the deals that need a decision.
 */
export function SyncStatus() {
  const dispatch = useAppDispatch();
  const { saving, failed, conflicts } = useAppSelector(selectSyncSummary);
  const problems = failed + conflicts;
  const hasUnsaved = saving + problems > 0;

  // Warn before closing the tab while changes are unsaved.
  useEffect(() => {
    if (!hasUnsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsaved]);

  return (
    <div className={styles.status} role="status" aria-live="polite">
      {saving > 0 && <span className={styles.saving}>Saving {pluralize(saving, 'change')}…</span>}
      {problems > 0 && (
        <button type="button" className={styles.problem} onClick={() => dispatch(updateFilters({ tab: 'attention' }))}>
          {pluralize(problems, 'change')} not saved · Review
        </button>
      )}
      {!hasUnsaved && <span className={styles.saved}>✓ All changes saved</span>}
    </div>
  );
}
