import { useAppDispatch } from '../../app/hooks';
import { stageLabel } from '../../domain/stages';
import { displayActor } from '../../domain/users';
import { MAX_ATTEMPTS, type PendingChange } from '../../features/sync/syncSlice';
import { discardChanges, retryChanges } from '../../features/sync/syncThunks';
import styles from './DealTable.module.css';

interface RowSyncStatusProps {
  change: PendingChange;
}

/**
 * The "Save status" cell. Says plainly what is happening to the user's change,
 * and offers the two choices when something needs a decision.
 */
export function RowSyncStatus({ change }: RowSyncStatusProps) {
  const dispatch = useAppDispatch();

  const ids = [change.dealId];
  // Buttons sit inside a clickable row: don't let the click also focus/select the row.
  const act = (event: React.MouseEvent, action: 'retry' | 'discard') => {
    event.stopPropagation();
    dispatch(action === 'retry' ? retryChanges(ids) : discardChanges(ids));
  };

  switch (change.status) {
    case 'queued':
    case 'saving':
      return (
        <span className={styles.statusSaving}>
          {change.failedAttempts > 0 ? `Retrying (attempt ${change.failedAttempts + 1} of ${MAX_ATTEMPTS})…` : 'Saving…'}
        </span>
      );

    case 'failed':
      return (
        <span className={styles.statusProblem} title={change.error}>
          Not saved
          <button type="button" onClick={(event) => act(event, 'retry')}>
            Retry
          </button>
          <button type="button" onClick={(event) => act(event, 'discard')}>
            Discard
          </button>
        </span>
      );

    case 'conflict': {
      const { serverStage, changedBy } = change.conflict!;
      return (
        <span
          className={styles.statusProblem}
          title={`${displayActor(changedBy)} moved this deal to ${stageLabel(serverStage)} before your change was saved`}
        >
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
  }
}
