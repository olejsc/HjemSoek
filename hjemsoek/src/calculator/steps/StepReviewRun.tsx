import React from 'react';
import type { CalculatorScenarioBase } from '../types';

interface Props { scenario: CalculatorScenarioBase; onBack(): void; onRun(): void; }

export const StepReviewRun: React.FC<Props> = ({ scenario, onBack, onRun }) => {
  const lines: Array<[string,string]> = [
    ['Modul', scenario.module],
    ['Profesjoner', String(scenario.professions.length)],
    ['Regioner', String(scenario.regions.length)],
    ['Kommuner', String(scenario.municipalities.length)],
    ['Personer', String(scenario.persons.length)],
  ];
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Oppsummering</h2>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        {lines.map(([k,v]) => <div key={k} className="border rounded p-2 flex justify-between"><span className="opacity-70">{k}</span><span className="font-semibold">{v}</span></div>)}
      </div>
      <details className="mt-4 text-[10px]">
        <summary className="cursor-pointer select-none font-semibold">Mer detaljer (JSON)</summary>
        <pre className="mt-2 max-h-64 overflow-auto border p-2 bg-neutral-50">{JSON.stringify({ ...scenario, lastResult: undefined, lastFullResult: undefined }, null, 2)}</pre>
      </details>
      <div className="flex gap-2 mt-6">
        <button onClick={onBack} className="px-3 py-1 border rounded">Tilbake</button>
        <button onClick={onRun} className="px-3 py-1 bg-green-600 text-white rounded">Kjør</button>
      </div>
    </div>
  );
};
