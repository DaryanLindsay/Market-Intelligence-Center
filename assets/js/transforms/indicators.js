// assets/js/transforms/indicators.js

export function median(values) {
  const vals = (values || []).filter(Number.isFinite).slice().sort((a, b) => a - b);
  const n = vals.length;
  if (!n) return null;
  const mid = Math.floor(n / 2);
  return n % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
}

/**
 * Percentile rank (0..100) using low-tail definition with mid-ties:
 * pct = % of history at/below x (ties count half)
 */
export function percentile(values, x) {
  if (!values?.length || !Number.isFinite(x)) return null;

  let lt = 0, eq = 0, n = 0;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    n++;
    if (v < x) lt++;
    else if (v === x) eq++;
  }
  if (n === 0) return null;

  const midTies = eq * 0.5;
  return ((lt + midTies) / n) * 100;
}

export function findMinMax(dates, series) {
  let min = { value: Infinity, date: null };
  let max = { value: -Infinity, date: null };

  for (let i = 0; i < series.length; i++) {
    const v = series[i];
    if (!Number.isFinite(v)) continue;

    if (v < min.value) min = { value: v, date: dates[i] };
    if (v > max.value) max = { value: v, date: dates[i] };
  }

  if (!Number.isFinite(min.value)) min = null;
  if (!Number.isFinite(max.value)) max = null;

  return { min, max };
}

export function timeInRegime(dates, series, threshold) {
  if (!dates?.length || !series?.length || dates.length !== series.length) return null;
  if (!Number.isFinite(threshold)) return null;

  let last = series.length - 1;
  while (last >= 0 && !Number.isFinite(series[last])) last--;
  if (last < 0) return null;

  const current = series[last];
  const isAbove = current >= threshold;

  let count = 0;
  let startIdx = last;

  for (let i = last; i >= 0; i--) {
    const v = series[i];
    if (!Number.isFinite(v)) continue;

    const ok = isAbove ? (v >= threshold) : (v < threshold);
    if (!ok) break;

    count++;
    startIdx = i;
  }

  return {
    startDate: dates[startIdx],
    days: count,
    direction: isAbove ? "above" : "below"
  };
}

export function computeRatioIndicators(dates, ratio) {
  if (!dates?.length || !ratio?.length || dates.length !== ratio.length) return null;

  let last = ratio.length - 1;
  while (last >= 0 && !Number.isFinite(ratio[last])) last--;
  if (last < 0) return null;

  const latestValue = ratio[last];
  const latestDate = dates[last];
  const startYear = Number(dates[0]?.slice(0, 4)) || null;

  const vals = ratio.filter(Number.isFinite);

  const med = median(vals);
  const pct = percentile(vals, latestValue);
  const tir = timeInRegime(dates, ratio, med);
  const historical = findMinMax(dates, ratio);

  return {
    latestValue,
    latestDate,
    startYear,
    median: med,
    percentile: pct,
    timeInRegime: tir,
    historical
  };
}
