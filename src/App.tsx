import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { DealTable } from './components/DealTable/DealTable';
import { FilterBar } from './components/FilterBar/FilterBar';
import { PipelineTabs } from './components/PipelineTabs/PipelineTabs';
import { CURRENT_USER_ID, userName } from './domain/users';
import { selectLoadStatus } from './features/deals/dealsSlice';
import { loadPipeline } from './features/view/viewThunks';
import styles from './App.module.css';

/** Top-level layout: header, tabs, filters, and the deal table. */
export function App() {
  const dispatch = useAppDispatch();
  const loadStatus = useAppSelector(selectLoadStatus);

  useEffect(() => {
    void dispatch(loadPipeline());
  }, [dispatch]);

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>DealFlow</h1>
        <span className={styles.user}>Signed in as {userName(CURRENT_USER_ID)}</span>
      </header>

      {loadStatus === 'ready' ? (
        <main className={styles.main}>
          <PipelineTabs />
          <FilterBar />
          <DealTable />
        </main>
      ) : (
        <main className={styles.status}>
          {loadStatus === 'failed' ? 'Could not load the pipeline. Please reload the page.' : 'Loading deals…'}
        </main>
      )}
    </div>
  );
}
