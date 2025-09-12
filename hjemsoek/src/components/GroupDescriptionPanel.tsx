import React from 'react';
import type { Group } from '../types';
import generateGroupDescription from '../utils/groupDescription';

export interface GroupDescriptionPanelProps {
  group: Group;
  municipalities: { id: string; name?: string; region_id?: string }[];
  regions: { id: string; name?: string }[];
}

const GroupDescriptionPanel: React.FC<GroupDescriptionPanelProps> = ({ group, municipalities, regions }) => {
  const municipalitiesById = React.useMemo(() => Object.fromEntries(municipalities.map(m => [m.id, m])), [municipalities]);
  const regionsById = React.useMemo(() => Object.fromEntries(regions.map(r => [r.id, r])), [regions]);
  const desc = React.useMemo(() => generateGroupDescription(group, { municipalitiesById, regionsById }), [group, municipalitiesById, regionsById]);
  const textRef = React.useRef<HTMLTextAreaElement | null>(null);
  const copy = () => {
    if (textRef.current) {
      textRef.current.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      window.getSelection()?.removeAllRanges();
    }
  };
  return (
    <div className="rounded-xl shadow ring-1 ring-gray-200 bg-white flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50">
        <h2 className="font-semibold text-gray-700 text-sm">Beskrivelse</h2>
        <button onClick={copy} className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-600 hover:bg-green-700 text-white shadow focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-green-500">Kopier</button>
      </div>
      <div className="p-3">
        <p className="text-xs whitespace-pre-line font-mono text-gray-700">
          <strong className="font-semibold">{desc.groupParagraph}</strong>{desc.personsParagraph ? '\n\n' + desc.personsParagraph : ''}
        </p>
        <textarea ref={textRef} className="sr-only" readOnly value={desc.fullText} aria-hidden="true" />
      </div>
    </div>
  );
};

export default GroupDescriptionPanel;