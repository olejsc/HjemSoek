import React from 'react';
import type { CalculatorModule } from '../types';

interface Props { value: CalculatorModule; onChange(m: CalculatorModule): void; onNext(): void; }

export const StepModuleSelect: React.FC<Props> = ({ value, onChange, onNext }) => (
  <div>
    <h2 className="text-lg font-semibold mb-3">Velg modul</h2>
    <select value={value} onChange={e => onChange(e.target.value as CalculatorModule)} className="border px-2 py-1 rounded">
      <option value="capacity">Kapasitet</option>
      <option value="workOpportunity">Arbeid</option>
      <option value="connection">Tilknytning</option>
      <option value="healthcare">Helse</option>
      <option value="education">Utdanning</option>
    </select>
    <div className="mt-4">
      <button onClick={onNext} className="bg-blue-600 text-white px-3 py-1 rounded">Neste</button>
    </div>
  </div>
);
