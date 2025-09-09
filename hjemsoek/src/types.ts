/* Auto-extracted types from the single-file library
 * This file contains the public contracts (data shapes) used by the scoring
 * modules. It was split out from the original monolithic file.
 */

/**
 * Unique string identifier for a person in the group.
 */
export type PersonId = string;

/**
 * Person-level input used by Work Opportunity and future modules.
 */
/** Enumerated lifecycle / role categories for a person influencing module eligibility. */
export type PersonType =
  | 'baby'
  | 'child'
  | 'high_school_pupil'
  | 'student'
  | 'adult_working'
  | 'adult_not_working'
  | 'senior';

export interface Person {
  /** Stable identifier for the person. */
  id: PersonId;
  /** Person lifecycle / role classification. */
  personType: PersonType;
  /** Optional profession key. If absent, growth subscore = 0 for Work Opportunity (when eligible). */
  profession?: string;
  /** Optional single connection (municipality OR region plus relation). */
  connection?: PersonConnection;
  /** Healthcare: whether person needs hospital access. */
  needs_hospital?: boolean;
  /** Healthcare: single specialist treatment need (id from SPECIALIST_TREATMENT_TYPES). */
  specialist_need?: string;
  /** Education: single education facility need (one of EDUCATION_FACILITY_TYPES). */
  education_need?: EducationFacilityType;
}

/**
 * A group of persons to be settled together. `size` is optional and, if present,
 * MUST equal `persons.length`. When omitted, size is derived from `persons`.
 */
export interface Group {
  /** Array of persons in the group. */
  persons: Person[];
  /** Optional explicit size; if provided, must match persons.length. */
  size?: number;
}

/**
 * Capacity inputs at municipality scope.
 */
export interface MunicipalityCapacityInput {
  /** Total capacity seats (≥ 0). Required. */
  capacity_total: number;
  /** Already settled seats (≥ 0). Required. */
  settled_current: number;
  /** Tentative claims (≥ 0). Optional. */
  tentative_claim?: number;
}

/**
 * Municipality-side inputs for Work Opportunity.
 */
export interface MunicipalityWorkInputs {
  /** Unemployment rate in %, 0..100. Lower unemployment ⇒ higher employment chance. */
  unemployment_rate?: number;
  /** Per-profession historic workforce metrics used for growth normalization (required to score growth). */
  profession_history?: Record<string, {
    number_of_employees_in_profession_5_years_ago?: number; // P0 (raw, may be 0)
    number_of_employees_in_profession_now?: number; // P1
    percentage_of_municipality_workforce_5_years_ago?: number; // Share0 (0-100)
    percentage_of_municipality_workforce_now?: number; // Share1 (0-100)
    workforce_change_past_5_years?: number; // Provided pct change (-100..100)
  }>;
}

/**
 * Options controlling Capacity scoring behavior.
 */
export interface CapacityOptions {
  /** If true, subtract tentative_claim from available capacity. */
  include_tentative: boolean;
  /** If true, allow overflow scoring (penalty), else infeasible = 0. */
  allow_overflow: boolean;
}

/**
 * Subweight contract for capacity (single core subweight at present).
 */
export interface CapacitySubweight {
  /** Fixed id for the current capacity subweight. */
  id: "capacity.core";
  /** Relative weight; normalized internally if multiple subweights are added later. */
  weight: number;
}

/**
 * Input envelope for Capacity scoring.
 */
export interface CapacityInput {
  /** Group to be settled; size is taken from persons.length when available. */
  group: Group;
  /** Municipality capacity inputs. */
  municipality: MunicipalityCapacityInput;
  /** Behavior flags. */
  options: CapacityOptions;
  /** Optional list of subweights; default to a single core=1 when omitted. */
  subweights?: CapacitySubweight[];
}

/**
 * Subweights for Work Opportunity (two at present).
 */
export type WorkSubweightId = "work.chance" | "work.growth";

export interface WorkSubweight {
  /** One of the known work subweights. */
  id: WorkSubweightId;
  /** Relative weight; normalized so that Σ ŵ = 1. */
  weight: number;
}

/**
 * Work Opportunity input envelope (V2 – per person).
 */
export interface WorkOpportunityInput {
  /** Group of persons; professions used by growth subweight. */
  group: Group;
  /** Municipality work inputs (unemployment + per-profession growth). */
  municipality: { work_opportunity?: MunicipalityWorkInputs };
  /** Optional subweight array; defaults to 50/50 when omitted. */
  subweights?: WorkSubweight[];
  /** Optional normalization configuration for growth adjustment. */
  growth_normalization?: Partial<WorkGrowthNormalizationConfig>;
}

