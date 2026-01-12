export function toMap(points, valueKey = "close") {
  const m = new Map();
  for (const p of (points || [])) {
    const date = p?.date;
    const v = Number(p?.[valueKey]);
    if (!date || !Number.isFinite(v)) continue;
    m.set(date, v);
  }
  return m;
}

export function intersectDates(mapA, mapB) {
  return [...mapA.keys()].filter(d => mapB.has(d)).sort();
}

export function buildRatioSeries({ numJson, denJson, numKey="close", denKey="close" }) {
  const numMap = toMap(numJson?.points, numKey);
  const denMap = toMap(denJson?.points, denKey);
  const dates = intersectDates(numMap, denMap);

  const ratio = dates.map(d => {
    const a = numMap.get(d);
    const b = denMap.get(d);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return null;
    return a / b;
  });

  return { dates, ratio };
}
