import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef } from 'react';

/** Fixed row height keeps virtualization simple and scrolling smooth. */
export const ROW_HEIGHT = 44;

/**
 * Virtualization for the deal list: only the ~20 rows on screen (plus a small
 * buffer) are rendered, so a list of 10,000+ deals scrolls smoothly.
 * Also keeps the focused row in view, e.g. when it moves with the keyboard.
 */
export function useVirtualDeals(ids: string[], focusedId: string | null) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: ids.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  useEffect(() => {
    const index = focusedId ? ids.indexOf(focusedId) : -1;
    if (index >= 0) virtualizer.scrollToIndex(index);
  }, [focusedId, ids, virtualizer]);

  return { scrollRef, virtualizer };
}
