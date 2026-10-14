import { describe, expect, it } from 'vitest';
import { FakeServer } from './fakeServer';
import { NetworkError, type SimulationConfig } from './types';

/** A fast, fully reliable server; individual tests turn on the misbehaviour they need. */
function createServer(config: Partial<SimulationConfig> = {}) {
  return new FakeServer({
    dealCount: 100,
    config: {
      minLatencyMs: 0,
      maxLatencyMs: 0,
      failureRate: 0,
      raceChance: 0,
      teammateChangesPerMinute: 0,
      ...config,
    },
  });
}

describe('FakeServer', () => {
  it('generates the same dataset for the same seed', async () => {
    const [a, b] = await Promise.all([createServer().fetchDeals(), createServer().fetchDeals()]);
    expect(a).toHaveLength(100);
    expect(a.map((deal) => deal.company)).toEqual(b.map((deal) => deal.company));
  });

  it('moves a deal and bumps its version', async () => {
    const server = createServer();
    const [deal] = await server.fetchDeals();
    const toStage = deal.stage === 'won' ? 'lost' : 'won';

    const [result] = await server.moveDeals([{ dealId: deal.id, toStage, expectedStage: deal.stage }], 'u01');

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.deal.stage).toBe(toStage);
    expect(result.deal.version).toBe(deal.version + 1);
    expect(result.deal.updatedBy).toBe('u01');
  });

  it('reports a conflict when the deal is no longer in the expected stage', async () => {
    const server = createServer();
    const [deal] = await server.fetchDeals();
    const otherStage = deal.stage === 'new' ? 'contacted' : 'new';

    const [result] = await server.moveDeals(
      [{ dealId: deal.id, toStage: 'won', expectedStage: otherStage }],
      'u01',
    );

    expect(result.status).toBe('conflict');
  });

  it('treats a repeated move as success, so retries are safe', async () => {
    const server = createServer();
    const [deal] = await server.fetchDeals();
    const toStage = deal.stage === 'won' ? 'lost' : 'won';
    const request = { dealId: deal.id, toStage, expectedStage: deal.stage } as const;

    await server.moveDeals([request], 'u01');
    const [retry] = await server.moveDeals([request], 'u01');

    expect(retry.status).toBe('ok');
  });

  it('rejects with a NetworkError when the request fails', async () => {
    const server = createServer({ failureRate: 1 });
    const [deal] = await server.fetchDeals();

    await expect(
      server.moveDeals([{ dealId: deal.id, toStage: 'won', expectedStage: deal.stage }], 'u01'),
    ).rejects.toBeInstanceOf(NetworkError);
  });

  it('produces a conflict when a teammate races the save', async () => {
    const server = createServer({ raceChance: 1 });
    const [deal] = await server.fetchDeals();
    const toStage = deal.stage === 'won' ? 'lost' : 'won';

    const [result] = await server.moveDeals([{ dealId: deal.id, toStage, expectedStage: deal.stage }], 'u01');

    expect(result.status).toBe('conflict');
    if (result.status !== 'conflict') return;
    expect(result.deal.updatedBy).not.toBe('u01');
  });

  it('pushes committed changes to subscribers', async () => {
    const server = createServer();
    const [deal] = await server.fetchDeals();
    const received = new Promise((resolve) => server.subscribe(resolve));

    await server.moveDeals([{ dealId: deal.id, toStage: 'won', expectedStage: deal.stage }], 'u01');

    await expect(received).resolves.toEqual([expect.objectContaining({ id: deal.id, stage: 'won' })]);
  });
});
