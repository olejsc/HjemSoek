import type { HealthcareBuild, CalculatorScenarioBase, ValidationIssue } from '../types';

export function buildHealthcareInput(s: CalculatorScenarioBase): HealthcareBuild {
  const issues: ValidationIssue[] = [];
  const m = s.municipalities[0];
  if (!m) { issues.push({ code: 'NO_MUNICIPALITY', level: 'error', message: 'Ingen kommune definert', step: 'municipalities' }); return { issues }; }
  const municipality_region_map: Record<string, string> = {};
  const adjacency_map: Record<string, string[]> = {};
  const municipality_healthcare_map: Record<string, { has_hospital?: boolean; specialist_facilities?: string[] }> = {};
  for (const mu of s.municipalities) {
    if (mu.region) municipality_region_map[mu.id] = mu.region;
    adjacency_map[mu.id] = mu.neighbors.filter(n => s.municipalities.find(mm => mm.id === n));
    municipality_healthcare_map[mu.id] = { has_hospital: mu.healthcare?.has_hospital, specialist_facilities: mu.healthcare?.specialist_facilities || [] };
  }
  const group = { persons: s.persons.map(p => ({ id: p.id, personType: p.personType || 'adult_working', needs_hospital: p.needs_hospital, specialist_need: p.specialist_need })) };
  return {
    issues,
    input: {
      group,
      target_municipality_id: m.id,
      municipality_region_map,
      adjacency_map,
      municipality_healthcare_map,
      subweights: Object.keys(s.subweights).map(id => ({ id: id as 'healthcare.hospital' | 'healthcare.specialist', weight: s.subweights[id] })),
    }
  };
}
