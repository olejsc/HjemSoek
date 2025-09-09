import type { ModuleWeights, CapacitySubweight, WorkSubweight, ConnectionSubweight, HealthcareSubweight, EducationSubweight, WeightConfiguration } from '../types';

/** Normalize a list of {weight} items into fractions summing 1. */
function normalizeList<T extends { weight: number }>(items: T[] | undefined): Array<T & { normalized: number }> | undefined {
  if (!items || !items.length) return undefined;
  const total = items.reduce((a,b)=>a + (b.weight||0),0) || 1;
  return items.map(it => ({ ...it, normalized: total === 0 ? 0 : it.weight / total }));
}

/** Normalize top-level module weights into fractions (Σ=1 over present keys). */
function normalizeModules(modules: ModuleWeights): Record<string, number> {
  const entries = Object.entries(modules).filter(([,v]) => typeof v === 'number');
  const sum = entries.reduce((a,[,v]) => a + (v as number), 0) || 1;
  const out: Record<string, number> = {};
  for (const [k,v] of entries) out[k] = sum === 0 ? 0 : (v as number)/sum;
  return out;
}

export interface BuildWeightConfigArgs {
  moduleWeights: ModuleWeights;
  capacitySubweights?: CapacitySubweight[];
  workSubweights?: WorkSubweight[];
  connectionSubweights?: ConnectionSubweight[];
  healthcareSubweights?: HealthcareSubweight[];
  educationSubweights?: EducationSubweight[];
}

/** Build a full WeightConfiguration object from current UI state. */
export function buildWeightConfiguration(args: BuildWeightConfigArgs): WeightConfiguration {
  const { moduleWeights, capacitySubweights, workSubweights, connectionSubweights, healthcareSubweights, educationSubweights } = args;
  const modules: { capacity: number; workOpportunity: number; connection: number; healthcare: number; education: number } = {
    capacity: moduleWeights.capacity ?? 0,
    workOpportunity: moduleWeights.workOpportunity ?? 0,
    connection: moduleWeights.connection ?? 0,
    healthcare: moduleWeights.healthcare ?? 0,
    education: moduleWeights.education ?? 0,
  };
  const modules_normalized = normalizeModules(modules);
  const subweights = {
    capacity: capacitySubweights,
    workOpportunity: workSubweights,
    connection: connectionSubweights,
    healthcare: healthcareSubweights,
    education: educationSubweights,
  };
  const subweights_normalized = {
    capacity: normalizeList(capacitySubweights),
    workOpportunity: normalizeList(workSubweights),
    connection: normalizeList(connectionSubweights),
    healthcare: normalizeList(healthcareSubweights),
    education: normalizeList(educationSubweights),
  };
  return {
    modules,
    modules_normalized,
    subweights,
    subweights_normalized,
    generated_at: new Date().toISOString(),
  };
}
