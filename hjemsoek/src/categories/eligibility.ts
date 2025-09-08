import type { PersonType, ConnectionRelation, EducationFacilityType } from '../types';

/** Person types eligible for Work Opportunity scoring. */
export const WORK_ELIGIBLE: ReadonlySet<PersonType> = new Set([
  'high_school_pupil',
  'student',
  'adult_working',
  'adult_not_working',
]);

/** Person types that may have a profession specified. */
export const PROFESSION_ELIGIBLE: ReadonlySet<PersonType> = new Set([
  'high_school_pupil', // allow early profession interest / study track
  'student',
  'adult_working',
  'adult_not_working',
]);

/** Relation allowances per person type. */
const RELATIONS_BY_TYPE: Record<PersonType, ReadonlySet<ConnectionRelation>> = {
  baby: new Set(),
  child: new Set(['friend', 'close_family', 'relative']),
  high_school_pupil: new Set(['friend', 'close_family', 'relative', 'workplace', 'school_place']),
  student: new Set(['friend', 'close_family', 'relative', 'workplace', 'school_place']),
  adult_working: new Set(['friend', 'close_family', 'relative', 'workplace', 'school_place']),
  adult_not_working: new Set(['friend', 'close_family', 'relative', 'workplace', 'school_place']),
  senior: new Set(['friend', 'close_family', 'relative']), // no workplace or school_place
};

/** Education facility allowances per person type (single selectable need). */
const EDUCATION_NEEDS_BY_TYPE: Record<PersonType, ReadonlySet<EducationFacilityType>> = {
  baby: new Set(),
  child: new Set(['primary_school','high_school']),
  high_school_pupil: new Set(['high_school','university']),
  student: new Set(['university','adult_language']),
  adult_working: new Set(['university','adult_language']),
  adult_not_working: new Set(['high_school','university','adult_language']),
  senior: new Set(['university','adult_language']),
};

export function canHaveProfession(type: PersonType): boolean {
  return PROFESSION_ELIGIBLE.has(type);
}

export function isWorkEligible(type: PersonType): boolean {
  return WORK_ELIGIBLE.has(type);
}

export function allowedRelations(type: PersonType): ReadonlySet<ConnectionRelation> {
  return RELATIONS_BY_TYPE[type] || new Set();
}

export function canHaveRelation(type: PersonType, relation: ConnectionRelation): boolean {
  return allowedRelations(type).has(relation);
}

/** Return allowed education facilities for a person type (UI helper). */
export function allowedEducationNeeds(type: PersonType): ReadonlySet<EducationFacilityType> {
  return EDUCATION_NEEDS_BY_TYPE[type] || new Set();
}

/** Convenience list function returning array form (stable order). */
export function educationNeedsList(type: PersonType): EducationFacilityType[] {
  const order: EducationFacilityType[] = ['primary_school','high_school','university','adult_language'];
  const allowed = allowedEducationNeeds(type);
  return order.filter(o => allowed.has(o));
}

/** Determine module confidence (binary) from eligible count. */
export function confidenceFromEligible(eligibleCount: number): 0 | 1 {
  return eligibleCount > 0 ? 1 : 0;
}
