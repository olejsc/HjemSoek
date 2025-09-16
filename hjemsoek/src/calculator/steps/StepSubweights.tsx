import React from 'react';
import type { CalculatorScenarioBase } from '../types';
import { SubweightEditorLocal } from '../components/SubweightEditorLocal';

interface Props { scenario: CalculatorScenarioBase; onUpdate(patch: Partial<CalculatorScenarioBase>): void; onBack(): void; onNext(): void; }

export const StepSubweights: React.FC<Props> = ({ scenario, onUpdate, onBack, onNext }) => {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Undervekter</h2>
      <SubweightEditorLocal subweights={scenario.subweights} onChange={sw=>onUpdate({ subweights: sw })} />
      <div className="flex gap-2 mt-6">
        <button onClick={onBack} className="px-3 py-1 border rounded">Tilbake</button>
        <button onClick={onNext} className="px-3 py-1 bg-blue-600 text-white rounded">Neste</button>
      </div>
    </div>
  );
};
