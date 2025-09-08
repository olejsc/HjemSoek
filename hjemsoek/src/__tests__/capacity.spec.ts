import { describe, it, expect } from 'vitest';
import { scoreCapacity } from '../categories';

describe('scoreCapacity', () => {
  it('returns missing_data when required fields missing', () => {
    const res = scoreCapacity({ group: { persons: [] }, municipality: { capacity_total: 0, settled_current: 0 }, options: { include_tentative: false, allow_overflow: false } });
    expect(res.mode).toBe('missing_data');
    expect(res.max_possible).toBe(0);
  });

  it('computes feasible score when enough capacity', () => {
    const res = scoreCapacity({
  group: { persons: [{ id: 'a', personType: 'adult_working' }, { id: 'b', personType: 'student' }] },
      municipality: { capacity_total: 10, settled_current: 0 },
      options: { include_tentative: false, allow_overflow: false }
    });

    expect(res.mode).toBe('feasible');
  expect(res.effective_score).toBeGreaterThanOrEqual(0);
    expect(res.effective_score).toBeLessThanOrEqual(100);
  expect(res.confidence).toBe(1);
  });
});
