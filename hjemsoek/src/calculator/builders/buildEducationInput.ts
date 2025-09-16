import type { EducationBuild, CalculatorScenarioBase, ValidationIssue } from '../types';

export function buildEducationInput(s: CalculatorScenarioBase): EducationBuild {
  const issues: ValidationIssue[] = [];
  const m = s.municipalities[0];
  if (!m) { issues.push({ code: 'NO_MUNICIPALITY', level: 'error', message: 'Ingen kommune definert', step: 'municipalities' }); return { issues }; }
  const municipality_region_map: Record<string, string> = {};
  const adjacency_map: Record<string, string[]> = {};
  const municipality_education_map: Record<string, {
    has_primary_school?: boolean;
    has_high_school?: boolean;
    has_university?: boolean;
    has_adult_language?: boolean;
  }> = {};
  for (const mu of s.municipalities) {
    if (mu.region) municipality_region_map[mu.id] = mu.region;
    adjacency_map[mu.id] = mu.neighbors.filter(n => s.municipalities.find(mm => mm.id === n));
    municipality_education_map[mu.id] = { ...mu.education };
  }
  const group = { persons: s.persons.map(p => ({ id: p.id, personType: p.personType || 'adult_working', education_need: p.education_need })) };
  return {
    issues,
    input: {
      group,
      target_municipality_id: m.id,
      municipality_region_map,
      adjacency_map,
      municipality_education_map,
      subweights: Object.keys(s.subweights).map(id => ({
        id: id as
          | 'education.primary_school'
          | 'education.high_school'
          | 'education.university'
          | 'education.adult_language',
        weight: s.subweights[id]
      })),
    }
  };
}
