import React from 'react';
import type { Group, ModuleWeights, CapacitySubweight, WorkSubweight, ConnectionSubweight, HealthcareSubweight, EducationSubweight, CapacityOptions } from '../types';
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

// (Profession labels moved into Inspect modal component)

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

// Map 0-100 score into 0.5–5 stars with linear 10% buckets.
// Buckets:
// 0-9.99  -> 0.5
// 10-19.99-> 1.0
// 20-29.99-> 1.5
// 30-39.99-> 2.0
// 40-49.99-> 2.5
// 50-59.99-> 3.0
// 60-69.99-> 3.5
// 70-79.99-> 4.0
// 80-89.99-> 4.5
// 90-100  -> 5.0
// (Confidence / max_possible ignored; scale is absolute.)
function starsForScore(score: number): number {
  const s = Math.max(0, Math.min(100, score));
  const bucket = Math.min(9, Math.floor(s / 10)); // 0..9
  return 0.5 + 0.5 * bucket; // 0.5 .. 5.0
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

// Tooltip helper for explaining star mapping; both hover (CSS) & click (state) to support touch.
// If score is provided we show a contextual line; otherwise just the legend.
const StarInfo: React.FC<{ score?: number }> = ({ score }) => {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest?.('[data-star-info]')) setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('click', onClick); };
  }, [open]);

  const starValue = score != null ? starsForScore(score) : null;
  const legend = [
    { range: '0 – 9.9%', stars: '0.5' },
    { range: '10 – 19.9%', stars: '1.0' },
    { range: '20 – 29.9%', stars: '1.5' },
    { range: '30 – 39.9%', stars: '2.0' },
    { range: '40 – 49.9%', stars: '2.5' },
    { range: '50 – 59.9%', stars: '3.0' },
    { range: '60 – 69.9%', stars: '3.5' },
    { range: '70 – 79.9%', stars: '4.0' },
    { range: '80 – 89.9%', stars: '4.5' },
    { range: '90 – 100%', stars: '5.0' },
  ];

  return (
    <div className="relative inline-block" data-star-info>
      <button
        type="button"
        onClick={() => setOpen(o=>!o)}
        className="w-4 h-4 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 flex items-center justify-center text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
        aria-label="Forklaring av stjernerangering"
      >?</button>
      <div
        className={`absolute left-5 top-0 z-20 w-56 text-[10px] leading-snug rounded-md shadow-lg border border-gray-200 bg-white p-2 transition-opacity duration-150 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'} group-hover:opacity-100`}
        role="dialog"
        aria-label="Stjernerangering forklaring"
      >
        <div className="font-semibold text-gray-800 mb-1">Stjernerangering</div>
        <ul className="space-y-0.5">
          {legend.map(l => <li key={l.range} className="flex justify-between"><span className="text-gray-600">{l.range}</span><span className="text-amber-600 font-medium">{l.stars}★</span></li>)}
        </ul>
        {score != null && starValue != null && (
          <div className="mt-2 text-gray-700 font-medium">Denne kommunen: {score.toFixed(1)}% → {starValue.toFixed(1)}★</div>
        )}
        <div className="mt-1 text-gray-500 italic">Skala: lineære 10% intervaller (0.5–5.0★).</div>
      </div>
    </div>
  );
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

import MunicipalityInspectModal from './MunicipalityInspectModal.tsx';

export const MunicipalityScoreTable: React.FC<MunicipalityScoreTableProps> = (props) => {
  const { group, municipalities, moduleWeights } = props;
  const DISCLAIMER_TEXT = 'Dette er ett verktøy laget for å illustrere utfordringer knyttet til vekting, og alle datagrunnlag om kommuner, yrker, helsetilbud ol. er fiktive';

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
  const [jsonRow, setJsonRow] = React.useState<RowData | null>(null);

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

  // For navigation inside Inspect modal (uses current sorted order)
  const inspectIndex = inspect ? sorted.findIndex(r => r.municipality.id === inspect.municipality.id) : -1;
  const hasPrev = inspectIndex > 0;
  const hasNext = inspectIndex >= 0 && inspectIndex < sorted.length - 1;

  return (
    <div className="mt-10">
      <div className="p-3 mb-3 rounded text-red-700 bg-red-50 border border-red-200">
        <p style={{ fontSize: 24, lineHeight: 1.1, margin: 0, whiteSpace: 'normal', wordWrap: 'break-word' }}>{DISCLAIMER_TEXT}</p>
      </div>
      <h2 className="text-xl font-semibold mb-3 text-gray-700">Kommuner (rangert)</h2>
      <div className="overflow-x-auto rounded-xl shadow ring-1 ring-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <Th label="#" noSort />
              <Th label="Kommune" sortKey="name" current={sortKey} dir={sortDir} onSort={toggleSort} />
              <Th label="Total" sortKey="overall" current={sortKey} dir={sortDir} onSort={toggleSort} extra={<StarInfo />} />
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
        <MunicipalityInspectModal
          data={{
            municipality: inspect.municipality,
            overall: inspect.overall,
            capacityRes: inspect.capacityRes,
            workRes: inspect.workRes,
            connectionRes: inspect.connectionRes,
            healthcareRes: inspect.healthcareRes,
            educationRes: inspect.educationRes,
            aggregate: inspect.aggregate,
          }}
            group={group}
            activeModules={activeModuleKeys as string[]}
            onClose={() => setInspect(null)}
            onPrev={hasPrev ? () => setInspect(sorted[inspectIndex - 1]) : undefined}
            onNext={hasNext ? () => setInspect(sorted[inspectIndex + 1]) : undefined}
            hasPrev={hasPrev}
            hasNext={hasNext}
        />
      )}
    </div>
  );
};

const Th: React.FC<{ label: string; sortKey?: TableSortKey; current?: string; dir?: 'asc'|'desc'; onSort?: (k:TableSortKey)=>void; noSort?: boolean; extra?: React.ReactNode }> = ({ label, sortKey, current, dir, onSort, noSort, extra }) => {
  if (noSort) return <th className="px-2 py-2 font-semibold text-xs text-gray-600">{label} {extra && <span className="inline-block ml-1 align-middle" onClick={e=>e.stopPropagation()}>{extra}</span>}</th>;
  const active = current === sortKey;
  return (
    <th className="px-2 py-2 font-semibold text-xs text-gray-600 select-none">
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => onSort && sortKey && onSort(sortKey)}
          className="inline-flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded cursor-pointer"
          aria-label={`Sorter etter ${label}`}
        >
          <span>{label}</span>
          {active && (<span className="text-[10px]">{dir === 'asc' ? '▲' : '▼'}</span>)}
        </button>
        {extra && <span onClick={e => e.stopPropagation()} className="ml-0.5">{extra}</span>}
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

// (Inspect modal related components moved to MunicipalityInspectModal.tsx)