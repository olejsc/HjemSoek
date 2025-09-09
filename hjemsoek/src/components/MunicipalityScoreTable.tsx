import React from 'react';
import type { Group, ModuleWeights, CapacitySubweight, WorkSubweight, ConnectionSubweight, HealthcareSubweight, EducationSubweight, CapacityOptions, CapacityResult, WorkOpportunityResult, ConnectionResult as ConnectionResultType, HealthcareResult, EducationResult } from '../types';
import { scoreCapacity } from '../categories/capacity';
import { scoreWorkOpportunity } from '../categories/work';
import { scoreConnection } from '../categories/connection';
import { scoreHealthcare } from '../categories/healthcare';
import { scoreEducation } from '../categories/education';
import { aggregateOverall } from '../categories/aggregate';
import type { Municipality } from '../mockdata';

// -------------------- Props --------------------
export interface MunicipalityScoreTableProps {
  group: Group;
  municipalities: Municipality[];
  moduleWeights: ModuleWeights; // integers (not necessarily normalized, aggregate handles normalization)
  capacitySubweights?: CapacitySubweight[];
  capacityOptions?: CapacityOptions;
  workSubweights?: WorkSubweight[];
  connectionSubweights?: ConnectionSubweight[];
  healthcareSubweights?: HealthcareSubweight[];
  educationSubweights?: EducationSubweight[];
}

// 10-step red -> green palette (roughly from Tailwind shades). Index 0 = worst.
const SCORE_COLORS = [
  '#991b1b', // very dark red
  '#b91c1c',
  '#dc2626',
  '#f87171',
  '#fca5a5',
  '#fde68a', // pivot yellow-ish mid
  '#d9f99d',
  '#86efac',
  '#34d399',
  '#059669', // strong green
];

// Norsk navn per yrke (fallback til engelsk nøkkel hvis ikke definert)
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

function colorForScore(score: number) {
  if (!isFinite(score)) return '#ddd';
  const clamped = Math.max(0, Math.min(100, score));
  const bucket = Math.min(SCORE_COLORS.length - 1, Math.floor((clamped / 101) * SCORE_COLORS.length));
  return SCORE_COLORS[bucket];
}

interface RowData {
  municipality: Municipality;
  overall: number;
  modules: Record<string, number>; // per top-level module effective score
  // Full result objects for drill-down modal
  capacityRes: ReturnType<typeof scoreCapacity> | null;
  workRes: ReturnType<typeof scoreWorkOpportunity> | null;
  connectionRes: ReturnType<typeof scoreConnection> | null;
  healthcareRes: ReturnType<typeof scoreHealthcare> | null;
  educationRes: ReturnType<typeof scoreEducation> | null;
  aggregate: ReturnType<typeof aggregateOverall> | null;
}

// Dedicated type for table sort keys
type TableSortKey = 'overall' | 'name' | 'capacity' | 'workOpportunity' | 'connection' | 'healthcare' | 'education';

// Map 0-100 score into 0.5 increments up to 5 stars.
function starsForScore(score: number): number {
  const s = Math.max(0, Math.min(100, score));
  if (s < 5) return 0.5; // 0-5
  if (s >= 95) return 5; // 95-100
  // Every 5% adds a half-star: 5-10 =>1, 10-15=>1.5 ...
  const remaining = s - 5; // now 0..90
  const halfSteps = Math.floor(remaining / 5) + 1; // +1 accounts for first full star at >=5
  return Math.min(5, 1 + halfSteps * 0.5 - 0.5); // adjust formula to produce sequence 1,1.5,2,...4.5
}

