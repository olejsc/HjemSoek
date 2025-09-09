import React from 'react';
import { buildWeightConfiguration } from '../utils/weights';
import { WEIGHT_TEMPLATES, getTemplateById } from '../scoringTemplates';
import type {
  ModuleWeights,
  CapacitySubweight,
  WorkSubweight,
  ConnectionSubweight,
  HealthcareSubweight,
  EducationSubweight,
  CapacityOptions,
} from '../types';

// -------------------- Types & Props --------------------

export interface WeightEditorProps {
  /** Topp-nivå vekter mellom modulene. */
  moduleWeights: ModuleWeights;
  onModuleWeightsChange(next: ModuleWeights): void;
  /** Undervekter for hver modul (frivillig hvis man ikke ønsker UI for de). */
  capacitySubweights?: CapacitySubweight[];
  onCapacitySubweightsChange?(next: CapacitySubweight[]): void;
  workSubweights?: WorkSubweight[];
  onWorkSubweightsChange?(next: WorkSubweight[]): void;
  connectionSubweights?: ConnectionSubweight[];
  onConnectionSubweightsChange?(next: ConnectionSubweight[]): void;
  healthcareSubweights?: HealthcareSubweight[];
  onHealthcareSubweightsChange?(next: HealthcareSubweight[]): void;
  educationSubweights?: EducationSubweight[];
  onEducationSubweightsChange?(next: EducationSubweight[]): void;
  /** Kapasitet modul spesifikke opsjoner (checkboxes). */
  capacityOptions?: CapacityOptions;
  onCapacityOptionsChange?(next: CapacityOptions): void;
}

// Stable ordered list of top-level modules we expose in UI
const TOP_MODULE_KEYS: Array<keyof ModuleWeights> = [
  'capacity',
  'workOpportunity',
  'connection',
  'healthcare',
  'education',
];

// -------------------- Norwegian ELI5 Explanations --------------------

// Kort og barnevennlig forklaring av hva hver modul betyr i totalen.
const MODULE_EXPLANATION_NB: Record<string, string> = {
  capacity: 'Hvor lett gruppen kan få plass i kommunen uten å sprenge antall tilgjengelige plasser. Høy verdi = god plass. Ved overløp brukes en «straff» (snur tallene) slik at totalen fortsatt tolkes som “mer er bedre”.',
  workOpportunity: 'Hvor gode sjanser passende personer i gruppen har for jobb: lav arbeidsledighet + vekst i deres yrker. Høy verdi = flere/det er lettere å få jobb.',
  connection: 'Hvor sterke sosiale / familie / jobb / skole bånd gruppen har til målkommunen. Nær familie og eksakt treff gir mest utslag.',
  healthcare: 'Dekker kommunen (eller nabo/region) sykehus- og spesialistbehov for de personene som har dem? Høy verdi = behovene møtes nærme.',
  education: 'Har kommunen (eller nabo/region) de skole- og opplæringstilbud som personene faktisk trenger? Høy verdi = behov møtes lokalt.',
};

// Undervekter forklaringer (ELI5) pr modul -> undervekt id -> tekst
const SUB_EXPLANATION_NB: Record<string, Record<string, string>> = {
  capacity: {
    'capacity.core': 'Kjerneutregning: sammenligner gruppestørrelse med tilgjengelige plasser. 100 betyr god margin. Ved overløp blir dette en straff-score (inverteres i totalen).',
  },
  workOpportunity: {
    'work.chance': 'Sjanse-del: snur arbeidsledighet (lav ledighet gir høy score).',
    'work.growth': 'Vekst-del: hvor etterspurte gruppens yrker er i kommunen (prosent).',
  },
  connection: {
    'connection.friend': 'Vennskapsbånd. Gir noe positivt når geografien matcher.',
    'connection.close_family': 'Nær familie. Telles tyngst – sterke sosiale røtter.',
    'connection.relative': 'Slekt (ikke kjernefamilie). Middels styrke.',
    'connection.workplace': 'Arbeidsplass-tilknytning. Viser praktisk hverdagsbånd.',
    'connection.school_place': 'Skole/studiested. Viser utdanningsbånd til området.',
  },
  healthcare: {
    'healthcare.hospital': 'Sykehusbehov: trenger noen i gruppen sykehus? Nærhet (samme kommune > nabo > region) gir høyere poeng.',
    'healthcare.specialist': 'Spesialistbehov: dekker kommunen (eller nabo/region) nødvendige behandlingstyper (f.eks dialyse)?',
  },
  education: {
    'education.primary_school': 'Grunnskole-behov for barn. Nær tilgang er viktig.',
    'education.high_school': 'Videregående for ungdom/voksne som trenger det.',
    'education.university': 'Universitet/høgskole for høyere studier.',
    'education.adult_language': 'Voksenopplæring språk (f.eks norsk) for integrering.',
  },
};

