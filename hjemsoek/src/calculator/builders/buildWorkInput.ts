import type { WorkBuild, CalculatorScenarioBase, ValidationIssue } from '../types';
import type { WorkGrowthNormalizationConfig } from '../../types';

export function buildWorkInput(s: CalculatorScenarioBase): WorkBuild {
  const issues: ValidationIssue[] = [];
  const m = s.municipalities[0];
  if (!m) {
    issues.push({ code: 'NO_MUNICIPALITY', level: 'error', message: 'Ingen kommune definert', step: 'municipalities' });
    return { issues };
  }
  if (m.unemployment_rate != null && (m.unemployment_rate < 0 || m.unemployment_rate > 100)) {
    issues.push({ code: 'INVALID_UNEMPLOYMENT', level: 'error', message: 'Arbeidsledighet må være 0..100', step: 'municipalities' });
  }
  if (issues.some(i => i.level === 'error')) return { issues };

  const group = { persons: s.persons.map(p => ({ id: p.id, personType: p.personType || 'adult_working', profession: p.profession })) };
  const profession_history: Record<string, {
    number_of_employees_in_profession_5_years_ago?: number;
    number_of_employees_in_profession_now?: number;
    percentage_of_municipality_workforce_5_years_ago?: number;
    percentage_of_municipality_workforce_now?: number;
  }> = {};
  for (const [prof, row] of Object.entries(m.work?.profession_history || {})) profession_history[prof] = { ...row };

  return {
    issues,
    input: {
      group,
      municipality: { work_opportunity: { unemployment_rate: m.unemployment_rate, profession_history } },
      subweights: Object.keys(s.subweights).map(id => ({ id: id as 'work.chance' | 'work.growth', weight: s.subweights[id] })),
      growth_normalization: s.options?.work as Partial<WorkGrowthNormalizationConfig>,
    }
  };
}
