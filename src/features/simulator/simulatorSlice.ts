import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { DEFAULT_DEAL_COUNT, DEFAULT_SIMULATION_CONFIG, type SimulationConfig } from '../../api/types';
import type { RootState } from '../../app/rootReducer';

/**
 * The fake backend's settings, as shown in the simulator panel.
 * The thunks in `simulatorThunks.ts` keep the fake server in step with this.
 */
export interface SimulatorState {
  config: SimulationConfig;
  dealCount: number;
}

const initialState: SimulatorState = {
  config: DEFAULT_SIMULATION_CONFIG,
  dealCount: DEFAULT_DEAL_COUNT,
};

const simulatorSlice = createSlice({
  name: 'simulator',
  initialState,
  reducers: {
    configChanged(state, action: PayloadAction<Partial<SimulationConfig>>) {
      state.config = { ...state.config, ...action.payload };
    },
    dealCountChanged(state, action: PayloadAction<number>) {
      state.dealCount = action.payload;
    },
  },
});

export const { configChanged, dealCountChanged } = simulatorSlice.actions;
export default simulatorSlice.reducer;

export const selectSimulationConfig = (state: RootState) => state.simulator.config;
export const selectDealCount = (state: RootState) => state.simulator.dealCount;
