# ...existing code...

## Connection Module (relation-based locality scoring)

The `connection` module scores how well a target municipality matches declared personal connections (one per person). Each person may declare EITHER a municipality OR a region plus a mandatory relation type.

### Relation kinds & default weights

Subweight ids (default equal weights, normalized internally):
- `connection.friend`
- `connection.close_family`
- `connection.relative`
- `connection.workplace`
- `connection.school_place`

Example explicit subweights (optional):
```ts
subweights: [
  { id: 'connection.friend', weight: 1 },
  { id: 'connection.close_family', weight: 2 }, // emphasize close family
  { id: 'connection.relative', weight: 1 },
  { id: 'connection.workplace', weight: 1 },
  { id: 'connection.school_place', weight: 1 },
]
```

### Matching ladder (base scores before relation weights)
If a person declares a municipality connection:
- Exact municipality id == target ⇒ 100
- Declared municipality is adjacent to target ⇒ 50
- Same region (different municipality) ⇒ 10
- Else ⇒ 0

If a person declares a region connection (and target municipality belongs to that region):
- Base depends on relation:
  - friend: 10
  - close_family: 75
  - relative: 25
  - workplace: 25
  - school_place: 25
- If target municipality not in declared region ⇒ 0 (no adjacency credit outside region).

A person cannot declare both a region and a municipality. Exactly one connection per person (or none).

### Aggregation
1. Compute per-person base score via ladder.
2. Group persons by relation; for each relation r compute avg base score among persons with that relation (absent relation ⇒ avg 0 and contributes 0 when multiplied by weight).
3. Final module score = Σ_r (ŵ_r · avg_r).
4. `effective_score = score` (0..100). `max_possible = 100` when at least one person; 0 when no persons.

### Per-person trace
Each trace item exposes:
- `match_level`: exact | neighbor | region | none
- `base_score`: numeric (pre-weight)
- `explanation`: bullet lines for debugging.

### Example
```ts
import { scoreConnection } from './src/connection';

const input = {
  group: { persons: [
    { id: 'a', connection: { municipality_id: 'm1', relation: 'friend' } },
    { id: 'b', connection: { region_id: 'r2', relation: 'close_family' } },
  ]},
  target_municipality_id: 'm1',
  municipality_region_map: { m1: 'r1', m2: 'r1', m3: 'r2' },
  adjacency_map: { m1: ['m3'], m2: [], m3: ['m1'] },
};
const res = scoreConnection(input);
console.log(res.score, res.subscores);
```

### Overall aggregation default weights
When present with Capacity and Work Opportunity, recommend equal raw weights:
```ts
const weights = { capacity: 1, workOpportunity: 1, connection: 1 }; // normalized ⇒ each 1/3
```