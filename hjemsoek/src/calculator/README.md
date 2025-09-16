# Module Calculator / Wizard Plan

This document describes the design and implementation plan for an in‑app "Calculator" wizard that lets a user experiment with any single scoring module in isolation by creating ad‑hoc (ephemeral) input data. It must not modify existing application state or global weights. Scope: ONE MODULE PER RUN (no aggregate multi‑module scoring inside this tool).

## Core Goals (Non‑Negotiable) – Status

Legend: ✅ Done · 🟡 Partial (scaffold / pending UI) · ⏳ Not started

1. Isolated sandbox (ephemeral state) – ✅ Implemented via local reducer/state in `ModalRoot` (no leakage to global app).
2. Single module per run – ✅ Scenario field `module` + switch/ builders only act on chosen module.
3. Stepwise wizard – ✅ All core step UIs implemented.
4. Temporary subweights – 🟡 Editor UI implemented (raw weights); redistribution algorithm (auto-balance) still missing.
5. Max 5 municipalities – ✅ Enforced in Regions & municipalities step (UI guard + disabled add button at 5).
6. Region definition + neighbor selection – ✅ Region add/remove + municipality region selector + neighbor toggles in municipality editor.
7. Municipality editing (capacity/work/healthcare/education) – ✅ Unified municipality form with module-conditional sections.
8. Person editing (all fields) – ✅ Person table with module-conditional columns (profession, connection, healthcare, education).
9. Result view: module score + trace JSON toggle – 🟡 Basic score + raw trace JSON; still missing subweight table & per-person drilldowns.
10. No new libraries – ✅ Respected.

## High-Level Wizard Step Sequence

Irrelevant steps are skipped based on selected module.

| Step | Description | Status |
|------|-------------|--------|
| 1 | Module selection | ✅ `StepModuleSelect.tsx` implemented |
| 2 | Professions | ✅ `StepProfessions.tsx` |
| 3 | Regions & municipality count | ✅ `StepRegionsMunicipalities.tsx` (enforces max 5) |
| 4 | Municipality details | ✅ `StepMunicipalityEditor.tsx` + `MunicipalityForm` |
| 5 | Persons | ✅ `StepPersons.tsx` + `PersonTable` |
| 6 | Subweights | ✅ `StepSubweights.tsx` (raw editor; no auto-redistribute yet) |
| 7 | Module specific options | ✅ `StepOptions.tsx` |
| 8 | Review & Run | ✅ `StepReviewRun.tsx` |
| 9 | Results | 🟡 `ResultsView.tsx` (needs richer breakdown) |

## Draft Data Structures (Ephemeral)

```ts
interface CalculatorScenarioBase {
  module: 'capacity' | 'workOpportunity' | 'connection' | 'healthcare' | 'education';
  professions: string[];
  regions: string[];
  municipalities: Array<{
    id: string;
    name: string;
    region: string | null;
    neighbors: string[];
    capacity?: { capacity_total?: number; settled_current?: number; tentative_claim?: number };
    work?: { profession_history: Record<string, ProfessionHistoryDraft> };
    healthcare?: { has_hospital?: boolean; specialist_facilities: string[] };
    education?: { has_primary_school?: boolean; has_high_school?: boolean; has_university?: boolean; has_adult_language?: boolean };
  }>;
  persons: Array<{
    id: string; // p1, p2 ...
    personType?: PersonType;
    profession?: string;
    connection?: { municipality_id?: string; region_id?: string; relation?: ConnectionRelation };
    needs_hospital?: boolean;
    specialist_need?: string;
    education_need?: EducationFacilityType;
  }>;
  subweights: Record<string, number>;
  options?: { capacity?: { include_tentative: boolean; allow_overflow: boolean }; work?: Partial<WorkGrowthNormalizationConfig> };
  lastResult?: BaseModuleResult;
  lastFullResult?: any;
}
```

## Module-Specific Input Assembly

Each module now has a builder returning `input` + validation `issues`.

| Module | Builder Output | Required Draft Elements | Validation Highlights |
|--------|----------------|-------------------------|----------------------|
| capacity | CapacityInput | >=1 municipality (first as target), persons, capacity fields, options | Implemented (errors + warnings) |
| workOpportunity | WorkOpportunityInput | Unemployment rate, persons, profession history | Implemented (basic validation) |
| connection | ConnectionInput | Target municipality, region/adjacency maps, persons | Implemented (baseline) |
| healthcare | HealthcareInput | Target municipality, region/adjacency, healthcare map, persons | Implemented |
| education | EducationInput | Target municipality, region/adjacency, education map, persons | Implemented |

## Subweight Handling Inside Calculator

Status: Raw integer storage + pass‑through to scorer in place and UI editor implemented (`StepSubweights` + `SubweightEditorLocal`). Normalization still handled by scorer internals. Remaining: optional auto‑redistribution helper (e.g. balance to 100 after deletes) and richer per‑subweight contribution display in results.

## Validation Strategy (Blocking vs Non-Blocking)

Blocking (prevents Run):

- Missing required numeric (e.g. capacity_total, settled_current for capacity).
- Negative numeric where >= 0 is required.
- No municipalities defined.
- Work: unemployment_rate < 0 or > 100.

Non‑blocking warnings:

- settled_current > capacity_total.
- Profession history “now” < “5 years ago” (negative growth allowed, just informative).
- Municipality missing region.

