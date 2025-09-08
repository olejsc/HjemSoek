import type { BaseModuleResult, ModuleWeights } from "../types";
import { normalizeWeights, sum } from "../utils";

/** Compute contribution-safe impact (make higher always better for totals). */
export function impactForModule(moduleKey: string, moduleResult: BaseModuleResult): number {
	if (!moduleResult) return 0;
	if (moduleKey === "capacity" && moduleResult.mode === "overflow_penalty") {
        // Invert overflow for total aggregation
		return 100 - (moduleResult.effective_score ?? 0);
	}
	return moduleResult.effective_score ?? 0;
}

/**
 * Aggregate modules into a single weighted total (0..100).
 * - Normalizes weights across present modules.
 * - Applies `impactForModule` so totals remain higher-is-better.
 */
export function aggregateOverall(modules: Record<string, BaseModuleResult | undefined>, weights: ModuleWeights) {
	const present = Object.keys(modules).filter((k) => !!modules[k]);
	const normalized = normalizeWeights(weights as Record<string, number>, present);
	const contributions = present.map((k) => normalized[k] * impactForModule(k, modules[k]!));
	const weighted_total = sum(contributions);
    // overall max possible limited by confidence (binary) per module
	const overall_max_possible = sum(present.map(k => {
		const m = modules[k]!;
		const conf = typeof m.confidence === 'number' ? m.confidence : (m.max_possible > 0 ? 1 : 0);
		return normalized[k] * (conf * 100);
	}));
	return { weighted_total, weights: normalized, overall_max_possible };
}