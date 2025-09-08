import { describe, it, expect } from 'vitest';
import { aggregateOverall } from '../categories';

describe('aggregateOverall', () => {
  it('computes weighted total with normalized weights (two modules)', () => {
    const modules = {
      capacity: { effective_score: 50, mode: 'feasible', max_possible: 100, explanation: '', direction: 'higher_better', confidence: 1 },
      workOpportunity: { effective_score: 80, mode: 'feasible', max_possible: 100, explanation: '', direction: 'higher_better', confidence: 1 }
    } as any;
    const weights = { capacity: 1, workOpportunity: 1 } as any;
    const res = aggregateOverall(modules, weights);
    expect(res.weighted_total).toBeCloseTo((50 + 80) / 2, 6);
  });

  it('normalizes three-module weights including connection', () => {
    const modules = {
      capacity: { effective_score: 60, mode: 'feasible', max_possible: 100, explanation: '', direction: 'higher_better', confidence: 1 },
      workOpportunity: { effective_score: 90, mode: 'feasible', max_possible: 100, explanation: '', direction: 'higher_better', confidence: 1 },
      connection: { effective_score: 30, mode: 'feasible', max_possible: 100, explanation: '', direction: 'higher_better', confidence: 1 }
    } as any;
    const weights = { capacity: 1, workOpportunity: 1, connection: 1 } as any; // expect simple average
    const res = aggregateOverall(modules, weights);
    expect(res.weighted_total).toBeCloseTo((60 + 90 + 30) / 3, 6);
    expect(res.overall_max_possible).toBeCloseTo(100); // all confident
  });
  it('overall max reduced when a module has confidence=0', () => {
    const modules = {
      capacity: { effective_score: 60, mode: 'feasible', max_possible: 100, explanation: '', direction: 'higher_better', confidence: 1 },
      workOpportunity: { effective_score: 0, mode: 'feasible', max_possible: 0, explanation: '', direction: 'higher_better', confidence: 0 },
      connection: { effective_score: 30, mode: 'feasible', max_possible: 100, explanation: '', direction: 'higher_better', confidence: 1 }
    } as any;
    const weights = { capacity: 1, workOpportunity: 1, connection: 1 } as any;
    const res = aggregateOverall(modules, weights);
    // Two confident modules => overall max = 2/3 * 100 ≈ 66.6667
    expect(res.overall_max_possible).toBeGreaterThan(66);
    expect(res.overall_max_possible).toBeLessThan(67);
  });
});
