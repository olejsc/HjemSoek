# Scoring Core Overview

This document describes the scoring modules intended to be embedded inside a larger decision / ranking system. Individual modules are not end-user features on their own; they expose consistent contracts so they can be combined.

## Module Summary

| Module Key | Purpose | Score Range | Direction | Notes |
|------------|---------|-------------|-----------|-------|
| capacity | Settlement feasibility vs available seats | 0..100 | higher better (overflow internally inverted for aggregation) | Penalizes overflow if allowed; infeasible can be 0 |
| workOpportunity | Employment potential (per-person micro average) | 0..100 (if eligible persons) else 0 max | higher better | Two subweights: chance & growth (growth derived from profession history); ignores ineligible person types |
| connection | Social / familial / familiarity ties to target municipality | 0..100 (if eligible persons) else 0 max | higher better | Relation-based weighting + geographic ladder; babies excluded |
| healthcare | Access to hospital & specialist treatment needs | 0..100 (if any healthcare needs) else 0 max | higher better | Two subweights (hospital, specialist); geographic tiers 100/50/25 |
| education | Access to required education facility (per person needs) | 0..100 (if any education needs) else 0 max | higher better | Subweights per facility (primary, high, university, adult_language); tiers 100/50/25 |

All modules return an object extending `BaseModuleResult` from `src/types.ts`.

## Weight Normalization (Inter-Module)

`aggregateOverall(modules, weights)`:
1. Filters to present modules (keys available in `modules`).
2. Normalizes raw weights so Σ ŵ = 1 across present keys.
3. For each module M, maps its `effective_score` to an *impact* value. (Currently only capacity overflow mode is inverted: `impact = 100 - score` when mode = `overflow_penalty`.)
4. Produces `weighted_total = Σ ŵ_M · impact_M`.

Example:
```ts
const modules = { capacity: capRes, workOpportunity: workRes, connection: connRes };
const weights = { capacity: 1, workOpportunity: 1, connection: 1 }; // equal → each = 1/3
const overall = aggregateOverall(modules, weights);
```
If a module is missing (undefined), its weight is excluded and remaining weights renormalize.

## Capacity Module

Input: `CapacityInput`.
- Required fields: `capacity_total > 0`, `settled_current >= 0`.
- Optional: `tentative_claim` (subtracted when `include_tentative=true`).
- Group size derived from persons length if `group.size` absent.

Scoring cases:
| Case | Criteria | Mode | Raw Core Score Formula | Direction |
|------|----------|------|------------------------|-----------|
| Feasible | available_effect ≥ group_size | feasible | 100 · (AE − G)/AE | higher_better |
| Overflow allowed | available_effect < G & allow_overflow | overflow_penalty | 100 · Overflow/CT | lower_better (inverted in aggregate) |
| Infeasible | available_effect < G & !allow_overflow | infeasible | 0 | higher_better |
| Missing data | capacity_total ≤ 0 or settled_current null | missing_data | 0 | higher_better |

Where: AE = capacity_total − settled_current − (include_tentative? tentative_claim:0). Overflow = G − max(AE,0).

Subweights: currently a single `capacity.core` (weight defaults 1). `effective_score = min(capacity_score, 100)`.

## Person Types & Eligibility

`Person.personType` ∈ { `baby`, `child`, `high_school_pupil`, `student`, `adult_working`, `adult_not_working`, `senior` }.

Eligibility summary:

| Person Type | Work Module Eligible | Can Have Profession | Allowed Relations |
|-------------|----------------------|---------------------|-------------------|
| baby | No | No | (none) |
| child | No | No | friend, close_family, relative |
| high_school_pupil | Yes | Yes | friend, close_family, relative, workplace, school_place |
| student | Yes | Yes | friend, close_family, relative, workplace, school_place |
| adult_working | Yes | Yes | friend, close_family, relative, workplace, school_place |
| adult_not_working | Yes | Yes | friend, close_family, relative, workplace, school_place |
| senior | No (excluded from work score) | No | friend, close_family, relative |

Babies have zero impact in connection (and work) because they are not eligible for any relations / work scoring. Seniors cannot have workplace or school_place relations. Relation declarations violating eligibility are ignored (score contribution zero with explanatory trace line).

## Confidence Semantics

Each module now exposes a binary `confidence` (0 or 1):

| Module | confidence=1 Condition | confidence=0 Condition | max_possible when 0 |
|--------|------------------------|-------------------------|---------------------|
| capacity | Required numeric inputs valid (capacity_total>0) | Missing required inputs | 0 |
| workOpportunity | ≥1 eligible person type contributes | No eligible persons (all types ineligible) | 0 |
| connection | ≥1 eligible person type (non-baby / with allowed relations) | No eligible persons (e.g., all babies) | 0 |