/**
 * Common shape for any module result at the top level.
 */
export interface BaseModuleResult {
  /** Module score (0..100), before any inversion for overall aggregation. */
  effective_score: number;
  /** Raw score naming; for capacity we also expose capacity_score separately. */
  score?: number;
  /** Maximum possible (0..100) given data completeness and rules. */
  max_possible: number;
  /** Binary confidence (0 or 1 for now): 1 if at least one eligible datum contributed; 0 if none (module effectively absent). */
  confidence?: 0 | 1;
  /** Scoring mode (used for explainability and UI treatment). */
  mode: "feasible" | "overflow_penalty" | "infeasible" | "missing_data";
  /** Direction of betterment for the raw score (not for totals). */
  direction: "higher_better" | "lower_better";
  /** Human-readable explanation (bulleted). */
  explanation: string;
  /** Opaque trace object for debugging / analytics. */
  trace?: unknown;
}

/**
 * Capacity result (extends BaseModuleResult with capacity-specific fields).
 */
export interface CapacityResult extends BaseModuleResult {
  /** Capacity score equals the module score prior to effective capping. */
  capacity_score: number;
  /** Whether overflow was allowed and whether tentative was included. */
  allow_overflow: boolean;
  include_tentative: boolean;
  /** Available effect seats (post-tentative), remaining after group, and overflow units. */
  available_effect: number;
  remaining_after: number;
  overflow_units: number;
  /** Subscore breakdown for capacity (currently one). */
  subscores: Array<{
    id: "capacity.core";
    weight: number;
    normalized_weight: number;
    score: number;
    contribution: number;
    formula: string;
    values: Record<string, number>;
    mode: CapacityResult["mode"];
    direction: CapacityResult["direction"];
  }>;
}

/**
 * Per-person trace for Work Opportunity.
 */
export interface WorkPersonTrace {
  /** Person id (for drill-down). */
  person_id: PersonId;
  /** Optional profession (null if absent). */
  profession: string | null;
  /** Chance subscore (0..100). */
  chance: number;
  /** Growth subscore (0..100). */
  growth: number;
  /** Optional raw adjusted growth pre-cap (can exceed 100, up to 200 trace cap). */
  growth_adjusted_raw?: number;
  /** Scenario classification when normalization active (1..4 or undefined). */
  growth_scenario?: 1|2|3|4;
  /** Detailed normalization factors (present only when history used). */
  growth_factors?: {
    P0_raw: number;
    P0_eff: number;
    P1: number;
    deltaN: number;
    recomputed_pct: number;
    positive_pct: number;
    share0: number;
    share1: number;
    delta_share_raw: number;
    delta_share: number;
    thresholds: { TH_abs: number; TH_pct: number; TH_share: number };
    tiny_base: boolean;
    negative_growth: boolean;
    F_scen: number;
    F_abs: number;
    F_base: number;
    F_shareRaw: number;
    F_struct: number;
    F_total_raw: number;
    F_total: number;
    params: WorkGrowthNormalizationConfig;
  };
  /** Normalized per-person weights applied. */
  weights: { chance: number; growth: number };
  /** Composite Sᵢ = w_c·Cᵢ + w_g·Gᵢ. */
  composite: number;
  /** Always 100 in zeros-as-scores policy. */
  max_possible: 100;
  /** Bullet-point numbers for this person. */
  explanation: string;
  /** Future flags (e.g., gating) if needed. */
  flags: string[];
}

/**
 * Work Opportunity result (V2 – per person micro-average).
 */
export interface WorkOpportunityResult extends BaseModuleResult {
  /** Group-level micro-average of per-person composites. */
  score: number;
  /** Coverage is always 1.0 with zeros-as-scores (all persons included). */
  coverage: number;
  /** Subweight definitions (normalized). */
  subscores: Array<{
    id: WorkSubweightId;
    weight: number;           // normalized weight (ŵ)
    normalized_weight: number; // same as weight (kept for symmetry)
    score?: number;           // reserved for future module-level subscores
    contribution?: number;    // reserved
  }>;
  /** Per-person traces. */
  persons: WorkPersonTrace[];
}

