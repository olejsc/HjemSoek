import React from 'react';
import type { CalculatorModule, DraftMunicipality, ProfessionHistoryDraft } from '../types';

interface Props {
  module: CalculatorModule;
  municipality: DraftMunicipality;
  professions: string[];
  regions: string[];
  allMunicipalities: DraftMunicipality[];
  onChange(next: DraftMunicipality): void;
}

export const MunicipalityForm: React.FC<Props> = ({ module, municipality, professions, regions, allMunicipalities, onChange }) => {
  function patch(partial: Partial<DraftMunicipality>) {
    onChange({ ...municipality, ...partial });
  }

  function updateHistory(prof: string, field: keyof ProfessionHistoryDraft, value: number | undefined) {
    const work = municipality.work || { profession_history: {} };
    const existing = work.profession_history[prof] || {};
    const ph: ProfessionHistoryDraft = { ...existing, [field]: value };
    const profession_history: Record<string, ProfessionHistoryDraft> = { ...work.profession_history, [prof]: ph };
    patch({ work: { profession_history } });
  }

  const neighborIds = municipality.neighbors;
  const toggleNeighbor = (id: string) => {
    if (id === municipality.id) return; // can't neighbor self
    const set = new Set(neighborIds);
    if (set.has(id)) set.delete(id); else set.add(id);
    patch({ neighbors: Array.from(set) });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <label className="flex flex-col">Navn
          <input value={municipality.name} onChange={e=>patch({ name: e.target.value })} className="border px-2 py-1 rounded" />
        </label>
        <label className="flex flex-col">Region
          <select value={municipality.region || ''} onChange={e=>patch({ region: e.target.value || null })} className="border px-2 py-1 rounded">
            <option value="">(ingen)</option>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
      </div>

      {module === 'capacity' && (
        <fieldset className="border p-2 rounded text-[11px] space-y-1">
          <legend className="px-1 font-semibold">Kapasitet</legend>
          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col">Total
              <input type="number" value={municipality.capacity?.capacity_total ?? ''} onChange={e=>patch({ capacity: { ...municipality.capacity, capacity_total: e.target.value === '' ? undefined : Number(e.target.value) } })} className="border px-1 py-[2px] rounded" />
            </label>
            <label className="flex flex-col">Bosatt nå
              <input type="number" value={municipality.capacity?.settled_current ?? ''} onChange={e=>patch({ capacity: { ...municipality.capacity, settled_current: e.target.value === '' ? undefined : Number(e.target.value) } })} className="border px-1 py-[2px] rounded" />
            </label>
            <label className="flex flex-col">Tentativ
              <input type="number" value={municipality.capacity?.tentative_claim ?? ''} onChange={e=>patch({ capacity: { ...municipality.capacity, tentative_claim: e.target.value === '' ? undefined : Number(e.target.value) } })} className="border px-1 py-[2px] rounded" />
            </label>
          </div>
        </fieldset>
      )}

      {module === 'workOpportunity' && (
        <fieldset className="border p-2 rounded text-[11px] space-y-2">
          <legend className="px-1 font-semibold">Arbeid</legend>
          <label className="flex flex-col max-w-[160px]">Arbeidsledighet %
            <input type="number" value={municipality.unemployment_rate ?? ''} onChange={e=>patch({ unemployment_rate: e.target.value === '' ? undefined : Number(e.target.value) })} className="border px-1 py-[2px] rounded" />
          </label>
          <details className="text-[10px]">
            <summary className="cursor-pointer select-none mb-1">Historikk per profesjon</summary>
            {professions.length === 0 && <div className="italic">Ingen profesjoner definert.</div>}
            {professions.map(p => {
              const h = municipality.work?.profession_history[p] || {};
              return (
                <div key={p} className="mb-2 border rounded p-1">
                  <div className="font-semibold text-[10px] mb-1">{p}</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
                    <label className="flex flex-col">Ansatte 5 år siden
                      <input type="number" value={h.number_of_employees_in_profession_5_years_ago ?? ''} onChange={e=>updateHistory(p,'number_of_employees_in_profession_5_years_ago', e.target.value === '' ? undefined : Number(e.target.value))} className="border px-1 py-[1px] rounded" />
                    </label>
                    <label className="flex flex-col">Ansatte nå
                      <input type="number" value={h.number_of_employees_in_profession_now ?? ''} onChange={e=>updateHistory(p,'number_of_employees_in_profession_now', e.target.value === '' ? undefined : Number(e.target.value))} className="border px-1 py-[1px] rounded" />
                    </label>
                    <label className="flex flex-col">Andel % 5 år siden
                      <input type="number" value={h.percentage_of_municipality_workforce_5_years_ago ?? ''} onChange={e=>updateHistory(p,'percentage_of_municipality_workforce_5_years_ago', e.target.value === '' ? undefined : Number(e.target.value))} className="border px-1 py-[1px] rounded" />
                    </label>
                    <label className="flex flex-col">Andel % nå
                      <input type="number" value={h.percentage_of_municipality_workforce_now ?? ''} onChange={e=>updateHistory(p,'percentage_of_municipality_workforce_now', e.target.value === '' ? undefined : Number(e.target.value))} className="border px-1 py-[1px] rounded" />
                    </label>
                  </div>
                </div>
              );
            })}
          </details>
        </fieldset>
      )}

      {module === 'healthcare' && (
        <fieldset className="border p-2 rounded text-[11px] space-y-2">
          <legend className="px-1 font-semibold">Helse</legend>
          <label className="inline-flex items-center gap-1 text-[11px]">
            <input type="checkbox" checked={!!municipality.healthcare?.has_hospital} onChange={e=>patch({ healthcare: { ...(municipality.healthcare||{ specialist_facilities: [] }), has_hospital: e.target.checked } })} />
            Har sykehus
          </label>
          <label className="flex flex-col text-[10px]">Spesialist fasiliteter (kommaseparert)
            <input value={(municipality.healthcare?.specialist_facilities||[]).join(',')} onChange={e=>patch({ healthcare: { ...(municipality.healthcare||{ has_hospital: false }), specialist_facilities: e.target.value.split(',').map(s=>s.trim()).filter(Boolean) } })} className="border px-1 py-[2px] rounded" />
          </label>
        </fieldset>
      )}

      {module === 'education' && (
        <fieldset className="border p-2 rounded text-[11px] space-y-2">
          <legend className="px-1 font-semibold">Utdanning</legend>
      {(['has_primary_school','has_high_school','has_university','has_adult_language'] as const).map(key => (
            <label key={key} className="inline-flex items-center gap-1">
        <input type="checkbox" checked={!!municipality.education?.[key]} onChange={e=>patch({ education: { ...(municipality.education||{}), [key]: e.target.checked } })} />
              {key.replace('has_','')}
            </label>
          ))}
        </fieldset>
      )}

      <fieldset className="border p-2 rounded text-[11px] space-y-1">
        <legend className="px-1 font-semibold">Naboer</legend>
        <div className="flex flex-wrap gap-2 text-[10px]">
          {allMunicipalities.filter(m=>m.id!==municipality.id).map(m => (
            <label key={m.id} className="inline-flex items-center gap-1">
              <input type="checkbox" checked={neighborIds.includes(m.id)} onChange={()=>toggleNeighbor(m.id)} />
              {m.name}
            </label>
          ))}
          {allMunicipalities.length <= 1 && <span className="opacity-60">Ingen andre kommuner</span>}
        </div>
      </fieldset>
    </div>
  );
};
