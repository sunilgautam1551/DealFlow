import { FakeServer } from './fakeServer';

/** Number of deals generated on startup (the brief's scale). */
export const INITIAL_DEAL_COUNT = 50_000;

/**
 * The app's single backend instance. It implements both the API contract and
 * the simulator controls; the store receives it via dependency injection
 * (see `src/app/dependencies.ts`), so features never import it directly.
 */
export const fakeServer = new FakeServer({ dealCount: INITIAL_DEAL_COUNT });

export * from './types';
