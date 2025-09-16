import React from 'react';
import type { CalculatorScenarioBase, WorkNormalizationDraft } from '../types';

interface Props { scenario: CalculatorScenarioBase; onUpdate(patch: Partial<CalculatorScenarioBase>): void; onBack(): void; onNext(): void; }

export const StepOptions: React.FC<Props> = ({ scenario, onUpdate, onBack, onNext }) => {
  const opt = scenario.options || { capacity: { include_tentative: true, allow_overflow: false }, work: {} };
  function patch(next: Partial<CalculatorScenarioBase['options']>) { onUpdate({ options: { ...opt, ...next } }); }
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Modul opsjoner</h2>
  {scenario.module === 'capacity' && (
        <fieldset className="border p-2 rounded text-[11px] space-y-1 mb-4">
          <legend className="px-1 font-semibold">Kapasitet</legend>
          <label className="inline-flex items-center gap-1 text-[11px]">
    <input type="checkbox" checked={!!opt.capacity?.include_tentative} onChange={e=>patch({ capacity: { include_tentative: e.target.checked, allow_overflow: opt.capacity?.allow_overflow ?? false } })} /> Inkluder tentativ krav
          </label>
          <label className="inline-flex items-center gap-1 text-[11px]">
    <input type="checkbox" checked={!!opt.capacity?.allow_overflow} onChange={e=>patch({ capacity: { allow_overflow: e.target.checked, include_tentative: opt.capacity?.include_tentative ?? true } })} /> Tillat overflow straff
          </label>
        </fieldset>
      )}
      {scenario.module === 'workOpportunity' && (
        <fieldset className="border p-2 rounded text-[11px] space-y-2 mb-4">
          <legend className="px-1 font-semibold">Normalisering (arbeid)</legend>
      {(['tinyBaseThreshold','beta_boost_s1','damp_s4','gamma_share','cap_factor'] as (keyof WorkNormalizationDraft)[]).map(k => (
            <label key={k} className="flex items-center gap-2">
        <span className="w-32 text-right text-[10px]">{k}</span>
        <input type="number" value={opt.work?.[k] ?? ''} onChange={e=>patch({ work: { ...(opt.work||{}), [k]: e.target.value === '' ? undefined : Number(e.target.value) } })} className="border px-1 py-[1px] rounded w-28" />
            </label>
          ))}
          <div className="text-[10px] opacity-70">Tomt felt ⇒ default verdi brukes.</div>
        </fieldset>
      )}
      <div className="flex gap-2 mt-6">
        <button onClick={onBack} className="px-3 py-1 border rounded">Tilbake</button>
        <button onClick={onNext} className="px-3 py-1 bg-blue-600 text-white rounded">Neste</button>
      </div>
    </div>
  );
};
