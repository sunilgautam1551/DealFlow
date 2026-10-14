import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { pluralize } from '../../domain/format';
import { selectUnseenChanges } from '../../features/view/viewSelectors';
import { refreshView } from '../../features/view/viewThunks';
import styles from './UpdatesBanner.module.css';

/**
 * "12 updates from your team" with a button to apply them.
 *
 * Teammates' edits to deals already on screen show up in place straight away.
 * Only changes that would add, remove or reorder rows wait here, so the list
 * never jumps while the user is reading or clicking.
 */
export function UpdatesBanner() {
  const dispatch = useAppDispatch();
  const { added, removed } = useAppSelector(selectUnseenChanges);
  if (added + removed === 0) return null;

  const parts = [
    added > 0 && `${pluralize(added, 'deal')} now ${added === 1 ? 'belongs' : 'belong'} here`,
    removed > 0 && `${pluralize(removed, 'deal')} moved out`,
  ].filter(Boolean);

  return (
    <div className={styles.banner} role="status">
      <span>Teammates made changes: {parts.join(', ')}.</span>
      <button type="button" onClick={() => dispatch(refreshView())}>
        Show latest
      </button>
    </div>
  );
}
