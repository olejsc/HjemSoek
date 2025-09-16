import React from 'react';
import type { CalculatorScenarioBase } from '../types';
import { ProfessionListEditor } from '../components/ProfessionListEditor';

interface Props { scenario: CalculatorScenarioBase; onUpdate(patch: Partial<CalculatorScenarioBase>): void; onBack(): void; onNext(): void; }

export const StepProfessions: React.FC<Props> = ({ scenario, onUpdate, onBack, onNext }) => {
  const required = scenario.module === 'workOpportunity';
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Profesjoner</h2>
      <p className="text-xs opacity-70 mb-4">Definer profesjoner relevant for vekst‑ og sjansescoring. {required ? 'Minst én kreves.' : 'Valgfritt for denne modulen.'}</p>
      <ProfessionListEditor professions={scenario.professions} onChange={p=>onUpdate({ professions: p })} required={required} />
      <div className="flex gap-2 mt-6">
        <button onClick={onBack} className="px-3 py-1 border rounded">Tilbake</button>
        <button onClick={onNext} className="px-3 py-1 bg-blue-600 text-white rounded" disabled={required && scenario.professions.length===0}>Neste</button>
      </div>
    </div>
  );
};
