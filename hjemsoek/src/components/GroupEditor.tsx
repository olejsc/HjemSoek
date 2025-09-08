import React from 'react';
import type { Group, Person, PersonType, ConnectionRelation, EducationFacilityType } from '../types';
import { SPECIALIST_TREATMENT_TYPES } from '../types';
import { PERSON_TYPE_LABEL_NB, CONNECTION_RELATION_LABEL_NB, EDUCATION_FACILITY_LABEL_NB, SPECIALIST_TREATMENT_LABEL_NB } from '../categories';
import { PROFESSION_LABEL_NB } from '../labels.nb';
import { allowedRelations, educationNeedsList, canHaveProfession } from '../categories/eligibility';
import { createNorwayMunicipalities, regions as mockRegions, professions as mockProfessions } from '../mockdata';

// Simple sequential id helper (local to component instance)
function useNextId(initial:number = 1) {
  const ref = React.useRef(initial);
  return React.useCallback(() => {
    const v = ref.current;
    ref.current += 1;
    return String(v); // PersonId is string
  }, []);
}

const PERSON_TYPES: PersonType[] = [
  'baby','child','high_school_pupil','student','adult_working','adult_not_working','senior'
];

// UI constant (placeholder option text shown at top of dropdowns)
const PLACEHOLDER = 'velg verdi';

export interface GroupEditorProps {
  value: Group;
  onChange(value: Group): void;
  // Optional lists for municipalities / regions to populate connection dropdowns
  municipalities?: { id: string; name?: string; region_id?: string }[];
  regions?: { id: string; name?: string }[];
  professions?: string[]; // external profession list if desired
}