/** Normalization configuration (values documented in scoring.md extension). */
export interface WorkGrowthNormalizationConfig {
  tinyBaseThreshold: number; // default 2
  beta_boost_s1: number; // default 0.4 (Scenario1 boost strength)
  damp_s4: number; // default 0.5 (Scenario4 damp multiplier before other factors)
  gamma_share: number; // default 0.3 (structural delta share boost)
  cap_factor: number; // default 1.5 (cap for multiplicative factor)
  final_cap: number; // default 200 (trace-only cap for adjusted raw growth)
  k_abs_scale: 'TH_abs' | number; // denominator for F_abs
  k_boost_scale: 'TH_abs' | number; // denominator for scenario 1 boost
  share_scale_mode: 'TH_share_or_5pp' | number; // scale S_share
}

/**
 * Top-level weights across modules. Keys must match module registration names.
 */
export interface ModuleWeights {
  /** Relative weight for Capacity (any non-negative). */
  capacity?: number;
  /** Relative weight for Work Opportunity (any non-negative). */
  workOpportunity?: number;
  /** Relative weight for Connection module (any non-negative). */
  connection?: number;
  /** Relative weight for Education module (any non-negative). */
  education?: number;
  /** Future modules are allowed via index signature. */
  [key: string]: number | undefined;
}

// -------------------------------- Healthcare Module Types --------------------------------

/** Canonical list of specialist treatment types (exported for UI). */
export const SPECIALIST_TREATMENT_TYPES: readonly string[] = [
  'dialysis',
  'rehabilitation',
  'physical_therapy',
  'mental_health',
  'oncology',
  'cardiology',
  'maternity',
  'pediatrics',
  'substance_abuse',
  'trauma',
  'orthopedic',
  'respiratory',
] as const;

/** Subweight ids for healthcare module. */
export type HealthcareSubweightId = 'healthcare.hospital' | 'healthcare.specialist';

export interface HealthcareSubweight {
  id: HealthcareSubweightId;
  weight: number; // relative raw weight
}

/** Municipality healthcare fields. */
export interface MunicipalityHealthcareFields {
  has_hospital?: boolean;
  specialist_facilities?: string[]; // subset of SPECIALIST_TREATMENT_TYPES
}

/** Input envelope for Healthcare scoring. */
export interface HealthcareInput {
  group: Group;
  /** Target municipality id being scored. */
  target_municipality_id: string;
  /** Map: municipality id -> region id. */
  municipality_region_map: Record<string, string>;
  /** Map: municipality id -> neighboring municipality ids. */
  adjacency_map: Record<string, string[]>;
  /** Lookup: municipality id -> healthcare fields (has_hospital, facilities). */
  municipality_healthcare_map: Record<string, MunicipalityHealthcareFields>;
  /** Optional subweights (hospital vs specialist); defaults equal when omitted. */
  subweights?: HealthcareSubweight[];
}

/** Per-person healthcare trace. */
export interface HealthcarePersonTrace {
  person_id: PersonId;
  needs_hospital: boolean;
  specialist_need: string | null;
  hospital_score?: number; // 0,25,50,100 or undefined if hospital subweight disabled or person not needing
  specialist_score?: number; // 0,25,50,100 or undefined if specialist subweight disabled or person not needing
  composite: number; // weighted person score (0..100)
  explanation: string; // bullet lines
}

/** Healthcare result. */
export interface HealthcareResult extends BaseModuleResult {
  score: number; // module score
  subscores: Array<{
    id: HealthcareSubweightId;
    weight: number;
    normalized_weight: number;
    score: number; // average over persons for that subcomponent
    contribution: number; // ŵ * score
  }>;
  persons: HealthcarePersonTrace[];
}

// -------------------------------- Connection Module Types --------------------------------

/** Allowed relation kinds for a person's single connection. */
export type ConnectionRelation =
  | 'friend'
  | 'close_family'
  | 'relative'
  | 'workplace'
  | 'school_place';

/** Subweight ids for connection relations. */
export type ConnectionSubweightId =
  | 'connection.friend'
  | 'connection.close_family'
  | 'connection.relative'
  | 'connection.workplace'
  | 'connection.school_place';

/** A per-person connection declaration (exclusive municipality OR region). */
export interface PersonConnection {
  /** Municipality id OR region id (mutually exclusive). */
  municipality_id?: string; // e.g. 'no-1'
  region_id?: string;       // e.g. 'region-east'
  /** Relation kind (optional – UI may set location first then relation). */
  relation?: ConnectionRelation;
}

/** Subweight configuration for connection module. */
export interface ConnectionSubweight {
  id: ConnectionSubweightId;
  weight: number; // relative (normalized internally)
}

