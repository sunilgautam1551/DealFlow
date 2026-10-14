import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { formatCompactCurrency, formatNumber } from '../../domain/format';
import { STAGES } from '../../domain/stages';
import { selectSyncSummary } from '../../features/sync/syncSelectors';
import { selectFilters, selectTabCounts } from '../../features/view/viewSelectors';
import type { ViewTab } from '../../features/view/viewSlice';
import { updateFilters } from '../../features/view/viewThunks';
import styles from './PipelineTabs.module.css';

interface TabItem {
  id: ViewTab;
  label: string;
  count: number;
  /** Optional second line, e.g. the stage's total value. */
  detail?: string;
  /** Highlight the tab (used when saves need the user's decision). */
  alert?: boolean;
}

/**
 * One tab per stage plus "Today", "All" and "Needs attention". Each stage tab shows its deal
 * count and value, so the tab row doubles as a pipeline overview.
 */
export function PipelineTabs() {
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

  // Standard tabs keyboard pattern: the whole row is one Tab stop, ←/→ switch tabs.
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.id === activeTab);
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next = tabs[(index + step + tabs.length) % tabs.length];
    dispatch(updateFilters({ tab: next.id }));
    document.getElementById(tabElementId(next.id))?.focus();
  };

  return (
    <nav className={styles.tabs} role="tablist" aria-label="Pipeline views" onKeyDown={handleKeyDown}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          id={tabElementId(tab.id)}
          type="button"
          role="tab"
          aria-selected={tab.id === activeTab}
          tabIndex={tab.id === activeTab ? 0 : -1}
          className={styles.tab}
          data-alert={tab.alert || undefined}
          onClick={() => dispatch(updateFilters({ tab: tab.id }))}
        >
          <span className={styles.label}>
            {tab.label} <span className={styles.count}>{formatNumber(tab.count)}</span>
          </span>
          {tab.detail && <span className={styles.detail}>{tab.detail}</span>}
        </button>
      ))}
    </nav>
  );
}

function tabElementId(tab: ViewTab): string {
  return `view-tab-${tab}`;
}
