export type ConfidenceLevel = "high" | "medium" | "low";

export type ConfidenceBreakdown = {
  propensityShare: number;
  uniqueness: number;
  sampleStrength: number;
  poolStrength: number;
  segmentMatch: number;
  score: number;
  level: ConfidenceLevel;
};

/** Intent-weighted click signal — still normalized so pool totals are conserved. */
export function keywordPropensity(row: {
  clicks: number;
  ctr: number;
  position: number;
  impressions: number;
}): number {
  const clicks = Math.max(row.clicks || 0, 0);
  if (clicks <= 0) return 0;

  const ctrFactor =
    row.ctr > 0 ? Math.min(2, 0.6 + row.ctr * 8) : row.impressions > 0 ? 0.75 : 0.5;
  const position = row.position > 0 ? row.position : 20;
  const positionFactor = Math.max(0.45, Math.min(1.4, 10 / position));
  const reliability =
    row.impressions >= 20 ? 1 : row.impressions >= 5 ? 0.85 : row.impressions >= 1 ? 0.65 : 0.4;

  return clicks * ctrFactor * positionFactor * reliability;
}

export function normalizePropensityShares(
  weights: Array<{ key: string; weight: number }>,
): Map<string, number> {
  const total = weights.reduce((s, w) => s + w.weight, 0);
  const out = new Map<string, number>();
  if (total <= 0) {
    const even = weights.length > 0 ? 1 / weights.length : 0;
    for (const w of weights) out.set(w.key, even);
    return out;
  }
  for (const w of weights) out.set(w.key, w.weight / total);
  return out;
}

/**
 * Modelled confidence for a keyword's share of a conversion pool.
 * Not a calibrated probability — encodes share strength, competition, sample size,
 * pool size, and whether device/country segmentation matched on both sides.
 */
export function scoreAttributionConfidence(params: {
  propensityShare: number;
  keywordCount: number;
  clicks: number;
  impressions: number;
  poolKeyEvents: number;
  poolSessions: number;
  segmentMatched: boolean;
}): ConfidenceBreakdown {
  const propensityShare = Math.max(0, Math.min(1, params.propensityShare));
  const uniqueness = params.keywordCount <= 1 ? 1 : 1 / Math.sqrt(params.keywordCount);
  const sampleStrength = Math.min(1, Math.log10(params.clicks + 1) / 1.2);
  const impressionStrength = Math.min(1, Math.log10(params.impressions + 1) / 2);
  const poolStrength = Math.min(
    1,
    Math.log10(Math.max(params.poolKeyEvents, params.poolSessions, 1) + 1) / 1.4,
  );
  const segmentMatch = params.segmentMatched ? 1 : 0.25;

  const score =
    0.32 * propensityShare +
    0.22 * uniqueness +
    0.16 * sampleStrength +
    0.1 * impressionStrength +
    0.12 * poolStrength +
    0.08 * segmentMatch;

  let level: ConfidenceLevel = "low";
  if (
    score >= 0.68 &&
    params.clicks >= 3 &&
    (params.keywordCount <= 5 || propensityShare >= 0.35)
  ) {
    level = "high";
  } else if (score >= 0.42 && params.clicks >= 1) {
    level = "medium";
  }

  return {
    propensityShare,
    uniqueness,
    sampleStrength,
    poolStrength,
    segmentMatch,
    score,
    level,
  };
}

/** Propensity-weighted average keyword confidence for a bucket. */
export function overallBucketConfidence(
  keywords: Array<{ confidence: ConfidenceBreakdown; propensityShare: number }>,
): { score: number; level: ConfidenceLevel } {
  if (!keywords.length) return { score: 0, level: "low" };

  const totalShare = keywords.reduce((s, k) => s + k.propensityShare, 0);
  const score =
    totalShare > 0
      ? keywords.reduce((s, k) => s + k.confidence.score * k.propensityShare, 0) / totalShare
      : keywords.reduce((s, k) => s + k.confidence.score, 0) / keywords.length;

  let level: ConfidenceLevel = "low";
  if (score >= 0.65) level = "high";
  else if (score >= 0.4) level = "medium";

  return { score, level };
}
