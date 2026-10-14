import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store';
import { moveTargetsTo, selectActionTargets } from '../../../store/selectionSlice';
import { selectEffectiveStage } from '../../../store/syncSlice';
import { moveDialogToggled } from '../../../store/uiSlice';
import { STAGES } from '../../../types/deal';
import { nextStage, pluralize, STAGE_IDS } from '../../../utils/dealUtils';
import './MoveDialog.css';

/**
 * MoveDialog
 *
 * The keyboard way to move deals: press Enter on the list and pick a stage.
 * ↑/↓ choose, Enter moves, 1–7 pick a stage directly, Esc cancels. It opens
 * on the focused deal's next stage, the most common move. It takes focus
 * while open and gives it back to the list when it closes.
 */
export function MoveDialog() {
  const isOpen = useAppSelector((state) => state.ui.moveDialogOpen);
  return isOpen ? <MoveDialogContent /> : null;
}

/** Mounted only while open, so the chosen stage resets each time. */
function MoveDialogContent() {
  const dispatch = useAppDispatch();
  const targetCount = useAppSelector((state) => selectActionTargets(state).length);
  const currentStage = useAppSelector((state) =>
    state.view.focusedId ? selectEffectiveStage(state, state.view.focusedId) : undefined,
  );
  const suggested = currentStage ? nextStage(currentStage) : null;
  const [activeIndex, setActiveIndex] = useState(suggested ? STAGE_IDS.indexOf(suggested) : 0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    listRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  const close = () => dispatch(moveDialogToggled(false));
  const choose = (index: number) => {
    dispatch(moveTargetsTo(STAGE_IDS[index]));
    close();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const digit = Number(event.key);
    if (digit >= 1 && digit <= STAGE_IDS.length) choose(digit - 1);
    else if (event.key === 'ArrowDown') setActiveIndex((i) => (i + 1) % STAGE_IDS.length);
    else if (event.key === 'ArrowUp') setActiveIndex((i) => (i - 1 + STAGE_IDS.length) % STAGE_IDS.length);
    else if (event.key === 'Enter') choose(activeIndex);
    else if (event.key === 'Escape') close();
    else return;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className="backdrop" onClick={close}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="move-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="move-title">Move {pluralize(targetCount, 'deal')} to…</h2>
        <ul
          ref={listRef}
          className="stage-options"
          role="listbox"
          tabIndex={0}
          aria-labelledby="move-title"
          aria-activedescendant={`move-${STAGE_IDS[activeIndex]}`}
          onKeyDown={handleKeyDown}
        >
          {STAGES.map((stage, index) => (
            <li
              key={stage.id}
              id={`move-${stage.id}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(index)}
            >
              <kbd>{index + 1}</kbd> {stage.label}
              {stage.id === currentStage && <span className="push-right muted">current</span>}
            </li>
          ))}
        </ul>
        <p className="hint">
          <kbd>↑</kbd> <kbd>↓</kbd> choose · <kbd>Enter</kbd> move · <kbd>Esc</kbd> cancel
        </p>
      </div>
    </div>
  );
}
