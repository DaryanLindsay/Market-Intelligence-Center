// assets/js/transforms/takeaway.js

function fmt(x, digits = 4) {
  return Number.isFinite(x) ? x.toFixed(digits) : "—";
}

function fmtPct(p) {
  if (p == null || !Number.isFinite(p)) return "—";
  if (p < 1) return "<1%";
  return `${Math.round(p)}%`;
}

export function generateTakeaway(ind, profile = {}) {
  if (!ind) {
    return {
      headline: "No takeaway available",
      body: "Indicator data was not available for this series."
    };
  }

  const v = ind.latestValue;
  const med = ind.median;
  const p = ind.percentile; // low-tail 0..100
  const startYear = ind.startYear ?? null;

  const LOW_EXTREME = profile.lowExtreme ?? 15;
  const HIGH_EXTREME = profile.highExtreme ?? 85;

  const noun = profile.noun ?? "ratio";
  const lowHeadline = profile.lowHeadline ?? "Historically low reading";
  const highHeadline = profile.highHeadline ?? "Historically high reading";
  const normalHeadlineAbove = profile.normalHeadlineAbove ?? "Above median regime";
  const normalHeadlineBelow = profile.normalHeadlineBelow ?? "Below median regime";
  const normalHeadlineUnknown = profile.normalHeadlineUnknown ?? "Within typical range";

  const isAbove = Number.isFinite(v) && Number.isFinite(med) ? v >= med : null;
  const regimeText = isAbove == null ? "—" : (isAbove ? "above" : "below");

  // Optional per-chart template functions (highest control)
  // Each returns { headline, body }
  const templates = profile.templates ?? {};

  // Decide state
  let state = "normal";
  if (p != null && Number.isFinite(p) && p <= LOW_EXTREME) state = "low";
  else if (p != null && Number.isFinite(p) && p >= HIGH_EXTREME) state = "high";

  // If a chart provided custom template for this state, use it
  if (templates[state]) return templates[state](ind);

  // Otherwise
  let headline = normalHeadlineUnknown;
  if (state === "low") headline = lowHeadline;
  if (state === "high") headline = highHeadline;
  if (state === "normal") {
    headline =
      isAbove == null ? normalHeadlineUnknown :
      isAbove ? normalHeadlineAbove : normalHeadlineBelow;
  }

  const bodyParts = [
    `Latest ${noun} is ${fmt(v, 4)} (${ind.latestDate}).`,
    Number.isFinite(med)
      ? `The long-run median is ${fmt(med, 4)}, and the ratio remains ${regimeText} its long-term historical median.`
      : ""
  ];

  // Only show this line when LOW extreme
  if (state === "low") {
    const since = startYear ? ` since ${startYear}` : "";
    bodyParts.push(`This is in the bottom ${fmtPct(p)} of historical observations${since}.`);
  }

  return { headline, body: bodyParts.filter(Boolean).join(" ") };
}
