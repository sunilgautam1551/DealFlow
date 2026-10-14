import type { PipelineApi, SimulatorControls } from '../api/types';

/**
 * External services injected into every thunk as the `extra` argument.
 *
 * Thunks reach the backend only through this object, so tests can pass a
 * fake or a stub and features never import the server singleton.
 */
export interface ThunkExtra {
  api: PipelineApi;
  simulator: SimulatorControls;
}
