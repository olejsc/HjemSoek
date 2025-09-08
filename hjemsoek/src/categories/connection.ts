// Connection scoring module (moved from src/connection.ts)
import type { ConnectionInput, ConnectionResult, ConnectionSubweight, ConnectionSubweightId, ConnectionPersonTrace, ConnectionRelation } from '../types';
import { allowedRelations, confidenceFromEligible } from '../categories/eligibility';
import { round, sum } from '../utils';

// Default relation subweights (equal distribution)
const DEFAULT_SUBWEIGHTS: ConnectionSubweight[] = [
  { id: 'connection.friend', weight: 1 },
  { id: 'connection.close_family', weight: 1 },
  { id: 'connection.relative', weight: 1 },
  { id: 'connection.workplace', weight: 1 },
  { id: 'connection.school_place', weight: 1 },
];

// Region-based base scores by relation kind (when person declares a region connection that includes target municipality)
const REGION_RELATION_BASE: Record<ConnectionRelation, number> = {
  friend: 10,
  close_family: 75,
  relative: 25,
  workplace: 25,
  school_place: 25,
};

/** Determine match level and base score for a given person connection relative to target municipality. */
function evaluatePerson(
  target: string,
  municipalityRegion: Record<string, string>,
  adjacency: Record<string, string[]>,
  declared: { municipality_id?: string; region_id?: string; relation?: ConnectionRelation } | undefined
): { match_level: 'exact' | 'neighbor' | 'region' | 'none'; base_score: number; explanation: string } {
  if (!declared) {
  return { match_level: 'none', base_score: 0, explanation: '• Ingen tilknytning oppgitt.' };
  }
  if (!declared.relation) {
    return { match_level: 'none', base_score: 0, explanation: '• Relasjon ikke valgt ennå.' };
  }

    // Person declared a municipality
  if (declared.municipality_id) {
    if (declared.municipality_id === target) {
  return { match_level: 'exact', base_score: 100, explanation: '• Eksakt treff på kommune gir 100.' };
    }
    // neighbor?
    const neighbors = adjacency[target] || [];
    if (neighbors.includes(declared.municipality_id)) {
  return { match_level: 'neighbor', base_score: 50, explanation: '• Treff på nabokommune gir 50.' };
    }
    // same region (but not same municipality)
    const targetRegion = municipalityRegion[target];
    const declaredRegion = municipalityRegion[declared.municipality_id];
    if (targetRegion && declaredRegion && targetRegion === declaredRegion) {
  return { match_level: 'region', base_score: 10, explanation: '• Samme region men annen kommune gir 10.' };
    }
  return { match_level: 'none', base_score: 0, explanation: '• Kommunetilknytning passer ikke mål kommune, naboer eller region.' };
  }

  // Person declared a region
  if (declared.region_id) {
    const targetRegion = municipalityRegion[target];
    if (targetRegion && targetRegion === declared.region_id) {
      const relBase = REGION_RELATION_BASE[declared.relation];
  return { match_level: 'region', base_score: relBase, explanation: `• Region treff med relasjon ${declared.relation} gir ${relBase}.` };
    }
    // adjacency to any municipality in region but not inside region => explicitly zero per spec
  return { match_level: 'none', base_score: 0, explanation: '• Regiontilknytning omfatter ikke mål kommune og gir 0.' };
  }
  return { match_level: 'none', base_score: 0, explanation: '• Ugyldig tilknytningsoppføring.' };
}

