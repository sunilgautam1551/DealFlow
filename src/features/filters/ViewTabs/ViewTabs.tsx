import { useAppDispatch, useAppSelector } from '../../../store';
import { selectSyncSummary } from '../../../store/syncSlice';
import { selectFilters, selectTabCounts, updateFilters, type ViewTab } from '../../../store/viewSlice';
import { STAGES } from '../../../types/deal';
import { formatCompactCurrency, formatNumber } from '../../../utils/dealUtils';
import './ViewTabs.css';

interface TabItem {
  id: ViewTab;
  label: string;
  count: number;
  /** Second line under the label, e.g. the stage's total value. */
  detail?: string;
  /** Shown in red (used when saves need the user's decision). */
  alert?: boolean;
}

/**
 * ViewTabs
 *
 * The row of tabs that picks what the list shows:
 * - Today: the user's own open deals, ranked by priority.
 * - One tab per stage, with its deal count and total value, so the row also
 *   works as a pipeline overview.
 * - All deals.
 * - Needs attention: moves that failed to save or conflicted.
 *
 * Counts are live. Keyboard: the whole row is one Tab stop; ←/→ switch tabs.
 */
export function ViewTabs() {
  const dispatch = useAppDispatch();
  const activeTab = useAppSelector(selectFilters).tab;
  const counts = useAppSelector(selectTabCounts);
  const { failed, conflicts } = useAppSelector(selectSyncSummary);

  const tabs: TabItem[] = [
    { id: 'today', label: 'Today', count: counts.today, detail: 'My priorities' },
    ...STAGES.map((stage) => ({
      id: stage.id,
      label: stage.label,
      count: counts.byStage[stage.id].count,
      detail: formatCompactCurrency(counts.byStage[stage.id].value),
    })),
    { id: 'all', label: 'All deals', count: counts.all },
    {
      id: 'attention',
      label: 'Needs attention',
      count: failed + conflicts,
      detail: 'Unsaved changes',
      alert: failed + conflicts > 0,
    },
  ];

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.id === activeTab);
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    dispatch(updateFilters({ tab: next.id }));
    document.getElementById(`tab-${next.id}`)?.focus();
  };

  return (
    <nav className="tabs" role="tablist" aria-label="Pipeline views" onKeyDown={handleKeyDown}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          id={`tab-${tab.id}`}
          type="button"
          role="tab"
          className="tab"
          aria-selected={tab.id === activeTab}
          tabIndex={tab.id === activeTab ? 0 : -1}
          data-alert={tab.alert || undefined}
          onClick={() => dispatch(updateFilters({ tab: tab.id }))}
        >
          <span>
            {tab.label} <span className="tab-count">{formatNumber(tab.count)}</span>
          </span>
          {tab.detail && <span className="tab-detail">{tab.detail}</span>}
        </button>
      ))}
    </nav>
  );
}
