import React from 'react';
import type { DraftPerson, CalculatorModule } from '../types';
import { SPECIALIST_TREATMENT_TYPES, EDUCATION_FACILITY_TYPES } from '../../types';
import type { PersonType } from '../../types';

interface Props {
  module: CalculatorModule;
  persons: DraftPerson[];
  professions: string[];
  municipalities: { id: string; name: string; region: string | null }[];
  regions: string[];
  onChange(next: DraftPerson[]): void;
}

const PERSON_TYPES: PersonType[] = ['baby','child','high_school_pupil','student','adult_working','adult_not_working','senior'];

export const PersonTable: React.FC<Props> = ({ module, persons, professions, municipalities, regions, onChange }) => {
  const update = (id: string, partial: Partial<DraftPerson>) => {
    onChange(persons.map(p => p.id === id ? { ...p, ...partial } : p));
  };
  const remove = (id: string) => onChange(persons.filter(p => p.id !== id));
  const add = () => {
    const nextIdx = persons.length + 1;
    onChange([...persons, { id: 'p'+nextIdx, personType: 'adult_working' }]);
  };
  return (
    <div className="space-y-2 text-[11px]">
      <button type="button" onClick={add} className="bg-blue-600 text-white text-xs px-2 py-1 rounded">Legg til person</button>
      <table className="w-full border text-[10px]">
        <thead className="bg-neutral-100">
          <tr>
            <th className="p-1 text-left">ID</th>
            <th className="p-1 text-left">Type</th>
            {(module==='workOpportunity') && <th className="p-1 text-left">Profesjon</th>}
            {(module==='connection') && <th className="p-1 text-left">Tilknytning</th>}
            {(module==='healthcare') && <th className="p-1 text-left">Helse behov</th>}
            {(module==='education') && <th className="p-1 text-left">Utdanning behov</th>}
            <th className="p-1"></th>
          </tr>
        </thead>
        <tbody>
          {persons.map(p => (
            <tr key={p.id} className="border-t">
              <td className="p-1 font-mono">{p.id}</td>
              <td className="p-1">
                <select value={p.personType||''} onChange={e=>update(p.id,{ personType: e.target.value as PersonType })} className="border px-1 py-[1px] rounded">
                  {PERSON_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </td>
              {module==='workOpportunity' && (
                <td className="p-1">
                  <select value={p.profession||''} onChange={e=>update(p.id,{ profession: e.target.value || undefined })} className="border px-1 py-[1px] rounded">
                    <option value="">(ingen)</option>
                    {professions.map(pr => <option key={pr} value={pr}>{pr}</option>)}
                  </select>
                </td>
              )}
              {module==='connection' && (
                <td className="p-1 w-64">
                  <div className="flex flex-col gap-1">
                    <select value={p.connection?.municipality_id || ''} onChange={e=>update(p.id,{ connection: { ...(p.connection||{}), municipality_id: e.target.value || undefined, region_id: undefined } })} className="border px-1 py-[1px] rounded">
                      <option value="">(kommune)</option>
                      {municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <select value={p.connection?.region_id || ''} onChange={e=>update(p.id,{ connection: { ...(p.connection||{}), region_id: e.target.value || undefined, municipality_id: undefined } })} className="border px-1 py-[1px] rounded">
                      <option value="">(region)</option>
                      {regions.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <select value={p.connection?.relation || ''} onChange={e=>update(p.id,{ connection: { ...(p.connection||{}), relation: e.target.value as any } })} className="border px-1 py-[1px] rounded">
                      <option value="">(relasjon)</option>
                      <option value="friend">friend</option>
                      <option value="close_family">close_family</option>
                      <option value="relative">relative</option>
                      <option value="workplace">workplace</option>
                      <option value="school_place">school_place</option>
                    </select>
                  </div>
                </td>
              )}
              {module==='healthcare' && (
                <td className="p-1">
                  <div className="flex flex-col gap-1">
                    <label className="inline-flex items-center gap-1">
                      <input type="checkbox" checked={!!p.needs_hospital} onChange={e=>update(p.id,{ needs_hospital: e.target.checked })} /> treng sykehus
                    </label>
                    <select value={p.specialist_need||''} onChange={e=>update(p.id,{ specialist_need: e.target.value || undefined })} className="border px-1 py-[1px] rounded">
                      <option value="">(spesialist)</option>
                      {SPECIALIST_TREATMENT_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </td>
              )}
              {module==='education' && (
                <td className="p-1">
                  <select value={p.education_need||''} onChange={e=>update(p.id,{ education_need: e.target.value || undefined })} className="border px-1 py-[1px] rounded">
                    <option value="">(behov)</option>
                    {EDUCATION_FACILITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
              )}
              <td className="p-1 text-right">
                <button type="button" onClick={()=>remove(p.id)} className="text-red-600">Slett</button>
              </td>
            </tr>
          ))}
          {persons.length === 0 && <tr><td colSpan={6} className="p-2 italic text-center">Ingen personer</td></tr>}
        </tbody>
      </table>
    </div>
  );
};
