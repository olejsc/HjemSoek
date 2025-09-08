import type { WorkOpportunityInput, WorkOpportunityResult, WorkPersonTrace } from "../types";
import { isWorkEligible, confidenceFromEligible } from './eligibility';
import { clamp, round, sum } from "../utils";

// (groupSize helper removed after eligibility filtering change)

/** Compute chance subscore from unemployment (C = 100 − U). */
function chanceFromUnemployment(unemployment_rate?: number): number {
  if (typeof unemployment_rate !== "number") return 0;
  return clamp(100 - unemployment_rate, 0, 100);
}

/** Compute growth subscore from profession key in the municipality growth map. */
function growthFromProfession(profession: string | undefined, map: Record<string, number> | undefined): number {
  if (!profession || !map) return 0;
  const v = map[profession];
  return typeof v === "number" ? clamp(v, 0, 100) : 0;
}

/**
 * Score the Work Opportunity module (per-person, zeros-as-scores).
 * - Chance (Cᵢ) depends only on unemployment: Cᵢ = 100 − U
 * - Growth (Gᵢ) depends on the person's profession looking up the city's map
 * - Per-person composite: Sᵢ = w_c·Cᵢ + w_g·Gᵢ (w normalized)
 * - Group score: average of Sᵢ over all persons (N)
 */
export function scoreWorkOpportunity(input: WorkOpportunityInput): WorkOpportunityResult {
  const personsAll = Array.isArray(input?.group?.persons) ? input.group.persons : [];
  const eligiblePersons = personsAll.filter(p => isWorkEligible(p.personType));
  const N = eligiblePersons.length;

  if (N === 0) {
    return {
      score: 0,
      max_possible: 0,
      effective_score: 0,
      coverage: 0,
      subscores: [
        { id: "work.chance", weight: 0.5, normalized_weight: 0.5 },
        { id: "work.growth", weight: 0.5, normalized_weight: 0.5 },
      ],
      persons: eligiblePersons.map<WorkPersonTrace>(p => ({
        person_id: p.id,
        profession: p.profession ?? null,
        chance: 0,
        growth: 0,
        weights: { chance: 0.5, growth: 0.5 },
        composite: 0,
        max_possible: 100,
        explanation: '• Person er ikke kvalifisert for arbeid mulighet på grunn av person type.',
        flags: ['ineligible'],
      })),
      mode: "feasible",
      direction: "higher_better",
      explanation: "• Ingen kvalifiserte personer for arbeid mulighet. Poengsum er 0. Maks mulig er 0. Tillit er 0.",
      confidence: 0,
      trace: { inputs: { persons_total: personsAll.length, eligible: 0 } },
    };
  }

  const wo = input?.municipality?.work_opportunity || {};
  const U = wo.unemployment_rate;
  const growthMap = wo.profession_growth || {};

  const subweights = Array.isArray(input?.subweights) && input.subweights.length
    ? input.subweights
    : [
        { id: "work.chance" as const, weight: 0.5 },
        { id: "work.growth" as const, weight: 0.5 },
      ];

  const totalW = sum(subweights.map((s) => (s.weight ?? 0)));
  const wChance = totalW > 0 ? (subweights.find((s) => s.id === "work.chance")?.weight ?? 0.5) / totalW : 0.5;
  const wGrowth = totalW > 0 ? (subweights.find((s) => s.id === "work.growth")?.weight ?? 0.5) / totalW : 0.5;

  const rows: WorkPersonTrace[] = eligiblePersons.map((p) => {
    const C = chanceFromUnemployment(U);
    const G = growthFromProfession(p.profession, growthMap);
    const S = wChance * C + wGrowth * G;
    return {
      person_id: p.id,
      profession: p.profession ?? null,
      chance: C,
      growth: G,
      weights: { chance: wChance, growth: wGrowth },
      composite: S,
      max_possible: 100,
      explanation: [
        `• Sjanse er 100 minus arbeidsledighet lik ${typeof U === "number" ? U : "ikke oppgitt"} som gir ${round(C, 1)} prosent` ,
        `• Vekst er verdi i vekst kart for profesjon ${p.profession ?? "ikke oppgitt"} som gir ${round(G, 1)} prosent`,
        `• Sammensatt poeng for person er ${round(wChance * 100, 1)} prosent ganger sjanse pluss ${round(wGrowth * 100, 1)} prosent ganger vekst som gir ${round(S, 1)} prosent`,
      ].join("\n"),
      flags: [],
    };
  });

  const S_group = sum(rows.map((r) => r.composite)) / N;
  const confidence = confidenceFromEligible(N);

  return {
  score: S_group,
  max_possible: 100,
  effective_score: S_group,
  confidence,
    coverage: 1,
    subscores: [
      { id: "work.chance", weight: wChance, normalized_weight: wChance },
      { id: "work.growth", weight: wGrowth, normalized_weight: wGrowth },
    ],
    persons: rows,
    mode: "feasible",
    direction: "higher_better",
    explanation: [
      '• Arbeid mulighet per person. Høyere er bedre.',
      `• Delvekter er sjanse ${round(wChance * 100, 1)} prosent og vekst ${round(wGrowth * 100, 1)} prosent`,
      `• Kvalifiserte personer er ${N} av ${personsAll.length}. Gruppens poeng er gjennomsnitt av person poeng og er ${round(S_group, 1)} prosent`,
      `• Tillit er ${confidence}`,
    ].join("\n"),
    trace: {
      inputs: {
        persons_total: personsAll.map((p) => ({ id: p.id, personType: p.personType })),
        eligible_persons: eligiblePersons.map((p) => ({ id: p.id, profession: p.profession ?? null, personType: p.personType })),
        unemployment_rate: U ?? null,
        profession_growth: growthMap,
      },
      aggregation: { person_count: N, formula: "score = (1/N) · Σ Sᵢ,   Sᵢ = w_c·Cᵢ + w_g·Gᵢ" },
    },
  };
}
