import React from 'react';
import type { CalculatorScenarioBase, DraftMunicipality } from '../types';
import { MunicipalityForm } from '../components/MunicipalityForm';

interface Props { scenario: CalculatorScenarioBase; onUpdate(patch: Partial<CalculatorScenarioBase>): void; onBack(): void; onNext(): void; }

export const StepMunicipalityEditor: React.FC<Props> = ({ scenario, onUpdate, onBack, onNext }) => {
  const [idx, setIdx] = React.useState(0);
  const current = scenario.municipalities[idx];
  function updateCurrent(next: DraftMunicipality) {
    onUpdate({ municipalities: scenario.municipalities.map((m,i)=> i===idx ? next : m ) });
  }
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Kommunedetaljer</h2>
      <div className="flex items-center gap-2 mb-3 text-xs">
        <span>Velg:</span>
        <select value={idx} onChange={e=>setIdx(Number(e.target.value))} className="border px-2 py-1 rounded text-xs">
          {scenario.municipalities.map((m,i)=><option key={m.id} value={i}>{m.name}</option>)}
        </select>
        <span className="opacity-60">{idx+1}/{scenario.municipalities.length}</span>
      </div>
      {current && (
        <MunicipalityForm module={scenario.module} municipality={current} professions={scenario.professions} regions={scenario.regions} allMunicipalities={scenario.municipalities} onChange={updateCurrent} />
      )}
      <div className="flex gap-2 mt-6">
        <button onClick={onBack} className="px-3 py-1 border rounded">Tilbake</button>
        <button onClick={onNext} className="px-3 py-1 bg-blue-600 text-white rounded">Neste</button>
      </div>
    </div>
  );
};