## UI Structure (Proposed Files)

```text
src/calculator/
  index.ts
  ModalRoot.tsx
  useCalculatorState.ts
  types.ts
  steps/
    StepModuleSelect.tsx
    StepProfessions.tsx
    StepRegionsMunicipalities.tsx
    StepMunicipalityEditor.tsx
    StepPersons.tsx
    StepSubweights.tsx
    StepOptions.tsx
    StepReviewRun.tsx
    ResultsView.tsx
  builders/
    buildCapacityInput.ts
    buildWorkInput.ts
    buildConnectionInput.ts
    buildHealthcareInput.ts
    buildEducationInput.ts
  components/
    ProfessionListEditor.tsx
  MunicipalityPager.tsx (not needed now; simple select used)
    MunicipalityForm.tsx
    PersonTable.tsx
    SubweightEditorLocal.tsx
    SummaryCard.tsx
    TraceViewer.tsx
  util/
    normalization.ts
    validation.ts
  README.md
```

## Wizard Navigation Model

Linear index (0..N) with conditional skips.

- Capacity: professions can be skipped.
- Work: professions required.
- Connection / Healthcare / Education: professions optional (Skip button).

## State Management Approach

- Single `useCalculatorState` + `useReducer`.
- Context provider in `ModalRoot`.
- Steps consume context directly.

## Running a Calculation

1. Review step → Run.
2. Draft → module-specific builder.
3. Errors ⇒ show list + links to steps.
4. OK ⇒ invoke scorer, store result.
5. Navigate to Results.
6. Any later input change flags result stale.

## Results Presentation Notes

Implemented: basic score header, trace JSON toggle, closing resets (ephemeral). Pending: subweight table, contribution breakdown, per‑person accordion, mode badge, reset button UI.

## Defaults Per Module (When Modal Opens Without Prior Draft)

| Module | Persons Default | Municipality Defaults | Subweights Default | Options |
|--------|-----------------|-----------------------|--------------------|---------|
| capacity | 1 adult_not_working (p1) | 1 municipality (cap 100, settled 50, tent 0) | capacity.core=100 | include_tentative=true, allow_overflow=false |
| workOpportunity | 1 adult_working (p1) profession blank | 1 municipality unemployment_rate=4 | chance=50 growth=50 | normalization defaults only |
| connection | 1 adult_working (p1) no connection | 1 municipality (blank region) | equal 5-way 20 each | — |
| healthcare | 1 adult_working (p1) no needs | 1 municipality hospital=false, no specialists | hospital=50 specialist=50 | — |
| education | 1 child (p1) education_need blank | 1 municipality all facilities false | 4-way 25 each | — |

## Validation Issue Shape

```ts
interface ValidationIssue {
  code: string;
  level: 'error' | 'warn';
  message: string;
  step: string;
  fieldPath?: string;
}
```

## Error & Edge Handling Summary

| Situation | Handling |
|-----------|----------|
| No persons | Allowed; scorers produce 0 (explain). |
| Capacity totals inconsistent | Warning; still run. |
| Profession history incomplete | Missing numbers treated as 0; scorer logic already robust. |
| Region missing for municipality | Allowed; region-based benefits just unavailable. |
| Invalid numeric (NaN or <0) | Blocking error until fixed. |
| Duplicate profession names | Prevent add (inline message). |

## Styling & UX Notes

- Modal max width ~960px.
- Progress indicator.
- Navigation: Back / Next / Skip / Run.
- Sticky footer.
- Reuse existing styling primitives.

## Internationalization

All new UI strings initially Norwegian (may externalize later for i18n); README now in English for developer clarity.

## Future (Out of Scope Now)

- Multiple named scenarios
- Export / import
- Persistence
- Auto-fill helpers
- Cross-module aggregate
- Diff between runs

## Progress Tracking Guidance (For Future Contributors)

When implementing, append a dated entry under "Progress Log" summarizing added or modified steps/components. Keep entries concise.

### Progress Log

2025-09-12: Initial plan created.
2025-09-12: Clarifications integrated (free-form region, empty facilities defaults, normalization subset, no person cap). Scaffold (types, state hook, modal, builder placeholders) added.
2025-09-12: Stronger typing (removed `any`), union result type, launcher moved to `.tsx`, builders completed for all modules, basic `ResultsView` added.
2025-09-12: Implemented full wizard steps (professions, regions/municipalities, municipality editor, persons, subweights, options, review) + enforcement (max 5 municipalities) + neighbor selection + subweight editor UI.
2025-09-12: Added subweight rebalance helper (scales to raw sum=100), enriched `ResultsView` with subweight table, per-person breakdown, mode badge, reset scenario button, and capacity-specific display.

## Clarifications (Already Incorporated)

All prior clarifications are embedded in design, types and builders; retained here only for history.

| # | Clarification | Status |
|---|---------------|--------|
| 1 | Region ID is free-form unique string | Incorporated (`regions[]` + municipality `region`) |
| 2 | New municipalities start with all facilities false/empty | Incorporated (defaults in `createInitialScenario`) |
| 3 | Work exposes only subset normalization params: tinyBaseThreshold, beta_boost_s1, damp_s4, gamma_share, cap_factor | Incorporated (types + options draft) |
| 4 | No upper limit on persons | Incorporated (no constraint in state/builders) |

No further action needed; future changes should add new log entries.
