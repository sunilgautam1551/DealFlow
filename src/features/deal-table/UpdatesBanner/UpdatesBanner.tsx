import { useAppDispatch, useAppSelector } from '../../../store';
import { refreshView, selectUnseenChanges } from '../../../store/viewSlice';
import { pluralize } from '../../../utils/dealUtils';
import './UpdatesBanner.css';

/**
 * UpdatesBanner
 *
 * "Teammates made changes: 3 deals now belong here, 13 deals moved out.
 * [Show latest]"
 *
 * Teammates' edits to rows already on screen show up in place straight away.
 * Changes that would add or remove rows wait here instead, so the list never
 * jumps while the user is reading or clicking. Hidden when there's nothing new.
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
    <div className="banner" role="status">
      <span>Teammates made changes: {parts.join(', ')}.</span>
      <button type="button" onClick={() => dispatch(refreshView())}>
        Show latest
      </button>
    </div>
  );
}