export const GroupEditor: React.FC<GroupEditorProps> = ({ value, onChange, municipalities = [], regions = [], professions = [] }) => {
  const [showJson, setShowJson] = React.useState<boolean>(false); // hidden by default across platforms
  // Fallback mock data if host app doesn't provide
  const muniData = React.useMemo(() => {
    const src = municipalities.length ? municipalities : createNorwayMunicipalities(50,1);
    return [...src].sort((a,b) => (a.name || a.id).localeCompare(b.name || b.id, 'nb'));
  }, [municipalities]);
  const regionData = React.useMemo(() => {
    const src = regions.length ? regions : mockRegions;
    return [...src].sort((a,b) => (a.name || a.id).localeCompare(b.name || b.id, 'nb'));
  }, [regions]);
  const professionData = React.useMemo(() => {
    const src = professions.length ? professions : [...mockProfessions];
    return [...src].sort((a,b) => (PROFESSION_LABEL_NB[a] || a).localeCompare(PROFESSION_LABEL_NB[b] || b, 'nb'));
  }, [professions]);
  const nextId = useNextId(value.persons.length + 1);

  const updatePerson = (pid: string, patch: Partial<Person>) => {
    const persons = value.persons.map(p => p.id === pid ? { ...p, ...patch } : p);
    onChange({ persons, size: persons.length });
  };

  const removePerson = (pid: string) => {
    const persons = value.persons.filter(p => p.id !== pid);
    onChange({ persons, size: persons.length });
  };

  const addPerson = () => {
    const newPerson: Person = { id: nextId(), personType: 'adult_not_working' };
    const persons = [...value.persons, newPerson];
    onChange({ persons, size: persons.length });
  };

  if (!value.persons.length) {
    return (
      <div className="p-4 border border-dashed border-gray-400 text-center rounded">
        <button className="text-2xl px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded shadow" onClick={addPerson}>+ Opprett første person</button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex flex-col md:flex-row w-full">
        <div className={`overflow-x-auto rounded-xl shadow ring-1 ring-green-200 bg-white transition-all duration-300 flex-1 md:mr-4`}>  
        <div className="flex items-center justify-between px-4 py-2 border-b border-green-100 bg-green-50 rounded-t-xl gap-2">
          <h2 className="font-semibold text-green-900 text-sm">Personer</h2>
          <div className="flex items-center gap-2">
            {!showJson && (
              <button onClick={() => setShowJson(true)} className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-600 hover:bg-green-700 text-white shadow focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-green-500 md:hidden">
                Vis JSON
              </button>
            )}
            <button onClick={() => setShowJson(s => !s)} className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-600 hover:bg-green-700 text-white shadow focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-green-500 hidden md:inline-flex">
              {showJson ? 'Skjul JSON' : 'Vis JSON'}
            </button>
          </div>
        </div>
        <table className="w-full text-sm">
        <thead>
          <tr className="bg-green-50 text-left text-green-900">
            <th className="px-3 py-2 font-semibold first:rounded-tl-xl">#</th>
            <th className="px-3 py-2 font-semibold">PersonType</th>
            <th className="px-3 py-2 font-semibold">Yrke</th>
            <th className="px-3 py-2 font-semibold">Tilknytning (kommune)</th>
            <th className="px-3 py-2 font-semibold">Tilknytning (region)</th>
            <th className="px-3 py-2 font-semibold">Relasjon</th>
            <th className="px-3 py-2 font-semibold">Sykehus behov</th>
            <th className="px-3 py-2 font-semibold">Spesialist behov</th>
            <th className="px-3 py-2 font-semibold">Utdanning behov</th>
            <th className="px-3 py-2 font-semibold text-right last:rounded-tr-xl" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {value.persons.map((p, idx) => {
            const relAllowed = Array.from(allowedRelations(p.personType));
            const eduAllowed = educationNeedsList(p.personType);
            const canProfession = canHaveProfession(p.personType);
            return (
              <tr key={p.id} className="odd:bg-white even:bg-gray-50 hover:bg-green-50 transition-colors">
                <td className="px-3 py-2 align-top text-gray-500 text-xs font-medium">{idx + 1}</td>
                <td className="px-3 py-2">
                  <select className="border border-gray-300 rounded-md px-2 py-1 w-full bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500" value={p.personType} onChange={e => updatePerson(p.id, { personType: e.target.value as PersonType, profession: undefined, education_need: undefined, connection: undefined })}>
                    {PERSON_TYPES.map(t => <option key={t} value={t}>{PERSON_TYPE_LABEL_NB[t]}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  {canProfession ? (
                    <select className="border border-gray-300 rounded-md px-2 py-1 w-full bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500" value={p.profession || ''} onChange={e => updatePerson(p.id, { profession: e.target.value || undefined })}>
                      <option value="">{PLACEHOLDER}</option>
                      {professionData.map(pr => <option key={pr} value={pr}>{PROFESSION_LABEL_NB[pr] || pr}</option>)}
                    </select>
                  ) : <em className="text-gray-300">n/a</em>}
                </td>
                <td className="px-3 py-2">
                  <select className="border border-gray-300 rounded-md px-2 py-1 w-full bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500" value={p.connection?.municipality_id || ''} onChange={e => {
                    const municipality_id = e.target.value || undefined;
                    if (!municipality_id) { updatePerson(p.id, { connection: undefined }); return; }
                    const muni: any = muniData.find(m => m.id === municipality_id);
                    const region_id = muni?.region_id;
                    const connection = { municipality_id, region_id, relation: p.connection?.relation };
                    updatePerson(p.id, { connection });
                  }}>
                    <option value="">{PLACEHOLDER}</option>
                    {muniData.map(m => <option key={m.id} value={m.id}>{m.name || m.id}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select className="border border-gray-300 rounded-md px-2 py-1 w-full bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500" value={p.connection?.region_id || ''} onChange={e => {
                    const region_id = e.target.value || undefined;
                    if (!region_id) { updatePerson(p.id, { connection: undefined }); return; }
                    // keep municipality only if it matches selected region
                    const muni: any = muniData.find(m => m.id === p.connection?.municipality_id);
                    const municipality_id = muni && muni.region_id === region_id ? muni.id : undefined;
                    const connection = { region_id, municipality_id, relation: p.connection?.relation };
                    updatePerson(p.id, { connection });
                  }}>
                    <option value="">{PLACEHOLDER}</option>
                    {regionData.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  {relAllowed.length ? (
                    <select className="border border-gray-300 rounded-md px-2 py-1 w-full bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500" value={p.connection?.relation || ''} onChange={e => {
                      const relation = e.target.value as ConnectionRelation;
                      if (!relation) { updatePerson(p.id, { connection: undefined }); return; }
                      const connection = { relation, municipality_id: p.connection?.municipality_id, region_id: p.connection?.region_id };
                      updatePerson(p.id, { connection });
                    }}>
                      <option value="">{PLACEHOLDER}</option>
                      {relAllowed.map(r => <option key={r} value={r}>{CONNECTION_RELATION_LABEL_NB[r]}</option>)}
                    </select>
                  ) : <em className="text-gray-300">n/a</em>}
                </td>
                <td className="px-3 py-2 text-center">
                  <input className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded" type="checkbox" checked={!!p.needs_hospital} onChange={e => updatePerson(p.id, { needs_hospital: e.target.checked || undefined })} />
                </td>
                <td className="px-3 py-2">
                  <select className="border border-gray-300 rounded-md px-2 py-1 w-full bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500" value={p.specialist_need || ''} onChange={e => updatePerson(p.id, { specialist_need: e.target.value || undefined })}>
                    <option value="">{PLACEHOLDER}</option>
                    {SPECIALIST_TREATMENT_TYPES.map(s => <option key={s} value={s}>{SPECIALIST_TREATMENT_LABEL_NB[s] || s}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  {eduAllowed.length ? (
                    <select className="border border-gray-300 rounded-md px-2 py-1 w-full bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500" value={p.education_need || ''} onChange={e => updatePerson(p.id, { education_need: e.target.value as EducationFacilityType || undefined })}>
                      <option value="">{PLACEHOLDER}</option>
                      {eduAllowed.map(n => <option key={n} value={n}>{EDUCATION_FACILITY_LABEL_NB[n]}</option>)}
                    </select>
                  ) : <em className="text-gray-300">n/a</em>}
                </td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => removePerson(p.id)} className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500">Fjern</button>
                </td>
              </tr>
            );
          })}
          <tr>
            <td colSpan={10} className="p-3">
              <button onClick={addPerson} className="inline-flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md text-sm shadow focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-green-500">+ Legg til person</button>
            </td>
          </tr>
        </tbody>
        </table>
        </div>
  {/* Collapsible JSON side panel */}
  <div className={`transition-all duration-300 ease-in-out overflow-hidden ${showJson ? 'md:w-80 opacity-100 translate-x-0' : 'md:w-0 w-0 opacity-0 pointer-events-none'} `}>
          <div className="h-full rounded-xl shadow ring-1 ring-gray-200 bg-white flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50">
              <h2 className="font-semibold text-gray-700 text-sm">JSON</h2>
              <button onClick={() => setShowJson(false)} className="hidden md:inline-flex text-gray-500 hover:text-gray-700 text-xs">Lukk</button>
            </div>
            <pre className="flex-1 m-0 p-3 text-[11px] leading-snug overflow-auto bg-gray-50">{JSON.stringify(value, null, 2)}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupEditor;
