import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store';
import { selectToasts, toastDismissed, type Toast } from '../../../store/uiSlice';
import { updateFilters } from '../../../store/viewSlice';
import './Toasts.css';

/**
 * Toasts
 *
 * Short messages in the bottom-right corner about things that happened in
 * the background: saves that failed, conflicts, finished bulk moves.
 * Problem toasts have a "Review" button that opens the Needs attention tab.
 * Errors stay 10 seconds, good news 4 seconds. Screen readers announce them.
 */
export function Toasts() {
  const toasts = useAppSelector(selectToasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

/** One toast, which hides itself after a while. */
function ToastItem({ toast }: { toast: Toast }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const timer = setTimeout(() => dispatch(toastDismissed(toast.id)), toast.tone === 'error' ? 10_000 : 4_000);
    return () => clearTimeout(timer);
  }, [dispatch, toast.id, toast.tone, toast.shownAt]);

  const review = () => {
    dispatch(updateFilters({ tab: 'attention' }));
    dispatch(toastDismissed(toast.id));
  };

  return (
    <div className="toast" data-tone={toast.tone} role={toast.tone === 'error' ? 'alert' : 'status'}>
      <span>{toast.message}</span>
      {toast.showReview && (
        <button type="button" onClick={review}>
          Review
        </button>
      )}
      <button type="button" aria-label="Dismiss" onClick={() => dispatch(toastDismissed(toast.id))}>
        ×
      </button>
    </div>
  );
}
