import { describe, it, expect } from 'vitest';
import { scoreHealthcare } from '../categories';
import type { HealthcareInput } from '../types';

describe('Healthcare module basic scenarios', () => {
  const municipality_region_map = { a: 'r1', b: 'r1', c: 'r2', d: 'r2' };
  const adjacency_map = { a: ['b'], b: ['a','c'], c: ['b'], d: [] };
  const baseHealthcare = {
    a: { has_hospital: true, specialist_facilities: ['dialysis','oncology'] },
    b: { has_hospital: false, specialist_facilities: ['rehabilitation'] },
    c: { has_hospital: false, specialist_facilities: ['mental_health'] },
    d: { has_hospital: false, specialist_facilities: [] },
  };

  it('returns confidence 0 when no persons with needs', () => {
    const input: HealthcareInput = {
      group: { persons: [{ id: 'p1', personType: 'adult_working' }]},
      target_municipality_id: 'a',
      municipality_region_map,
      adjacency_map,
      municipality_healthcare_map: baseHealthcare,
    } as any;
    const res = scoreHealthcare(input);
    expect(res.score).toBe(0);
    expect(res.max_possible).toBe(0);
    expect(res.confidence).toBe(0);
  });

  it('scores hospital self=100', () => {
    const input: HealthcareInput = {
      group: { persons: [{ id: 'p1', personType: 'adult_working', needs_hospital: true }]},
      target_municipality_id: 'a',
      municipality_region_map,
      adjacency_map,
      municipality_healthcare_map: baseHealthcare,
    } as any;
    const res = scoreHealthcare(input);
    expect(res.score).toBe(100);
  });

  it('scores hospital adjacency=50', () => {
    const input: HealthcareInput = {
      group: { persons: [{ id: 'p1', personType: 'adult_working', needs_hospital: true }]},
      target_municipality_id: 'b',
      municipality_region_map,
      adjacency_map,
      municipality_healthcare_map: baseHealthcare,
    } as any;
    const res = scoreHealthcare(input);
    expect(res.score).toBe(50);
  });

  it('scores hospital region=25 (no self/adjacency)', () => {
    const input: HealthcareInput = {
      group: { persons: [{ id: 'p1', personType: 'adult_working', needs_hospital: true }]},
      target_municipality_id: 'c', // region r2 has no hospital; expect 0
      municipality_region_map,
      adjacency_map,
      municipality_healthcare_map: baseHealthcare,
    } as any;
    const res0 = scoreHealthcare(input);
    expect(res0.score).toBe(0);

    const regionHospitalMap = { ...baseHealthcare, c: baseHealthcare.c, d: { has_hospital: true } };
    const input2: HealthcareInput = { ...input, municipality_healthcare_map: regionHospitalMap } as any;
    const res = scoreHealthcare(input2);
    expect(res.score).toBe(25);
  });

  it('scores specialist self=100', () => {
    const input: HealthcareInput = {
      group: { persons: [{ id: 'p1', personType: 'adult_working', specialist_need: 'rehabilitation' }]},
      target_municipality_id: 'b',
      municipality_region_map,
      adjacency_map,
      municipality_healthcare_map: baseHealthcare,
    } as any;
    const res = scoreHealthcare(input);
    expect(res.score).toBe(100);
  });

  it('scores specialist adjacency=50', () => {
    const input: HealthcareInput = {
      group: { persons: [{ id: 'p1', personType: 'adult_working', specialist_need: 'rehabilitation' }]},
      target_municipality_id: 'a', // a doesn't have rehabilitation but neighbor b has
      municipality_region_map,
      adjacency_map,
      municipality_healthcare_map: baseHealthcare,
    } as any;
    const res = scoreHealthcare(input);
    expect(res.score).toBe(50);
  });

  it('scores specialist region=25', () => {
    // Create scenario: target 'd' in region r2, mental_health only in another municipality same region, no adjacency
    const regionMap = { a: 'r1', b: 'r1', c: 'r2', d: 'r2' };
    const adj = { a: ['b'], b: ['a'], c: [], d: [] }; // remove adjacency between d and c
    const hcMap = {
      a: { has_hospital: false, specialist_facilities: [] },
      b: { has_hospital: false, specialist_facilities: [] },
      c: { has_hospital: false, specialist_facilities: ['mental_health'] },
      d: { has_hospital: false, specialist_facilities: [] },
    };
    const input: HealthcareInput = {
      group: { persons: [{ id: 'p1', personType: 'adult_working', specialist_need: 'mental_health' }]},
      target_municipality_id: 'd',
      municipality_region_map: regionMap,
      adjacency_map: adj,
      municipality_healthcare_map: hcMap,
    } as any;
    const res = scoreHealthcare(input);
    expect(res.score).toBe(25);
  });

  it('mixed hospital + specialist with equal weights', () => {
    const input: HealthcareInput = {
      group: { persons: [
        { id: 'p1', personType: 'adult_working', needs_hospital: true, specialist_need: 'rehabilitation' }, // target b has rehab self, no hospital self
      ]},
      target_municipality_id: 'b',
      municipality_region_map,
      adjacency_map,
      municipality_healthcare_map: baseHealthcare,
    } as any;
    const res = scoreHealthcare(input);
    // hospital adjacency (neighbor a) = 50, specialist self=100, equal weights => per-person composite 75
    expect(Math.round(res.score)).toBe(75);
  });
});
