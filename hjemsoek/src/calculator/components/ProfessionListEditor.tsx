import React from 'react';

interface Props {
  professions: string[];
  onChange(next: string[]): void;
  required?: boolean;
}

export const ProfessionListEditor: React.FC<Props> = ({ professions, onChange, required }) => {
  const [draft, setDraft] = React.useState('');
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (professions.includes(v)) return;
    onChange([...professions, v]);
    setDraft('');
  };
  const remove = (p: string) => onChange(professions.filter(x => x !== p));
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Ny profesjon" className="border px-2 py-1 text-xs rounded flex-1" />
        <button type="button" onClick={add} className="bg-blue-600 text-white text-xs px-2 rounded">Legg til</button>
      </div>
      {required && professions.length === 0 && <div className="text-red-600 text-[10px]">Minst én profesjon kreves for denne modulen.</div>}
      <ul className="flex flex-wrap gap-1">
        {professions.map(p => (
          <li key={p} className="bg-neutral-200 rounded px-2 py-[2px] text-[10px] flex items-center gap-1">
            <span>{p}</span>
            <button type="button" onClick={()=>remove(p)} className="text-red-600">×</button>
          </li>
        ))}
      </ul>
    </div>
  );
};
