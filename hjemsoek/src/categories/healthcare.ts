import type { HealthcareInput, HealthcareResult, HealthcareSubweight, HealthcareSubweightId, HealthcarePersonTrace } from '../types';
import { SPECIALIST_TREATMENT_TYPES } from '../types';
import { sum, round } from '../utils';

// Default subweights: equal hospital vs specialist
const DEFAULT_SUBWEIGHTS: HealthcareSubweight[] = [
  { id: 'healthcare.hospital', weight: 1 },
  { id: 'healthcare.specialist', weight: 1 },
];

// Tier scores
const TIER_SELF = 100;
const TIER_ADJ = 50;
const TIER_REGION = 25;

function tierScoreForHospital(targetId: string, input: HealthcareInput): number {
  const hc = input.municipality_healthcare_map[targetId];
  if (hc?.has_hospital) return TIER_SELF;
  // adjacency
  const neighbors = input.adjacency_map[targetId] || [];
  for (const n of neighbors) {
    if (input.municipality_healthcare_map[n]?.has_hospital) return TIER_ADJ;
  }
  // region
  const targetRegion = input.municipality_region_map[targetId];
  if (targetRegion) {
    for (const [mid, reg] of Object.entries(input.municipality_region_map)) {
      if (reg === targetRegion && input.municipality_healthcare_map[mid]?.has_hospital) {
        // ensure not already self (handled) or adjacent precedence; region fallback only
        return TIER_REGION;
      }
    }
  }
  return 0;
}

function tierScoreForSpecialist(targetId: string, specialist: string, input: HealthcareInput): number {
  const hc = input.municipality_healthcare_map[targetId];
  if (hc?.specialist_facilities?.includes(specialist)) return TIER_SELF;
  // adjacency
  const neighbors = input.adjacency_map[targetId] || [];
  for (const n of neighbors) {
    const hcN = input.municipality_healthcare_map[n];
    if (hcN?.specialist_facilities?.includes(specialist)) return TIER_ADJ;
  }
  // region
  const targetRegion = input.municipality_region_map[targetId];
  if (targetRegion) {
    for (const [mid, reg] of Object.entries(input.municipality_region_map)) {
      if (reg === targetRegion) {
        const hcM = input.municipality_healthcare_map[mid];
        if (hcM?.specialist_facilities?.includes(specialist)) return TIER_REGION;
      }
    }
  }
  return 0;
}

