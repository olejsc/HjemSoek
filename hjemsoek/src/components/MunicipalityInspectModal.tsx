import React from 'react';
import type {
  Group,
  CapacityResult,
  WorkOpportunityResult,
  ConnectionResult,
  HealthcareResult,
  EducationResult
} from '../types';
import type { Municipality } from '../mockdata';

// NOTE: We intentionally keep prop surface minimal & dedicated.
// The scoring result union types are kept as 'any' to avoid tight coupling; adjust if stricter typing desired.
export interface MunicipalityInspectData {
  municipality: Municipality;
  overall: number;
  capacityRes: CapacityResult | null;
  workRes: WorkOpportunityResult | null;
  connectionRes: ConnectionResult | null;
  healthcareRes: HealthcareResult | null;
  educationRes: EducationResult | null;
  aggregate: AggregateResult | null;
}

export interface MunicipalityInspectModalProps {
  data: MunicipalityInspectData;
  group: Group;
  activeModules: string[];
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

// Profession labels (Norwegian) localised here
const PROFESSION_NB: Record<string,string> = {
  teacher: 'Lærer',
  nurse: 'Sykepleier',
  engineer: 'Ingeniør',
  developer: 'Utvikler',
  farmer: 'Bonde',
  driver: 'Sjåfør',
  carpenter: 'Tømrer',
  electrician: 'Elektriker',
  chef: 'Kokk',
  sales: 'Selger'
};

const MODULE_STYLE: Record<string,{accent:string; bg:string; text:string}> = {
  capacity: { accent: 'border-l-4 border-blue-500', bg: 'bg-blue-50', text: 'text-blue-700' },
  workOpportunity: { accent: 'border-l-4 border-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
  connection: { accent: 'border-l-4 border-indigo-500', bg: 'bg-indigo-50', text: 'text-indigo-700' },
  healthcare: { accent: 'border-l-4 border-rose-500', bg: 'bg-rose-50', text: 'text-rose-700' },
  education: { accent: 'border-l-4 border-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
};

// ---- Lightweight shared result interfaces (mirrors subset of original scoring outputs) ----
interface AggregateResult { weights: Record<string, number> }

const MunicipalityInspectModal: React.FC<MunicipalityInspectModalProps> = ({ data, group, activeModules, onClose, onPrev, onNext, hasPrev, hasNext }) => {
  // Escape & focus trap (lightweight)
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev && onPrev) onPrev();
      if (e.key === 'ArrowRight' && hasNext && onNext) onNext();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext, hasPrev, hasNext]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-8">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-full overflow-auto ring-1 ring-gray-200 text-xs">
        <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b bg-white gap-2">
          <div className="flex items-center gap-4">
            <h3 className="font-semibold text-gray-800 text-sm">Detaljer: {data.municipality.name}</h3>
            <nav className="flex items-center gap-1" aria-label="Naviger kommuner">
              <button disabled={!hasPrev} onClick={onPrev} className={`px-2 py-1 rounded text-[10px] font-medium ${hasPrev ? 'bg-gray-200 hover:bg-gray-300 text-gray-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>◀ Forrige</button>
              <button disabled={!hasNext} onClick={onNext} className={`px-2 py-1 rounded text-[10px] font-medium ${hasNext ? 'bg-gray-200 hover:bg-gray-300 text-gray-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>Neste ▶</button>
            </nav>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xs">Lukk ✕</button>
        </div>
        <ModalContent data={data} group={group} activeModules={activeModules} />
      </div>
    </div>
  );
};

interface ModalContentProps { data: MunicipalityInspectData; group: Group; activeModules: string[]; }
const ModalContent: React.FC<ModalContentProps> = ({ data, group, activeModules }) => {
  const [showSummary, setShowSummary] = React.useState(false);
  const [openPerson, setOpenPerson] = React.useState<string | null>(null);

  const m = data.municipality;
  const free = Math.max(0, m.capacity_total - m.settled_current);
  const professionsInMunicipality = Object.keys(m.work_opportunity?.profession_history || {});
  const professionsCount = professionsInMunicipality.length;
  const specialistCount = m.specialist_facilities?.length || 0;

  const workObj = data.workRes;
  const connObj = data.connectionRes;
  const healthObj = data.healthcareRes;
  const eduObj = data.educationRes;

  const personRows = React.useMemo(() => {
    return group.persons.map(p => {
      const work = workObj?.persons?.find(pp => pp.person_id === p.id);
      const conn = connObj?.persons?.find(pp => pp.person_id === p.id);
      const health = healthObj?.persons?.find(pp => pp.person_id === p.id);
      const edu = eduObj?.persons?.find(pp => pp.person_id === p.id);
      return { p, work, conn, health, edu };
    });
  }, [group.persons, workObj, connObj, healthObj, eduObj]);

  return (
    <div className="p-4 space-y-6">
      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <InfoBox label="Fylke" value={m.county || '—'} />
        <InfoBox label="Region" value={m.region_id} />
        <InfoBox label="Total kapasitet" value={m.capacity_total} />
        <InfoBox label="Allerede bosatt" value={m.settled_current} />
        <InfoBox label="Ledig kapasitet" value={free} />
        {m.tentative_claim != null && <InfoBox label="Tentativt krav" value={m.tentative_claim} />}
        <InfoBox label="Arbeidsledighet" value={m.work_opportunity?.unemployment_rate != null ? m.work_opportunity.unemployment_rate + '%' : '—'} />
        <InfoBox label="Yrker i kommunen" value={professionsCount} items={professionsInMunicipality.map(p=>PROFESSION_NB[p]||p)} />
        <InfoBox label="Sykehus" value={m.has_hospital ? 'Ja' : 'Nei'} />
        <InfoBox label="Spesialist tilbud" value={specialistCount > 0 ? specialistCount : 'Ingen'} tooltip={m.specialist_facilities?.join(', ')} items={m.specialist_facilities} />
        <InfoBox label="Grunnskole" value={m.has_primary_school ? 'Ja' : 'Nei'} />
        <InfoBox label="Videregående" value={m.has_high_school ? 'Ja' : 'Nei'} />
        <InfoBox label="Universitet" value={m.has_university ? 'Ja' : 'Nei'} />
        <InfoBox label="Voksenopplæring" value={m.has_adult_language ? 'Ja' : 'Nei'} />
        <InfoBox label="Gruppestørrelse" value={group.persons.length} />
        <InfoBox label="Total score" value={data.overall.toFixed(1) + '%'} />
      </section>

      <ModuleDetailGroups inspect={data} activeModules={activeModules} />

      <section className="border rounded-md">
        <button onClick={() => setShowSummary(s => !s)} className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-left">
          <span className="font-semibold text-gray-700 text-xs">Gruppesammendrag</span>
          <span className="text-[10px] text-gray-500">{showSummary ? '▼' : '►'}</span>
        </button>
        {showSummary && (
          <div className="p-3 space-y-4">
            <div>
              <h4 className="font-semibold mb-1 text-gray-700 text-xs">Modulvekter</h4>
        {data.aggregate && (
                <div className="flex flex-wrap gap-2">
          {Object.entries(data.aggregate.weights).map(([k,v]) => (
                    <div key={k} className="px-2 py-1 bg-gray-100 rounded text-[10px] font-medium text-gray-700">{k}: {(v*100).toFixed(1)}%</div>
                  ))}
                </div>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {(['capacity','workOpportunity','connection','healthcare','education'] as const).map(mod => {
                const res = (mod === 'capacity' ? data.capacityRes : mod === 'workOpportunity' ? data.workRes : mod === 'connection' ? data.connectionRes : mod === 'healthcare' ? data.healthcareRes : data.educationRes);
                if (!res || !activeModules.includes(mod)) return null;
                const { effective_score, max_possible, explanation, subscores } = res as { effective_score?: number; max_possible?: number; explanation?: string; subscores?: Array<{id:string; normalized_weight:number; score?:number; contribution?:number}> };
                return (
                  <div key={mod} className="border rounded p-2 bg-white">
                    <div className="font-semibold text-gray-700 mb-1 capitalize">{mod}</div>
                    <div className="mb-1">Score: {typeof effective_score === 'number' ? effective_score.toFixed(1) : '-'}% {max_possible != null && <> (maks {max_possible})</>}</div>
                    {Array.isArray(subscores) && subscores.length > 0 && (
                      <div className="overflow-x-auto mb-2">
                        <table className="min-w-full text-[10px]">
                          <thead>
                            <tr className="bg-gray-50 text-left">
                              <th className="px-1 py-0.5">Del</th>
                              <th className="px-1 py-0.5">Vekt</th>
                              <th className="px-1 py-0.5">Score</th>
                              <th className="px-1 py-0.5">Bidrag</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {subscores.map(s => (
                              <tr key={s.id}>
                                <td className="px-1 py-0.5">{s.id}</td>
                                <td className="px-1 py-0.5">{(s.normalized_weight*100).toFixed(1)}%</td>
                                <td className="px-1 py-0.5">{s.score != null ? s.score.toFixed(1) : '-'}</td>
                                <td className="px-1 py-0.5">{s.contribution != null ? s.contribution.toFixed(1) : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {explanation && (
                      <pre className="whitespace-pre-wrap bg-gray-50 rounded p-2 font-mono text-[9px] leading-snug border text-gray-700 max-h-40 overflow-auto">{String(explanation)}</pre>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section>
        <h4 className="font-semibold text-gray-700 mb-2 text-xs">Per-person detaljert bidrag</h4>
        <div className="overflow-x-auto border rounded-md">
          <table className="min-w-full text-[11px]">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-2 py-1">Person</th>
                <th className="px-2 py-1">Type</th>
                {activeModules.includes('workOpportunity') && <th className="px-2 py-1">Arbeid</th>}
                {activeModules.includes('connection') && <th className="px-2 py-1">Tilknytning</th>}
                {activeModules.includes('healthcare') && <th className="px-2 py-1">Helse</th>}
                {activeModules.includes('education') && <th className="px-2 py-1">Utdanning</th>}
                <th className="px-2 py-1 text-right">Detaljer</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {personRows.map(row => {
                const pid = row.p.id;
                const open = openPerson === pid;
                return (
                  <React.Fragment key={pid}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-2 py-1 font-medium text-gray-700">{pid}</td>
                      <td className="px-2 py-1">{row.p.personType}</td>
                      {activeModules.includes('workOpportunity') && <td className="px-2 py-1">{row.work ? row.work.composite.toFixed(1) + '%' : '—'}</td>}
                      {activeModules.includes('connection') && <td className="px-2 py-1">{row.conn ? row.conn.base_score.toFixed(1) + '%' : '—'}</td>}
                      {activeModules.includes('healthcare') && <td className="px-2 py-1">{row.health ? row.health.composite.toFixed(1) + '%' : '—'}</td>}
                      {activeModules.includes('education') && <td className="px-2 py-1">{row.edu && row.edu.tier_score != null ? row.edu.tier_score.toFixed(1) + '%' : '—'}</td>}
                      <td className="px-2 py-1 text-right">
                        <button onClick={() => setOpenPerson(open ? null : pid)} className="text-[10px] px-2 py-0.5 rounded bg-gray-200 hover:bg-gray-300">{open ? 'Skjul' : 'Vis'}</button>
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-gray-50/60">
                        <td className="px-2 py-2" colSpan={6}>
                          <div className="grid gap-2 md:grid-cols-2">
                            {activeModules.includes('workOpportunity') && row.work && (
                              <div className="border rounded p-2 bg-white">
                                <div className="font-semibold mb-1 text-gray-700 text-[11px]">Arbeid</div>
                                <div className="mb-1">Composite: {row.work.composite.toFixed(1)}%</div>
                                <div className="mb-1">Chance: {row.work.chance.toFixed(1)}% | Growth: {row.work.growth.toFixed(1)}%</div>
                                <pre className="whitespace-pre-wrap bg-gray-50 rounded p-2 font-mono text-[9px] leading-snug max-h-40 overflow-auto">{row.work.explanation}</pre>
                              </div>
                            )}
                            {activeModules.includes('connection') && row.conn && (
                              <div className="border rounded p-2 bg-white">
                                <div className="font-semibold mb-1 text-gray-700 text-[11px]">Tilknytning</div>
                                <div className="mb-1">Base score: {row.conn.base_score.toFixed(1)}% ({row.conn.match_level})</div>
                                <div className="mb-1">Relasjon: {row.conn.relation || '—'}</div>
                                <pre className="whitespace-pre-wrap bg-gray-50 rounded p-2 font-mono text-[9px] leading-snug max-h-40 overflow-auto">{row.conn.explanation}</pre>
                              </div>
                            )}
                            {activeModules.includes('healthcare') && row.health && (
                              <div className="border rounded p-2 bg-white">
                                <div className="font-semibold mb-1 text-gray-700 text-[11px]">Helse</div>
                                <div className="mb-1">Composite: {row.health.composite.toFixed(1)}%</div>
                                <div className="mb-1">Sykehus: {row.health.hospital_score != null ? row.health.hospital_score + '%' : '—'} | Spesialist: {row.health.specialist_score != null ? row.health.specialist_score + '%' : '—'}</div>
                                <pre className="whitespace-pre-wrap bg-gray-50 rounded p-2 font-mono text-[9px] leading-snug max-h-40 overflow-auto">{row.health.explanation}</pre>
                              </div>
                            )}
                            {activeModules.includes('education') && row.edu && (
                              <div className="border rounded p-2 bg-white">
                                <div className="font-semibold mb-1 text-gray-700 text-[11px]">Utdanning</div>
                                <div className="mb-1">Tier score: {row.edu.tier_score != null ? row.edu.tier_score + '%' : '—'}</div>
                                <div className="mb-1">Behov: {row.edu.education_need || '—'}</div>
                                <pre className="whitespace-pre-wrap bg-gray-50 rounded p-2 font-mono text-[9px] leading-snug max-h-40 overflow-auto">{row.edu.explanation}</pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

const ModuleDetailGroups: React.FC<{ inspect: MunicipalityInspectData; activeModules: string[] }> = ({ inspect, activeModules }) => {
  const [open, setOpen] = React.useState<Record<string, boolean>>({ workOpportunity: true });
  const m = inspect.municipality;
  const workHist = m.work_opportunity?.profession_history;
  const professions = workHist ? Object.keys(workHist) : [];
  function toggle(key: string) { setOpen(o => ({ ...o, [key]: !o[key] })); }

  return (
    <section className="space-y-3">
              {activeModules.includes('workOpportunity') && (
        <div className={`rounded shadow-sm border ${MODULE_STYLE.workOpportunity.accent} overflow-hidden`}>
          <button onClick={() => toggle('workOpportunity')} className={`w-full flex items-center justify-between px-3 py-2 ${MODULE_STYLE.workOpportunity.bg} ${MODULE_STYLE.workOpportunity.text} font-semibold text-[11px]`}>Arbeid (yrker & vekst){' '}<span className="text-[10px]">{open.workOpportunity ? '▼' : '►'}</span></button>
          {open.workOpportunity && (
            <div className="p-3 bg-white text-[11px] space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <Badge label={`Arbeidsledighet: ${m.work_opportunity?.unemployment_rate ?? '—'}%`} color="amber" />
                <Badge label={`Yrker med historikk: ${professions.length}`} color="amber" />
              </div>
              {professions.length > 0 ? (
                <div className="overflow-x-auto max-w-[520px]">
                  <table className="text-[10px] w-full table-fixed">
                    <thead>
                      <tr className="bg-amber-50 text-left">
                        <th className="px-1 py-0.5 w-[90px]">Yrke</th>
                        <th className="px-1 py-0.5 w-[52px]" title="Antall ansatte for 5 år siden (rå)">Ansatte₀</th>
                        <th className="px-1 py-0.5 w-[52px]" title="Antall ansatte nå">Ansatte₁</th>
                        <th className="px-1 py-0.5 w-[45px]" title="Endring i antall (Ansatte₁ − justert base)">Δ antall</th>
                        <th className="px-1 py-0.5 w-[55px]" title="Prosentvekst ((Ansatte₁−base)/base*100)">Vekst%</th>
                        <th className="px-1 py-0.5 w-[60px]" title="Endring i andel av arbeidsstyrke (prosentpoeng)">Δ andel pp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {professions.map(p => {
                        const h = workHist![p];
                        const P0_raw = h.number_of_employees_in_profession_5_years_ago ?? 0;
                        const P0_eff = P0_raw === 0 ? 1 : P0_raw;
                        const P1 = h.number_of_employees_in_profession_now ?? 0;
                        const deltaN = P1 - P0_eff;
                        const pct = P0_eff === 0 ? 0 : ((P1 - P0_eff)/P0_eff)*100;
                        const share0 = h.percentage_of_municipality_workforce_5_years_ago ?? 0;
                        const share1 = h.percentage_of_municipality_workforce_now ?? 0;
                        const dShare = share1 - share0;
                        const pctStr = (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
                        const pctColor = pct > 20 ? 'text-green-600' : pct > 0 ? 'text-green-500' : pct < 0 ? 'text-red-600' : 'text-gray-600';
                        return (
                          <tr key={p} className="hover:bg-amber-50/60">
                            <td className="px-1 py-0.5 font-medium text-gray-800" title={p}>{PROFESSION_NB[p] || p}</td>
                            <td className="px-1 py-0.5">{P0_raw}</td>
                            <td className="px-1 py-0.5">{P1}</td>
                            <td className="px-1 py-0.5">{deltaN}</td>
                            <td className={`px-1 py-0.5 ${pctColor}`}>{pctStr}</td>
                            <td className="px-1 py-0.5">{dShare > 0 ? '+'+dShare.toFixed(2)+'pp' : dShare.toFixed(2)+'pp'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-gray-500 text-[10px]">Ingen historikk for yrker.</div>
              )}
              {(() => {
                function extractThresholds(trace: unknown): Record<string, number> | null {
                  if (!trace || typeof trace !== 'object') return null;
                  const maybeInputs = (trace as { inputs?: unknown }).inputs;
                  if (!maybeInputs || typeof maybeInputs !== 'object') return null;
                  const thresholds = (maybeInputs as { normalization_thresholds?: unknown }).normalization_thresholds;
                  if (!thresholds || typeof thresholds !== 'object') return null;
                  // Filter numeric values only
                  const out: Record<string, number> = {};
                  for (const [k,v] of Object.entries(thresholds as Record<string, unknown>)) {
                    if (typeof v === 'number') out[k] = v;
                  }
                  return Object.keys(out).length ? out : null;
                }
                return extractThresholds(inspect.workRes?.trace);
              })() && (
                <div className="text-[10px] bg-amber-50 border border-amber-200 rounded p-2 leading-snug">
                  <div className="font-semibold mb-1">Terskler (median + MAD)</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries((() => {
                      function extract(trace: unknown): Record<string, number> {
                        if (!trace || typeof trace !== 'object') return {};
                        const inputs = (trace as { inputs?: unknown }).inputs;
                        if (!inputs || typeof inputs !== 'object') return {};
                        const thresholds = (inputs as { normalization_thresholds?: unknown }).normalization_thresholds;
                        if (!thresholds || typeof thresholds !== 'object') return {};
                        const out: Record<string, number> = {};
                        for (const [k,v] of Object.entries(thresholds as Record<string, unknown>)) {
                          if (typeof v === 'number') out[k] = v;
                        }
                        return out;
                      }
                      return extract(inspect.workRes?.trace);
                    })()).map(([k,v]) => {
                      const display = typeof v === 'number' ? v.toFixed(2) : String(v);
                      return (<span key={k} className="px-1.5 py-0.5 bg-amber-100 rounded text-amber-800">{k}: {display}</span>);
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {activeModules.includes('healthcare') && (
        <div className={`rounded shadow-sm border ${MODULE_STYLE.healthcare.accent} overflow-hidden`}>
          <button onClick={() => toggle('healthcare')} className={`w-full flex items-center justify-between px-3 py-2 ${MODULE_STYLE.healthcare.bg} ${MODULE_STYLE.healthcare.text} font-semibold text-[11px]`}>Helse (spesialister){' '}<span className="text-[10px]">{open.healthcare ? '▼' : '►'}</span></button>
          {open.healthcare && (
            <div className="p-3 bg-white text-[11px] space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <Badge label={`Sykehus: ${m.has_hospital ? 'Ja' : 'Nei'}`} color={m.has_hospital ? 'green' : 'rose'} />
                <Badge label={`Antall spesialist typer: ${m.specialist_facilities?.length || 0}`} color="rose" />
              </div>
              {m.specialist_facilities?.length ? (
                <ul className="list-disc ml-4 text-[10px] space-y-0.5">
                  {m.specialist_facilities.map(s => <li key={s} className="text-rose-700">{s}</li>)}
                </ul>
              ) : (
                <div className="text-gray-500 text-[10px]">Ingen spesialisttilbud registrert.</div>
              )}
            </div>
          )}
        </div>
      )}
      {activeModules.includes('education') && (
        <div className={`rounded shadow-sm border ${MODULE_STYLE.education.accent} overflow-hidden`}>
          <button onClick={() => toggle('education')} className={`w-full flex items-center justify-between px-3 py-2 ${MODULE_STYLE.education.bg} ${MODULE_STYLE.education.text} font-semibold text-[11px]`}>Utdanningstilbud<span className="text-[10px]">{open.education ? '▼' : '►'}</span></button>
          {open.education && (
            <div className="p-3 bg-white text-[11px] space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge label={`Grunnskole: ${m.has_primary_school ? 'Ja' : 'Nei'}`} color={m.has_primary_school ? 'green' : 'gray'} />
                <Badge label={`Videregående: ${m.has_high_school ? 'Ja' : 'Nei'}`} color={m.has_high_school ? 'green' : 'gray'} />
                <Badge label={`Universitet: ${m.has_university ? 'Ja' : 'Nei'}`} color={m.has_university ? 'green' : 'gray'} />
                <Badge label={`Voksenopplæring: ${m.has_adult_language ? 'Ja' : 'Nei'}`} color={m.has_adult_language ? 'green' : 'gray'} />
              </div>
            </div>
          )}
        </div>
      )}
      {activeModules.includes('capacity') && (
        <div className={`rounded shadow-sm border ${MODULE_STYLE.capacity.accent} overflow-hidden`}>
          <button onClick={() => toggle('capacity')} className={`w-full flex items-center justify-between px-3 py-2 ${MODULE_STYLE.capacity.bg} ${MODULE_STYLE.capacity.text} font-semibold text-[11px]`}>Kapasitet<span className="text-[10px]">{open.capacity ? '▼' : '►'}</span></button>
          {open.capacity && (
            <div className="p-3 bg-white text-[11px] space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge label={`Total: ${m.capacity_total}`} color="blue" />
                <Badge label={`Bosatt: ${m.settled_current}`} color="blue" />
                <Badge label={`Ledig: ${Math.max(0,m.capacity_total - m.settled_current)}`} color="blue" />
                {m.tentative_claim != null && <Badge label={`Tentativt krav: ${m.tentative_claim}`} color="blue" />}
              </div>
            </div>
          )}
        </div>
      )}
      {activeModules.includes('connection') && (
        <div className={`rounded shadow-sm border ${MODULE_STYLE.connection.accent} overflow-hidden`}>
          <button onClick={() => toggle('connection')} className={`w-full flex items-center justify-between px-3 py-2 ${MODULE_STYLE.connection.bg} ${MODULE_STYLE.connection.text} font-semibold text-[11px]`}>Tilknytning (personbasert)<span className="text-[10px]">{open.connection ? '▼' : '►'}</span></button>
          {open.connection && (
            <div className="p-3 bg-white text-[11px] space-y-1">
              <div className="text-[10px] text-gray-600">Se per-person seksjon for detaljer om relasjoner og match nivå.</div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

const Badge: React.FC<{ label: string; color?: string }> = ({ label, color = 'gray' }) => {
  const palette: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-700 border-gray-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rose: 'bg-rose-100 text-rose-700 border-rose-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200'
  };
  return <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${palette[color] || palette.gray}`}>{label}</span>;
};

interface InfoBoxProps { label: string; value: React.ReactNode; tooltip?: string; items?: string[]; }
const InfoBox: React.FC<InfoBoxProps> = ({ label, value, tooltip, items }) => {
  const [open, setOpen] = React.useState(false);
  const hasList = Array.isArray(items) && items.length > 0;
  return (
    <div className="border rounded p-2 bg-white flex flex-col gap-0.5" title={tooltip || ''}>
      <span className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold flex items-center justify-between">
        <span>{label}</span>
        {hasList && (
          <button type="button" onClick={() => setOpen(o=>!o)} className="text-[9px] text-gray-500 hover:text-gray-700 font-medium">
            {open ? '−' : '+'}
          </button>
        )}
      </span>
      <span className="text-xs text-gray-800 font-medium">{value}</span>
      {hasList && open && (
        <ul className="mt-1 space-y-0.5 max-h-28 overflow-auto pr-1">
          {items!.map(it => <li key={it} className="text-[10px] text-gray-700 leading-tight">{it}</li>)}
        </ul>
      )}
    </div>
  );
};

export default MunicipalityInspectModal;
