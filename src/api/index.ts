import { FakeServer } from './fakeServer';
import { DEFAULT_DEAL_COUNT } from './types';

/**
 * The app's single backend instance. It implements both the API contract and
 * the simulator controls; the store receives it via dependency injection
 * (see `src/app/dependencies.ts`), so features never import it directly.
 */
export const fakeServer = new FakeServer({ dealCount: DEFAULT_DEAL_COUNT });

export * from './types';
