import type { EducationInput, EducationResult, EducationSubweight, EducationSubweightId, EducationFacilityType, EducationPersonTrace } from '../types';
import { educationNeedsList } from './eligibility';
import { round, sum } from '../utils';

// Default subweights: equal across all facilities
const DEFAULT_SUBWEIGHTS: EducationSubweight[] = [
  { id: 'education.primary_school', weight: 1 },
  { id: 'education.high_school', weight: 1 },
  { id: 'education.university', weight: 1 },
  { id: 'education.adult_language', weight: 1 },
];

// Tier constants (same as healthcare precedence)
const TIER_SELF = 100;
const TIER_ADJ = 50;
const TIER_REGION = 25;

/** Map facility type -> municipality boolean property name. */
const FACILITY_FLAG: Record<EducationFacilityType, keyof EducationInput['municipality_education_map'][string]> = {
  primary_school: 'has_primary_school',
  high_school: 'has_high_school',
  university: 'has_university',
  adult_language: 'has_adult_language',
};

function tierScoreForFacility(targetId: string, facility: EducationFacilityType, input: EducationInput): number {
  const facilities = input.municipality_education_map;
  const target = facilities[targetId];
  if (target && target[FACILITY_FLAG[facility]]) return TIER_SELF;
  // adjacency
  const neighbors = input.adjacency_map[targetId] || [];
  for (const n of neighbors) {
    const m = facilities[n];
    if (m && m[FACILITY_FLAG[facility]]) return TIER_ADJ;
  }
  // region fallback
  const targetRegion = input.municipality_region_map[targetId];
  if (targetRegion) {
    for (const [mid, region] of Object.entries(input.municipality_region_map)) {
      if (region === targetRegion) {
        const m = facilities[mid];
        if (m && m[FACILITY_FLAG[facility]]) return TIER_REGION;
      }
    }
  }
  return 0;
}

