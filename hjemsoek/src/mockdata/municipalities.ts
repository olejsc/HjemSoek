// Lightweight seeded PRNG (mulberry32) for reproducible mock data
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Municipality = {
  id: string;
  name: string;
  county?: string;
  /** Region id the municipality belongs to (added for connection & education scoring). */
  region_id: string;
  capacity_total: number;
  settled_current: number;
  tentative_claim?: number;
  work_opportunity?: {
    unemployment_rate?: number;
    profession_growth?: Record<string, number>;
    profession_history?: Record<string, {
      number_of_employees_in_profession_5_years_ago?: number;
      number_of_employees_in_profession_now?: number;
      percentage_of_municipality_workforce_5_years_ago?: number;
      percentage_of_municipality_workforce_now?: number;
      workforce_change_past_5_years?: number;
    }>;
  };
  // Healthcare fields
  has_hospital?: boolean;
  specialist_facilities?: string[];
  // Education facility flags
  has_primary_school?: boolean;
  has_high_school?: boolean;
  has_university?: boolean;
  has_adult_language?: boolean;
};

const norwegianNames = [
  'Oslo','Bergen','Trondheim','Stavanger','Drammen','Fredrikstad','Tromsø','Kristiansand','Ålesund','Hamar',
  'Tønsberg','Skien','Bodø','Sandnes','Arendal','Molde','Lillehammer','Gjøvik','Halden','Porsgrunn',
  'Alta','Narvik','Harstad','Lørenskog','Bærum','Asker','Larvik','Kongsberg','Horten','Rana',
  'Stjørdal','Moss','Kongsvinger','Sortland','Steinkjer','Voss','Rakkestad','Eidsvoll','Klepp','Sola',
  'Vindafjord','Notodden','Karmøy','Ski','Jessheim','Mandalen','Ås','Flekkefjord','Horten','Drangedal'
];

/** Canonical list of mock professions (exported for UI drop-down). */
export const professions = ['teacher','nurse','engineer','developer','farmer','driver','carpenter','electrician','chef','sales'] as const;

/** Norwegian counties used as regions for UI purposes. */
export interface Region { id: string; name: string; }
export const regions: Region[] = [
  { id: 'akershus', name: 'Akershus' },
  { id: 'oslo', name: 'Oslo' },
  { id: 'innlandet', name: 'Innlandet' },
  { id: 'vestfold-telemark', name: 'Vestfold og Telemark' },
  { id: 'viken', name: 'Viken' },
  { id: 'agder', name: 'Agder' },
  { id: 'rogaland', name: 'Rogaland' },
  { id: 'vestland', name: 'Vestland' },
  { id: 'more-romsdal', name: 'Møre og Romsdal' },
  { id: 'trondelag', name: 'Trøndelag' },
  { id: 'nordland', name: 'Nordland' },
  { id: 'troms-finnmark', name: 'Troms og Finnmark' },
];

// Deterministic county assignment
function regionForIndex(i: number): string {
  return regions[i % regions.length].id;
}

/**
 * Create an array of mock Norwegian municipalities.
 * Returns objects compatible with the scoring input shapes in `src/types.ts`.
 */
