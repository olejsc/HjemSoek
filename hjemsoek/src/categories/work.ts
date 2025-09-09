import type { WorkOpportunityInput, WorkOpportunityResult, WorkPersonTrace, WorkGrowthNormalizationConfig } from "../types";
import { isWorkEligible, confidenceFromEligible } from './eligibility';
import { clamp, round, sum } from "../utils";

// (groupSize helper removed after eligibility filtering change)

/** Compute chance subscore from unemployment (C = 100 − U). */
function chanceFromUnemployment(unemployment_rate?: number): number {
  if (typeof unemployment_rate !== "number") return 0;
  return clamp(100 - unemployment_rate, 0, 100);
}

/** Default normalization config */
const DEFAULT_NORMALIZATION: WorkGrowthNormalizationConfig = {
  tinyBaseThreshold: 2,
  beta_boost_s1: 0.4,
  damp_s4: 0.5,
  gamma_share: 0.3,
  cap_factor: 1.5,
  final_cap: 200,
  k_abs_scale: 'TH_abs',
  k_boost_scale: 'TH_abs',
  share_scale_mode: 'TH_share_or_5pp'
};

interface NormalizationThresholds { TH_abs: number; TH_pct: number; TH_share: number; }

/** Compute thresholds median + MAD (robust). */
function computeThreshold(values: number[]): { median: number; mad: number; threshold: number } {
  if (!values.length) return { median: 0, mad: 0, threshold: 0 };
  const sorted = [...values].sort((a,b)=>a-b);
  const mid = Math.floor(sorted.length/2);
  const median = sorted.length %2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2;
  const deviations = sorted.map(v => Math.abs(v - median));
  const dSorted = deviations.sort((a,b)=>a-b);
  const midD = Math.floor(dSorted.length/2);
  const mad = dSorted.length ? (dSorted.length %2 ? dSorted[midD] : (dSorted[midD-1]+dSorted[midD])/2) : 0;
  // threshold = median + MAD; fallback if MAD=0 => median (unchanged)
  const threshold = mad === 0 ? median : median + mad;
  return { median, mad, threshold };
}

/** Growth normalization returning adjusted (0..100 capped) and trace factors. */
interface ProfessionHistoryEntry {
  number_of_employees_in_profession_5_years_ago?: number;
  number_of_employees_in_profession_now?: number;
  percentage_of_municipality_workforce_5_years_ago?: number;
  percentage_of_municipality_workforce_now?: number;
  workforce_change_past_5_years?: number;
}

