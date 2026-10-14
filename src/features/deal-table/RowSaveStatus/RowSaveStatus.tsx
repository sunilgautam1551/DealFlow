import { useAppDispatch } from '../../../store';
import { discardChanges, MAX_ATTEMPTS, retryChanges, type PendingChange } from '../../../store/syncSlice';
import { displayActor, stageLabel } from '../../../utils/dealUtils';
import './RowSaveStatus.css';

/**
 * RowSaveStatus
 *
 * The "Save status" cell of a row with an unsaved move. Says plainly what is
 * happening, and offers the two choices when the user has to decide:
 * - "Saving…" or "Retrying (attempt 2 of 3)…"
 * - "Not saved" with Retry / Discard, after the automatic retries ran out.
 * - "Rahul moved it to Lost" with Keep mine / Keep theirs, on a conflict.
 */
export function RowSaveStatus({ change }: { change: PendingChange }) {
  const dispatch = useAppDispatch();
  const ids = [change.dealId];

  // The buttons sit inside a clickable row: don't also focus/select the row.
  const act = (event: React.MouseEvent, action: 'retry' | 'discard') => {
    event.stopPropagation();
    dispatch(action === 'retry' ? retryChanges(ids) : discardChanges(ids));
  };

  if (change.status === 'queued' || change.status === 'saving') {
    return (
      <span className="status-saving">
        {change.failedAttempts > 0 ? `Retrying (attempt ${change.failedAttempts + 1} of ${MAX_ATTEMPTS})…` : 'Saving…'}
      </span>
    );
  }

  if (change.status === 'failed') {
    return (
      <span className="status-problem" title={change.error}>
        Not saved
        <button type="button" onClick={(event) => act(event, 'retry')}>
          Retry
        </button>
        <button type="button" onClick={(event) => act(event, 'discard')}>
          Discard
        </button>
      </span>
    );
  }

  const { serverStage, changedBy } = change.conflict!;
  return (
    <span className="status-problem" title="A teammate moved this deal before your change was saved">
      {displayActor(changedBy)} moved it to {stageLabel(serverStage)}
      <button type="button" onClick={(event) => act(event, 'retry')}>
        Keep mine
      </button>
      <button type="button" onClick={(event) => act(event, 'discard')}>
        Keep theirs
      </button>
    </span>
  );
}
