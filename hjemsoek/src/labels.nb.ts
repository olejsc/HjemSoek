// Norwegian (Bokmål) label mappings for enum-like string unions.
// Each map is exhaustive for current values; new values should extend here.

import { SPECIALIST_TREATMENT_TYPES } from './types';
import type { PersonType, ConnectionRelation, EducationFacilityType } from './types';

// PersonType labels
export const PERSON_TYPE_LABEL_NB: Record<PersonType, string> = {
  baby: 'baby',
  child: 'barn',
  high_school_pupil: 'videregående elev',
  student: 'student',
  adult_working: 'voksen i arbeid',
  adult_not_working: 'voksen uten arbeid',
  senior: 'senior',
};

// Connection relations
export const CONNECTION_RELATION_LABEL_NB: Record<ConnectionRelation, string> = {
  friend: 'venn',
  close_family: 'nær familie',
  relative: 'slektning',
  workplace: 'arbeidsplass',
  school_place: 'skole/studiested',
};

// Education facilities
export const EDUCATION_FACILITY_LABEL_NB: Record<EducationFacilityType, string> = {
  primary_school: 'grunnskole',
  high_school: 'videregående skole',
  university: 'universitet/høgskole',
  adult_language: 'voksenopplæring språk',
};

// Specialist treatment types dynamic list -> labels (fall back to id if missing)
export const SPECIALIST_TREATMENT_LABEL_NB: Record<string, string> = Object.fromEntries(
  SPECIALIST_TREATMENT_TYPES.map(id => [id, ({
    dialysis: 'dialyse',
    rehabilitation: 'rehabilitering',
    physical_therapy: 'fysioterapi',
    mental_health: 'psykisk helse',
    oncology: 'onkologi (kreft)',
    cardiology: 'kardiologi (hjerte)',
    maternity: 'føde/barsel',
    pediatrics: 'pediatri (barn)',
    substance_abuse: 'rusbehandling',
    trauma: 'traume',
    orthopedic: 'ortopedi',
    respiratory: 'respiratorisk',
  } as Record<string,string>)[id] || id])
) as Record<string,string>;

// Generic helper to safely fetch label with fallback to key
export function labelNb<K extends string>(map: Record<K,string> | Record<string,string>, key: K | string): string {
  return (map as any)[key] || String(key);
}

// Barrel export convenience (can be re-exported by modules as needed)
export const nbLabels: Record<string, any> = {
  personType: PERSON_TYPE_LABEL_NB,
  relation: CONNECTION_RELATION_LABEL_NB,
  educationFacility: EDUCATION_FACILITY_LABEL_NB,
  specialistTreatment: SPECIALIST_TREATMENT_LABEL_NB,
  label: labelNb,
};

// Profession labels (Norwegian) – keys must match mock profession ids
export const PROFESSION_LABEL_NB: Record<string,string> = {
  teacher: 'lærer',
  nurse: 'sykepleier',
  engineer: 'ingeniør',
  developer: 'utvikler',
  farmer: 'bonde',
  driver: 'sjåfør',
  carpenter: 'snekker',
  electrician: 'elektriker',
  chef: 'kokk',
  sales: 'salgsmedarbeider',
};

// Extend barrel
nbLabels['profession'] = PROFESSION_LABEL_NB;