export function createNorwayMunicipalities(count = 50, seed = 1): Municipality[] {
  const rand = mulberry32(seed);
  const out: Municipality[] = [];

  for (let i = 0; i < count; i++) {
    const name = norwegianNames[i % norwegianNames.length] + (i >= norwegianNames.length ? `-${Math.floor(i / norwegianNames.length)}` : '');
  const id = `no-${i + 1}`;
  const region_id = regionForIndex(i); // stable region assignment

  // capacity_total: final reduction 5..50 (no municipality needs > 50)
  // Buckets (approx probs, emphasizing 5-25):
  // 55% very small (5-15), 25% small (16-25), 15% moderate (26-40), 5% upper (41-50)
    const p = rand();
    const pick = (min: number, max: number) => Math.round(min + rand() * (max - min));
    let capacity_total: number;
  if (p < 0.55) capacity_total = pick(5, 15);
  else if (p < 0.80) capacity_total = pick(16, 25);
  else if (p < 0.95) capacity_total = pick(26, 40);
  else capacity_total = pick(41, 50);

    // Settled current: occupancy ratio varied (skewed toward lower occupancy for small municipalities)
    let settled_current: number;
    const occSkew = (() => {
      // With small capacities, occupancy variance should be high.
      if (capacity_total <= 15) return Math.pow(rand(), 1.9) * 0.6; // often quite empty
      if (capacity_total <= 25) return Math.pow(rand(), 1.5) * 0.7;
      if (capacity_total <= 40) return Math.pow(rand(), 1.2) * 0.8;
      return Math.pow(rand(), 1.0) * 0.85;
    })();
    settled_current = Math.round(capacity_total * occSkew);
    if (settled_current >= capacity_total) settled_current = capacity_total - 1;

    // Force specific leftover patterns:
    const leftoverMode = rand();
    if (capacity_total >= 5) {
      if (leftoverMode < 0.15) {
        // 15% fully saturated (0 capacity left)
        settled_current = capacity_total;
      } else if (leftoverMode < 0.40) {
        // 25% with only 1-5 spots left
        const remaining = pick(1, Math.min(5, Math.max(1, capacity_total - 1)));
        settled_current = Math.max(0, capacity_total - remaining);
      }
    }
    // Clamp
    if (settled_current < 0) settled_current = 0;
    if (settled_current > capacity_total) settled_current = capacity_total;

    // Tentative claim: roughly 40% chance; value 5-20% of free capacity (if any)
  const free = Math.max(0, capacity_total - settled_current);
  const tentative_claim = free > 0 && rand() < 0.4 ? Math.max(1, Math.round((0.05 + rand() * 0.15) * free)) : undefined;

    // Unemployment 1..12% typically
    const unemployment_rate = Math.round((2 + rand() * 10) * 10) / 10;

  // (Removed legacy profession_growth map – normalization now derives from history only)

    // synthesize simple profession history to exercise scenarios:
    const profession_history: Record<string, {
      number_of_employees_in_profession_5_years_ago?: number;
      number_of_employees_in_profession_now?: number;
      percentage_of_municipality_workforce_5_years_ago?: number;
      percentage_of_municipality_workforce_now?: number;
      workforce_change_past_5_years?: number;
    }> = {};
    for (const prof of professions) {
      // base employees 0..9
      const base = Math.floor(rand()*10); // can be 0 triggers synthetic base logic
      const delta = Math.floor(rand()*6) - 2; // -2..+3
      const now = Math.max(0, base + delta);
      const totalWorkforceBase = 100 + Math.floor(rand()*200); // 100..299 baseline workforce size (approx)
      const totalWorkforceNow = totalWorkforceBase + Math.floor(rand()*20) - 10;
      const share0 = totalWorkforceBase ? (base/totalWorkforceBase)*100 : 0;
      const share1 = totalWorkforceNow ? (now/totalWorkforceNow)*100 : 0;
      const pctChange = base === 0 ? (now>0?100:0) : ((now-base)/base)*100;
      if (rand()<0.55) { // sparse history
        profession_history[prof] = {
          number_of_employees_in_profession_5_years_ago: base,
          number_of_employees_in_profession_now: now,
          percentage_of_municipality_workforce_5_years_ago: parseFloat(share0.toFixed(2)),
            percentage_of_municipality_workforce_now: parseFloat(share1.toFixed(2)),
          workforce_change_past_5_years: parseFloat(pctChange.toFixed(2))
        };
      }
    }

    out.push({
      id,
      name,
      region_id,
      county: regions.find(r => r.id === region_id)?.name,
      capacity_total,
      settled_current,
      tentative_claim,
      work_opportunity: {
        unemployment_rate,
        profession_history: Object.keys(profession_history).length ? profession_history : undefined,
      },
      has_hospital: rand() < 0.4, // ~40% have a hospital
      specialist_facilities: (() => {
        // pick a random subset of specialist types (no duplicates)
        const all = [
          'dialysis','rehabilitation','physical_therapy','mental_health','oncology','cardiology','maternity','pediatrics','substance_abuse','trauma','orthopedic','respiratory'
        ];
        const shuffled = all
          .map(t => ({ t, r: rand() }))
          .sort((a,b) => a.r - b.r)
          .slice(0, Math.floor(rand()*5)); // up to 5 facilities
        const subset = shuffled.map(x => x.t);
        return subset.length ? subset : undefined;
      })(),
  // Education facility presence (~distributions tuned for variety)
  has_primary_school: rand() < 0.85, // most municipalities have primary school
  has_high_school: rand() < 0.55,
  has_university: rand() < 0.25,
  has_adult_language: rand() < 0.40,
    });
  }

  return out;
}

export default createNorwayMunicipalities;