const StarRating: React.FC<{ value: number }> = ({ value }) => {
  const full = Math.floor(value);
  const hasHalf = value - full >= 0.5;
  const stars: React.ReactNode[] = [];
  for (let i = 0; i < full; i++) {
    stars.push(<svg key={'f'+i} viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current text-amber-500" aria-hidden="true"><path d="M10 15.27 16.18 19l-1.64-7.03L20 7.24l-7.19-.62L10 0 7.19 6.62 0 7.24l5.46 4.73L3.82 19z"/></svg>);
  }
  if (hasHalf) {
    stars.push(<svg key="half" viewBox="0 0 20 20" className="w-3.5 h-3.5 text-amber-500" aria-hidden="true"><defs><linearGradient id="halfGrad" x1="0" x2="1"><stop offset="50%" stopColor="currentColor"/><stop offset="50%" stopColor="transparent"/></linearGradient></defs><path d="M10 15.27 16.18 19l-1.64-7.03L20 7.24l-7.19-.62L10 0 7.19 6.62 0 7.24l5.46 4.73L3.82 19z" fill="url(#halfGrad)" stroke="currentColor" strokeWidth="1"/></svg>);
  }
  const totalShown = full + (hasHalf ? 1 : 0);
  for (let i = totalShown; i < 5; i++) {
    stars.push(<svg key={'e'+i} viewBox="0 0 20 20" className="w-3.5 h-3.5 text-amber-300" aria-hidden="true"><path d="M10 15.27 16.18 19l-1.64-7.03L20 7.24l-7.19-.62L10 0 7.19 6.62 0 7.24l5.46 4.73L3.82 19z" fill="currentColor" className="opacity-30"/></svg>);
  }
  return <div className="flex items-center gap-0.5" title={`${value} stjerner`}>{stars}</div>;
};

// Helper: build adjacency + region maps on the fly (mock dataset does not export explicit adjacency -> simple synthetic adjacency: neighbors are +-1 index for demo)
function buildAdjacency(munis: Municipality[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (let i = 0; i < munis.length; i++) {
    const prev = munis[i - 1];
    const next = munis[i + 1];
    const arr: string[] = [];
    if (prev) arr.push(prev.id);
    if (next) arr.push(next.id);
    map[munis[i].id] = arr;
  }
  return map;
}

function buildRegionMap(munis: Municipality[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const m of munis) map[m.id] = m.region_id;
  return map;
}

export const MunicipalityScoreTable: React.FC<MunicipalityScoreTableProps> = (props) => {
  const { group, municipalities, moduleWeights } = props;

  // Precomputed maps (stable unless municipalities array identity changes)
  const adjacencyMap = React.useMemo(() => buildAdjacency(municipalities), [municipalities]);
  const regionMap = React.useMemo(() => buildRegionMap(municipalities), [municipalities]);

  // Active modules (weight > 0) used for conditional columns
  const activeModuleKeys = React.useMemo(() => {
    const keys: Array<keyof ModuleWeights> = ['capacity','workOpportunity','connection','healthcare','education'];
    return keys.filter(k => (moduleWeights[k] ?? 0) > 0);
  }, [moduleWeights]);

  // Derived per municipality scores
  const rows = React.useMemo<RowData[]>(() => {
    if (!group.persons.length) return [];
    return municipalities.map(m => {
  const capacityRes = scoreCapacity({
        group,
        municipality: { capacity_total: m.capacity_total, settled_current: m.settled_current, tentative_claim: m.tentative_claim },
        options: props.capacityOptions || { include_tentative: true, allow_overflow: true },
        subweights: props.capacitySubweights,
  });
  const workRes = scoreWorkOpportunity({
        group,
        municipality: { work_opportunity: m.work_opportunity },
        subweights: props.workSubweights,
  });
  const connectionRes = scoreConnection({
        group,
        target_municipality_id: m.id,
        municipality_region_map: regionMap,
        adjacency_map: adjacencyMap,
        subweights: props.connectionSubweights,
  });
  const healthcareRes = scoreHealthcare({
        group,
        target_municipality_id: m.id,
        municipality_region_map: regionMap,
        adjacency_map: adjacencyMap,
        municipality_healthcare_map: Object.fromEntries(municipalities.map(mm => [mm.id, { has_hospital: mm.has_hospital, specialist_facilities: mm.specialist_facilities }])),
        subweights: props.healthcareSubweights,
  });
  const educationRes = scoreEducation({
        group,
        target_municipality_id: m.id,
        municipality_region_map: regionMap,
        adjacency_map: adjacencyMap,
        municipality_education_map: Object.fromEntries(municipalities.map(mm => [mm.id, {
          has_primary_school: mm.has_primary_school,
          has_high_school: mm.has_high_school,
          has_university: mm.has_university,
          has_adult_language: mm.has_adult_language,
        }])),
        subweights: props.educationSubweights,
  });

      const aggregate = aggregateOverall({
        capacity: capacityRes,
        workOpportunity: workRes,
        connection: connectionRes,
        healthcare: healthcareRes,
        education: educationRes,
      }, moduleWeights);

      return {
        municipality: m,
        overall: aggregate.weighted_total,
        modules: {
          capacity: capacityRes.effective_score,
          workOpportunity: workRes.effective_score,
          connection: connectionRes.effective_score,
          healthcare: healthcareRes.effective_score,
          education: educationRes.effective_score,
        },
        capacityRes,
        workRes,
        connectionRes,
        healthcareRes,
        educationRes,
        aggregate,
      };
    });
  }, [group, municipalities, moduleWeights, props.capacitySubweights, props.capacityOptions, props.workSubweights, props.connectionSubweights, props.healthcareSubweights, props.educationSubweights, adjacencyMap, regionMap]);

  const [inspect, setInspect] = React.useState<RowData | null>(null);
  // Selected row for JSON view (inline below table)
  const [jsonRow, setJsonRow] = React.useState<RowData | null>(null);
  React.useEffect(() => {
    if (!inspect) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setInspect(null); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inspect]);

  // Sorting
  const [sortKey, setSortKey] = React.useState<TableSortKey>('overall');
  const [sortDir, setSortDir] = React.useState<'asc'|'desc'>('desc');

  // Fallback if current sort key is for a hidden module
  React.useEffect(() => {
    if (sortKey !== 'overall' && sortKey !== 'name' && !activeModuleKeys.includes(sortKey)) {
      setSortKey('overall');
      setSortDir('desc');
    }
  }, [activeModuleKeys, sortKey]);

  const sorted = React.useMemo(() => {
    const arr = [...rows];
    arr.sort((a,b) => {
      let av: number | string; let bv: number | string;
      if (sortKey === 'overall') { av = a.overall; bv = b.overall; }
      else if (sortKey === 'name') { av = a.municipality.name; bv = b.municipality.name; }
      else { av = a.modules[sortKey]; bv = b.modules[sortKey]; }
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = av as number; const bn = bv as number;
      return sortDir === 'asc' ? an - bn : bn - an;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  function toggleSort(k: TableSortKey) {
    setSortKey(prev => prev === k ? prev : k);
    setSortDir(prev => (sortKey === k ? (prev === 'asc' ? 'desc' : 'asc') : (k === 'name' ? 'asc' : 'desc')));
  }

  function Bar({ value }: { value: number }) {
    const color = colorForScore(value);
    return (
      <div className="w-full h-4 bg-gray-100 rounded relative overflow-hidden" title={value.toFixed(1) + '%'}>
        <div className="h-full" style={{ width: `${Math.max(0,Math.min(100,value))}%`, backgroundColor: color }} />
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-gray-800 mix-blend-multiply">
          {Math.round(value)}
        </div>
      </div>
    );
  }

  if (!group.persons.length) {
    return <div className="mt-6 text-sm text-gray-600">Legg til personer i gruppen for å se kommune rangeringer.</div>;
  }

  return (
    <div className="mt-10">
      <h2 className="text-xl font-semibold mb-3 text-gray-700">Kommuner (rangert)</h2>
      <div className="overflow-x-auto rounded-xl shadow ring-1 ring-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <Th label="#" noSort />
              <Th label="Kommune" sortKey="name" current={sortKey} dir={sortDir} onSort={toggleSort} />
              <Th label="Total" sortKey="overall" current={sortKey} dir={sortDir} onSort={toggleSort} />
              {activeModuleKeys.includes('capacity') && (
                <Th label="Kapasitet" sortKey="capacity" current={sortKey} dir={sortDir} onSort={toggleSort} />
              )}
              {activeModuleKeys.includes('workOpportunity') && (
                <Th label="Arbeid" sortKey="workOpportunity" current={sortKey} dir={sortDir} onSort={toggleSort} />
              )}
              {activeModuleKeys.includes('connection') && (
                <Th label="Tilknytning" sortKey="connection" current={sortKey} dir={sortDir} onSort={toggleSort} />
              )}
              {activeModuleKeys.includes('healthcare') && (
                <Th label="Helse" sortKey="healthcare" current={sortKey} dir={sortDir} onSort={toggleSort} />
              )}
              {activeModuleKeys.includes('education') && (
                <Th label="Utdanning" sortKey="education" current={sortKey} dir={sortDir} onSort={toggleSort} />
              )}
              <Th label="" noSort />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((r, idx) => (
              <tr key={r.municipality.id} className="odd:bg-white even:bg-gray-50 hover:bg-green-50">
                <td className="px-2 py-1 text-xs text-gray-500">{idx + 1}</td>
                <td className="px-2 py-1 whitespace-nowrap">{r.municipality.name}</td>
                <td className="px-2 py-1 font-semibold text-gray-800">
                  <div className="flex items-center gap-2" title={r.overall.toFixed(1) + '%'} aria-label={`Total score ${r.overall.toFixed(1)} prosent`}>
                    <StarRating value={starsForScore(r.overall)} />
                  </div>
                </td>
                {activeModuleKeys.includes('capacity') && (
                  <td className="px-2 py-1"><Bar value={r.modules.capacity} /></td>
                )}
                {activeModuleKeys.includes('workOpportunity') && (
                  <td className="px-2 py-1"><Bar value={r.modules.workOpportunity} /></td>
                )}
                {activeModuleKeys.includes('connection') && (
                  <td className="px-2 py-1"><Bar value={r.modules.connection} /></td>
                )}
                {activeModuleKeys.includes('healthcare') && (
                  <td className="px-2 py-1"><Bar value={r.modules.healthcare} /></td>
                )}
                {activeModuleKeys.includes('education') && (
                  <td className="px-2 py-1"><Bar value={r.modules.education} /></td>
                )}
                <td className="px-2 py-1 text-right space-x-1 whitespace-nowrap">
                  <button onClick={() => setInspect(r)} className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400">Inspiser</button>
                  <button
                    onClick={() => setJsonRow(j => j && j.municipality.id === r.municipality.id ? null : r)}
                    className={`text-xs px-2 py-1 rounded font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 ${jsonRow?.municipality.id === r.municipality.id ? 'bg-emerald-700 hover:bg-emerald-600 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                    title="Show JSON scoring"
                  >{jsonRow?.municipality.id === r.municipality.id ? 'Lukk JSON' : 'Show JSON'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Inline JSON view */}
      {jsonRow && (
        <JsonScoringPanel row={jsonRow} onClose={() => setJsonRow(null)} />
      )}
      {inspect && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-8">
          <div className="absolute inset-0 bg-black/40" onClick={() => setInspect(null)} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-full overflow-auto ring-1 ring-gray-200 text-xs">
            <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b bg-white">
              <h3 className="font-semibold text-gray-800 text-sm">Detaljer: {inspect.municipality.name}</h3>
              <button onClick={() => setInspect(null)} className="text-gray-500 hover:text-gray-700 text-xs">Lukk ✕</button>
            </div>
            <ModalContent inspect={inspect} group={group} activeModules={activeModuleKeys as string[]} onClose={() => setInspect(null)} />
          </div>
        </div>
      )}
    </div>
  );
};

const Th: React.FC<{ label: string; sortKey?: TableSortKey; current?: string; dir?: 'asc'|'desc'; onSort?: (k:TableSortKey)=>void; noSort?: boolean }> = ({ label, sortKey, current, dir, onSort, noSort }) => {
  if (noSort) return <th className="px-2 py-2 font-semibold text-xs text-gray-600">{label}</th>;
  const active = current === sortKey;
  return (
  <th className="px-2 py-2 font-semibold text-xs text-gray-600 cursor-pointer select-none" onClick={() => onSort && sortKey && onSort(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (<span className="text-[10px]">{dir === 'asc' ? '▲' : '▼'}</span>)}
      </span>
    </th>
  );
};

export default MunicipalityScoreTable;

// Panel for JSON scoring output with copy & close actions
const JsonScoringPanel: React.FC<{ row: RowData; onClose: () => void }> = ({ row, onClose }) => {
  const [copied, setCopied] = React.useState(false);
  const payload = React.useMemo(() => ({
    municipality: {
      id: row.municipality.id,
      name: row.municipality.name,
      region: row.municipality.region_id,
      county: row.municipality.county,
    },
    overall: row.overall,
    modules: row.modules,
    details: {
      capacity: row.capacityRes,
      workOpportunity: row.workRes,
      connection: row.connectionRes,
      healthcare: row.healthcareRes,
      education: row.educationRes,
      aggregate: row.aggregate,
    }
  }), [row]);

  function copy() {
    try {
      navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* swallow */
    }
  }
  return (
    <div className="mt-4 border rounded-lg bg-gray-50 ring-1 ring-gray-200 overflow-hidden text-xs">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-100 border-b">
        <span className="font-semibold text-gray-700">Scoring JSON: {payload.municipality.name}</span>
        <div className="flex items-center gap-2">
          <button onClick={copy} className="text-[11px] px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400">
            {copied ? 'Kopiert!' : 'Kopiér'}
          </button>
          <button onClick={onClose} className="text-[11px] px-2 py-1 rounded bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-gray-400">Lukk</button>
        </div>
      </div>
      <div className="max-h-96 overflow-auto">
        <pre className="p-3 text-[10px] leading-snug whitespace-pre text-gray-800 font-mono">{JSON.stringify(payload, null, 2)}</pre>
      </div>
    </div>
  );
};

// Inspect modal inner content separated for clarity
const ModalContent: React.FC<{ inspect: RowData; group: Group; activeModules: string[]; onClose: () => void }> = ({ inspect, group, activeModules }) => {
  const [showSummary, setShowSummary] = React.useState(false);
  const [openPerson, setOpenPerson] = React.useState<string | null>(null);

  const m = inspect.municipality;
  const free = Math.max(0, m.capacity_total - m.settled_current);
  const professionsInMunicipality = Object.keys(m.work_opportunity?.profession_history || {});
  const professionsCount = professionsInMunicipality.length;
  const specialistCount = m.specialist_facilities?.length || 0;

  // Build combined per-person dataset
  const personRows = React.useMemo(() => {
    return group.persons.map(p => {
      const work = inspect.workRes?.persons.find(pp => pp.person_id === p.id);
      const conn = inspect.connectionRes?.persons.find(pp => pp.person_id === p.id);
      const health = inspect.healthcareRes?.persons.find(pp => pp.person_id === p.id);
      const edu = inspect.educationRes?.persons.find(pp => pp.person_id === p.id);
      return { p, work, conn, health, edu };
    });
  }, [group.persons, inspect.workRes, inspect.connectionRes, inspect.healthcareRes, inspect.educationRes]);

  return (
    <div className="p-4 space-y-6">
      {/* Municipality info */}
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
        <InfoBox label="Total score" value={inspect.overall.toFixed(1) + '%'} />
      </section>
      {/* Module detail groups (arbeidstabell flyttet over sammendrag) */}
      <ModuleDetailGroups inspect={inspect} activeModules={activeModules} />

      {/* Expandable group summary (overall weights & raw module outputs) */}
      <section className="border rounded-md">
        <button onClick={() => setShowSummary(s => !s)} className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-left">
          <span className="font-semibold text-gray-700 text-xs">Gruppesammendrag</span>
          <span className="text-[10px] text-gray-500">{showSummary ? '▼' : '►'}</span>
        </button>
        {showSummary && (
          <div className="p-3 space-y-4">
            <div>
              <h4 className="font-semibold mb-1 text-gray-700 text-xs">Modulvekter</h4>
              {inspect.aggregate && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(inspect.aggregate.weights).map(([k,v]) => (
                    <div key={k} className="px-2 py-1 bg-gray-100 rounded text-[10px] font-medium text-gray-700">{k}: {(v*100).toFixed(1)}%</div>
                  ))}
                </div>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {(['capacity','workOpportunity','connection','healthcare','education'] as const).map(mod => {
                type ModuleResultUnion = CapacityResult | WorkOpportunityResult | ConnectionResultType | HealthcareResult | EducationResult | null;
                const res: ModuleResultUnion = (mod === 'capacity' ? inspect.capacityRes : mod === 'workOpportunity' ? inspect.workRes : mod === 'connection' ? inspect.connectionRes : mod === 'healthcare' ? inspect.healthcareRes : inspect.educationRes);
                if (!res || !activeModules.includes(mod)) return null;
                const subscores = (res as unknown as { subscores?: Array<{id:string; normalized_weight:number; score?:number; contribution?:number}> }).subscores;
                return (
                  <div key={mod} className="border rounded p-2 bg-white">
                    <div className="font-semibold text-gray-700 mb-1 capitalize">{mod}</div>
                    <div className="mb-1">Score: {res.effective_score?.toFixed?.(1)}% (maks {res.max_possible})</div>
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
                    {res.explanation && (
                      <pre className="whitespace-pre-wrap bg-gray-50 rounded p-2 font-mono text-[9px] leading-snug border text-gray-700 max-h-40 overflow-auto">{res.explanation}</pre>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

  {/* (Arbeidstabell allerede vist over sammendrag) */}

      {/* Per-person breakdown */}
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

// ------------- Colored grouped module details -------------
const MODULE_STYLE: Record<string,{accent:string; bg:string; text:string}> = {
  capacity: { accent: 'border-l-4 border-blue-500', bg: 'bg-blue-50', text: 'text-blue-700' },
  workOpportunity: { accent: 'border-l-4 border-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
  connection: { accent: 'border-l-4 border-indigo-500', bg: 'bg-indigo-50', text: 'text-indigo-700' },
  healthcare: { accent: 'border-l-4 border-rose-500', bg: 'bg-rose-50', text: 'text-rose-700' },
  education: { accent: 'border-l-4 border-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
};

// Narrow subset used; accept broader shape for compatibility
interface InspectLike {
  municipality: Municipality;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workRes?: any; // accessing only workRes.trace.inputs.normalization_thresholds if present
}
const ModuleDetailGroups: React.FC<{ inspect: InspectLike; activeModules: string[] }> = ({ inspect, activeModules }) => {
  const [open, setOpen] = React.useState<Record<string, boolean>>({ workOpportunity: true });
  const m: Municipality = inspect.municipality;
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
              {/* Thresholds if available */}
              {inspect.workRes?.trace?.inputs?.normalization_thresholds && (
                <div className="text-[10px] bg-amber-50 border border-amber-200 rounded p-2 leading-snug">
                  <div className="font-semibold mb-1">Terskler (median + MAD)</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(inspect.workRes.trace.inputs.normalization_thresholds).map(([k,v]) => {
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
        <div className={`rounded shadow-sm border ${MODULE_STYLE.healthcare.accent} overflow-hidden`}>/* Healthcare */
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
        <div className={`rounded shadow-sm border ${MODULE_STYLE.education.accent} overflow-hidden`}>/* Education */
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
        <div className={`rounded shadow-sm border ${MODULE_STYLE.capacity.accent} overflow-hidden`}>/* Capacity */
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
        <div className={`rounded shadow-sm border ${MODULE_STYLE.connection.accent} overflow-hidden`}>/* Connection */
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