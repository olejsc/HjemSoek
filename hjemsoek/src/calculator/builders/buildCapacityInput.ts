import type { CapacityBuild, CalculatorScenarioBase, ValidationIssue } from '../types';

export function buildCapacityInput(s: CalculatorScenarioBase): CapacityBuild {
  const issues: ValidationIssue[] = [];
  const m = s.municipalities[0];
  if (!m) {
    issues.push({ code: 'NO_MUNICIPALITY', level: 'error', message: 'Ingen kommune definert', step: 'municipalities' });
    return { issues };
  }
  const cap = m.capacity || {};
  if (cap.capacity_total == null || cap.capacity_total <= 0) {
    issues.push({ code: 'MISSING_CAPACITY_TOTAL', level: 'error', message: 'capacity_total må være > 0', step: 'municipalities', fieldPath: 'capacity.capacity_total' });
  }
  if (cap.settled_current == null || cap.settled_current < 0) {
    issues.push({ code: 'MISSING_SETTLED_CURRENT', level: 'error', message: 'settled_current må være ≥ 0', step: 'municipalities', fieldPath: 'capacity.settled_current' });
  }
  if (cap.capacity_total != null && cap.settled_current != null && cap.settled_current > cap.capacity_total) {
    issues.push({ code: 'SETTLED_GT_TOTAL', level: 'warn', message: 'Bosatt er større enn total kapasitet', step: 'municipalities' });
  }
  if (issues.some(i => i.level === 'error')) return { issues };

  const group = { persons: s.persons.map(p => ({
    id: p.id,
    personType: p.personType || 'adult_working',
    profession: p.profession,
    connection: p.connection,
    needs_hospital: p.needs_hospital,
    specialist_need: p.specialist_need,
    education_need: p.education_need,
  })) };

  return {
    issues,
    input: {
      group,
      municipality: {
        capacity_total: cap.capacity_total!,
        settled_current: cap.settled_current!,
        tentative_claim: cap.tentative_claim || 0,
      },
      options: {
        include_tentative: s.options?.capacity?.include_tentative ?? true,
        allow_overflow: s.options?.capacity?.allow_overflow ?? false,
      },
      subweights: Object.keys(s.subweights).map(id => ({ id: id as 'capacity.core', weight: s.subweights[id] }))
    }
  };
}
