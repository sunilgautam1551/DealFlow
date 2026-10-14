import { useEffect, useRef, useState } from 'react';
import { moveTargetsTo } from '../../app/commands';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { pluralize } from '../../domain/format';
import { nextStage, STAGE_IDS, STAGES } from '../../domain/stages';
import { selectEffectiveStage } from '../../features/sync/syncSelectors';
import { dialogClosed } from '../../features/ui/uiSlice';
import { selectActionTargets } from '../../features/view/viewSelectors';
import styles from './MoveDialog.module.css';

/** The "Move to…" stage picker, opened with Enter on the deal list. */
export function MoveDialog() {
  const isOpen = useAppSelector((state) => state.ui.openDialog === 'move');
  return isOpen ? <MoveDialogContent /> : null;
}

/**
 * Keyboard: ↑/↓ choose, Enter moves, 1–7 picks a stage directly, Esc cancels.
 * Starts on the focused deal's next stage, because "advance" is the most common move.
 */
function MoveDialogContent() {
  const dispatch = useAppDispatch();
  const targetCount = useAppSelector((state) => selectActionTargets(state).length);
  const currentStage = useAppSelector((state) =>
    state.view.focusedId ? selectEffectiveStage(state, state.view.focusedId) : undefined,
  );

  const suggested = currentStage ? nextStage(currentStage) : null;
  const [activeIndex, setActiveIndex] = useState(suggested ? STAGE_IDS.indexOf(suggested) : 0);
  const listRef = useRef<HTMLUListElement>(null);

  // Take focus while open; give it back to where it was (the deal list) on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    listRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  const close = () => dispatch(dialogClosed());
  const choose = (index: number) => {
    dispatch(moveTargetsTo(STAGE_IDS[index]));
    close();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const digit = Number(event.key);
    if (digit >= 1 && digit <= STAGE_IDS.length) {
      choose(digit - 1);
    } else if (event.key === 'ArrowDown') {
      setActiveIndex((index) => (index + 1) % STAGE_IDS.length);
    } else if (event.key === 'ArrowUp') {
      setActiveIndex((index) => (index - 1 + STAGE_IDS.length) % STAGE_IDS.length);
    } else if (event.key === 'Enter') {
      choose(activeIndex);
    } else if (event.key === 'Escape') {
      close();
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className={styles.backdrop} onClick={close}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="move-dialog-title" className={styles.title}>
          Move {pluralize(targetCount, 'deal')} to…
        </h2>
        <ul
          ref={listRef}
          className={styles.list}
          role="listbox"
          tabIndex={0}
          aria-labelledby="move-dialog-title"
          aria-activedescendant={`move-option-${STAGE_IDS[activeIndex]}`}
          onKeyDown={handleKeyDown}
        >
          {STAGES.map((stage, index) => (
            <li
              key={stage.id}
              id={`move-option-${stage.id}`}
              role="option"
              aria-selected={index === activeIndex}
              className={styles.option}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(index)}
            >
              <kbd>{index + 1}</kbd> {stage.label}
              {stage.id === currentStage && <span className={styles.current}>current</span>}
            </li>
          ))}
        </ul>
        <p className={styles.hint}>
          <kbd>↑</kbd> <kbd>↓</kbd> choose · <kbd>Enter</kbd> move · <kbd>Esc</kbd> cancel
        </p>
      </div>
    </div>
  );
}
