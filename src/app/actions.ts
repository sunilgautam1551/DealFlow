import { createAction } from '@reduxjs/toolkit';

/**
 * Actions that several slices respond to.
 */

/**
 * The dataset was regenerated (simulator panel). Every slice that holds deal
 * ids clears itself, so nothing points at deals that no longer exist.
 */
export const pipelineReset = createAction('app/pipelineReset');
