import type { Deal } from '../../domain/deal';
import { assessPriority } from '../../domain/priority';
import { isClosedStage } from '../../domain/stages';
import { DAY_MS } from '../../domain/time';
import { CURRENT_USER_ID } from '../../domain/users';
import type { SortKey, ViewFilters, ViewTab } from './viewSlice';

/**
 * Turns all deals + the current filters into the ordered list of ids to show.
 * A pure function: easy to test, and fast enough to run over 50,000 deals on
 * every filter change (~10–20 ms).
 */
export function buildVisibleIds(deals: Deal[], filters: ViewFilters, now: number): string[] {
  const search = filters.search.trim().toLowerCase();
  const matching = deals.filter((deal) => matchesFilters(deal, filters, search, now));

  // Compute each sort key once, not once per comparison.
  const sortValue = SORT_VALUES[filters.sort];
  const keyed = matching.map((deal) => ({ id: deal.id, key: sortValue(deal, now) }));
  keyed.sort((a, b) => a.key - b.key || (a.id < b.id ? -1 : 1));

  return keyed.map((item) => item.id);
}

/** Whether a deal belongs on a tab (before search/owner/idle filters). */
export function matchesTab(tab: ViewTab, deal: Deal): boolean {
  switch (tab) {
    case 'today':
      return deal.ownerId === CURRENT_USER_ID && !isClosedStage(deal.stage);
    case 'all':
      return true;
    default:
      return deal.stage === tab;
  }
}

function matchesFilters(deal: Deal, filters: ViewFilters, search: string, now: number): boolean {
  if (!matchesTab(filters.tab, deal)) return false;
  // "Today" is always the current user's deals, so the owner filter does not apply.
  if (filters.tab !== 'today' && filters.ownerId !== 'all' && deal.ownerId !== filters.ownerId) return false;
  if (search && !deal.company.toLowerCase().includes(search)) return false;
  if (filters.minIdleDays > 0 && now - deal.lastActivityAt < filters.minIdleDays * DAY_MS) return false;
  return true;
}

/** Sort keys, ascending: a smaller value is shown first. */
const SORT_VALUES: Record<SortKey, (deal: Deal, now: number) => number> = {
  priority: (deal, now) => -assessPriority(deal, now).score,
  value: (deal) => -deal.value,
  idle: (deal) => deal.lastActivityAt,
  closeDate: (deal) => deal.expectedCloseAt,
};
