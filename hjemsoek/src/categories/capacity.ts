import type { CapacityInput, CapacityResult } from "../types";
import { round } from "../utils";

/**
 * Score the Capacity module.
 * - Feasible: higher remaining/AE is better: S = 100 · (AE − G)/AE
 * - Overflow (if allowed): smaller overflow/CT is better: S = 100 · Overflow/CT
 * - Infeasible (overflow disallowed): S = 0
 * - Missing required inputs ⇒ max_possible = 0
 */
export function scoreCapacity(input: CapacityInput): CapacityResult {
	const groupSizeFromPersons = Array.isArray(input.group?.persons) ? input.group.persons.length : 0;
	const group_size = typeof input.group?.size === "number" ? input.group.size : groupSizeFromPersons;

	const { capacity_total, settled_current, tentative_claim } = input.municipality || ({} as any);
	const { include_tentative = false, allow_overflow = false } = input.options || ({} as any);

	const configured = Array.isArray(input.subweights) && input.subweights.length
		? input.subweights
		: [{ id: "capacity.core" as const, weight: 1 }];
	const core = configured.find((s) => s.id === "capacity.core") || { id: "capacity.core" as const, weight: 1 };
	const sumWeights = Math.max(1e-9, core.weight || 0);

	if (capacity_total == null || settled_current == null || capacity_total <= 0) {
		const explanation = [
			"• Kapasitet: mangler eller ugyldige nødvendige data. Maks mulig er 0.",
			`• total kapasitet er ${capacity_total}, allerede bosatt er ${settled_current}`,
			`• tillat overflyt er ${allow_overflow}, inkluder tentativt krav er ${include_tentative}.`,
		].join("\n");

		return {
			capacity_score: 0,
			max_possible: 0,
			effective_score: 0,
			mode: "missing_data",
			direction: "higher_better",
			confidence: 0,
			allow_overflow,
			include_tentative,
			available_effect: 0,
			remaining_after: 0,
			overflow_units: 0,
			subscores: [{
				id: "capacity.core",
				weight: core.weight,
				normalized_weight: (core.weight || 0) / sumWeights,
				score: 0,
				contribution: 0,
				formula: "Not computed (missing required fields).",
				values: {},
				mode: "missing_data",
				direction: "higher_better",
			}],
			explanation,
			trace: { inputs: { group_size, capacity_total, settled_current, tentative_claim, include_tentative, allow_overflow } },
		} as CapacityResult;
	}

	const tc = include_tentative ? (tentative_claim ?? 0) : 0;
	const available_base = capacity_total - settled_current;
	const available_effect = available_base - tc;
	const remaining_after = available_effect - group_size;

	let mode: CapacityResult["mode"] = "feasible";
	let direction: CapacityResult["direction"] = "higher_better";
	let coreScore = 0;
	let coreFormula = "";
	let coreValues: Record<string, number> = {};
	let overflow_units = 0;

	if (available_effect >= group_size) {
		const denom = available_effect <= 0 ? 1 : available_effect;
		coreScore = 100 * Math.max(0, remaining_after) / denom; // higher is better
		coreFormula = "S_core = 100 × (AE − G) / AE";
		coreValues = { AE: available_effect, G: group_size, AE_minus_G: Math.max(0, remaining_after) };
		mode = "feasible"; direction = "higher_better";
	} else if (allow_overflow) {
		overflow_units = Math.max(0, group_size - Math.max(0, available_effect));
		coreScore = 100 * overflow_units / capacity_total; // smaller is better
		coreFormula = "S_core = 100 × Overflow / CT";
		coreValues = { Overflow: overflow_units, CT: capacity_total };
		mode = "overflow_penalty"; direction = "lower_better";
	} else {
		coreScore = 0;
		coreFormula = "S_core = 0 (infeasible; overflow disabled)";
		coreValues = { AE: available_effect, G: group_size };
		mode = "infeasible"; direction = "higher_better";
	}

	const normalized_core_w = (core.weight || 0) / sumWeights;
	const contribution_core = normalized_core_w * coreScore;

	const capacity_score = contribution_core;
	const max_possible = 100;
	const effective_score = Math.min(capacity_score, max_possible);

	const explanation = [
		`• Modus er ${mode} (${direction}). Tillat overflyt er ${allow_overflow}, inkluder tentativt krav er ${include_tentative}.`,
		`• Inndata: gruppestørrelse er ${group_size}, total kapasitet er ${capacity_total}, allerede bosatt er ${settled_current}, tentativt krav brukt er ${tc}.`,
		`• Avledet: tilgjengelig etter justering er ${available_effect}, resterende etter bosetting er ${remaining_after}, overflyt enheter er ${overflow_units}.`,
		`• capacity.core: vekt normalisert er ${round(normalized_core_w, 3)} ganger ${round(coreScore, 1)} prosent er ${round(contribution_core, 1)} prosent`,
		`• Effektiv poengsum er ${round(effective_score, 1)} prosent`,
	].join("\n");

	return {
		capacity_score,
		max_possible,
		effective_score,
		mode,
		direction,
		confidence: 1, // capacity always confident when inputs valid (group may be zero but still deterministic)
		allow_overflow,
		include_tentative,
		available_effect,
		remaining_after,
		overflow_units,
		subscores: [{
			id: "capacity.core",
			weight: core.weight,
			normalized_weight: normalized_core_w,
			score: coreScore,
			contribution: contribution_core,
			formula: coreFormula,
			values: coreValues,
			mode,
			direction,
		}],
		explanation,
		trace: {
			inputs: { group_size, capacity_total, settled_current, tentative_claim: tc, include_tentative, allow_overflow },
			derivations: { available_base, available_effect, remaining_after, overflow_units },
		},
	} as CapacityResult;
}

export default scoreCapacity;