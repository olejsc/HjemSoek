import React from 'react';
import { useCalculatorState } from './useCalculatorState';
import { StepModuleSelect } from './steps/StepModuleSelect';
// PlaceholderStep no longer used (kept for potential future minor steps)
import { StepProfessions } from './steps/StepProfessions';
import { StepRegionsMunicipalities } from './steps/StepRegionsMunicipalities';
import { StepMunicipalityEditor } from './steps/StepMunicipalityEditor';
import { StepPersons } from './steps/StepPersons';
import { StepSubweights } from './steps/StepSubweights';
import { StepOptions } from './steps/StepOptions';
import { StepReviewRun } from './steps/StepReviewRun';
import { ResultsView } from './steps/ResultsView';
import { buildCapacityInput } from './builders/buildCapacityInput';
import { buildWorkInput } from './builders/buildWorkInput';
import { buildConnectionInput } from './builders/buildConnectionInput';
import { buildHealthcareInput } from './builders/buildHealthcareInput';
import { buildEducationInput } from './builders/buildEducationInput';
import { scoreCapacity } from '../categories/capacity';
import { scoreWorkOpportunity } from '../categories/work';
import { scoreConnection } from '../categories/connection';
import { scoreHealthcare } from '../categories/healthcare';
import { scoreEducation } from '../categories/education';
import type { CalculatorModule, WizardStepKey, ValidationIssue, ModuleFullResult } from './types';

interface Props { initialModule?: CalculatorModule; onClose(): void; }

export const ModalRoot: React.FC<Props> = ({ initialModule = 'capacity', onClose }) => {
  const { state, dispatch } = useCalculatorState(initialModule);
  const { scenario } = state;
  const goto = (step: WizardStepKey) => dispatch({ type: 'SET_STEP', step });
  const setModule = (m: CalculatorModule) => dispatch({ type: 'REPLACE_SCENARIO', scenario: { ...scenario, module: m } });

  function runCalculation() {
    let result: ModuleFullResult | undefined;
    let buildIssues: ValidationIssue[] = [];
    switch (scenario.module) {
  case 'capacity': { const b = buildCapacityInput(scenario); buildIssues = b.issues; if (b.input && !b.issues.some(i=>i.level==='error')) { result = scoreCapacity(b.input); } break; }
  case 'workOpportunity': { const b = buildWorkInput(scenario); buildIssues = b.issues; if (b.input && !b.issues.some(i=>i.level==='error')) { result = scoreWorkOpportunity(b.input); } break; }
  case 'connection': { const b = buildConnectionInput(scenario); buildIssues = b.issues; if (b.input && !b.issues.some(i=>i.level==='error')) { result = scoreConnection(b.input); } break; }
  case 'healthcare': { const b = buildHealthcareInput(scenario); buildIssues = b.issues; if (b.input && !b.issues.some(i=>i.level==='error')) { result = scoreHealthcare(b.input); } break; }
  case 'education': { const b = buildEducationInput(scenario); buildIssues = b.issues; if (b.input && !b.issues.some(i=>i.level==='error')) { result = scoreEducation(b.input); } break; }
    }
    if (buildIssues.some(i => i.level === 'error')) {
      alert('Kan ikke kjøre – rett feil først.\n' + buildIssues.filter(i=>i.level==='error').map(i=>'- '+i.message).join('\n'));
      return;
    }
    if (result) { dispatch({ type: 'SET_RESULT', base: result, full: result }); goto('results'); }
  }

  function renderStep() {
    switch (state.step) {
      case 'module': return <StepModuleSelect value={scenario.module} onChange={setModule} onNext={() => goto('professions')} />;
  case 'professions': return <StepProfessions scenario={scenario} onUpdate={p=>dispatch({ type: 'UPDATE_SCENARIO', patch: p })} onBack={() => goto('module')} onNext={() => goto('regions')} />;
  case 'regions': return <StepRegionsMunicipalities scenario={scenario} onUpdate={p=>dispatch({ type: 'UPDATE_SCENARIO', patch: p })} onBack={() => goto('professions')} onNext={() => goto('municipalities')} />;
  case 'municipalities': return <StepMunicipalityEditor scenario={scenario} onUpdate={p=>dispatch({ type: 'UPDATE_SCENARIO', patch: p })} onBack={() => goto('regions')} onNext={() => goto('persons')} />;
  case 'persons': return <StepPersons scenario={scenario} onUpdate={p=>dispatch({ type: 'UPDATE_SCENARIO', patch: p })} onBack={() => goto('municipalities')} onNext={() => goto('subweights')} />;
  case 'subweights': return <StepSubweights scenario={scenario} onUpdate={p=>dispatch({ type: 'UPDATE_SCENARIO', patch: p })} onBack={() => goto('persons')} onNext={() => goto('options')} />;
  case 'options': return <StepOptions scenario={scenario} onUpdate={p=>dispatch({ type: 'UPDATE_SCENARIO', patch: p })} onBack={() => goto('subweights')} onNext={() => goto('review')} />;
  case 'review': return <StepReviewRun scenario={scenario} onBack={() => goto('options')} onRun={runCalculation} />;
  case 'results': return <ResultsView result={scenario.lastFullResult} stale={!!scenario.resultStale} onRerun={runCalculation} onClose={onClose} onBack={() => goto('review')} onReset={()=>dispatch({ type:'RESET_SCENARIO' })} />;
      default: return <div>Ukjent steg</div>;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-auto rounded shadow-lg p-6 text-sm">
        {renderStep()}
      </div>
    </div>
  );
};
