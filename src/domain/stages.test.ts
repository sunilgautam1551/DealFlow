import { describe, expect, it } from 'vitest';
import { nextStage, previousStage } from './stages';

describe('stage navigation', () => {
  it('advances open deals one stage, ending at Won', () => {
    expect(nextStage('new')).toBe('contacted');
    expect(nextStage('negotiation')).toBe('won');
  });

  it('does not advance closed deals', () => {
    expect(nextStage('won')).toBeNull();
    expect(nextStage('lost')).toBeNull();
  });

  it('sends deals back one stage and re-opens closed deals into Negotiation', () => {
    expect(previousStage('contacted')).toBe('new');
    expect(previousStage('new')).toBeNull();
    expect(previousStage('lost')).toBe('negotiation');
  });
});
