import type { ConnectionBuild, CalculatorScenarioBase, ValidationIssue } from '../types';

export function buildConnectionInput(s: CalculatorScenarioBase): ConnectionBuild {
  const issues: ValidationIssue[] = [];
  const m = s.municipalities[0];
  if (!m) { issues.push({ code: 'NO_MUNICIPALITY', level: 'error', message: 'Ingen kommune definert', step: 'municipalities' }); return { issues }; }
  const municipality_region_map: Record<string, string> = {};
  const adjacency_map: Record<string, string[]> = {};
  for (const mu of s.municipalities) {
    if (mu.region) municipality_region_map[mu.id] = mu.region;
    adjacency_map[mu.id] = mu.neighbors.filter(n => s.municipalities.find(mm => mm.id === n));
  }
  const group = { persons: s.persons.map(p => ({ id: p.id, personType: p.personType || 'adult_working', connection: p.connection })) };
  return {
    issues,
    input: {
      group,
      target_municipality_id: m.id,
      municipality_region_map,
      adjacency_map,
      subweights: Object.keys(s.subweights).map(id => ({
        id: id as
          | 'connection.friend'
          | 'connection.close_family'
          | 'connection.relative'
          | 'connection.workplace'
          | 'connection.school_place',
        weight: s.subweights[id]
      })),
    }
  };
}
