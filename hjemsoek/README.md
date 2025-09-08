## Overview

This project is a React + TypeScript + Vite app that embeds a pure scoring core. The scoring logic is framework-agnostic and lives under `src/categories/`. Each module returns a structured result extending `BaseModuleResult` (see `src/types.ts`). Modules can be combined via `aggregateOverall` with automatic weight normalization and confidence-aware max potential.

## Scoring Modules Summary

| Key | Purpose | Score Range | Direction | Notes |
|-----|---------|-------------|-----------|-------|
| capacity | Settlement feasibility vs seats | 0..100 | higher better (overflow internally inverted in aggregate) | Modes: feasible / overflow_penalty / infeasible / missing_data |
| workOpportunity | Employment potential (eligible persons only) | 0..100 (if eligible) else 0 max | higher better | Chance (100−U) + growth (profession map) |
| connection | Social / familial / functional ties | 0..100 (if eligible) else 0 max | higher better | Relation ladder + geography (exact / neighbor / region) |
| healthcare | Hospital & specialist access | 0..100 (if any needs) else 0 max | higher better | Tiers self=100 / neighbor=50 / region=25 |
| education | Education facility access | 0..100 (if any valid needs) else 0 max | higher better | Same geographic tiers as healthcare |

## Confidence (Binary)

| Module | confidence=1 when | confidence=0 effect |
|--------|------------------|---------------------|
| capacity | Required numeric inputs valid | Removes its weight from theoretical max |
| workOpportunity | ≥1 eligible person | Max possible becomes 0 for this module |
| connection | ≥1 eligible (non-baby) person | Same |
| healthcare | ≥1 person with need | Same |
| education | ≥1 valid declared need | Same |

`aggregateOverall` reports `overall_max_possible = Σ ŵ_i * (confidence_i * 100)` so UIs can show both realized total and theoretical ceiling given available data.

## Weight Normalization
Provide raw weights only for modules present; they are normalized so Σ ŵ = 1 across present keys. Missing modules are ignored automatically. Capacity overflow mode is inverted (`impact = 100 - score`) so that higher overall still means better outcome.

## File Layout (Core)

| Path | Role |
|------|------|
| `src/categories/capacity.ts` | `scoreCapacity` |
| `src/categories/work.ts` | `scoreWorkOpportunity` |
| `src/categories/connection.ts` | `scoreConnection` |
| `src/categories/healthcare.ts` | `scoreHealthcare` |
| `src/categories/education.ts` | `scoreEducation` |
| `src/categories/aggregate.ts` | `aggregateOverall`, `impactForModule` |
| `src/categories/index.ts` | Barrel export for all above |
| `src/types.ts` | Shared type definitions |
| `src/utils.ts` | Helpers: `round`, `clamp`, `sum`, `normalizeWeights` |

## Install & Run

```powershell
npm install
npm test          # run unit tests in src/__tests__
npm run dev       # start Vite dev server
```

## Full Multi-Module Example

Below is a single TypeScript example invoking all scoring modules, then aggregating them with equal raw weights. Adjust data as needed.

