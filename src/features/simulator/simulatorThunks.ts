import type { SimulationConfig } from '../../api/types';
import { pipelineReset } from '../../app/actions';
import type { AppThunk } from '../../app/store';
import { loadPipeline } from '../view/viewThunks';
import { configChanged, dealCountChanged } from './simulatorSlice';

/** Changes how the fake backend behaves. Takes effect on the next request. */
export const updateSimulation =
  (changes: Partial<SimulationConfig>): AppThunk =>
  (dispatch, getState, { simulator }) => {
    dispatch(configChanged(changes));
    simulator.configure(getState().simulator.config);
  };

/**
 * Throws all data away and generates `dealCount` fresh deals, e.g. to try the
 * app with 100,000 deals. The UI only offers this when nothing is unsaved.
 */
export const regenerateDeals =
  (dealCount: number): AppThunk<Promise<void>> =>
  async (dispatch, _getState, { simulator }) => {
    simulator.reset(dealCount);
    dispatch(dealCountChanged(dealCount));
    dispatch(pipelineReset());
    await dispatch(loadPipeline());
  };
