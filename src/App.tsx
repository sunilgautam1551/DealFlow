import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { ActionBar } from './components/ActionBar/ActionBar';
import { BulkProgress } from './components/BulkProgress/BulkProgress';
import { DealTable } from './components/DealTable/DealTable';
import { FilterBar } from './components/FilterBar/FilterBar';
import { MoveDialog } from './components/MoveDialog/MoveDialog';
import { PipelineTabs } from './components/PipelineTabs/PipelineTabs';
import { SimulatorPanel } from './components/SimulatorPanel/SimulatorPanel';
import { SyncStatus } from './components/SyncStatus/SyncStatus';
import { Toasts } from './components/Toasts/Toasts';
import { UpdatesBanner } from './components/UpdatesBanner/UpdatesBanner';
import { CURRENT_USER_ID, userName } from './domain/users';
import { selectLoadStatus } from './features/deals/dealsSlice';
import { connectRealtime } from './features/realtime/realtimeThunks';
import { simulatorToggled } from './features/ui/uiSlice';
import { loadPipeline } from './features/view/viewThunks';
import styles from './App.module.css';

/** Top-level layout: header, tabs, filters, actions, and the deal table. */
export function App() {
  const dispatch = useAppDispatch();
  const loadStatus = useAppSelector(selectLoadStatus);

  // Connect the realtime feed *before* loading, so no change made during the
  // load is missed. The deals slice keeps whichever version is newer.
  useEffect(() => {
    const disconnect = dispatch(connectRealtime());
    void dispatch(loadPipeline());
    return disconnect;
  }, [dispatch]);

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>DealFlow</h1>
        <SyncStatus />
        <span className={styles.user}>Signed in as {userName(CURRENT_USER_ID)}</span>
        <button type="button" onClick={() => dispatch(simulatorToggled())}>
          Simulator
        </button>
      </header>

      {loadStatus === 'ready' ? (
        <main className={styles.main}>
          <PipelineTabs />
          <FilterBar />
          <ActionBar />
          <BulkProgress />
          <UpdatesBanner />
          <DealTable />
        </main>
      ) : (
        <main className={styles.status}>
          {loadStatus === 'failed' ? 'Could not load the pipeline. Please reload the page.' : 'Loading deals…'}
        </main>
      )}

      <SimulatorPanel />
      <MoveDialog />
      <Toasts />
    </div>
  );
}
