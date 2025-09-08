import { describe, it, expect } from 'vitest';
import { canHaveProfession, allowedRelations, canHaveRelation, isWorkEligible } from '../categories';

describe('eligibility utilities', () => {
  it('profession eligibility', () => {
    expect(canHaveProfession('baby' as any)).toBe(false);
    expect(canHaveProfession('student' as any)).toBe(true);
  });
  it('relations for baby empty', () => {
    expect(Array.from(allowedRelations('baby' as any)).length).toBe(0);
  });
  it('senior lacks workplace', () => {
    expect(canHaveRelation('senior' as any, 'workplace')).toBe(false);
    expect(canHaveRelation('senior' as any, 'friend')).toBe(true);
  });
  it('work eligibility', () => {
    expect(isWorkEligible('high_school_pupil' as any)).toBe(true);
    expect(isWorkEligible('child' as any)).toBe(false);
  });
});