export function scoreConnection(input: ConnectionInput): ConnectionResult {
  const personsAll = Array.isArray(input.group?.persons) ? input.group.persons : [];
  // Eligible for connection impact = person types that allow at least one relation (non-baby)
  const eligible = personsAll.filter(p => allowedRelations(p.personType).size > 0);
  const N = eligible.length;

  if (personsAll.length === 0) {
    return {
      score: 0,
      effective_score: 0,
      max_possible: 0,
      subscores: DEFAULT_SUBWEIGHTS.map(sw => ({ id: sw.id, weight: 1 / DEFAULT_SUBWEIGHTS.length, normalized_weight: 1 / DEFAULT_SUBWEIGHTS.length, score: 0, contribution: 0 })),
      persons: [],
      mode: 'feasible',
      direction: 'higher_better',
  explanation: '• Ingen personer i gruppen. Poengsum er 0. Maks mulig er 0.',
      trace: { inputs: { persons: 0, target: input.target_municipality_id } },
    } as ConnectionResult;
  }
  if (N === 0) {
    return {
      score: 0,
      effective_score: 0,
      max_possible: 0, // no eligible persons
      subscores: DEFAULT_SUBWEIGHTS.map(sw => ({ id: sw.id, weight: 1 / DEFAULT_SUBWEIGHTS.length, normalized_weight: 1 / DEFAULT_SUBWEIGHTS.length, score: 0, contribution: 0 })),
      persons: personsAll.map(p => ({
        person_id: p.id,
        relation: p.connection?.relation,
        declared: p.connection || null,
        match_level: 'none',
        base_score: 0,
  explanation: '• Person er ikke kvalifisert for tilknytningspoeng. Ingen tillatte relasjoner.'
      })),
      mode: 'feasible',
      direction: 'higher_better',
  explanation: '• Ingen kvalifiserte personer for tilknytning. Poengsum er 0. Maks mulig er 0. Tillit er 0.',
      confidence: 0,
      trace: { inputs: { persons_total: personsAll.length, eligible: 0 } },
    } as ConnectionResult;
  }

  const subweights = (Array.isArray(input.subweights) && input.subweights.length ? input.subweights : DEFAULT_SUBWEIGHTS);
  const totalW = sum(subweights.map(s => s.weight || 0)) || 1;
  const normalized: Record<ConnectionSubweightId, number> = {
    'connection.friend': (subweights.find(s => s.id === 'connection.friend')?.weight || 0) / totalW,
    'connection.close_family': (subweights.find(s => s.id === 'connection.close_family')?.weight || 0) / totalW,
    'connection.relative': (subweights.find(s => s.id === 'connection.relative')?.weight || 0) / totalW,
    'connection.workplace': (subweights.find(s => s.id === 'connection.workplace')?.weight || 0) / totalW,
    'connection.school_place': (subweights.find(s => s.id === 'connection.school_place')?.weight || 0) / totalW,
  } as any;

  // Gather per-person traces
  const personTraces: ConnectionPersonTrace[] = eligible.map(p => {
  const declared = p.connection ? { ...p.connection } : undefined;
    // Enforce relation eligibility: if relation not allowed for this type, ignore declared
  if (declared && declared.relation && !allowedRelations(p.personType).has(declared.relation)) {
      return {
        person_id: p.id,
        relation: declared.relation,
        declared: declared,
        match_level: 'none',
        base_score: 0,
  explanation: '• Oppgitt relasjon er ikke tillatt for denne person typen. Den blir ignorert.'
      };
    }
    const { match_level, base_score, explanation } = evaluatePerson(
      input.target_municipality_id,
      input.municipality_region_map,
      input.adjacency_map,
      declared
    );
    return {
      person_id: p.id,
      relation: declared?.relation,
      declared: declared || null,
      match_level,
      base_score,
      explanation: [
  `• Oppgitt: ${declared ? (declared.municipality_id ? 'kommune=' + declared.municipality_id : 'region=' + declared.region_id) : 'ingen'}`,
        explanation,
  `• Treff nivå er ${match_level}. Grunn poeng er ${round(base_score,1)}`,
      ].join('\n')
    };
  });

  // Aggregate per relation: average base scores over persons that have that relation
  const relationKinds: { key: ConnectionRelation; subId: ConnectionSubweightId }[] = [
    { key: 'friend', subId: 'connection.friend' },
    { key: 'close_family', subId: 'connection.close_family' },
    { key: 'relative', subId: 'connection.relative' },
    { key: 'workplace', subId: 'connection.workplace' },
    { key: 'school_place', subId: 'connection.school_place' },
  ];
  const relationScores: Record<ConnectionSubweightId, number> = {
    'connection.friend': 0,
    'connection.close_family': 0,
    'connection.relative': 0,
    'connection.workplace': 0,
    'connection.school_place': 0,
  };
  const counts: Record<ConnectionSubweightId, number> = { ...relationScores } as any;
  for (const trace of personTraces) {
    if (!trace.declared || !trace.relation) continue;
    const subId = ('connection.' + trace.relation) as ConnectionSubweightId;
    relationScores[subId] += trace.base_score;
    counts[subId] += 1;
  }
  for (const k of Object.keys(relationScores) as ConnectionSubweightId[]) {
    if (counts[k] > 0) relationScores[k] = relationScores[k] / counts[k];
  }
  // Weighted total
  const contributions = relationKinds.map(rk => {
    const w = normalized[rk.subId];
    const rs = relationScores[rk.subId];
    return { id: rk.subId, weight: w, normalized_weight: w, score: rs, contribution: w * rs };
  });
  const score = sum(contributions.map(c => c.contribution));
  const confidence = confidenceFromEligible(N);
  const explanationLines = [
    '• Tilknytningspoeng. Høyere er bedre.',
    `• Delvekter: ${contributions.map(c => `${c.id} er ${round(c.weight*100,1)} prosent`).join(', ')}`,
    `• Gjennomsnitt per relasjon: ${contributions.map(c => `${c.id} er ${round(c.score,1)}`).join(', ')}`,
    `• Vektet total er ${round(score,1)} prosent`,
  ];
  return {
    score,
    effective_score: score,
    max_possible: 100,
    confidence,
    subscores: contributions.map(c => ({ ...c })),
    persons: personTraces,
    mode: 'feasible',
    direction: 'higher_better',
    explanation: explanationLines.join('\n'),
    trace: {
      inputs: {
        target: input.target_municipality_id,
        persons_total: personsAll.map(p => ({ id: p.id, personType: p.personType })),
        eligible_persons: eligible.map(p => ({ id: p.id, personType: p.personType, connection: p.connection || null })),
        weights: normalized,
      },
      aggregation: { formula: 'score = Σ ŵ_r · avg_base_score_r' },
      relation_counts: counts,
    }
  } as ConnectionResult;
}

export default scoreConnection;export * from './connection';