Overall aggregation adds `overall_max_possible = Σ ŵ_M · (confidence_M · 100)` (after weight normalization). A module with confidence=0 effectively withdraws its weight proportion from the theoretical total. Current `weighted_total` (raw impact sum) is still returned; UI can display both.

## Healthcare Module

Purpose: Measures how well a municipality satisfies healthcare needs: hospital access and one specialist treatment per person.

### Inputs
`HealthcareInput`:
* `group.persons[]` with optional `needs_hospital?: boolean`, `specialist_need?: string`.
* `target_municipality_id`.
* `municipality_region_map` & `adjacency_map`.
* `municipality_healthcare_map` (per municipality: `has_hospital?`, `specialist_facilities?: string[]`).
* Optional subweights: `healthcare.hospital`, `healthcare.specialist` (defaults equal).

Specialist types exported constant: `SPECIALIST_TREATMENT_TYPES` = dialysis, rehabilitation, physical_therapy, mental_health, oncology, cardiology, maternity, pediatrics, substance_abuse, trauma, orthopedic, respiratory.

### Person Inclusion & Confidence
Only persons declaring at least one need are included. Others ignored. If none ⇒ score=0, max_possible=0, confidence=0. Else confidence=1, max_possible=100.

### Geographic Tiers (per need)
1. Municipality provides ⇒ 100
2. Else any neighbor provides ⇒ 50
3. Else any municipality in same region provides ⇒ 25
4. Else 0

Precedence: self > neighbor > region (no stacking; adjacency overrides region fallback).

### Per-Person Composite
Components: hospital (if needed & subweight active) and specialist (if needed & subweight active). Module subweights are normalized globally; for persons missing one component, present components are renormalized locally so absence of an unmet dimension doesn't dilute the other. Example: weights 0.5/0.5, person only needs hospital tier=50 ⇒ composite=50.

### Aggregation
Module score = average of person composites. Subscore rows expose average hospital tier over hospital-need persons and average specialist tier over specialist-need persons; contributions use normalized module weights.

### Trace
Per-person trace includes tier scores and composite; module trace records tier cache and inputs.

### Edge Cases
* Disabled subweight (weight=0) removes that dimension; persons needing only the disabled type yield composite=0.
* Missing facility data assumed absent.

### Example
```ts
const res = scoreHealthcare({
  group: { persons: [ { id:'p1', personType:'adult_working', needs_hospital:true, specialist_need:'dialysis' } ] },
  target_municipality_id: 'm1',
  municipality_region_map,
  adjacency_map,
  municipality_healthcare_map,
});
```

## Work Opportunity Module (V2 + Growth Normalization)

Input: `WorkOpportunityInput`.
- Per-person micro-average with zeros-as-scores (no data just yields 0 for that subcomponent).
- Two subweights: chance & growth (defaults 50/50 when omitted).

Per-person raw components:
1. Chance: `Cᵢ = 100 − unemployment_rate` (clamped 0..100). Missing unemployment ⇒ 0.
2. Growth (normalized): Derived solely from historic workforce metrics in `profession_history` (raw positive percent change adjusted by scenario factors). When a profession lacks history ⇒ growth = 0.

Composite: `Sᵢ = ŵ_c·Cᵢ + ŵ_g·Gᵢ` where ŵ are normalized subweights.

Group score: `score = (1/N) Σ Sᵢ` over ONLY eligible persons. Ineligible persons are omitted (not zeroed). If no eligible persons ⇒ `score=0`, `max_possible=0`, `confidence=0`. `max_possible = 100` when at least one eligible person else 0.

### Growth Normalization (Scenario-Based)

Historic per-profession metrics (optional):
```
profession_history[profession] = {
  number_of_employees_in_profession_5_years_ago: P0,
  number_of_employees_in_profession_now: P1,
  percentage_of_municipality_workforce_5_years_ago: Share0 (0-100),
  percentage_of_municipality_workforce_now: Share1 (0-100),
  workforce_change_past_5_years: (ignored; recomputed from P0/P1)
}
```

If present for at least one profession, the module computes robust thresholds (median + MAD) across professions:
```
TH_abs   = median(|ΔN|) + MAD(|ΔN|)     where ΔN = P1 - P0_eff, P0_eff = (P0==0?1:P0)
TH_pct   = median(|pct_growth|) + MAD(|pct_growth|) where pct_growth = ((P1-P0_eff)/P0_eff)*100
TH_share = median(positive ΔShare) + MAD(positive ΔShare) where ΔShare = Share1 - Share0 > 0
```
Fallback: If MAD=0 ⇒ threshold = median.