export function scoreHealthcare(input: HealthcareInput): HealthcareResult {
  const personsAll = Array.isArray(input.group?.persons) ? input.group.persons : [];
  // persons with any healthcare needs
  const persons = personsAll.filter(p => p?.needs_hospital || !!p?.specialist_need);
  const N = persons.length;

  if (N === 0) {
    return {
      score: 0,
      effective_score: 0,
      max_possible: 0,
      confidence: 0,
      subscores: DEFAULT_SUBWEIGHTS.map(sw => ({ id: sw.id, weight: 0.5, normalized_weight: 0.5, score: 0, contribution: 0 })),
      persons: [],
      mode: 'feasible',
      direction: 'higher_better',
      explanation: '• Ingen personer med behov for helsetjenester. Poengsum er 0. Maks mulig er 0. Tillit er 0.',
      trace: { inputs: { persons_total: personsAll.length, included: 0 } },
    };
  }

  const cfg = (Array.isArray(input.subweights) && input.subweights.length ? input.subweights : DEFAULT_SUBWEIGHTS)
    .filter(sw => sw.weight > 0);
  // If user disables one subweight entirely, handle single-component normalization
  const effectiveSubweights: HealthcareSubweight[] = cfg.length ? cfg : DEFAULT_SUBWEIGHTS;
  const totalW = sum(effectiveSubweights.map(s => s.weight));
  const normalized: Record<HealthcareSubweightId, number> = {
    'healthcare.hospital': (effectiveSubweights.find(s => s.id === 'healthcare.hospital')?.weight || 0) / totalW,
    'healthcare.specialist': (effectiveSubweights.find(s => s.id === 'healthcare.specialist')?.weight || 0) / totalW,
  } as any;

  // Pre-compute tier scores for hospital & each specialist needed to avoid recomputing per person for deterministic environment
  const hospitalTierScore = tierScoreForHospital(input.target_municipality_id, input);

  // For specialists, cache by specialist id
  const specialistTierCache: Record<string, number> = {};
  function specialistTier(s: string): number {
    if (!(s in specialistTierCache)) {
      specialistTierCache[s] = tierScoreForSpecialist(input.target_municipality_id, s, input);
    }
    return specialistTierCache[s];
  }

  const personTraces: HealthcarePersonTrace[] = persons.map(p => {
    const needsHospital = !!p.needs_hospital;
    const specialistNeed = typeof p.specialist_need === 'string' ? p.specialist_need : null;

    // Validate specialistNeed is in list
    const validSpecialist = specialistNeed && SPECIALIST_TREATMENT_TYPES.includes(specialistNeed)
      ? specialistNeed
      : null;

    let hospitalScore: number | undefined = undefined;
    let specialistScore: number | undefined = undefined;

    if (needsHospital && normalized['healthcare.hospital'] > 0) {
      hospitalScore = hospitalTierScore;
    }
    if (validSpecialist && normalized['healthcare.specialist'] > 0) {
      specialistScore = specialistTier(validSpecialist);
    }

    // Composite: average of enabled, needed components by normalized module weights among enabled components only
    // We already normalized across enabled subweights; for persons missing one component because they do not need it, we treat missing as not part of average.
    const components: Array<{ w: number; s: number }> = [];
    if (hospitalScore != null && needsHospital) components.push({ w: normalized['healthcare.hospital'], s: hospitalScore });
    if (specialistScore != null && validSpecialist) components.push({ w: normalized['healthcare.specialist'], s: specialistScore });

    // Re-normalize person-level weights among present components to avoid diluting when one not needed.
    const sumWPerson = sum(components.map(c => c.w));
    const composite = sumWPerson > 0 ? sum(components.map(c => (c.w / sumWPerson) * c.s)) : 0;

    const explanationLines = [
      `• Behov: sykehus=${needsHospital ? 'ja' : 'nei'}, spesialist=${validSpecialist || 'ingen'}`,
    ];
    if (needsHospital) explanationLines.push(`• Nivå poeng for sykehus er ${hospitalScore}`);
    if (validSpecialist) explanationLines.push(`• Nivå poeng for spesialist '${validSpecialist}' er ${specialistScore}`);
    explanationLines.push(`• Sammensatt poeng for person er ${round(composite,1)} prosent`);

    return {
      person_id: p.id,
      needs_hospital: needsHospital,
      specialist_need: validSpecialist || null,
      hospital_score: hospitalScore,
      specialist_score: specialistScore,
      composite,
      explanation: explanationLines.map(l => '• ' + l.replace(/^•\s?/, '')).join('\n'),
    };
  });

  // Aggregate per subweight across persons (average of relevant persons that actually needed that component)
  const hospitalScores: number[] = [];
  const specialistScores: number[] = [];
  for (const tr of personTraces) {
    if (tr.needs_hospital && tr.hospital_score != null) hospitalScores.push(tr.hospital_score);
    if (tr.specialist_need && tr.specialist_score != null) specialistScores.push(tr.specialist_score);
  }

  const avgHospital = hospitalScores.length ? sum(hospitalScores)/hospitalScores.length : 0;
  const avgSpecialist = specialistScores.length ? sum(specialistScores)/specialistScores.length : 0;

  const subscoreRows = [
    { id: 'healthcare.hospital' as const, base: avgHospital },
    { id: 'healthcare.specialist' as const, base: avgSpecialist },
  ];

  const contributions = subscoreRows.map(r => {
    const w = normalized[r.id];
    return {
      id: r.id,
      weight: w,
      normalized_weight: w,
      score: r.base,
      contribution: w * r.base,
    };
  });

  // Module score: average per-person composites (consistent with other modules) OR weighted combination of subscore averages?
  // Spec: person-level averaging. We'll average composites.
  const groupScore = sum(personTraces.map(p => p.composite)) / N;

  const explanation = [
    '• Helsepoeng. Høyere er bedre.',
    `• Personer inkludert er ${N} av ${personsAll.length}.`,
    `• Delvekter: ${contributions.map(c => `${c.id} er ${round(c.weight*100,1)} prosent`).join(', ')}`,
    `• Gjennomsnitt sykehus er ${round(avgHospital,1)} prosent. Gjennomsnitt spesialist er ${round(avgSpecialist,1)} prosent`,
    `• Gruppens poeng (gjennomsnitt av person sammensatte) er ${round(groupScore,1)} prosent`,
  ].join('\n');

  return {
    score: groupScore,
    effective_score: groupScore,
    max_possible: 100,
    confidence: 1,
    subscores: contributions,
    persons: personTraces,
    mode: 'feasible',
    direction: 'higher_better',
    explanation,
    trace: {
      inputs: {
        target: input.target_municipality_id,
        persons_total: personsAll.length,
        included_persons: persons.map(p => p.id),
        subweights: normalized,
      },
      tiers: { hospitalTierScore, specialistTierCache },
      aggregation: { formula: 'score = avg(person_composite)' },
    },
  };
}

export default scoreHealthcare;
