import { describe, it, expect } from 'vitest';
import { scoreConnection } from '../categories';

const municipality_region_map = {
  'm1': 'r1',
  'm2': 'r1', // same region as m1
  'm3': 'r2'
};

const adjacency_map = {
  'm1': ['m3'], // m3 neighbor to m1 (different region)
  'm2': [],
  'm3': ['m1']
};

describe('scoreConnection', () => {
  it('returns max_possible=0 when no persons', () => {
  const res = scoreConnection({ group: { persons: [] }, target_municipality_id: 'm1', municipality_region_map, adjacency_map });
    expect(res.max_possible).toBe(0);
    expect(res.score).toBe(0);
  });

  it('scores exact municipality match as 100', () => {
    const res = scoreConnection({
  group: { persons: [{ id: 'p1', personType: 'adult_working', connection: { municipality_id: 'm1', relation: 'friend' } }] },
      target_municipality_id: 'm1',
      municipality_region_map,
      adjacency_map,
    });
    // friend weight default 20% so total score should be 100 * 0.2 = 20
    expect(res.persons[0].base_score).toBe(100);
    expect(res.score).toBeGreaterThan(0); // 20 with equal weights
  });

  it('scores neighbor municipality as 50', () => {
    const res = scoreConnection({
  group: { persons: [{ id: 'p1', personType: 'student', connection: { municipality_id: 'm3', relation: 'friend' } }] },
      target_municipality_id: 'm1',
      municipality_region_map,
      adjacency_map,
    });
    expect(res.persons[0].match_level).toBe('neighbor');
    expect(res.persons[0].base_score).toBe(50);
  });

  it('scores same-region different municipality as 10', () => {
    const res = scoreConnection({
  group: { persons: [{ id: 'p1', personType: 'student', connection: { municipality_id: 'm2', relation: 'friend' } }] },
      target_municipality_id: 'm1',
      municipality_region_map,
      adjacency_map,
    });
    expect(res.persons[0].match_level).toBe('region');
    expect(res.persons[0].base_score).toBe(10);
  });

  it('scores region connection using relation mapping (close_family=75)', () => {
    const res = scoreConnection({
  group: { persons: [{ id: 'p1', personType: 'adult_working', connection: { region_id: 'r1', relation: 'close_family' } }] },
      target_municipality_id: 'm1',
      municipality_region_map,
      adjacency_map,
    });
    expect(res.persons[0].match_level).toBe('region');
    expect(res.persons[0].base_score).toBe(75);
  });

  it('gives zero for region connection not containing target', () => {
    const res = scoreConnection({
      group: { persons: [{ id: 'p1', personType: 'adult_working', connection: { region_id: 'r2', relation: 'close_family' } }] },
      target_municipality_id: 'm1',
      municipality_region_map,
      adjacency_map,
    });
    expect(res.persons[0].base_score).toBe(0);
  });

  it('location without relation yields base 0 and explanation', () => {
    const res = scoreConnection({
      group: { persons: [{ id: 'p1', personType: 'adult_working', connection: { municipality_id: 'm1' } }] },
      target_municipality_id: 'm1',
      municipality_region_map,
      adjacency_map,
    });
    expect(res.persons[0].base_score).toBe(0);
    expect(res.persons[0].explanation).toMatch(/Relasjon ikke valgt/);
  });

  it('baby-only group yields confidence=0 and max_possible=0', () => {
    const res = scoreConnection({
      group: { persons: [ { id: 'b1', personType: 'baby' }, { id: 'b2', personType: 'baby' } ] },
      target_municipality_id: 'm1',
      municipality_region_map,
      adjacency_map,
    });
    expect(res.max_possible).toBe(0);
    expect(res.confidence).toBe(0);
  });
});
