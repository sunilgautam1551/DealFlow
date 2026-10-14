import { useEffect } from 'react';
import { BulkActionBar } from './features/bulk-actions/BulkActionBar/BulkActionBar';
import { DealTable } from './features/deal-table/DealTable/DealTable';
import { PipelineFilters } from './features/filters/PipelineFilters/PipelineFilters';
import { SaveStatus } from './features/save-status/SaveStatus/SaveStatus';
import { Toasts } from './features/save-status/Toasts/Toasts';
import { SimulationPanel } from './features/simulator/SimulationPanel/SimulationPanel';
import { useAppDispatch, useAppSelector } from './store';
import { connectRealtime } from './store/dealsSlice';
import { simulatorToggled } from './store/uiSlice';
import { loadPipeline } from './store/viewSlice';
import { CURRENT_USER_ID } from './types/deal';
import { userName } from './utils/dealUtils';

export function App() {
  const dispatch = useAppDispatch();
  const loadStatus = useAppSelector((state) => state.deals.loadStatus);

  // Connect the realtime feed *before* loading, so no change made during the
  // load is missed. The deals slice keeps whichever version is newer.
  useEffect(() => {
    const disconnect = dispatch(connectRealtime());
    void dispatch(loadPipeline());
    return disconnect;
  }, [dispatch]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>DealFlow</h1>
        <SaveStatus />
        <span className="push-right muted">Signed in as {userName(CURRENT_USER_ID)}</span>
        <button type="button" onClick={() => dispatch(simulatorToggled())}>
          Simulator
        </button>
      </header>

      {loadStatus === 'ready' ? (
        <main className="app-main">
          <PipelineFilters />
          <BulkActionBar />
          <DealTable />
        </main>
      ) : (
        <main className="app-loading">
          {loadStatus === 'failed' ? 'Could not load the pipeline. Please reload the page.' : 'Loading deals…'}
        </main>
      )}

      <SimulationPanel />
      <Toasts />
    </div>
  );
}
