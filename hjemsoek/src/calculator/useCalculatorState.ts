import React from 'react';
import type { WizardState, WizardAction, CalculatorModule } from './types';
import { createInitialScenario } from './types';

export function useCalculatorState(initialModule: CalculatorModule = 'capacity') {
  const initial: WizardState = React.useMemo(() => ({ step: 'module', scenario: createInitialScenario(initialModule) }), [initialModule]);

  function reducer(state: WizardState, action: WizardAction): WizardState {
    switch (action.type) {
      case 'SET_STEP':
        return { ...state, step: action.step };
      case 'UPDATE_SCENARIO':
        return { ...state, scenario: { ...state.scenario, ...action.patch, resultStale: true } };
      case 'REPLACE_SCENARIO':
        return { ...state, scenario: action.scenario };
      case 'MARK_RESULT_STALE':
        return { ...state, scenario: { ...state.scenario, resultStale: true } };
      case 'SET_RESULT':
        return { ...state, scenario: { ...state.scenario, lastResult: action.base, lastFullResult: action.full, resultStale: false } };
      case 'RESET_SCENARIO':
        return { ...state, step: 'module', scenario: createInitialScenario(state.scenario.module) };
      default:
        return state;
    }
  }

  const [state, dispatch] = React.useReducer(reducer, initial);
  return { state, dispatch };
}
