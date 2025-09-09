import { describe, it, expect } from 'vitest';
import { scoreWorkOpportunity } from '../categories';
import type { WorkOpportunityInput } from '../types';

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
  municipality: { work_opportunity: { unemployment_rate: 10, profession_history: { x: { number_of_employees_in_profession_5_years_ago: 5, number_of_employees_in_profession_now: 6 } } } }
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

  describe('growth normalization scenarios', () => {
    interface HistoryEntry {
      number_of_employees_in_profession_5_years_ago?: number;
      number_of_employees_in_profession_now?: number;
      percentage_of_municipality_workforce_5_years_ago?: number;
      percentage_of_municipality_workforce_now?: number;
      workforce_change_past_5_years?: number;
    }
  function buildInput(profession: string, targetHistory: HistoryEntry, shapingHistories: Record<string, HistoryEntry>): WorkOpportunityInput {
      return {
        group: { persons: [ { id: 'p1', personType: 'student', profession } ] },
        municipality: { work_opportunity: {
          unemployment_rate: 10,
      profession_history: { [profession]: targetHistory, ...shapingHistories }
        } }
      };
    }

    it('Scenario 4: big percent small absolute (deltaN=1, percent=100%)', () => {
      // Need TH_abs >1 and TH_pct <=100
      // absChanges: [1(target),20,21] => median=20 threshold=20 -> bigAbs false
      // pctMagnitudes: [100(target),5,5] => median=5 threshold=5 -> bigPct true
      const input = buildInput(
        'electrician',
        { number_of_employees_in_profession_5_years_ago:1, number_of_employees_in_profession_now:2, percentage_of_municipality_workforce_5_years_ago:1, percentage_of_municipality_workforce_now:2, workforce_change_past_5_years:100 },
        {
          dummyA: { number_of_employees_in_profession_5_years_ago:20, number_of_employees_in_profession_now:40, percentage_of_municipality_workforce_5_years_ago:5, percentage_of_municipality_workforce_now:5.5, workforce_change_past_5_years:100 },
          dummyB: { number_of_employees_in_profession_5_years_ago:21, number_of_employees_in_profession_now:42, percentage_of_municipality_workforce_5_years_ago:5, percentage_of_municipality_workforce_now:5.5, workforce_change_past_5_years:100 }
        }
      );
      const res = scoreWorkOpportunity(input);
      expect(res.persons[0].growth_scenario).toBe(4);
    });

    it('Scenario 1: small percent big absolute', () => {
      // absChanges: [20(target),1,1] => median=1 threshold=1 -> bigAbs true
      // pctMagnitudes: [20(target),80,80] => median=80 threshold=80 -> bigPct false
      const input = buildInput(
        'teacher',
        { number_of_employees_in_profession_5_years_ago:50, number_of_employees_in_profession_now:60, percentage_of_municipality_workforce_5_years_ago:10, percentage_of_municipality_workforce_now:11, workforce_change_past_5_years:20 },
        {
          dummyA: { number_of_employees_in_profession_5_years_ago:5, number_of_employees_in_profession_now:9, percentage_of_municipality_workforce_5_years_ago:3, percentage_of_municipality_workforce_now:5.4, workforce_change_past_5_years:80 },
          dummyB: { number_of_employees_in_profession_5_years_ago:5, number_of_employees_in_profession_now:9, percentage_of_municipality_workforce_5_years_ago:3, percentage_of_municipality_workforce_now:5.4, workforce_change_past_5_years:80 }
        }
      );
      const res = scoreWorkOpportunity(input);
      expect(res.persons[0].growth_scenario).toBe(1);
    });

    it('Scenario 2: small percent small absolute', () => {
      // absChanges: [1(target),20,20] => median=20 threshold=20 -> bigAbs false
      // pctMagnitudes: [5(target),50,50] => median=50 threshold=50 -> bigPct false
      const input = buildInput(
        'driver',
        { number_of_employees_in_profession_5_years_ago:20, number_of_employees_in_profession_now:21, percentage_of_municipality_workforce_5_years_ago:2, percentage_of_municipality_workforce_now:2.1, workforce_change_past_5_years:5 },
        {
          dummyA: { number_of_employees_in_profession_5_years_ago:20, number_of_employees_in_profession_now:40, percentage_of_municipality_workforce_5_years_ago:4, percentage_of_municipality_workforce_now:6, workforce_change_past_5_years:50 },
          dummyB: { number_of_employees_in_profession_5_years_ago:20, number_of_employees_in_profession_now:40, percentage_of_municipality_workforce_5_years_ago:4, percentage_of_municipality_workforce_now:6, workforce_change_past_5_years:50 }
        }
      );
      const res = scoreWorkOpportunity(input);
      expect(res.persons[0].growth_scenario).toBe(2);
    });

    it('Scenario 3: big percent big absolute', () => {
      // absChanges: [10(target),1,1] => median=1 threshold=1 bigAbs true
      // pctMagnitudes: [60(target),5,5] => median=5 threshold=5 bigPct true
      const input = buildInput(
        'nurse',
        { number_of_employees_in_profession_5_years_ago:10, number_of_employees_in_profession_now:20, percentage_of_municipality_workforce_5_years_ago:4, percentage_of_municipality_workforce_now:8, workforce_change_past_5_years:100 },
        {
          dummyA: { number_of_employees_in_profession_5_years_ago:5, number_of_employees_in_profession_now:6, percentage_of_municipality_workforce_5_years_ago:2, percentage_of_municipality_workforce_now:2.1, workforce_change_past_5_years:5 },
          dummyB: { number_of_employees_in_profession_5_years_ago:5, number_of_employees_in_profession_now:6, percentage_of_municipality_workforce_5_years_ago:2, percentage_of_municipality_workforce_now:2.1, workforce_change_past_5_years:5 }
        }
      );
      const res = scoreWorkOpportunity(input);
      expect(res.persons[0].growth_scenario).toBe(3);
    });

    it('Missing history yields zero growth', () => {
      const res = scoreWorkOpportunity({
        group: { persons: [ { id: 'p1', personType: 'student', profession: 'chef' } ] },
        municipality: { work_opportunity: { unemployment_rate: 5 } }
      });
      expect(res.persons[0].growth).toBe(0);
    });
  });
});