// Menneskevennlige korte etiketter for topp-moduler (norsk)
const MODULE_LABEL_NB: Record<string,string> = {
  capacity: 'Kapasitet',
  workOpportunity: 'Arbeid',
  connection: 'Tilknytning',
  healthcare: 'Helse',
  education: 'Utdanning',
};

// Fallback render helper
function labelForSub(id: string): string {
  const categories: Array<Record<string,string>> = [
    SUB_EXPLANATION_NB.capacity,
    SUB_EXPLANATION_NB.workOpportunity,
    SUB_EXPLANATION_NB.connection,
    SUB_EXPLANATION_NB.healthcare,
    SUB_EXPLANATION_NB.education,
  ];
  for (const cat of categories) {
    if (cat && Object.prototype.hasOwnProperty.call(cat, id)) return cat[id];
  }
  return id;
}

// -------------------- Component --------------------

export const WeightEditor: React.FC<WeightEditorProps> = (props) => {
  const { moduleWeights, onModuleWeightsChange } = props;
  const [showHelp, setShowHelp] = React.useState<boolean>(false);
  const [showJson, setShowJson] = React.useState<boolean>(false);
  // Table expansion (shows editable subweights rows inline)
  const [tableOpenModule, setTableOpenModule] = React.useState<string | null>(null);
  // Help panel expansion (purely informational, independent of table)
  const [helpOpenModule, setHelpOpenModule] = React.useState<string | null>(null);
  // Tooltip for module description
  const [tooltipOpenModule, setTooltipOpenModule] = React.useState<string | null>(null);
  // Template selection
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>('');
  // Measure left (table) height to sync side panel height so long JSON doesn't stretch page
  const leftPanelRef = React.useRef<HTMLDivElement | null>(null);
  const [leftHeight, setLeftHeight] = React.useState<number>(0);
  React.useLayoutEffect(() => {
    if (!leftPanelRef.current) return;
    const el = leftPanelRef.current;
    const update = () => setLeftHeight(el.clientHeight);
    update();
    const RO: typeof ResizeObserver | undefined = typeof ResizeObserver !== 'undefined' ? ResizeObserver : undefined;
    const ro = RO ? new RO(() => update()) : undefined;
    if (ro) ro.observe(el);
    window.addEventListener('resize', update);
    return () => { if (ro) ro.disconnect(); window.removeEventListener('resize', update); };
  }, []);
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-weight-tooltip-root]')) {
        setTooltipOpenModule(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /** Lock state for top-level modules (key -> locked). */
  const [lockedTop, setLockedTop] = React.useState<Record<string, boolean>>({});
  /** Lock state for subweights (moduleKey -> (subId -> locked)). */
  const [lockedSubs, setLockedSubs] = React.useState<Record<string, Record<string, boolean>>>({});

  // --------- Auto-normalize subweight groups (only when provided) ---------
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { normalizeIfNeeded('capacity', props.capacitySubweights, props.onCapacitySubweightsChange); }, [props.capacitySubweights]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { normalizeIfNeeded('workOpportunity', props.workSubweights, props.onWorkSubweightsChange); }, [props.workSubweights]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { normalizeIfNeeded('connection', props.connectionSubweights, props.onConnectionSubweightsChange); }, [props.connectionSubweights]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { normalizeIfNeeded('healthcare', props.healthcareSubweights, props.onHealthcareSubweightsChange); }, [props.healthcareSubweights]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { normalizeIfNeeded('education', props.educationSubweights, props.onEducationSubweightsChange); }, [props.educationSubweights]);

  function normalizeIfNeeded<T extends { id: string; weight: number }>(_moduleKey: string, list: T[] | undefined, onChange?: (n: T[]) => void) {
    if (!list || !list.length || !onChange) return;
    // Sum current integer weights
    const sum = list.reduce((a,b)=>a+(b.weight||0),0);
    if (sum === 100) return; // already normalized
    // Compute even distribution
    const count = list.length;
    const base = Math.floor(100 / count);
    let remainder = 100 - base*count;
    const next = list.map(sw => ({ ...sw, weight: base + (remainder-- > 0 ? 1 : 0) }));
    onChange(next);
  }

  // ------------- Helper: Ensure top-level weights always sum to 100 (integers) -------------
  React.useEffect(() => {
    // Auto-normalize once on mount if sum != 100
  const sum = TOP_MODULE_KEYS.reduce((acc: number, k) => acc + (moduleWeights[k] as number || 0), 0);
    if (sum !== 100) {
      const count = TOP_MODULE_KEYS.length;
      if (!count) return;
      const base = Math.floor(100 / count);
      let remainder = 100 - base * count;
      const next: ModuleWeights = {} as ModuleWeights;
      for (const k of TOP_MODULE_KEYS) {
        let v = base;
        if (remainder > 0) { v += 1; remainder -= 1; }
        (next as Record<string, number | undefined>)[k] = v;
      }
      onModuleWeightsChange(next);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------- Redistribution Algorithms (Generic for extensibility) -------------
  // NOTE (#15): Designed to be generic: works for any number of modules or subweights. Round-robin integer distribution preserves total exactly.

  function redistributeTop(activeKey: string, targetValue: number) {
    targetValue = Math.max(0, Math.min(100, Math.round(targetValue)));
    const current = { ...moduleWeights } as Record<string, number>;
    const oldValue = current[activeKey] ?? 0;
    if (oldValue === targetValue) return;
    if (lockedTop[activeKey]) return;
    // Separate locked others
    const lockedOthers = TOP_MODULE_KEYS.filter(k => k !== activeKey && lockedTop[k]);
  const sumLockedOthers = lockedOthers.reduce((acc: number, k) => acc + (current[k] || 0), 0);
    // Cap target so room remains for locked others
    const maxForActive = 100 - sumLockedOthers;
    if (targetValue > maxForActive) targetValue = maxForActive;
    current[activeKey] = targetValue;
    const adjustable = TOP_MODULE_KEYS.filter(k => k !== activeKey && !lockedTop[k]);
    if (!adjustable.length) {
      // Only active & locked others; set active to remaining budget
      current[activeKey] = 100 - sumLockedOthers;
      onModuleWeightsChange(current); return;
    }
    // Remaining budget after active + locked others
  const remaining = 100 - targetValue - sumLockedOthers; // mutable remainder distribution
    // Even distribution across adjustable peers
    const base = Math.floor(remaining / adjustable.length);
    let remainder = remaining - base * adjustable.length;
    // Deterministic order: start from next index after active (circular) for fairness
    const startIndex = TOP_MODULE_KEYS.indexOf(activeKey as keyof ModuleWeights);
    const orderedPeers: string[] = [];
    for (let i = 1; i <= TOP_MODULE_KEYS.length; i++) {
      const k = String(TOP_MODULE_KEYS[(startIndex + i) % TOP_MODULE_KEYS.length]);
      if (k === activeKey) continue;
      if (!lockedTop[k]) orderedPeers.push(k);
    }
    orderedPeers.forEach(k => { current[k] = base + (remainder > 0 ? 1 : 0); if (remainder > 0) remainder--; });
    // Final safety normalization
  const total = TOP_MODULE_KEYS.reduce((acc: number, k) => acc + (current[k] || 0), 0);
    if (total !== 100) {
      let diff = 100 - total;
      let i = 0;
      while (diff !== 0 && i < 500) {
        const k = orderedPeers[i % orderedPeers.length];
        if (diff > 0) { current[k] += 1; diff -= 1; }
        else if (current[k] > 0) { current[k] -= 1; diff += 1; }
        i++;
      }
    }
    onModuleWeightsChange(current);
  }

  // Subweights: we treat arrays passed via props. We'll convert to local copies for editing then push via onChange.
  function redistributeSubs(moduleKey: string, subId: string, target: number) {
    const { list, onChange } = getSubweightCollection(moduleKey);
    if (!list || !onChange) return;
    target = Math.max(0, Math.min(100, Math.round(target)));
    const current = list.map(sw => ({ ...sw }));
    const idx = current.findIndex(sw => sw.id === subId);
    if (idx < 0) return;
    const lockMap = lockedSubs[moduleKey] || {};
    if (lockMap[subId]) return;
    const oldValue = current[idx].weight;
    if (oldValue === target) return;
    // Set new value (will be capped later if needed)
    current[idx].weight = target;

    // Partition weights
    const lockedOthers = current.filter((sw,i) => i !== idx && lockMap[sw.id]);
    const adjustable = current.filter((sw,i) => i !== idx && !lockMap[sw.id]);

    const sumLockedOthers = lockedOthers.reduce((a,b)=>a+b.weight,0);
  // (Previous total of adjustable omitted since we redistribute evenly.)

    // Cap changed value so there is space for locked others (rest >=0)
    const maxForChanged = 100 - sumLockedOthers; // adjustable can go to zero
    if (current[idx].weight > maxForChanged) current[idx].weight = maxForChanged;

    // Recompute remaining budget for adjustable peers
    const remainingForAdjustable = 100 - current[idx].weight - sumLockedOthers;

    if (adjustable.length === 0) {
      // No adjustable peers; changed must absorb difference to make total 100
      current[idx].weight = 100 - sumLockedOthers;
      onChange(current); return;
    }

    // Even distribution across adjustable peers (ignore previous proportions – spec wants even)
    const base = Math.floor(remainingForAdjustable / adjustable.length);
    let remainder = remainingForAdjustable - base * adjustable.length;
    // Deterministic order: start from next index after changed (circular)
    const orderedPeers: typeof adjustable = [];
    for (let i = 1; i <= current.length; i++) {
      const node = current[(idx + i) % current.length];
      if (node.id === subId) continue;
      if (!lockMap[node.id]) orderedPeers.push(node);
    }
    orderedPeers.forEach(sw => { sw.weight = base + (remainder > 0 ? 1 : 0); if (remainder > 0) remainder--; });

    // Safety final normalization
  const total = current.reduce((a,b)=>a+b.weight,0);
    if (total !== 100) {
      let diff = 100 - total;
      const pool = orderedPeers.length ? orderedPeers : current.filter((_,i)=>i!==idx);
      let i = 0;
      while (diff !== 0 && pool.length) {
        const sw = pool[i % pool.length];
        if (diff > 0) { sw.weight += 1; diff -= 1; }
        else if (sw.weight > 0) { sw.weight -= 1; diff += 1; }
        i++; if (i > 500) break;
      }
    }
    onChange(current);
  }

  function toggleTopLock(k: string) { setLockedTop(s => ({ ...s, [k]: !s[k] })); }
  function toggleSubLock(moduleKey: string, subId: string) {
    setLockedSubs(s => ({ ...s, [moduleKey]: { ...(s[moduleKey]||{}), [subId]: !((s[moduleKey]||{})[subId]) } }));
  }

  function resetTop() {
    const count = TOP_MODULE_KEYS.length;
    if (!count) return;
    const base = Math.floor(100 / count);
    let remainder = 100 - base*count;
    const next: ModuleWeights = {};
  for (const k of TOP_MODULE_KEYS) { let v = base; if (remainder>0){v++; remainder--; } (next as Record<string, number | undefined>)[k]=v; }
    onModuleWeightsChange(next);
    setLockedTop({});
  }

  // --------- Templates ---------
  function applyTemplate(id: string) {
    const tpl = getTemplateById(id);
    if (!tpl) return;
    // Apply top-level weights & subweights
    props.onModuleWeightsChange?.(tpl.moduleWeights);
    props.onCapacitySubweightsChange?.(tpl.capacitySubweights.map(x => ({ ...x })));
    props.onWorkSubweightsChange?.(tpl.workSubweights.map(x => ({ ...x })));
    props.onConnectionSubweightsChange?.(tpl.connectionSubweights.map(x => ({ ...x })));
    props.onHealthcareSubweightsChange?.(tpl.healthcareSubweights.map(x => ({ ...x })));
    props.onEducationSubweightsChange?.(tpl.educationSubweights.map(x => ({ ...x })));
    props.onCapacityOptionsChange?.({ ...tpl.capacityOptions });
    // Clear locks & UI expansions
    setLockedTop({});
    setLockedSubs({});
    setTableOpenModule(null);
    setHelpOpenModule(null);
  }

  function handleTemplateChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setSelectedTemplateId(id);
    if (id) applyTemplate(id);
  }

  function resetToBaseline() {
    // Baseline = even distribution across modules + even subweights + default capacity options
    const count = TOP_MODULE_KEYS.length;
    if (count) {
      const base = Math.floor(100 / count);
      let remainder = 100 - base * count;
      const next: ModuleWeights = {};
      for (const k of TOP_MODULE_KEYS) {
        let v = base; if (remainder > 0) { v++; remainder--; }
        (next as Record<string, number | undefined>)[k] = v;
      }
      props.onModuleWeightsChange?.(next);
    }
    // Subweights even splits
    props.onCapacitySubweightsChange?.([{ id: 'capacity.core', weight: 100 }]);
    props.onWorkSubweightsChange?.([
      { id: 'work.chance', weight: 50 },
      { id: 'work.growth', weight: 50 },
    ]);
    props.onConnectionSubweightsChange?.([
      { id: 'connection.friend', weight: 20 },
      { id: 'connection.close_family', weight: 20 },
      { id: 'connection.relative', weight: 20 },
      { id: 'connection.workplace', weight: 20 },
      { id: 'connection.school_place', weight: 20 },
    ]);
    props.onHealthcareSubweightsChange?.([
      { id: 'healthcare.hospital', weight: 50 },
      { id: 'healthcare.specialist', weight: 50 },
    ]);
    props.onEducationSubweightsChange?.([
      { id: 'education.primary_school', weight: 25 },
      { id: 'education.high_school', weight: 25 },
      { id: 'education.university', weight: 25 },
      { id: 'education.adult_language', weight: 25 },
    ]);
    // Baseline capacity options (allow_overflow=false per latest requirement, include_tentative=true retained)
    props.onCapacityOptionsChange?.({ include_tentative: true, allow_overflow: false });
    // Clear locks & selections
    setLockedTop({});
    setLockedSubs({});
    setTableOpenModule(null);
    setHelpOpenModule(null);
    setSelectedTemplateId('');
  }

  function resetSubs(moduleKey: string) {
    const { list, onChange } = getSubweightCollection(moduleKey);
    if (!list || !onChange) return;
    const count = list.length;
    if (!count) return;
    const base = Math.floor(100 / count);
    let remainder = 100 - base*count;
    const next = list.map(sw => ({ ...sw, weight: base + (remainder-- > 0 ? 1 : 0) }));
    onChange(next);
    setLockedSubs(s => ({ ...s, [moduleKey]: {} }));
  }

  // Utility to fetch subweight collection generically
  function getSubweightCollection(moduleKey: string): { list?: { id: string; weight: number }[], onChange?: (n: { id: string; weight: number }[]) => void } {
    switch (moduleKey) {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  case 'capacity': return { list: props.capacitySubweights, onChange: props.onCapacitySubweightsChange ? (n) => props.onCapacitySubweightsChange!(n as any) : undefined }; 
  case 'workOpportunity': return { list: props.workSubweights, onChange: props.onWorkSubweightsChange ? (n) => props.onWorkSubweightsChange!(n as any) : undefined }; 
  case 'connection': return { list: props.connectionSubweights, onChange: props.onConnectionSubweightsChange ? (n) => props.onConnectionSubweightsChange!(n as any) : undefined }; 
  case 'healthcare': return { list: props.healthcareSubweights, onChange: props.onHealthcareSubweightsChange ? (n) => props.onHealthcareSubweightsChange!(n as any) : undefined }; 
  case 'education': return { list: props.educationSubweights, onChange: props.onEducationSubweightsChange ? (n) => props.onEducationSubweightsChange!(n as any) : undefined }; 
  /* eslint-enable @typescript-eslint/no-explicit-any */
    }
    return {};
  }

  // Top-level weight change via slider (continuous)
  const pendingTop = React.useRef<Record<string, number>>({});
  const updateModuleWeight = (key: keyof ModuleWeights, value: number) => {
    // Store pending without committing redistribution until pointer up for perf (score table recalculation)
    pendingTop.current[String(key)] = value;
    redistributeTop(String(key), value); // still update live for immediate feedback
  };
  function commitTopIfPending(key: string) {
    if (pendingTop.current[key] != null) {
      // trigger change handler again to ensure external listeners run after drag end (already updated state though)
      redistributeTop(key, pendingTop.current[key]);
      delete pendingTop.current[key];
    }
  }

  // Generic subweight update util with type erasure
  // (Removed legacy updateSubweights helper – logic now handled by redistributeSubs)

  // Helper to render subweight rows for a module group
  function renderSubweights(moduleKey: string) {
  const { list } = getSubweightCollection(moduleKey);
  const lockMap = lockedSubs[moduleKey] || {};
    if (!list || !list.length) return <p className="text-xs text-gray-400 italic">Ingen undervekter konfigurert.</p>;
  const parentDisabled = (moduleWeights as Record<string, number | undefined>)[moduleKey] === 0;
    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <button onClick={() => resetSubs(moduleKey)} className="text-[11px] text-blue-600 hover:underline">Reset undervekter</button>
          <span className="text-[10px] text-gray-400">Sum 100%</span>
        </div>
        {list.map(sw => {
          const disabled = parentDisabled || sw.weight === 0;
          return (
            <div key={sw.id} className={`p-2 rounded border ${disabled? 'border-gray-200 bg-gray-50 opacity-60':'border-gray-200 bg-white'}`}>
              <div className="flex items-center justify-between mb-1 gap-2">
                <span className="font-mono text-[10px] truncate" title={sw.id}>{sw.id}</span>
                <span className="text-[11px] font-semibold tabular-nums">{sw.weight}%</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={sw.weight}
                  disabled={disabled || lockMap[sw.id]}
                  onChange={e => redistributeSubs(moduleKey, sw.id, parseInt(e.target.value,10))}
                  className="flex-grow h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <button
                  type="button"
                  aria-label={lockMap[sw.id] ? 'Lås opp undervekt' : 'Lås undervekt'}
                  onClick={() => toggleSubLock(moduleKey, sw.id)}
                  className={`text-lg leading-none px-1 select-none ${lockMap[sw.id] ? 'text-yellow-600' : 'text-gray-400 hover:text-gray-600'}`}
                >{lockMap[sw.id] ? '🔒' : '🔓'}</button>
              </div>
              <div className="mt-1 text-[10px] text-gray-500 leading-tight">{labelForSub(sw.id)}</div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex flex-col md:flex-row w-full">
        {/* Main table */}
  <div ref={leftPanelRef} className="overflow-x-auto rounded-xl shadow ring-1 ring-blue-200 bg-white transition-all duration-300 flex-1 md:mr-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between px-4 py-2 border-b border-blue-100 bg-blue-50 rounded-t-xl gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-semibold text-blue-900 text-sm">Modul-vekter</h2>
              <div className="flex items-center gap-2" title="Forhåndsdefinert vektmal">
                <label className="text-[11px] text-blue-900 font-medium hidden sm:inline" htmlFor="weight-template-select">Mal:</label>
                <select
                  id="weight-template-select"
                  value={selectedTemplateId}
                  onChange={handleTemplateChange}
                  className="text-[11px] px-2 py-1 rounded border border-blue-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">Velg mal…</option>
                  {WEIGHT_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button
                  type="button"
                  onClick={resetToBaseline}
                  className="text-[11px] px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                  title="Tilbakestill til grunnoppsett (jevn fordeling)"
                >Reset</button>
              </div>
            </div>
            <div className="flex items-center gap-2 md:justify-end">
              <button
                onClick={() => { setShowHelp(h => { const next = !h; if (next) setShowJson(false); return next; }); }}
                className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white shadow focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500">
                {showHelp ? 'Skjul forklaring' : 'Forklaring ?'}
              </button>
              <button
                onClick={() => { setShowJson(j => { const next = !j; if (next) setShowHelp(false); return next; }); }}
                className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-700 hover:bg-gray-800 text-white shadow focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-500">
                {showJson ? 'Skjul JSON' : 'Vis JSON'}
              </button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-blue-50 text-left text-blue-900">
                <th className="px-3 py-2 font-semibold">Modul</th>
                <th className="px-3 py-2 font-semibold w-28">Vekt</th>
                <th className="px-3 py-2 font-semibold w-24">Undervekter</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {TOP_MODULE_KEYS.map(k => (
                <React.Fragment key={k}>
                  <tr className="odd:bg-white even:bg-gray-50 hover:bg-blue-50 transition-colors align-top">
                    <td className="px-3 py-2 font-medium" data-weight-tooltip-root>
                      <div className="flex flex-col gap-1 relative">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <span>{MODULE_LABEL_NB[k] || k}</span>
                            <button
                              type="button"
                              aria-label="Modul forklaring"
                              onClick={(e) => { e.stopPropagation(); setTooltipOpenModule(m => m === k ? null : String(k)); }}
                              className="text-[10px] w-4 h-4 flex items-center justify-center rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200"
                            >?</button>
                          </div>
                          <span className="text-[11px] font-semibold tabular-nums">{moduleWeights[k]}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            value={moduleWeights[k] ?? 0}
                            disabled={lockedTop[k]}
                            onChange={e => updateModuleWeight(k, parseInt(e.target.value,10))}
                            onMouseUp={() => commitTopIfPending(String(k))}
                            onPointerUp={() => commitTopIfPending(String(k))}
                            className="w-80 flex-grow h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                          <button
                            type="button"
                            aria-label={lockedTop[k] ? 'Lås opp modul' : 'Lås modul'}
                            onClick={() => toggleTopLock(String(k))}
                            className={`text-xl leading-none px-1 select-none ${lockedTop[k] ? 'text-yellow-600' : 'text-gray-400 hover:text-gray-600'}`}
                          >{lockedTop[k] ? '🔒' : '🔓'}</button>
                        </div>
                        {tooltipOpenModule === k && (
                          <div className="absolute z-20 top-full left-0 mt-1 w-64 p-2 rounded-md border border-blue-200 bg-white shadow text-[11px] text-gray-700 leading-snug">
                            <div className="flex justify-between items-start mb-1">
                              <strong className="text-gray-800 text-[11px]">{MODULE_LABEL_NB[k] || k}</strong>
                              <button
                                type="button"
                                className="text-gray-400 hover:text-gray-600"
                                aria-label="Lukk"
                                onClick={(e) => { e.stopPropagation(); setTooltipOpenModule(null); }}
                              >✕</button>
                            </div>
                            {MODULE_EXPLANATION_NB[k]}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => setTableOpenModule(m => m === k ? null : String(k))} className="text-[11px] text-blue-700 hover:underline">
                        {tableOpenModule === k ? 'Skjul' : 'Detaljer'}
                      </button>
                    </td>
                  </tr>
                  {tableOpenModule === k && (
                    <tr className="bg-blue-25">
                      <td colSpan={3} className="p-3">
                        <div className="mb-2 flex items-center justify-between gap-4">
                          <h3 className="font-semibold text-sm">Undervekter – {MODULE_LABEL_NB[k] || k}</h3>
                          <div className="flex items-center gap-2">
                            <button onClick={() => resetSubs(k)} className="text-[11px] text-blue-600 hover:underline">Reset</button>
                            <button onClick={() => setTableOpenModule(null)} className="text-[11px] text-gray-500 hover:text-gray-700">Lukk</button>
                          </div>
                        </div>
                        {/* Capacity spesifikke opsjoner */}
                        {k === 'capacity' && (
                          <div className="mb-3 border border-blue-100 rounded-md bg-blue-50/40 p-3 space-y-2">
                            <div className="text-[11px] font-medium text-blue-900">Kapasitet innstillinger</div>
                            <div className="flex flex-col sm:flex-row gap-3 text-[11px]">
                              <label className="inline-flex items-start gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  className="mt-0.5"
                                  checked={!!props.capacityOptions?.include_tentative}
                                  onChange={e => props.onCapacityOptionsChange?.({
                                    include_tentative: e.target.checked,
                                    allow_overflow: props.capacityOptions?.allow_overflow ?? false,
                                  })}
                                />
                                <span>
                                  Inkluder tentativt krav
                                  <span className="block text-[10px] text-gray-500">Trekk fra foreløpige reserverte plasser før margin beregnes.</span>
                                </span>
                              </label>
                              <label className="inline-flex items-start gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  className="mt-0.5"
                                  checked={!!props.capacityOptions?.allow_overflow}
                                  onChange={e => props.onCapacityOptionsChange?.({
                                    include_tentative: props.capacityOptions?.include_tentative ?? false,
                                    allow_overflow: e.target.checked,
                                  })}
                                />
                                <span>
                                  Tillat overflyt (straff)
                                  <span className="block text-[10px] text-gray-500">Hvis gruppen ikke får plass, beregn straff-score i stedet for 0.</span>
                                </span>
                              </label>
                            </div>
                          </div>
                        )}
                        {renderSubweights(k)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          <div className="border-t border-blue-100 px-3 py-2 flex items-center justify-between bg-blue-50 text-[11px]">
            <div className="flex items-center gap-3">
              <span className="font-medium text-blue-900">Sum: {TOP_MODULE_KEYS.reduce((a: number,k) => a + (moduleWeights[k] as number || 0),0)}%</span>
              <button onClick={resetTop} className="px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700">Reset topp</button>
            </div>
            <span className="text-gray-600">(Alltid 100%)</span>
          </div>
        </div>
        {/* Side panel: Help OR JSON */}
        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden ${(showHelp||showJson) ? 'md:w-96 opacity-100 translate-x-0' : 'md:w-0 w-0 opacity-0 pointer-events-none'}`}
          style={leftHeight ? { height: leftHeight } : undefined}
        >
          {(showHelp || showJson) && (
            <div className="h-full rounded-xl shadow ring-1 ring-gray-200 bg-white flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50">
                <h2 className="font-semibold text-gray-700 text-sm">{showHelp ? 'Forklaringer (ELI5)' : 'Vektkonfig JSON'}</h2>
                <button onClick={() => { if (showHelp) { setShowHelp(false); } else { setShowJson(false); } }} className="hidden md:inline-flex text-gray-500 hover:text-gray-700 text-xs">Lukk</button>
              </div>
              {showHelp && (
                <div className="flex-1 overflow-auto p-3 text-[12px] leading-snug space-y-4">
                  <p className="text-gray-600">Her kan du fordele hvor mye hver modul teller i samlet score. Høyere tall = større innflytelse. Alle topp-vekter normaliseres slik at summen blir 1. Undervekter fungerer likt innen sin modul.</p>
                  {TOP_MODULE_KEYS.map(k => (
                    <div key={k} className="border border-gray-200 rounded-md p-2 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <strong className="text-gray-800">{MODULE_LABEL_NB[k] || k}</strong>
                        <button onClick={() => setHelpOpenModule(m => m === k ? null : String(k))} className="text-[11px] text-blue-600 hover:underline">{helpOpenModule === k ? 'Skjul undervekter' : 'Vis undervekter'}</button>
                      </div>
                      <p className="mt-1">{MODULE_EXPLANATION_NB[k]}</p>
                      {helpOpenModule === k && (
                        <div className="mt-2 space-y-1">
                          {Object.entries(SUB_EXPLANATION_NB[k] || {}).map(([sid, txt]) => (
                            <div key={sid} className="bg-white border border-gray-200 rounded px-2 py-1">
                              <div className="font-mono text-[10px] text-gray-500">{sid}</div>
                              <div className="text-[11px] text-gray-700">{txt}</div>
                            </div>
                          ))}
                          {!Object.keys(SUB_EXPLANATION_NB[k] || {}).length && (
                            <div className="text-[11px] italic text-gray-400">Ingen undervekter definert.</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {showJson && (() => {
                const cfg = buildWeightConfiguration({
                  moduleWeights,
                  capacitySubweights: props.capacitySubweights,
                  workSubweights: props.workSubweights,
                  connectionSubweights: props.connectionSubweights,
                  healthcareSubweights: props.healthcareSubweights,
                  educationSubweights: props.educationSubweights,
                });
                const json = JSON.stringify(cfg, null, 2);
                return (
                  <div className="flex-1 p-3 flex flex-col min-h-0">
                    <pre className="text-[11px] leading-snug whitespace-pre-wrap break-words bg-gray-900 text-green-200 p-2 rounded-md shadow-inner flex-1 overflow-auto">
{json}
                    </pre>
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={() => { navigator.clipboard?.writeText(json); }}
                        className="text-[11px] px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                      >Kopier</button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WeightEditor;
