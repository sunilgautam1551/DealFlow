import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { pluralize } from '../../domain/format';
import { CURRENT_USER_ID, USERS } from '../../domain/users';
import { selectFilters, selectVisibleIds } from '../../features/view/viewSelectors';
import type { SortKey } from '../../features/view/viewSlice';
import { updateFilters } from '../../features/view/viewThunks';
import styles from './FilterBar.module.css';

const SEARCH_DEBOUNCE_MS = 200;

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'priority', label: 'Priority' },
  { value: 'value', label: 'Value (high to low)' },
  { value: 'idle', label: 'Longest without contact' },
  { value: 'closeDate', label: 'Closing soonest' },
];

const IDLE_OPTIONS = [0, 14, 30, 60, 90];

/** Search, owner, "no contact for N days" and sort controls. */
export function FilterBar() {
  const dispatch = useAppDispatch();
  const filters = useAppSelector(selectFilters);
  const resultCount = useAppSelector(selectVisibleIds).length;

  // The input updates instantly; the (50,000-deal) filter runs once typing pauses.
  const [search, setSearch] = useState(filters.search);
  useEffect(() => {
    if (search === filters.search) return;
    const timer = setTimeout(() => dispatch(updateFilters({ search })), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, filters.search, dispatch]);

  return (
    <div className={styles.bar}>
      <input
        type="search"
        className={styles.search}
        placeholder="Search company…"
        aria-label="Search company"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <label className={styles.field}>
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

      <label className={styles.field}>
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

      <label className={styles.field}>
        Sort by
        <select
          value={filters.sort}
          onChange={(event) => dispatch(updateFilters({ sort: event.target.value as SortKey }))}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <span className={styles.results} aria-live="polite">
        {pluralize(resultCount, 'deal')}
      </span>
    </div>
  );
}
