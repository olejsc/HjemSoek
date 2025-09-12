import { describe, it, expect } from 'vitest';
import { generateGroupDescription } from '../utils/groupDescription';
import type { Group } from '../types';

const municipalities = [
  { id: 'm1', name: 'Oslo', region_id: 'r1' },
  { id: 'm2', name: 'Bergen', region_id: 'r2' },
];
const regions = [
  { id: 'r1', name: 'Øst' },
  { id: 'r2', name: 'Vest' },
];

describe('generateGroupDescription', () => {
  it('creates paragraphs and full text with persons', () => {
    const group: Group = {
      persons: [
        { id: '1', personType: 'adult_working', profession: 'teacher', needs_hospital: true },
        { id: '2', personType: 'student', connection: { municipality_id: 'm1', relation: 'close_family' }, specialist_need: 'cardiology', education_need: 'university' },
      ],
    };
    const res = generateGroupDescription(group, { municipalitiesById: Object.fromEntries(municipalities.map(m => [m.id, m])), regionsById: Object.fromEntries(regions.map(r => [r.id, r])) });
  expect(res.groupParagraph).toContain('består av 2 personer');
  expect(res.personsParagraph.split('\n').length).toBe(2);
  expect(res.fullText).toMatch(/Den første personen er voksen person i arbeid/);
  // Second person sentences should use ordinal pronoun
  expect(res.fullText).toMatch(/Den andre/);
  });

  it('handles empty group', () => {
    const group: Group = { persons: [] };
    const res = generateGroupDescription(group, { municipalitiesById: {}, regionsById: {} });
  expect(res.fullText).toBe('Ingen personer i gruppen.');
  });
});