function adjustedGrowth(
  profession: string | undefined,
  history: Record<string, ProfessionHistoryEntry> | undefined,
  thresholds: NormalizationThresholds | undefined,
  config: WorkGrowthNormalizationConfig
) {
  if (!profession) return { growth: 0 };
  const hist = history?.[profession];
  if (!hist) return { growth: 0 }; // no data => zero growth contribution
  const P0_raw = hist.number_of_employees_in_profession_5_years_ago ?? 0;
  const P1 = hist.number_of_employees_in_profession_now ?? 0;
  const share0 = hist.percentage_of_municipality_workforce_5_years_ago ?? 0;
  const share1 = hist.percentage_of_municipality_workforce_now ?? 0;
  // provided workforce_change_past_5_years intentionally ignored per spec (recomputed used)
  const P0_eff = P0_raw === 0 ? 1 : P0_raw;
  const deltaN = P1 - P0_eff;
  const recomputedPct = P0_eff === 0 ? 0 : ((P1 - P0_eff) / P0_eff) * 100;
  const negative_growth = recomputedPct < 0;
  const positive_pct = negative_growth ? 0 : recomputedPct;
  const magnitudePct = Math.abs(recomputedPct);
  const delta_share_raw = share1 - share0;
  const delta_share = delta_share_raw > 0 ? delta_share_raw : 0;

  if (!thresholds) {
    // No thresholds (single or no history entries) => map positive_pct directly capped 100
    const simple = negative_growth ? 0 : Math.min(positive_pct, 100);
    return { growth: simple };
  }
  const { TH_abs, TH_pct, TH_share } = thresholds;
  const bigAbs = Math.abs(deltaN) >= TH_abs;
  const bigPct = magnitudePct >= TH_pct;
  let scenario: 1|2|3|4 = 2;
  if (!bigPct && bigAbs) scenario = 1; else if (bigPct && bigAbs) scenario = 3; else if (bigPct && !bigAbs) scenario = 4; else scenario = 2;
  const tiny_base = P0_raw < config.tinyBaseThreshold;

  // scales
  const K_abs = typeof config.k_abs_scale === 'number' ? config.k_abs_scale : TH_abs || 1;
  const K_boost = typeof config.k_boost_scale === 'number' ? config.k_boost_scale : TH_abs || 1;
  const S_share = typeof config.share_scale_mode === 'number' ? config.share_scale_mode : Math.max(TH_share || 0, 5);

  const F_abs = Math.abs(deltaN) / (Math.abs(deltaN) + (K_abs <=0?1:K_abs));
  const F_base = tiny_base ? (P0_raw / config.tinyBaseThreshold) : 1;
  const F_shareRaw = delta_share / (delta_share + (S_share<=0?1:S_share));
  const F_struct = 1 + config.gamma_share * F_shareRaw;
  let F_scen = 1;
  if (scenario === 1) {
    F_scen = 1 + config.beta_boost_s1 * (Math.abs(deltaN) / (Math.abs(deltaN) + (K_boost<=0?1:K_boost)));
  } else if (scenario === 4) {
    F_scen = config.damp_s4 * F_base; // additional penalty
  } else {
    F_scen = 1; // scenarios 2 & 3 neutral per spec
  }
  const F_total_raw = F_scen * F_abs * F_struct * F_base;
  const F_total = Math.min(F_total_raw, config.cap_factor);
  const adjusted_raw = positive_pct * F_total; // may exceed 100
  const adjusted_trace = Math.min(adjusted_raw, config.final_cap);
  const adjusted_for_score = Math.min(adjusted_raw, 100);
  const finalGrowth = negative_growth ? 0 : adjusted_for_score; // negative growth floors to 0

  return {
  growth: clamp(finalGrowth,0,100),
    adjusted_raw: adjusted_trace,
    scenario,
    factors: {
      P0_raw, P0_eff, P1, deltaN, recomputed_pct: recomputedPct, positive_pct,
      share0, share1, delta_share_raw, delta_share,
      thresholds: { TH_abs, TH_pct, TH_share },
      tiny_base, negative_growth,
      F_scen, F_abs, F_base, F_shareRaw, F_struct,
      F_total_raw, F_total,
      params: config
    }
  };
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
  const history = wo.profession_history;
  const normConfig: WorkGrowthNormalizationConfig = { ...DEFAULT_NORMALIZATION, ...input.growth_normalization };

  // Precompute thresholds if history present
  let thresholds: NormalizationThresholds | undefined;
  if (history) {
    const absChanges: number[] = [];
    const pctMagnitudes: number[] = [];
    const shareDeltasPos: number[] = [];
    for (const key of Object.keys(history)) {
      const h = history[key];
      if (!h) continue;
      const P0_raw = h.number_of_employees_in_profession_5_years_ago ?? 0;
      const P1 = h.number_of_employees_in_profession_now ?? 0;
      const P0_eff = P0_raw === 0 ? 1 : P0_raw;
      const deltaN = P1 - P0_eff;
      absChanges.push(Math.abs(deltaN));
      const recomputedPct = P0_eff === 0 ? 0 : ((P1 - P0_eff) / P0_eff) * 100;
      pctMagnitudes.push(Math.abs(recomputedPct));
      const share0 = h.percentage_of_municipality_workforce_5_years_ago ?? 0;
      const share1 = h.percentage_of_municipality_workforce_now ?? 0;
      const dShare = share1 - share0;
      if (dShare > 0) shareDeltasPos.push(dShare);
    }
    const tAbs = computeThreshold(absChanges).threshold;
    const tPct = computeThreshold(pctMagnitudes).threshold;
    const tShare = computeThreshold(shareDeltasPos).threshold;
    thresholds = { TH_abs: tAbs, TH_pct: tPct, TH_share: tShare };
  }

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
  const adj = adjustedGrowth(p.profession, history, thresholds, normConfig);
    const G = adj.growth; // capped 0..100
    const S = wChance * C + wGrowth * G;
    const explanationLines: string[] = [
      `• Sjanse er 100 minus arbeidsledighet lik ${typeof U === "number" ? U : "ikke oppgitt"} som gir ${round(C, 1)} prosent`,
      `• Vekst (justert) for profesjon ${p.profession ?? 'ikke oppgitt'} er ${round(G,1)} prosent`,
      `• Sammensatt poeng for person er ${round(wChance * 100, 1)}% * sjanse + ${round(wGrowth * 100, 1)}% * vekst = ${round(S,1)} prosent`
    ];
    if (adj.scenario) {
      explanationLines.push(`• Scenario ${adj.scenario} normalisering anvendt`);
    }
    // Legg til formel-detaljer (norske variabelnavn) hvis vi har faktorer (dvs. historikk + terskler)
    if (adj.factors) {
      const f = adj.factors;
      const pct = f.recomputed_pct;
      const pctPos = f.positive_pct;
      explanationLines.push(
        [
          '• Formler (vekst):',
          `  - U (arbeidsledighet) = ${typeof U === 'number' ? U : 'mangler'}`,
          '  - C (sjanse) = 100 − U',
          `    ⇒ C = 100 − ${typeof U === 'number' ? U : '0'} = ${round(C,1)}`,
          `  - P0 (ansatte for 5 år siden, rå) = ${f.P0_raw}`,
          `  - P0_eff (justert basis, hvis P0=0 ⇒ 1) = ${f.P0_eff}`,
          `  - P1 (ansatte nå) = ${f.P1}`,
          `  - ΔN (absolutt endring) = P1 − P0_eff = ${f.P1} − ${f.P0_eff} = ${f.deltaN}`,
          `  - pct (prosentendring) = ((P1 − P0_eff)/P0_eff)*100 = ${round(pct,2)}%`,
          `  - pct⁺ = max(0, pct) = ${round(pctPos,2)}%`,
          `  - andel0 = ${round(f.share0 ?? 0,3)}%, andel1 = ${round(f.share1 ?? 0,3)}%`,
          `  - Δandel = max(0, andel1 − andel0) = ${round(f.delta_share,3)} pp`,
          `  - Grenseverdier: Grenseverdi_abs=${round(f.thresholds.TH_abs,3)}, Grenseverdi_pct=${round(f.thresholds.TH_pct,3)}, Grenseverdi_andel=${round(f.thresholds.TH_share,3)}`,
          `  - F_abs = |ΔN| / (|ΔN| + K_abs) = ${round(Math.abs(f.deltaN),3)} / (${round(Math.abs(f.deltaN),3)} + ${round((f.params.k_abs_scale as number) || f.thresholds.TH_abs || 1,3)}) = ${round(f.F_abs,3)}`,
          `  - F_base = ${(f.tiny_base ? 'P0_raw / tinyBaseThreshold' : '1')} = ${round(f.F_base,3)}`,
          `  - F_share = Δandel /(Δandel + S_share) = ${round(f.F_shareRaw,3)}`,
          `  - F_struct = 1 + gamma_share * F_share = 1 + ${f.params.gamma_share} * ${round(f.F_shareRaw,3)} = ${round(f.F_struct,3)}`,
          `  - F_scen (scenario ${adj.scenario}) = ${round(f.F_scen,3)}`,
          `  - F_total = min(F_scen * F_abs * F_struct * F_base, cap_factor) = min(${round(f.F_scen*f.F_abs*f.F_struct*f.F_base,3)}, ${f.params.cap_factor}) = ${round(f.F_total,3)}`,
          `  - JustertVekst_rå = pct⁺ * F_total = ${round(pctPos,2)} * ${round(f.F_total,3)} = ${round(adj.adjusted_raw ?? 0,2)}`,
          `  - VekstScore = min(JustertVekst_rå, 100) = ${round(G,1)}`
        ].join('\n')
      );
    } else if (p.profession && history && history[p.profession]) {
      // Historikk uten terskler (enkelt-tilfelle): vis enkel formel
      const hist = history[p.profession];
      const P0_raw = hist.number_of_employees_in_profession_5_years_ago ?? 0;
      const P0_eff = P0_raw === 0 ? 1 : P0_raw;
      const P1 = hist.number_of_employees_in_profession_now ?? 0;
      const pct = P0_eff === 0 ? 0 : ((P1 - P0_eff)/P0_eff)*100;
      const pctPos = pct < 0 ? 0 : pct;
      explanationLines.push([
        '• Formler (vekst enkel):',
        `  - P0=${P0_raw} (P0_eff=${P0_eff}), P1=${P1}`,
        `  - pct=((P1−P0_eff)/P0_eff)*100 = ${round(pct,2)}%`,
        `  - pct⁺=max(0,pct) = ${round(pctPos,2)}%`,
        `  - VekstScore = min(pct⁺, 100) = ${round(G,1)}`
      ].join('\n'));
    } else if (!p.profession) {
      explanationLines.push('• Ingen profesjon oppgitt → vekst = 0');
    } else {
      explanationLines.push('• Ingen historikk for profesjon → vekst = 0');
    }
    return {
      person_id: p.id,
      profession: p.profession ?? null,
      chance: C,
      growth: G,
      growth_adjusted_raw: adj.adjusted_raw,
      growth_scenario: adj.scenario,
      growth_factors: adj.factors,
      weights: { chance: wChance, growth: wGrowth },
      composite: S,
      max_possible: 100,
      explanation: explanationLines.join('\n'),
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
  '• Formler: C_i = 100 − U, S_i = ŵ_sjanse·C_i + ŵ_vekst·G_i. Gruppens score = (1/N)·Σ S_i',
  '• MAD (Median Absolute Deviation) = median(|verdi − medianen|) brukt for robuste grenseverdier',
    ].join("\n"),
    trace: {
      inputs: {
        persons_total: personsAll.map((p) => ({ id: p.id, personType: p.personType })),
        eligible_persons: eligiblePersons.map((p) => ({ id: p.id, profession: p.profession ?? null, personType: p.personType })),
        unemployment_rate: U ?? null,
  profession_growth_removed: true,
        profession_history_present: !!history,
        normalization_thresholds: thresholds,
        normalization_config: normConfig,
      },
      aggregation: { person_count: N, formula: "score = (1/N) · Σ Sᵢ,   Sᵢ = w_c·Cᵢ + w_g·Gᵢ" },
    },
  };
}
