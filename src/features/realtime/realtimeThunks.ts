import type { AppThunk } from '../../app/store';
import type { Deal } from '../../domain/deal';
import { dealsReceived } from '../deals/dealsSlice';

/**
 * Pushes arrive in bursts (20 teammates, bulk moves of thousands). Collecting
 * them for a short window and applying them in one Redux update keeps the UI
 * smooth: one re-render per window instead of one per change.
 */
const BATCH_WINDOW_MS = 300;

/**
 * Subscribes to the server's realtime feed. Returns a function that disconnects.
 *
 * Incoming deals only update the store (server truth). They never reorder or
 * remove rows on screen; see `selectUnseenChanges` and the updates banner.
 */
export const connectRealtime = (): AppThunk<() => void> => (dispatch, _getState, { api }) => {
  let buffer: Deal[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    const deals = buffer;
    buffer = [];
    dispatch(dealsReceived(deals));
  };

  const unsubscribe = api.subscribe((deals) => {
    buffer = buffer.concat(deals);
    timer ??= setTimeout(flush, BATCH_WINDOW_MS);
  });

  return () => {
    unsubscribe();
    if (timer) clearTimeout(timer);
  };
};
