import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store';
import { selectSyncSummary } from '../../../store/syncSlice';
import { updateFilters } from '../../../store/viewSlice';
import { pluralize } from '../../../utils/dealUtils';
import './SaveStatus.css';

/**
 * SaveStatus
 *
 * The always-visible indicator in the header, and the one place that
 * answers "did my changes save?":
 * - "✓ All changes saved"
 * - "Saving 12 changes…"
 * - "3 changes not saved · Review" (red), which opens the Needs attention tab.
 *
 * While anything is unsaved, the browser asks before the tab is closed.
 */
export function SaveStatus() {
  const dispatch = useAppDispatch();
  const { saving, failed, conflicts } = useAppSelector(selectSyncSummary);
  const problems = failed + conflicts;
  const hasUnsaved = saving + problems > 0;

  useEffect(() => {
    if (!hasUnsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsaved]);

  return (
    <div className="save-status" role="status" aria-live="polite">
      {saving > 0 && <span className="muted">Saving {pluralize(saving, 'change')}…</span>}
      {problems > 0 && (
        <button type="button" className="save-problem" onClick={() => dispatch(updateFilters({ tab: 'attention' }))}>
          {pluralize(problems, 'change')} not saved · Review
        </button>
      )}
      {!hasUnsaved && <span className="save-ok">✓ All changes saved</span>}
    </div>
  );
}
