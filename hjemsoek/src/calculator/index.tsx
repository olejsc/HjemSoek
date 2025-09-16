import React from 'react';
import { ModalRoot } from './ModalRoot';
import type { CalculatorModule } from './types';

interface LauncherProps { defaultModule?: CalculatorModule; }

export const ModuleCalculatorLauncher: React.FC<LauncherProps> = ({ defaultModule = 'capacity' }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border px-3 py-1 rounded bg-white shadow-sm hover:bg-neutral-50"
      >
        Åpne kalkulator
      </button>
      {open && <ModalRoot initialModule={defaultModule} onClose={() => setOpen(false)} />}
    </>
  );
};

export default ModuleCalculatorLauncher;
