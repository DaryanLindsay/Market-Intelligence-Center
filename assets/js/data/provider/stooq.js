// assets/js/data/provider/stooq.js
// Fetch daily OHLC CSV from Stooq and return as array of { date, close }

function parseCSV(csvText) {
  if (!csvText) return [];
  const text = csvText.replace(/^\uFEFF/, "").trim();
  if (!text) return [];

  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  const headerLine = lines[0].trim();
  const delim = headerLine.includes(",") ? "," : ";";

  const header = headerLine.split(delim).map((h) => h.trim().toLowerCase());
  const dateIdx = header.indexOf("date");
  const closeIdx = header.indexOf("close");
  if (dateIdx === -1 || closeIdx === -1) {
    throw new Error(`Unexpected Stooq CSV header: ${lines[0]}`);
  }

  const points = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(delim);
    const date = row[dateIdx]?.trim();
    const closeRaw = row[closeIdx]?.trim();
    if (!date || !closeRaw || closeRaw === "-") continue;

    const close = Number(closeRaw.replace(/,/g, ""));
    if (!Number.isFinite(close)) continue;

    points.push({ date, close });
  }

  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}

export async function fetchStooqDaily({ symbol, minYear = 1970, start = null, end = null }) {
  const s = String(symbol).trim().toLowerCase();

  // If caller didn't pass start/end, compute from minYear to today.
  const d1 = start ?? `${minYear}0101`;
  const now = new Date();
  const d2 = end ?? `${now.getUTCFullYear()}${String(now.getUTCMonth()+1).padStart(2,"0")}${String(now.getUTCDate()).padStart(2,"0")}`;

  const candidates = [
    `https://stooq.com/q/d/l/?s=${encodeURIComponent(s)}&i=d&d1=${d1}&d2=${d2}`,
    `https://stooq.com/q/d/l/?s=${encodeURIComponent(s)}&i=d`,
    `https://stooq.pl/q/d/l/?s=${encodeURIComponent(s)}&i=d&d1=${d1}&d2=${d2}`,
    `https://stooq.pl/q/d/l/?s=${encodeURIComponent(s)}&i=d`,
  ];

  let lastErr = null;

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: {
          accept: "text/csv,text/plain,*/*",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
          "cache-control": "no-cache",
          pragma: "no-cache",
          referer: "https://stooq.com/",
        },
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText} :: ${t.slice(0, 120)}`);
      }

      const csv = await res.text();
      if (!csv || !csv.trim()) throw new Error("Empty body");

      const points = parseCSV(csv);
      const filtered = points.filter((p) => Number(p.date.slice(0, 4)) >= minYear);
      if (!filtered.length) throw new Error("No usable points after filtering");

      return filtered;
    } catch (e) {
      lastErr = new Error(`Stooq candidate failed: ${url} :: ${e.message}`);
    }
  }

  throw lastErr ?? new Error(`Stooq failed for ${symbol}`);
}
