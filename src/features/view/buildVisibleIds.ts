import type { Deal } from '../../domain/deal';
import { assessPriority } from '../../domain/priority';
import { isClosedStage, type StageId } from '../../domain/stages';
import { DAY_MS } from '../../domain/time';
import { CURRENT_USER_ID } from '../../domain/users';
import { needsAttention } from '../sync/syncSelectors';
import type { PendingChange } from '../sync/syncSlice';
import type { SortKey, ViewFilters, ViewTab } from './viewSlice';

/**
 * Turns all deals + the current filters into the ordered list of ids to show.
 * A pure function, fast enough to run over 50,000 deals on every filter
 * change (~10–40 ms).
 *
 * Deals are placed by their *effective* stage: the user's unsaved move if
 * there is one, otherwise the server's stage.
 */
export function buildVisibleIds(
  deals: Deal[],
  pending: Record<string, PendingChange>,
  filters: ViewFilters,
  now: number,
): string[] {
  const search = filters.search.trim().toLowerCase();
  const matching = deals.filter((deal) => matchesFilters(deal, pending[deal.id], filters, search, now));

  // Compute each sort key once, not once per comparison.
  const sortValue = SORT_VALUES[filters.sort];
  const keyed = matching.map((deal) => ({ id: deal.id, key: sortValue(deal, now) }));
  keyed.sort((a, b) => a.key - b.key || (a.id < b.id ? -1 : 1));

  return keyed.map((item) => item.id);
}

/**
 * Whether a deal in `stage` belongs on `tab`, judged by stage alone.
 * Used to drop a row as soon as the user moves it off the current tab.
 */
export function stageFitsTab(stage: StageId, tab: ViewTab): boolean {
  switch (tab) {
    case 'today':
      return !isClosedStage(stage);
    case 'all':
    case 'attention':
      return true;
    default:
      return stage === tab;
  }
}

function matchesTab(tab: ViewTab, deal: Deal, change: PendingChange | undefined): boolean {
  if (tab === 'attention') return needsAttention(change);
  if (tab === 'today' && deal.ownerId !== CURRENT_USER_ID) return false;
  return stageFitsTab(change?.toStage ?? deal.stage, tab);
}

function matchesFilters(
  deal: Deal,
  change: PendingChange | undefined,
  filters: ViewFilters,
  search: string,
  now: number,
): boolean {
  if (!matchesTab(filters.tab, deal, change)) return false;
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