Scenario classification (two axes: absolute change vs percent growth magnitude):
```
BigAbsolute = |ΔN| ≥ TH_abs
BigPercent  = |pct_growth| ≥ TH_pct

Scenario 1: !BigPercent &&  BigAbsolute   (quiet but material)
Scenario 2: !BigPercent && !BigAbsolute   (minor change)
Scenario 3:  BigPercent &&  BigAbsolute   (strong + material)
Scenario 4:  BigPercent && !BigAbsolute   (illusory percent – tiny base)
```
Tiny base flag: `tiny_base = (P0_raw < tinyBaseThreshold)` (default 2). When `P0_raw=0` a synthetic `P0_eff=1` is used for calculations.

Only positive ΔShare contributes to structural boost: `ΔShare = max(0, Share1-Share0)`.

Normalization factors (defaults in code, overridable via `growth_normalization` input):
```
tinyBaseThreshold = 2
beta_boost_s1     = 0.4   (Scenario 1 boost strength)
damp_s4           = 0.5   (Scenario 4 damp multiplier)
gamma_share       = 0.3   (Share structural boost strength)
cap_factor        = 1.5   (Max multiplier for combined factors)
final_cap         = 200   (Trace-only cap for adjusted raw growth)
k_abs_scale       = TH_abs (or numeric)
k_boost_scale     = TH_abs (or numeric)
share_scale_mode  = TH_share_or_5pp  (S_share = max(TH_share, 5))
```

Factor components:
```
F_abs     = |ΔN| / (|ΔN| + K_abs)
F_base    = (P0_raw < tinyBaseThreshold) ? P0_raw / tinyBaseThreshold : 1
F_shareRaw= ΔShare / (ΔShare + S_share)
F_struct  = 1 + gamma_share * F_shareRaw

Scenario multiplier F_scen:
  S1: 1 + beta_boost_s1 * (|ΔN| / (|ΔN| + K_boost))
  S2: 1
  S3: 1 (neutral by design)
  S4: damp_s4 * F_base

F_total_raw = F_scen * F_abs * F_struct * F_base
F_total     = min(F_total_raw, cap_factor)

positive_pct = max(0, pct_growth)
AdjustedRaw  = positive_pct * F_total  (may exceed 100; trace-only limited to final_cap)
GrowthScore  = min(AdjustedRaw, 100)   (used in composite; negative pct ⇒ 0)
```

Trace fields for each person when normalization active:
```
growth_scenario (1..4)
growth_adjusted_raw (capped at final_cap, possibly >100)
growth_factors: {
  P0_raw, P0_eff, P1, deltaN, recomputed_pct, positive_pct,
  share0, share1, delta_share_raw, delta_share,
  thresholds { TH_abs, TH_pct, TH_share }, tiny_base, negative_growth,
  F_scen, F_abs, F_base, F_shareRaw, F_struct, F_total_raw, F_total,
  params (effective normalization config)
}
```

If no `profession_history` is present for the person's profession, growth falls back to simple `clamp(profession_growth[profession], 0, 100)`.

### Note
Legacy `profession_growth` input has been removed. Growth scoring now depends entirely on `profession_history`. If history is absent for a profession its growth contribution is zero (transparent in trace).

## Connection Module

Purpose: Measures social/familial/functional ties to a target municipality using a geographic + relation ladder. One connection per person.

Declaration (per person):
* Either a municipality connection `{ municipality_id }` OR a region connection `{ region_id }` may be created first (location-first UX).
* `relation` is OPTIONAL until user chooses it. A connection without a relation contributes 0 and is treated as "ikke valgt" in traces.
* When present, relation ∈ { friend, close_family, relative, workplace, school_place } BUT must be allowed for the person's `personType` (see table). Disallowed relations are ignored with base_score=0 and explanatory trace.
* Babies produce no trace entries contributing to averages (confidence=0 if all persons are babies / otherwise ignored individually).

### Matching Ladder (Municipality Declaration)
| Match | Condition | Base Score |
|-------|-----------|------------|
| exact | declared.municipality_id == target | 100 |
| neighbor | declared municipality in adjacency[target] | 50 |
| region | same region as target (different municipality) | 10 |
| none | otherwise | 0 |

### Region Declaration
If target municipality belongs to declared region: base = relation map:
- friend 10, close_family 75, relative 25, workplace 25, school_place 25
Else 0 (no adjacency leakage outside region).