export function scoreEducation(input: EducationInput): EducationResult {
  const personsAll = Array.isArray(input.group?.persons) ? input.group.persons : [];
  // Only persons with a declared education_need that is allowed for their personType are included
  const persons = personsAll.filter(p => {
    if (!p.education_need) return false;
    const allowed = educationNeedsList(p.personType);
    return allowed.includes(p.education_need as EducationFacilityType);
  });
  const N = persons.length;

  if (N === 0) {
    return {
      score: 0,
      effective_score: 0,
      max_possible: 0,
      confidence: 0,
      subscores: DEFAULT_SUBWEIGHTS.map(sw => ({ id: sw.id as EducationSubweightId, weight: 1/DEFAULT_SUBWEIGHTS.length, normalized_weight: 1/DEFAULT_SUBWEIGHTS.length, score: 0, contribution: 0 })),
      persons: [],
      mode: 'feasible',
      direction: 'higher_better',
      explanation: '• Ingen personer med behov for utdanning. Poengsum er 0. Maks mulig er 0. Tillit er 0.',
      trace: { inputs: { persons_total: personsAll.length, included: 0 } },
    };
  }

  // Filter/validate subweights (ignore zero-weight entries; fallback to default if all removed)
  const cfg = (Array.isArray(input.subweights) && input.subweights.length ? input.subweights : DEFAULT_SUBWEIGHTS).filter(sw => sw.weight > 0);
  const effectiveSubweights: EducationSubweight[] = cfg.length ? cfg : DEFAULT_SUBWEIGHTS;
  const totalW = sum(effectiveSubweights.map(s => s.weight));
  const normalized: Record<EducationSubweightId, number> = {
    'education.primary_school': (effectiveSubweights.find(s => s.id === 'education.primary_school')?.weight || 0) / totalW,
    'education.high_school': (effectiveSubweights.find(s => s.id === 'education.high_school')?.weight || 0) / totalW,
    'education.university': (effectiveSubweights.find(s => s.id === 'education.university')?.weight || 0) / totalW,
    'education.adult_language': (effectiveSubweights.find(s => s.id === 'education.adult_language')?.weight || 0) / totalW,
  } as any;

  // Precompute tier scores per facility (cache)
  const tierCache: Record<EducationFacilityType, number> = {
    primary_school: tierScoreForFacility(input.target_municipality_id, 'primary_school', input),
    high_school: tierScoreForFacility(input.target_municipality_id, 'high_school', input),
    university: tierScoreForFacility(input.target_municipality_id, 'university', input),
    adult_language: tierScoreForFacility(input.target_municipality_id, 'adult_language', input),
  };

  // Per-person traces: validate need belongs to allowed set for personType
  const personTraces: EducationPersonTrace[] = persons.map(p => {
    const allowed = educationNeedsList(p.personType);
    const need = p.education_need as EducationFacilityType; // already validated by inclusion filter
    let tier: number | undefined = undefined;
    if (need) {
      tier = tierCache[need];
    }
    const explanationLines: string[] = [
      `• Oppgitt behov: ${p.education_need || 'ingen'}`,
      `• Tillatte behov for person type ${p.personType}: ${allowed.join(',') || 'ingen'}`,
    ];
    if (need) explanationLines.push(`• Nivå poeng for ${need} er ${tier}`);
    else if (p.education_need) explanationLines.push('• Oppgitt behov er ikke tillatt for denne person typen. Det blir ignorert.');
    explanationLines.push(`• Bidrag fra person er ${tier ?? 0}`);
    return {
      person_id: p.id,
      education_need: need,
      tier_score: need ? tier : 0,
      explanation: explanationLines.map(l => '• ' + l.replace(/^•\s?/, '')).join('\n'),
    };
  });

  // Aggregate per facility: average tier over persons needing that facility (and need allowed)
  const facilityKeys: { facility: EducationFacilityType; subId: EducationSubweightId }[] = [
    { facility: 'primary_school', subId: 'education.primary_school' },
    { facility: 'high_school', subId: 'education.high_school' },
    { facility: 'university', subId: 'education.university' },
    { facility: 'adult_language', subId: 'education.adult_language' },
  ];
  const sums: Record<EducationSubweightId, number> = {
    'education.primary_school': 0,
    'education.high_school': 0,
    'education.university': 0,
    'education.adult_language': 0,
  };
  const counts: Record<EducationSubweightId, number> = { ...sums } as any;

  for (const tr of personTraces) {
    if (!tr.education_need) continue; // invalid or none
    const subId = ('education.' + tr.education_need) as EducationSubweightId;
    sums[subId] += tr.tier_score || 0;
    counts[subId] += 1;
  }
  for (const k of Object.keys(sums) as EducationSubweightId[]) {
    if (counts[k] > 0) sums[k] = sums[k] / counts[k];
  }

  const subscoreRows = facilityKeys.map(row => {
    const w = normalized[row.subId];
    const avg = sums[row.subId];
    return { id: row.subId, weight: w, normalized_weight: w, score: avg, contribution: w * avg };
  });

  const score = sum(subscoreRows.map(r => r.contribution));

  const explanationLines = [
    '• Utdanningspoeng. Høyere er bedre.',
    `• Personer inkludert med oppgitte behov er ${N} av ${personsAll.length}.`,
    `• Delvekter: ${subscoreRows.map(c => `${c.id} er ${round(c.weight*100,1)} prosent`).join(', ')}`,
    `• Gjennomsnitt per utdanningstilbud: ${subscoreRows.map(c => `${c.id} er ${round(c.score,1)}`).join(', ')}`,
    `• Vektet total er ${round(score,1)} prosent`,
  ];

  return {
    score,
    effective_score: score,
    max_possible: 100,
    confidence: 1,
    subscores: subscoreRows,
    persons: personTraces,
    mode: 'feasible',
    direction: 'higher_better',
    explanation: explanationLines.join('\n'),
    trace: {
      inputs: {
        target: input.target_municipality_id,
        persons_total: personsAll.length,
        included_persons: personTraces.map(p => p.person_id),
        subweights: normalized,
      },
      tier_cache: tierCache,
      aggregation: { formula: 'score = Σ ŵ_f · avg_tier_f' },
    },
  };
}

export default scoreEducation;