/** Input envelope for connection scoring. */
export interface ConnectionInput {
  /** Group of persons (each may have one connection). */
  group: Group;
  /** The target municipality id we are scoring against. */
  target_municipality_id: string;
  /** Lookup: municipality id -> region id. */
  municipality_region_map: Record<string, string>;
  /** Lookup: municipality id -> array of neighboring municipality ids. */
  adjacency_map: Record<string, string[]>;
  /** Optional subweights (defaults equal across relations). */
  subweights?: ConnectionSubweight[];
}

/** Per-person trace for connection scoring. */
export interface ConnectionPersonTrace {
  person_id: PersonId;
  relation?: ConnectionRelation; // undefined if person has no connection
  declared: PersonConnection | null;
  match_level: 'exact' | 'neighbor' | 'region' | 'none';
  base_score: number; // 0..100 before relation weighting
  explanation: string; // bullet lines summarizing evaluation
}

/** Module result for connection scoring. */
export interface ConnectionResult extends BaseModuleResult {
  score: number; // weighted aggregate
  subscores: Array<{
    id: ConnectionSubweightId;
    weight: number; // normalized
    normalized_weight: number; // same as weight
    score: number; // average base score for that relation kind
    contribution: number; // weight * score
  }>;
  persons: ConnectionPersonTrace[];
}

// -------------------------------- Education Module Types --------------------------------

/** Canonical list of education facility types (exported for UI). */
export const EDUCATION_FACILITY_TYPES: readonly string[] = [
  'primary_school',
  'high_school',
  'university',
  'adult_language',
] as const;

export type EducationFacilityType = typeof EDUCATION_FACILITY_TYPES[number];

/** Subweight ids for education module (one per facility). */
export type EducationSubweightId =
  | 'education.primary_school'
  | 'education.high_school'
  | 'education.university'
  | 'education.adult_language';

export interface EducationSubweight {
  id: EducationSubweightId;
  weight: number; // relative raw weight
}

/** Municipality education facility flags. */
export interface MunicipalityEducationFields {
  has_primary_school?: boolean;
  has_high_school?: boolean;
  has_university?: boolean;
  has_adult_language?: boolean;
}

/** Input envelope for Education scoring. */
export interface EducationInput {
  group: Group;
  target_municipality_id: string;
  municipality_region_map: Record<string, string>;
  adjacency_map: Record<string, string[]>;
  municipality_education_map: Record<string, MunicipalityEducationFields>;
  subweights?: EducationSubweight[];
}

/** Per-person education trace. */
export interface EducationPersonTrace {
  person_id: PersonId;
  education_need: EducationFacilityType | null;
  tier_score?: number; // 0,25,50,100 when a valid need
  explanation: string;
}

/** Education module result. */
export interface EducationResult extends BaseModuleResult {
  score: number; // weighted aggregate (Σ ŵ_f · avg_tier_f)
  subscores: Array<{
    id: EducationSubweightId;
    weight: number; // normalized weight
    normalized_weight: number; // same as weight
    score: number; // average tier over persons needing that facility
    contribution: number; // w * score
  }>;
  persons: EducationPersonTrace[];
}

// -------------------- Unified Weight Configuration (UI Export) --------------------
/**
 * Full weight configuration exported by the UI for persistence / API calls.
 * Raw weights are integer 0..100 allocations summing 100 per level. Normalized
 * weights are provided for consumers expecting Σ=1. Subweight groups are
 * omitted when undefined in UI state.
 */
export interface WeightConfiguration {
  /** Raw top-level module weights (integers summing 100). */
  modules: Required<Pick<ModuleWeights,'capacity'|'workOpportunity'|'connection'|'education'>>;
  /** Normalized top-level module weights (Σ=1). */
  modules_normalized: Record<string, number>;
  /** Optional subweight groups keyed by module. */
  subweights?: {
    capacity?: CapacitySubweight[];
    workOpportunity?: WorkSubweight[];
    connection?: ConnectionSubweight[];
    healthcare?: HealthcareSubweight[];
    education?: EducationSubweight[];
  };
  /** Normalized subweight maps (same shape as subweights, but normalized lists). */
  subweights_normalized?: {
    capacity?: Array<CapacitySubweight & { normalized: number }>;
    workOpportunity?: Array<WorkSubweight & { normalized: number }>;
    connection?: Array<ConnectionSubweight & { normalized: number }>;
    healthcare?: Array<HealthcareSubweight & { normalized: number }>;
    education?: Array<EducationSubweight & { normalized: number }>;
  };
  /** Timestamp (ISO) when configuration was generated. */
  generated_at: string;
}
