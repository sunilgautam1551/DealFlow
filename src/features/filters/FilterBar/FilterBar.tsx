import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store';
import { selectFilters, selectVisibleIds, updateFilters, type SortKey } from '../../../store/viewSlice';
import { CURRENT_USER_ID, USERS } from '../../../types/deal';
import { pluralize } from '../../../utils/dealUtils';
import './FilterBar.css';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'priority', label: 'Priority' },
  { value: 'value', label: 'Value (high to low)' },
  { value: 'idle', label: 'Longest without contact' },
  { value: 'closeDate', label: 'Closing soonest' },
];
const IDLE_OPTIONS = [0, 14, 30, 60, 90];
const SEARCH_DELAY_MS = 200;

/**
 * FilterBar
 *
 * Narrows and orders the deals in the current tab: search by company,
 * owner, "no contact for N+ days" and sort order. Shows how many deals match.
 *
 * Search waits until typing pauses, because each search filters all 50,000
 * deals. The owner filter is disabled on Today, which always shows your deals.
 */
export function FilterBar() {
  const dispatch = useAppDispatch();
  const filters = useAppSelector(selectFilters);
  const resultCount = useAppSelector(selectVisibleIds).length;

  const [search, setSearch] = useState(filters.search);
  useEffect(() => {
    if (search === filters.search) return;
    const timer = setTimeout(() => dispatch(updateFilters({ search })), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search, filters.search, dispatch]);

  return (
    <div className="toolbar">
      <input
        type="search"
        className="search"
        placeholder="Search company…"
        aria-label="Search company"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <label className="field">
        Owner
        <select
          value={filters.ownerId}
          disabled={filters.tab === 'today'}
          title={filters.tab === 'today' ? 'Today always shows your deals' : undefined}
          onChange={(event) => dispatch(updateFilters({ ownerId: event.target.value }))}
        >
          <option value="all">Everyone</option>
          {USERS.map((user) => (
            <option key={user.id} value={user.id}>
              {user.id === CURRENT_USER_ID ? `${user.name} (you)` : user.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        No contact for
        <select
          value={filters.minIdleDays}
          onChange={(event) => dispatch(updateFilters({ minIdleDays: Number(event.target.value) }))}
        >
          {IDLE_OPTIONS.map((days) => (
            <option key={days} value={days}>
              {days === 0 ? 'Any time' : `${days}+ days`}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        Sort by
        <select value={filters.sort} onChange={(event) => dispatch(updateFilters({ sort: event.target.value as SortKey }))}>
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <span className="push-right muted" aria-live="polite">
        {pluralize(resultCount, 'deal')}
      </span>
    </div>
  );
}
