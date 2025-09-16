import type {
  PersonType,
  ConnectionRelation,
  EducationFacilityType,
  BaseModuleResult,
  CapacityInput,
  WorkOpportunityInput,
  ConnectionInput,
  HealthcareInput,
  EducationInput,
  CapacityResult,
  WorkOpportunityResult,
  ConnectionResult,
  HealthcareResult,
  EducationResult,
} from '../types';

export interface ProfessionHistoryDraft {
  number_of_employees_in_profession_5_years_ago?: number;
  number_of_employees_in_profession_now?: number;
  percentage_of_municipality_workforce_5_years_ago?: number;
  percentage_of_municipality_workforce_now?: number;
}

export interface DraftMunicipality {
  id: string;
  name: string;
  region: string | null;
  neighbors: string[];
  // Capacity
  capacity?: { capacity_total?: number; settled_current?: number; tentative_claim?: number };
  // Work (unemployment + history)
  unemployment_rate?: number;
  work?: { profession_history: Record<string, ProfessionHistoryDraft> };
  // Healthcare
  healthcare?: { has_hospital?: boolean; specialist_facilities: string[] };
  // Education
  education?: { has_primary_school?: boolean; has_high_school?: boolean; has_university?: boolean; has_adult_language?: boolean };
}

export interface DraftPerson {
  id: string;
  personType?: PersonType;
  profession?: string;
  connection?: { municipality_id?: string; region_id?: string; relation?: ConnectionRelation };
  needs_hospital?: boolean;
  specialist_need?: string;
  education_need?: EducationFacilityType;
}

export type CalculatorModule = 'capacity' | 'workOpportunity' | 'connection' | 'healthcare' | 'education';

export interface WorkNormalizationDraft {
  tinyBaseThreshold?: number;
  beta_boost_s1?: number;
  damp_s4?: number;
  gamma_share?: number;
  cap_factor?: number;
}

export interface CalculatorScenarioBase {
  module: CalculatorModule;
  professions: string[];
  regions: string[];
  municipalities: DraftMunicipality[];
  persons: DraftPerson[];
  subweights: Record<string, number>;
  options?: {
    capacity?: { include_tentative: boolean; allow_overflow: boolean };
    work?: WorkNormalizationDraft;
  };
  lastResult?: BaseModuleResult;
  lastFullResult?: ModuleFullResult;
  resultStale?: boolean;
}

export interface ValidationIssue {
  code: string;
  level: 'error' | 'warn';
  message: string;
  step: string;
  fieldPath?: string;
}

export interface BuildResult<TInput> { input?: TInput; issues: ValidationIssue[]; }

export type CapacityBuild = BuildResult<CapacityInput>;
export type WorkBuild = BuildResult<WorkOpportunityInput>;
export type ConnectionBuild = BuildResult<ConnectionInput>;
export type HealthcareBuild = BuildResult<HealthcareInput>;
export type EducationBuild = BuildResult<EducationInput>;

export type WizardStepKey =
  | 'module'
  | 'professions'
  | 'regions'
  | 'municipalities'
  | 'persons'
  | 'subweights'
  | 'options'
  | 'review'
  | 'results';

export interface WizardState { step: WizardStepKey; scenario: CalculatorScenarioBase; }

export type WizardAction =
  | { type: 'SET_STEP'; step: WizardStepKey }
  | { type: 'UPDATE_SCENARIO'; patch: Partial<CalculatorScenarioBase> }
  | { type: 'REPLACE_SCENARIO'; scenario: CalculatorScenarioBase }
  | { type: 'MARK_RESULT_STALE' }
  | { type: 'SET_RESULT'; base: BaseModuleResult; full: ModuleFullResult }
  | { type: 'RESET_SCENARIO' };

export const DEFAULT_SUBWEIGHTS: Record<CalculatorModule, Record<string, number>> = {
  capacity: { 'capacity.core': 100 },
  workOpportunity: { 'work.chance': 50, 'work.growth': 50 },
  connection: {
    'connection.friend': 20,
    'connection.close_family': 20,
    'connection.relative': 20,
    'connection.workplace': 20,
    'connection.school_place': 20,
  },
  healthcare: { 'healthcare.hospital': 50, 'healthcare.specialist': 50 },
  education: {
    'education.primary_school': 25,
    'education.high_school': 25,
    'education.university': 25,
    'education.adult_language': 25,
  },
};

export function createInitialScenario(module: CalculatorModule): CalculatorScenarioBase {
  const baseMunicipality: DraftMunicipality = {
    id: 'm1',
    name: 'm1',
    region: null,
    neighbors: [],
    capacity: { capacity_total: module === 'capacity' ? 100 : undefined, settled_current: module === 'capacity' ? 50 : undefined, tentative_claim: 0 },
    unemployment_rate: module === 'workOpportunity' ? 4 : undefined,
    work: { profession_history: {} },
    healthcare: { has_hospital: false, specialist_facilities: [] },
    education: { has_primary_school: false, has_high_school: false, has_university: false, has_adult_language: false },
  };
  const basePerson = () => ({ id: 'p1', personType: 'adult_working' as PersonType });
  const persons = (() => {
    switch (module) {
      case 'capacity': return [{ id: 'p1', personType: 'adult_not_working' as PersonType }];
      case 'workOpportunity': return [basePerson()];
      case 'connection': return [basePerson()];
      case 'healthcare': return [basePerson()];
      case 'education': return [{ id: 'p1', personType: 'child' as PersonType }];
    }
  })();
  return {
    module,
    professions: [],
    regions: [],
    municipalities: [baseMunicipality],
    persons,
    subweights: { ...DEFAULT_SUBWEIGHTS[module] },
    options: { capacity: { include_tentative: true, allow_overflow: false }, work: {} },
    lastResult: undefined,
    lastFullResult: undefined,
    resultStale: false,
  };
}

// Union result type for convenience (display / storage)
export type ModuleFullResult =
  | CapacityResult
  | WorkOpportunityResult
  | ConnectionResult
  | HealthcareResult
  | EducationResult;
