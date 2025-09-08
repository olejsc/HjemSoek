import { describe, test, expect } from 'vitest';
import { scoreEducation, educationNeedsList } from '../categories';
import type { EducationInput } from '../types';

function baseInput(): EducationInput {
  return {
    group: { persons: [] },
    target_municipality_id: 'm1',
    municipality_region_map: { m1: 'r1', m2: 'r1', m3: 'r2' },
    adjacency_map: { m1: ['m2'], m2: ['m1'], m3: [] },
    municipality_education_map: {
      m1: { has_primary_school: true, has_high_school: false, has_university: false, has_adult_language: false },
      m2: { has_primary_school: false, has_high_school: true, has_university: false, has_adult_language: false },
      m3: { has_primary_school: false, has_high_school: false, has_university: true, has_adult_language: true },
    },
  };
}

describe('education eligibility helper', () => {
  test('returns allowed facilities for each type', () => {
    expect(educationNeedsList('baby')).toEqual([]);
    expect(educationNeedsList('child')).toEqual(['primary_school','high_school']);
    expect(educationNeedsList('high_school_pupil')).toEqual(['high_school','university']);
  });
});

describe('scoreEducation', () => {
  test('no persons -> score 0 confidence 0', () => {
    const res = scoreEducation(baseInput());
    expect(res.score).toBe(0);
    expect(res.confidence).toBe(0);
    expect(res.max_possible).toBe(0);
  });

  test('single person primary school need in target => 100', () => {
    const input = baseInput();
    input.group.persons = [ { id: 'p1', personType: 'child', education_need: 'primary_school' } ];
    // Provide only primary school subweight to avoid dilution
    (input as any).subweights = [ { id: 'education.primary_school', weight: 1 } ];
    const res = scoreEducation(input);
    expect(Math.round(res.score)).toBe(100);
    expect(Math.round(res.subscores.find(s => s.id==='education.primary_school')?.score || 0)).toBe(100);
    expect(res.confidence).toBe(1);
  });

  test('need satisfied via neighbor => 50', () => {
    const input = baseInput();
    // m1 lacks high school, neighbor m2 has it
    input.group.persons = [ { id: 'p1', personType: 'child', education_need: 'high_school' } ];
    (input as any).subweights = [ { id: 'education.high_school', weight: 1 } ];
    const res = scoreEducation(input);
    expect(Math.round(res.subscores.find(s => s.id==='education.high_school')?.score || 0)).toBe(50);
    expect(Math.round(res.score)).toBe(50);
  });

  test('need satisfied via region fallback => 25', () => {
    const input = baseInput();
    // Add region school facility only in another municipality same region (m2) already neighbor test; use university via region different municipality r2? adjust: add university in m2 same region
    input.municipality_education_map.m2.has_university = true; // region facility
    input.group.persons = [ { id: 'p1', personType: 'high_school_pupil', education_need: 'university' } ];
    // target m1 lacks, neighbor m2 has -> adjacency actually 50; adjust so adjacency path removed
    input.adjacency_map.m1 = []; // remove adjacency for this test
    (input as any).subweights = [ { id: 'education.university', weight: 1 } ];
    const res = scoreEducation(input);
    expect(Math.round(res.subscores.find(s => s.id==='education.university')?.score || 0)).toBe(25);
    expect(Math.round(res.score)).toBe(25);
  });

  test('invalid need for person type ignored', () => {
    const input = baseInput();
    input.group.persons = [ { id: 'p1', personType: 'child', education_need: 'university' as any } ];
    const res = scoreEducation(input);
    expect(res.score).toBe(0);
    expect(res.confidence).toBe(0); // no valid needs counted
  });
});
