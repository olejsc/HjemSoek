import React from 'react';

interface Props { subweights: Record<string, number>; onChange(sw: Record<string, number>): void; }

/** Local subweight editor with an optional rebalance helper (scales to sum 100). */
export const SubweightEditorLocal: React.FC<Props> = ({ subweights, onChange }) => {
  const entries = Object.entries(subweights);
  const total = entries.reduce((a,[,v])=>a+ (isNaN(v)?0:v),0) || 0;
  const update = (k: string, v: number | undefined) => {
    onChange({ ...subweights, [k]: v ?? 0 });
  };
  const rebalance = () => {
    if (!entries.length) return;
    if (total === 0) {
      // Equal split to sum exactly 100
      const equal = Math.floor(100 / entries.length);
      const remainder = 100 - equal * entries.length;
      const next: Record<string, number> = {};
      entries.forEach(([k], idx) => { next[k] = equal + (idx === 0 ? remainder : 0); });
      onChange(next);
      return;
    }
    const scaledRaw: Array<[string, number]> = entries.map(([k,v]) => [k, (v/total)*100]);
    // Round while preserving total = 100 (largest remainder method)
    const floors = scaledRaw.map(([k,v]) => [k, Math.floor(v)] as [string, number]);
    let assigned = floors.reduce((a, [,v]) => a+v, 0);
    const remainders = scaledRaw.map(([k,v]) => ({ k, r: v - Math.floor(v) })).sort((a,b)=>b.r-a.r);
    for (let i=0; assigned < 100 && i < remainders.length; i++) { const fIdx = floors.findIndex(f => f[0] === remainders[i].k); floors[fIdx][1]++; assigned++; }
    const next: Record<string, number> = {};
    floors.forEach(([k,v]) => { next[k] = v; });
    onChange(next);
  };
  return (
    <div className="space-y-2 text-[11px]">
      <div className="flex items-center gap-2 justify-between">
        <div className="text-[10px] opacity-70">Normalisering skjer i scoreren; tall her er rå.</div>
        <button type="button" onClick={rebalance} className="text-[10px] border px-2 py-[2px] rounded hover:bg-neutral-100">Rebalanser til 100</button>
      </div>
      <table className="w-full border text-[10px]">
        <thead className="bg-neutral-100">
          <tr><th className="p-1 text-left">ID</th><th className="p-1 text-left">Vekt (rå)</th><th className="p-1 text-left">Normalisert</th></tr>
        </thead>
        <tbody>
          {entries.map(([k,v]) => (
            <tr key={k} className="border-t">
              <td className="p-1 font-mono">{k}</td>
              <td className="p-1">
                <input type="number" value={v} onChange={e=>update(k, e.target.value===''?0:Number(e.target.value))} className="border px-1 py-[1px] rounded w-24" />
              </td>
              <td className="p-1">{total>0 ? ((v/total)*100).toFixed(1)+'%' : '—'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t font-semibold"><td className="p-1">Sum</td><td className="p-1">{total}</td><td className="p-1">{total>0 ? '100%' : '—'}</td></tr>
        </tfoot>
      </table>
    </div>
  );
};
