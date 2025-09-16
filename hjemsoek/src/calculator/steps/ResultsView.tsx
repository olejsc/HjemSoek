import React from 'react';
import type { ModuleFullResult } from '../types';

interface Props { result: ModuleFullResult | undefined; stale: boolean; onRerun(): void; onClose(): void; onBack(): void; onReset(): void; }

// Runtime helpers without using 'any' in public surface – keep local casting minimal and contained.
interface GenericSubscore { id: string; normalized_weight: number; score?: number; contribution?: number; weight?: number; }
// Minimal per-person discriminated possibilities
type PersonTrace = {
  person_id: string;
  chance?: number; growth?: number; composite?: number; // work
  relation?: string; match_level?: string; base_score?: number; // connection
  hospital_score?: number; specialist_score?: number; // healthcare
  education_need?: string; tier_score?: number; // education
  explanation?: string;
};
const isCapacity = (r: ModuleFullResult): r is ModuleFullResult & { capacity_score: number } =>
  typeof (r as unknown as { capacity_score?: unknown }).capacity_score === 'number';
const hasSubscoresArray = (r: ModuleFullResult): r is ModuleFullResult & { subscores: GenericSubscore[] } => {
  const maybe = (r as unknown as { subscores?: unknown }).subscores;
  return Array.isArray(maybe);
};
const hasPersonsArray = (r: ModuleFullResult): r is ModuleFullResult & { persons: PersonTrace[] } => {
  const maybe = (r as unknown as { persons?: unknown }).persons;
  return Array.isArray(maybe);
};

export const ResultsView: React.FC<Props> = ({ result, stale, onRerun, onClose, onBack, onReset }) => {
  const [showTrace, setShowTrace] = React.useState(false);
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Resultat</h2>
      {stale && <div className="text-orange-600 text-xs mb-2">Endringer gjort – kjør på nytt for oppdatert resultat.</div>}
      {!result && <div className="text-xs">Ingen kjøring enda.</div>}
      {result && (
        <div className="space-y-4">
          <div className="p-3 border rounded bg-white flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="font-semibold text-sm">Score: {Math.round(result.effective_score)}%</div>
              <span className={`text-[9px] px-2 py-[2px] rounded-full uppercase tracking-wide ${
                result.mode === 'feasible' ? 'bg-green-100 text-green-700' :
                result.mode === 'overflow_penalty' ? 'bg-amber-100 text-amber-700' :
                result.mode === 'infeasible' ? 'bg-red-100 text-red-700' :
                'bg-neutral-200 text-neutral-700'
              }`}>{result.mode}</span>
            </div>
            {isCapacity(result) && <div className="text-[10px]">Kapasitets-score: {result.capacity_score}%</div>}
            <div className="text-[10px] opacity-70">Mode: {result.mode} | Max: {result.max_possible}% | Confidence: {result.confidence ?? '—'}</div>
            <ul className="list-disc ml-4 text-[10px]">
              {result.explanation.split('\n').filter(Boolean).map((l,i)=><li key={i}>{l}</li>)}
            </ul>
          </div>
          {hasSubscoresArray(result) && (
            <div>
              <h3 className="font-semibold text-xs mb-1">Undervekter</h3>
              <table className="w-full border text-[10px]">
                <thead className="bg-neutral-100"><tr><th className="p-1 text-left">ID</th><th className="p-1 text-right">Vekt (norm)</th><th className="p-1 text-right">Score</th><th className="p-1 text-right">Bidrag</th></tr></thead>
                <tbody>
                  {result.subscores.map(s => (
                    <tr key={s.id} className="border-t">
                      <td className="p-1 font-mono">{s.id}</td>
                      <td className="p-1 text-right">{(s.normalized_weight*100).toFixed(1)}%</td>
                      <td className="p-1 text-right">{s.score != null ? Math.round(s.score) : '—'}</td>
                      <td className="p-1 text-right">{s.contribution != null ? Math.round(s.contribution) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {hasPersonsArray(result) && (
            <details open className="border rounded p-2">
              <summary className="cursor-pointer select-none font-semibold text-xs">Personer ({result.persons.length})</summary>
              <div className="mt-2 max-h-56 overflow-auto">
                <table className="w-full border text-[10px]">
                  <thead className="bg-neutral-100"><tr><th className="p-1 text-left">Person</th><th className="p-1">Detaljer</th></tr></thead>
                  <tbody>
                    {result.persons.map((p)=> (
                      <tr key={p.person_id} className="border-t align-top">
                        <td className="p-1 font-mono whitespace-nowrap">{p.person_id}</td>
                        <td className="p-1">
                          <div className="flex flex-col gap-1">
                            {p.chance !== undefined && <div>Chance: {Math.round(p.chance)} | Growth: {Math.round(p.growth ?? 0)} | Composite: {Math.round(p.composite ?? 0)}</div>}
                            {p.match_level && <div>Relasjon: {p.relation || '—'} · Match: {p.match_level} · Base {p.base_score}</div>}
                            {(p.hospital_score !== undefined || p.specialist_score !== undefined) && <div>Hospital: {p.hospital_score ?? '—'} | Specialist: {p.specialist_score ?? '—'} | Composite: {Math.round(p.composite ?? 0)}</div>}
                            {p.tier_score !== undefined && <div>Need: {p.education_need || '—'} | Tier: {p.tier_score}</div>}
                            <ul className="list-disc ml-4">
                              {p.explanation?.split('\n').filter(Boolean).map((l:string,i:number)=><li key={i}>{l}</li>)}
                            </ul>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
          <div>
            <button type="button" onClick={()=>setShowTrace(v=>!v)} className="text-[10px] underline">{showTrace? 'Skjul' : 'Vis'} full JSON trace</button>
            {showTrace && <pre className="overflow-auto max-h-64 mt-2 border p-2 bg-neutral-50 text-[10px]">{JSON.stringify(result, null, 2)}</pre>}
          </div>
        </div>
      )}
      <div className="flex gap-2 mt-4">
        <button onClick={onBack} className="border px-3 py-1 rounded">Tilbake</button>
        <button onClick={onRerun} className="bg-blue-600 text-white px-3 py-1 rounded">Kjør på nytt</button>
        <button onClick={onReset} className="border px-3 py-1 rounded text-red-600">Reset</button>
        <button onClick={onClose} className="ml-auto bg-neutral-700 text-white px-3 py-1 rounded">Lukk</button>
      </div>
    </div>
  );
};
