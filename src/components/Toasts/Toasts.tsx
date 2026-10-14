import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { selectToasts, toastDismissed, type Toast } from '../../features/notifications/notificationsSlice';
import { updateFilters } from '../../features/view/viewThunks';
import styles from './Toasts.module.css';

/** Errors stay a little longer than good news. */
const AUTO_HIDE_MS = { success: 4000, info: 5000, error: 10000 };

/** Stack of toasts in the bottom-right corner, announced to screen readers. */
export function Toasts() {
  const toasts = useAppSelector(selectToasts);
  return (
    <div className={styles.stack} aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const timer = setTimeout(() => dispatch(toastDismissed(toast.id)), AUTO_HIDE_MS[toast.tone]);
    return () => clearTimeout(timer);
  }, [dispatch, toast.id, toast.tone, toast.shownAt]);

  const review = () => {
    dispatch(updateFilters({ tab: 'attention' }));
    dispatch(toastDismissed(toast.id));
  };

  return (
    <div className={styles.toast} data-tone={toast.tone} role={toast.tone === 'error' ? 'alert' : 'status'}>
      <span>{toast.message}</span>
      {toast.action === 'review' && (
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