```ts
import {
  scoreCapacity,
  scoreWorkOpportunity,
  scoreConnection,
  scoreHealthcare,
  scoreEducation,
  aggregateOverall,
} from './src/categories';
import type {
  CapacityInput,
  WorkOpportunityInput,
  ConnectionInput,
  HealthcareInput,
  EducationInput,
  ModuleWeights,
} from './src/types';

// --- Capacity ---
const capacityInput: CapacityInput = {
  group: { persons: [{ id: 'p1', personType: 'adult_working' }, { id: 'p2', personType: 'child' }] },
  municipality: { capacity_total: 120, settled_current: 60, tentative_claim: 5 },
  options: { include_tentative: true, allow_overflow: true },
  subweights: [{ id: 'capacity.core', weight: 1 }],
};
const capacity = scoreCapacity(capacityInput);

// --- Work Opportunity ---
const workInput: WorkOpportunityInput = {
  group: { persons: [
    { id: 'p1', personType: 'adult_working', profession: 'teacher' },
    { id: 'p2', personType: 'adult_not_working', profession: 'nurse' },
    { id: 'p3', personType: 'child' }, // ineligible, ignored
  ]},
  municipality: { work_opportunity: {
    unemployment_rate: 6,
    profession_growth: { teacher: 80, nurse: 65 },
  }},
  subweights: [
    { id: 'work.chance', weight: 1 },
    { id: 'work.growth', weight: 1 },
  ],
};
const workOpportunity = scoreWorkOpportunity(workInput);

// --- Connection ---
const connectionInput: ConnectionInput = {
  group: { persons: [
    { id: 'p1', personType: 'adult_working', connection: { municipality_id: 'm1', relation: 'friend' } },
    { id: 'p2', personType: 'adult_not_working', connection: { municipality_id: 'm2', relation: 'close_family' } },
    { id: 'p3', personType: 'child', connection: { region_id: 'r1', relation: 'relative' } },
    { id: 'p4', personType: 'baby' }, // ignored for confidence
  ]},
  target_municipality_id: 'm1',
  municipality_region_map: { m1: 'r1', m2: 'r1', m3: 'r2' },
  adjacency_map: { m1: ['m2'], m2: ['m1'], m3: [] },
};
const connection = scoreConnection(connectionInput);

// --- Healthcare ---
const healthcareInput: HealthcareInput = {
  group: { persons: [
    { id: 'p1', personType: 'adult_working', needs_hospital: true, specialist_need: 'dialysis' },
    { id: 'p2', personType: 'adult_not_working', specialist_need: 'oncology' },
    { id: 'p3', personType: 'child' }, // no needs
  ]},
  target_municipality_id: 'm1',
  municipality_region_map: { m1: 'r1', m2: 'r1', m3: 'r2' },
  adjacency_map: { m1: ['m2'], m2: ['m1'], m3: [] },
  municipality_healthcare_map: {
    m1: { has_hospital: true, specialist_facilities: ['dialysis'] },
    m2: { has_hospital: false, specialist_facilities: ['oncology'] },
    m3: { has_hospital: false, specialist_facilities: [] },
  },
};
const healthcare = scoreHealthcare(healthcareInput);

// --- Education ---
const educationInput: EducationInput = {
  group: { persons: [
    { id: 'p2', personType: 'adult_not_working', education_need: 'adult_language' },
    { id: 'p3', personType: 'child', education_need: 'primary_school' },
  ]},
  target_municipality_id: 'm1',
  municipality_region_map: { m1: 'r1', m2: 'r1', m3: 'r2' },
  adjacency_map: { m1: ['m2'], m2: ['m1'], m3: [] },
  municipality_education_map: {
    m1: { has_primary_school: true, has_high_school: false, has_university: false, has_adult_language: false },
    m2: { has_primary_school: false, has_high_school: true, has_university: false, has_adult_language: true },
    m3: { has_primary_school: false, has_high_school: false, has_university: true, has_adult_language: false },
  },
};
const education = scoreEducation(educationInput);

// --- Aggregate All ---
const modules = {
  capacity,
  workOpportunity,  // key must match weight key
  connection,
  healthcare,
  education,
};
const weights: ModuleWeights = {
  capacity: 1,
  workOpportunity: 1,
  connection: 1,
  healthcare: 1,
  education: 1,
};
const overall = aggregateOverall(modules, weights);

console.log('Capacity', capacity.effective_score, capacity.mode);
console.log('Work', workOpportunity.effective_score, 'confidence', workOpportunity.confidence);
console.log('Connection', connection.effective_score, 'confidence', connection.confidence);
console.log('Healthcare', healthcare.effective_score, 'confidence', healthcare.confidence);
console.log('Education', education.effective_score, 'confidence', education.confidence);
console.log('Aggregated weighted_total', overall.weighted_total);
console.log('Overall max possible (confidence-adjusted)', overall.overall_max_possible);
console.log('Normalized weights', overall.weights);
```

## Aggregation Impact Inversion
Only capacity in `overflow_penalty` mode is inverted (impact = 100 − score) so that all module impacts align with "higher is better" semantics in the final weighted total.

## Testing
All module behaviors have unit tests under `src/__tests__/`.

```powershell
npm test
```

## Extending
1. Create a new file under `src/categories/` exporting `scoreX` returning `BaseModuleResult` fields (`effective_score`, `max_possible`, `confidence`, `subscores`, etc.).
2. Add an export in `src/categories/index.ts`.
3. Provide a stable module key and include it in your `ModuleWeights` when aggregating.

## UI: MunicipalityScoreTable
`src/components/MunicipalityScoreTable.tsx` viser en rangert liste over kommuner for gjeldende gruppe og vekter.

Funksjoner:
* Kalkulerer modulscore for hver kommune (kapasitet, arbeid, tilknytning, helse, utdanning).
* Bruker eksisterende `aggregateOverall` for total (vekter normaliseres automatisk, kapasitet overflow håndteres med inversjon i aggregatfunksjonen).
* Viser 10-stegs fargegradient rød→grønn (dårlig→bra) som horisontale stolper (0–100%).
* Sorterbar per kolonne (klikk header). Standard sortering er Total synkende.
* Re-kalkulerer ved endringer i gruppe eller vekt (commit på museslipp i `WeightEditor`).

Brukseksempel (allerede i `App.tsx`):
```tsx
<MunicipalityScoreTable
  group={group}
  municipalities={municipalities}
  moduleWeights={moduleWeights}
  capacitySubweights={capacitySubs}
  workSubweights={workSubs}
  connectionSubweights={connectionSubs}
  healthcareSubweights={healthcareSubs}
  educationSubweights={educationSubs}
/>
```

Hvis gruppen er tom vises en hjelpetekst i stedet for tabell.

## License
MIT
