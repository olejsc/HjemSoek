import type { Group, Person } from '../types';
import { CONNECTION_RELATION_LABEL_NB, EDUCATION_FACILITY_LABEL_NB, SPECIALIST_TREATMENT_LABEL_NB } from '../categories';
import { PROFESSION_LABEL_NB } from '../labels.nb';

export interface GroupDescriptionLookups {
  municipalitiesById: Record<string, { id: string; name?: string; region_id?: string }>;
  regionsById: Record<string, { id: string; name?: string }>;
}

export interface GroupDescriptionResult {
  groupParagraph: string; // Gruppebeskrivelse (no bullets)
  personsParagraph: string; // Sammensatt beskrivelse av individuelle behov (no bullets, sentences separated by newline? we will use \n between persons for readability in plain text block)
  fullText: string; // groupParagraph + two newlines + personsParagraph
}

// Natural Norwegian indefinite article + base phrase for person type
function baseIntro(personType: Person['personType']): { intro: string; article: 'en'|'et'; } {
  switch(personType) {
    case 'child': return { intro: 'Et barn', article: 'et' };
    case 'baby': return { intro: 'En baby', article: 'en' };
    case 'high_school_pupil': return { intro: 'En videregående elev', article: 'en' };
    case 'student': return { intro: 'En student', article: 'en' };
    case 'adult_working': return { intro: 'En voksen person i arbeid', article: 'en' };
    case 'adult_not_working': return { intro: 'En voksen person uten arbeid', article: 'en' };
    case 'senior': return { intro: 'En senior', article: 'en' };
  }
}

function ordinalAdjective(idx: number): string {
  switch(idx) {
    case 0: return 'første';
    case 1: return 'andre';
    case 2: return 'tredje';
    case 3: return 'fjerde';
    case 4: return 'femte';
    case 5: return 'sjette';
    case 6: return 'sjuende';
    case 7: return 'åttende';
    case 8: return 'niende';
    case 9: return 'tiende';
    default: return `${idx + 1}.`; // fallback numeric
  }
}


function describePerson(p: Person, idx: number, lookups: GroupDescriptionLookups, multi: boolean): string {
  const sentences: string[] = [];
  const { intro } = baseIntro(p.personType); // e.g. "En voksen person i arbeid"

  // Derive predicate (remove leading 'En ' / 'Et ' to reuse inside ordinal phrasing)
  const predicate = intro.replace(/^En?\s/i, '').replace(/^Et\s/i,'').trim();

  // Collect attribute phrases (ordered, concise)
  const attrs: string[] = [];
  if (p.profession) {
    const profLabel = PROFESSION_LABEL_NB[p.profession] || p.profession;
    attrs.push(`er ${profLabel}`);
  }
  if (p.needs_hospital || p.specialist_need) {
    if (p.needs_hospital && p.specialist_need) {
      const specLabel = SPECIALIST_TREATMENT_LABEL_NB[p.specialist_need] || p.specialist_need;
      attrs.push(`trenger sykehus og spesialist for ${specLabel}`);
    } else if (p.needs_hospital) {
      attrs.push('trenger sykehus');
    } else if (p.specialist_need) {
      const specLabel = SPECIALIST_TREATMENT_LABEL_NB[p.specialist_need] || p.specialist_need;
      attrs.push(`trenger spesialist for ${specLabel}`);
    }
  }
  if (p.education_need) {
    let eduLabel = EDUCATION_FACILITY_LABEL_NB[p.education_need];
    if (p.education_need === 'adult_language') eduLabel = 'voksenopplæring i språk';
    attrs.push(`har behov for ${eduLabel}`);
  }
  if (p.connection && p.connection.relation && (p.connection.municipality_id || p.connection.region_id)) {
    const rel = CONNECTION_RELATION_LABEL_NB[p.connection.relation];
    if (p.connection.municipality_id) {
      const m = lookups.municipalitiesById[p.connection.municipality_id];
      const muniName = m?.name || p.connection.municipality_id;
      const regionName = (m && lookups.regionsById[m.region_id || '']?.name) || undefined;
      attrs.push(regionName ? `har tilknytning til ${muniName} (${regionName}) med ${rel} der` : `har tilknytning til ${muniName} med ${rel} der`);
    } else if (p.connection.region_id) {
      const r = lookups.regionsById[p.connection.region_id];
      const regionName = r?.name || p.connection.region_id;
      attrs.push(`har tilknytning i regionen ${regionName} med ${rel}`);
    }
  }

  const ordinalIntro = multi ? `Den ${ordinalAdjective(idx)} personen er ${predicate}` : intro;

  // Decide which attrs go in first sentence (max 2)
  const firstAttrs = attrs.slice(0, 2);
  const remaining = attrs.slice(2);
  let firstSentence = ordinalIntro;
  if (firstAttrs.length) {
    // join with ' som ' then ' og ' for second attr
    if (firstAttrs.length === 1) firstSentence += ` som ${firstAttrs[0]}`;
    else firstSentence += ` som ${firstAttrs[0]} og ${firstAttrs[1]}`;
  }
  firstSentence += '.';
  sentences.push(firstSentence);

  // Remaining attributes each become its own sentence with ordinal pronoun
  if (remaining.length) {
    const connectors = ['Videre', 'I tillegg', 'Samtidig'];
    const pickConnector = (k: number) => connectors[(idx + k) % connectors.length]; // deterministic pseudo-random
    remaining.forEach((a, i) => {
      const c = pickConnector(i);
      // Transform attribute phrase into a grammatically correct continuation
      if (a.startsWith('er ')) {
        sentences.push(`${c} er personen ${a.slice(3)}.`);
      } else if (a.startsWith('trenger ')) {
        sentences.push(`${c} trenger personen ${a.slice(8)}.`);
      } else if (a.startsWith('har ')) {
        sentences.push(`${c} har personen ${a.slice(4)}.`);
      } else {
        sentences.push(`${c} har personen ${a}.`);
      }
    });
  }

  return sentences.join(' ');
}

export function generateGroupDescription(group: Group, lookups: GroupDescriptionLookups): GroupDescriptionResult {
  const size = group.persons.length;
  // Group paragraph – simple sentence; capacity style focus
  let groupParagraph: string;
  if (size === 0) groupParagraph = 'Ingen personer i gruppen.';
  else if (size === 1) groupParagraph = '';
  else groupParagraph = `Gruppen består av ${size} personer som skal bosettes.`;

  // Persons paragraph: each person sentence on its own line (plain text)
  const multi = size > 1;
  const personLines = group.persons.map((p, i) => describePerson(p, i, lookups, multi));
  const personsParagraph = personLines.join('\n');
  const fullText = groupParagraph ? (personsParagraph ? `${groupParagraph}\n\n${personsParagraph}` : groupParagraph) : personsParagraph;
  return { groupParagraph, personsParagraph, fullText };
}

export default generateGroupDescription;