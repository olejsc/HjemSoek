import { describe, it, expect } from 'vitest';
import { scoreWorkOpportunity } from '../categories';

describe('scoreWorkOpportunity', () => {
  it('returns max_possible=0 when no persons', () => {
    const res = scoreWorkOpportunity({ group: { persons: [] }, municipality: {}, subweights: [] });
    expect(res.max_possible).toBe(0);
    expect(res.coverage).toBe(0);
  });

  it('computes non-negative score for persons', () => {
    const res = scoreWorkOpportunity({
      group: { persons: [
        { id: 'p1', personType: 'student', profession: 'x' },
        { id: 'p2', personType: 'adult_working' },
        { id: 'p3', personType: 'baby' } // ineligible
      ] },
      municipality: { work_opportunity: { unemployment_rate: 10, profession_growth: { x: 50 } } }
    });
    expect(res.score).toBeGreaterThanOrEqual(0);
    expect(res.score).toBeLessThanOrEqual(100);
    expect(res.persons.length).toBe(2); // baby excluded
    expect(res.confidence).toBe(1);
  });

  it('confidence=0 and max_possible=0 when only ineligible persons', () => {
    const res = scoreWorkOpportunity({
      group: { persons: [
        { id: 'b1', personType: 'baby' },
        { id: 'c1', personType: 'child' },
        { id: 's1', personType: 'senior' }
      ] },
      municipality: { work_opportunity: { unemployment_rate: 5 } }
    });
    expect(res.confidence).toBe(0);
    expect(res.max_possible).toBe(0);
  });
});