### Aggregation
1. Compute per-person `base_score` + `match_level`.
2. For each relation r: average base scores over persons with that relation ⇒ `avg_r`.
3. Subweight ids: `connection.friend`, `connection.close_family`, `connection.relative`, `connection.workplace`, `connection.school_place` (defaults equal raw weights ⇒ each ŵ=0.2 when all present and weighted equally).
4. Module score: `Σ_r ŵ_r · avg_r`.
5. `effective_score = score`; `max_possible = 100` when at least one ELIGIBLE person, else 0 (confidence mirrors this).

### Example
```ts
const connInput = {
  group: { persons: [
    { id: 'a', connection: { municipality_id: 'm1', relation: 'friend' } },
    { id: 'b', connection: { region_id: 'r2', relation: 'close_family' } },
  ] },
  target_municipality_id: 'm1',
  municipality_region_map: { m1: 'r1', m2: 'r1', m3: 'r2' },
  adjacency_map: { m1: ['m3'], m2: [], m3: ['m1'] },
};
const connRes = scoreConnection(connInput);
```

## Education Module

Purpose: Measures how well a municipality satisfies declared education facility needs (single need per person).

### Facilities
`EDUCATION_FACILITY_TYPES` exported constant:
```
primary_school, high_school, university, adult_language
```

### Person Eligibility & Declaration
Each person may declare at most one `education_need` (single value). Allowed facilities per `personType`:

| Person Type | Allowed Education Needs |
|-------------|-------------------------|
| baby | (none) |
| child | primary_school, high_school |
| high_school_pupil | high_school, university |
| student | university, adult_language |
| adult_working | university, adult_language |
| adult_not_working | high_school, university, adult_language |
| senior | university, adult_language |

Helper: `educationNeedsList(personType)` returns ordered array of allowed facilities (for UI dropdown population).

Persons without a declared need are ignored. Declared needs not permitted for their type are ignored (trace explains) and do not contribute to confidence.

### Inputs
`EducationInput`:
* `group.persons[]` (each may have `education_need?: EducationFacilityType`).
* `target_municipality_id`.
* `municipality_region_map`, `adjacency_map`.
* `municipality_education_map`: per municipality booleans `has_primary_school`, `has_high_school`, `has_university`, `has_adult_language`.
* Optional subweights: one per facility `education.primary_school`, `education.high_school`, `education.university`, `education.adult_language` (defaults equal). Zero-weight subweights are excluded then remaining renormalized; if all zero, defaults re-applied.

### Scoring Tiers (per facility need)
1. Municipality provides facility ⇒ 100
2. Else any neighbor provides ⇒ 50
3. Else any municipality in same region provides ⇒ 25
4. Else 0

Adjacency takes precedence over region fallback.

### Aggregation
1. Include only persons with a valid, allowed `education_need`.
2. For each facility f: compute average tier across persons needing f.
3. Module score = Σ (ŵ_f · avg_f) (ŵ = normalized facility subweight).
4. `effective_score = score`.

### Confidence & Max Possible
If ≥1 valid declared need exists ⇒ `confidence=1`, `max_possible=100`; else both 0.

### Subscores
Each facility produces a subscore row with average tier and its contribution.

### Trace
Per-person trace shows declared need, allowed list, tier score (if valid), and contribution. Module trace includes tier cache and weight normalization.

### Example
```ts
const eduInput = {
  group: { persons: [ { id:'p1', personType:'child', education_need:'primary_school' } ] },
  target_municipality_id: 'm1',
  municipality_region_map,
  adjacency_map,
  municipality_education_map,
};
const eduRes = scoreEducation(eduInput);
```

## Extensibility Guidelines
- New modules should export a `scoreX` returning `BaseModuleResult` fields and a stable module key for weighting.
- Provide per-person traces where individual inputs influence aggregate scores.
- Keep subweights normalized and explicit ids stable (avoid breaking changes).

## Default Inter-Module Weights
Recommended baseline: equal raw weights when all three modules present.
```ts
const weights = { capacity: 1, workOpportunity: 1, connection: 1 }; // ⇒ each 1/3 after normalization
```
To emphasize, e.g., capacity twice as much:
```ts
const weights = { capacity: 2, workOpportunity: 1, connection: 1 }; // normalization handles sum
```

## Handling Missing Data
| Scenario | Module Behavior |
|----------|-----------------|
| Capacity missing core numbers | mode=missing_data, max_possible=0 |
| Work: no persons | score=0, max_possible=0 |
| Connection: no persons | score=0, max_possible=0 |
| Any zero data subcomponent | Contributes 0 but does not break others |

## Aggregation Inversion Note
Only capacity overflow uses inversion so total still treats higher as better. If additional penalty-style modes are added, add logic to `impactForModule`.

## Quality & Testing
All modules have unit tests under `src/__tests__/`. Run:
```powershell
npm test
```

---
This document focuses strictly on scoring mechanics; UI / API layers consume these pure functions.
