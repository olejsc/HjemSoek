import type {
  ModuleWeights,
  CapacitySubweight,
  WorkSubweight,
  ConnectionSubweight,
  HealthcareSubweight,
  EducationSubweight,
  CapacityOptions,
} from './types';

export interface WeightTemplate {
  id: string;                 // internal slug id
  name: string;               // display name (NB)
  description: string;        // short NB description
  moduleWeights: ModuleWeights; // integers summing 100
  capacitySubweights: CapacitySubweight[];
  workSubweights: WorkSubweight[];
  connectionSubweights: ConnectionSubweight[];
  healthcareSubweights: HealthcareSubweight[];
  educationSubweights: EducationSubweight[];
  capacityOptions: CapacityOptions;
}

// ---------------- Template Definitions ----------------

// NOTE: All weight arrays intentionally sum to 100 so the UI will not re-normalize them.

export const WEIGHT_TEMPLATES: WeightTemplate[] = [
  {
    id: 'normal_bosetting',
    name: 'Normal bosetting',
    description: 'Balansert – litt ekstra vekt på arbeid og kapasitet.',
    moduleWeights: {
      capacity: 25,
      workOpportunity: 25,
      connection: 20,
      healthcare: 15,
      education: 15,
    },
    capacitySubweights: [
      { id: 'capacity.core', weight: 100 },
    ],
    workSubweights: [
      { id: 'work.chance', weight: 50 },
      { id: 'work.growth', weight: 50 },
    ],
    connectionSubweights: [
      { id: 'connection.friend', weight: 20 },
      { id: 'connection.close_family', weight: 20 },
      { id: 'connection.relative', weight: 20 },
      { id: 'connection.workplace', weight: 20 },
      { id: 'connection.school_place', weight: 20 },
    ],
    healthcareSubweights: [
      { id: 'healthcare.hospital', weight: 50 },
      { id: 'healthcare.specialist', weight: 50 },
    ],
    educationSubweights: [
      { id: 'education.primary_school', weight: 25 },
      { id: 'education.high_school', weight: 25 },
      { id: 'education.university', weight: 25 },
      { id: 'education.adult_language', weight: 25 },
    ],
  capacityOptions: { include_tentative: true, allow_overflow: false },
  },
  {
    id: 'enslige_mindrearige',
    name: 'Enslige mindreårige',
    description: 'Fokus på barn/ungdom: utdanning, helse og tilknytning.',
    moduleWeights: {
      capacity: 10,
      workOpportunity: 5,
      connection: 25,
      healthcare: 25,
      education: 35,
    },
    capacitySubweights: [
      { id: 'capacity.core', weight: 100 },
    ],
    workSubweights: [
      { id: 'work.chance', weight: 60 },
      { id: 'work.growth', weight: 40 },
    ],
    connectionSubweights: [
      { id: 'connection.close_family', weight: 40 },
      { id: 'connection.relative', weight: 25 },
      { id: 'connection.friend', weight: 25 },
      { id: 'connection.workplace', weight: 5 },
      { id: 'connection.school_place', weight: 5 },
    ],
    healthcareSubweights: [
      { id: 'healthcare.hospital', weight: 50 },
      { id: 'healthcare.specialist', weight: 50 },
    ],
    educationSubweights: [
      { id: 'education.primary_school', weight: 45 },
      { id: 'education.high_school', weight: 35 },
      { id: 'education.university', weight: 10 },
      { id: 'education.adult_language', weight: 10 },
    ],
    capacityOptions: { include_tentative: true, allow_overflow: false },
  },
  {
    id: 'helsefokus',
    name: 'Helsefokus',
    description: 'Helse tungt vektet; noe vekt på arbeid og tilknytning.',
    moduleWeights: {
      capacity: 10,
      workOpportunity: 20,
      connection: 15,
      healthcare: 45,
      education: 10,
    },
    capacitySubweights: [
      { id: 'capacity.core', weight: 100 },
    ],
    workSubweights: [
      { id: 'work.chance', weight: 60 },
      { id: 'work.growth', weight: 40 },
    ],
    connectionSubweights: [
      { id: 'connection.close_family', weight: 35 },
      { id: 'connection.relative', weight: 25 },
      { id: 'connection.friend', weight: 20 },
      { id: 'connection.workplace', weight: 10 },
      { id: 'connection.school_place', weight: 10 },
    ],
    healthcareSubweights: [
      { id: 'healthcare.hospital', weight: 55 },
      { id: 'healthcare.specialist', weight: 45 },
    ],
    educationSubweights: [
      { id: 'education.primary_school', weight: 25 },
      { id: 'education.high_school', weight: 25 },
      { id: 'education.university', weight: 25 },
      { id: 'education.adult_language', weight: 25 },
    ],
  capacityOptions: { include_tentative: true, allow_overflow: false },
  },
];

export function getTemplateById(id: string): WeightTemplate | undefined {
  return WEIGHT_TEMPLATES.find(t => t.id === id);
}

export const DEFAULT_TEMPLATE_ID = 'normal_bosetting';
