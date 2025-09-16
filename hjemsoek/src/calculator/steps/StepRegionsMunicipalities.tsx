import React from 'react';
import type { CalculatorScenarioBase, DraftMunicipality } from '../types';

interface Props { scenario: CalculatorScenarioBase; onUpdate(patch: Partial<CalculatorScenarioBase>): void; onBack(): void; onNext(): void; }

export const StepRegionsMunicipalities: React.FC<Props> = ({ scenario, onUpdate, onBack, onNext }) => {
  const [regionDraft, setRegionDraft] = React.useState('');
  const maxMunicipalities = 5;
  const addRegion = () => {
    const v = regionDraft.trim();
    if (!v) return;
    if (scenario.regions.includes(v)) return;
    onUpdate({ regions: [...scenario.regions, v] });
    setRegionDraft('');
  };
  function addMunicipality() {
    if (scenario.municipalities.length >= maxMunicipalities) return;
    const idx = scenario.municipalities.length + 1;
    const m: DraftMunicipality = { id: 'm'+idx, name: 'm'+idx, region: null, neighbors: [], capacity: {}, unemployment_rate: undefined, work: { profession_history: {} }, healthcare: { has_hospital: false, specialist_facilities: [] }, education: { has_primary_school: false, has_high_school: false, has_university: false, has_adult_language: false } };
    onUpdate({ municipalities: [...scenario.municipalities, m] });
  }
  const removeMunicipality = (id: string) => {
    onUpdate({ municipalities: scenario.municipalities.filter(m => m.id !== id).map(m => ({ ...m, neighbors: m.neighbors.filter(n=>n!==id) })) });
  };
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Regioner & kommuner</h2>
      <div className="mb-4 space-y-2">
        <div className="text-xs font-semibold">Regioner</div>
        <div className="flex gap-2">
          <input value={regionDraft} onChange={e=>setRegionDraft(e.target.value)} placeholder="Ny region" className="border px-2 py-1 text-xs rounded flex-1" />
          <button type="button" onClick={addRegion} className="bg-blue-600 text-white text-xs px-2 rounded">Legg til</button>
        </div>
        <ul className="flex flex-wrap gap-1">
          {scenario.regions.map(r => (
            <li key={r} className="bg-neutral-200 rounded px-2 py-[2px] text-[10px] flex items-center gap-1">
              <span>{r}</span>
              <button type="button" onClick={()=>onUpdate({ regions: scenario.regions.filter(x=>x!==r), municipalities: scenario.municipalities.map(m => m.region===r ? { ...m, region: null } : m) })} className="text-red-600">×</button>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="text-xs font-semibold">Kommuner ({scenario.municipalities.length}/{maxMunicipalities})</div>
          <button disabled={scenario.municipalities.length>=maxMunicipalities} type="button" onClick={addMunicipality} className="px-2 py-1 text-xs rounded bg-blue-600 text-white disabled:opacity-40">Ny kommune</button>
          {scenario.municipalities.length>=maxMunicipalities && <span className="text-[10px] text-red-600">Maks {maxMunicipalities} kommuner</span>}
        </div>
        <table className="w-full border text-[10px]">
          <thead className="bg-neutral-100"><tr><th className="p-1 text-left">ID</th><th className="p-1 text-left">Navn</th><th className="p-1 text-left">Region</th><th className="p-1"></th></tr></thead>
          <tbody>
            {scenario.municipalities.map(m => (
              <tr key={m.id} className="border-t">
                <td className="p-1 font-mono">{m.id}</td>
                <td className="p-1"><input value={m.name} onChange={e=>onUpdate({ municipalities: scenario.municipalities.map(mm => mm.id===m.id ? { ...mm, name: e.target.value } : mm) })} className="border px-1 py-[1px] rounded" /></td>
                <td className="p-1">
                  <select value={m.region || ''} onChange={e=>onUpdate({ municipalities: scenario.municipalities.map(mm => mm.id===m.id ? { ...mm, region: e.target.value || null } : mm) })} className="border px-1 py-[1px] rounded">
                    <option value="">(ingen)</option>
                    {scenario.regions.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="p-1 text-right"><button type="button" onClick={()=>removeMunicipality(m.id)} className="text-red-600">Slett</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={onBack} className="px-3 py-1 border rounded">Tilbake</button>
        <button onClick={onNext} className="px-3 py-1 bg-blue-600 text-white rounded" disabled={scenario.municipalities.length===0}>Neste</button>
      </div>
    </div>
  );
};
