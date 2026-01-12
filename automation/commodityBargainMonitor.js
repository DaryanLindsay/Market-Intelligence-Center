// automation/updateCommodityBargainMonitorYahoo.js
// Builds data-cache/commodityBargainMonitor.json using Yahoo v8 chart endpoint (daily).
// Computes 3Y trailing returns with a 1Y buffer for missing days.

import fs from "node:fs";
import path from "node:path";

const OUT_DIR = "data-cache";
const OUT_FILE = "commodityBargainMonitor.json";

const LOOKBACK_YEARS = 3;
const BUFFER_YEARS = 1;
const RADAR_THRESHOLD = -0.5; // -50%

function isoUTCDate(d) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toUnixSec(dateStr) {
  return Math.floor(new Date(dateStr).getTime() / 1000);
}

async function fetchDailySeriesYahoo(symbol, startISO) {
  const period1 = toUnixSec(`${startISO}T00:00:00Z`);
  const period2 = Math.floor(Date.now() / 1000);

  const url =
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=1d&period1=${period1}&period2=${period2}&events=history`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${symbol}`);

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) {
    const err = json?.chart?.error?.description || "No chart result";
    throw new Error(`Yahoo chart returned no result for ${symbol}: ${err}`);
  }

  const ts = Array.isArray(result.timestamp) ? result.timestamp : [];
  const close = result?.indicators?.quote?.[0]?.close ?? [];

  const points = ts
    .map((t, i) => {
      const c = close[i];
      if (c == null || !Number.isFinite(Number(c))) return null;
      return {
        date: new Date(t * 1000).toISOString().slice(0, 10),
        close: Number(c),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    symbol,
    currency: result?.meta?.currency || "USD",
    points,
  };
}

function writeJSON(filename, obj) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, filename), JSON.stringify(obj, null, 2), "utf8");
}

function pickStartEndFor3Y(points, lookbackYears = 3) {
  // Need closest point >= (lastDate - lookbackYears)
  if (!points.length) return null;

  const last = points[points.length - 1];
  const endDate = last.date;

  const end = new Date(`${endDate}T00:00:00Z`);
  const target = new Date(end);
  target.setUTCFullYear(target.getUTCFullYear() - lookbackYears);
  const targetISO = isoUTCDate(target);

  // Find first point with date >= targetISO
  const idx = points.findIndex((p) => p.date >= targetISO);
  if (idx === -1) return null;

  const start = points[idx];
  return {
    fromDate: start.date,
    toDate: endDate,
    startClose: start.close,
    endClose: last.close,
  };
}

function computeReturn(startClose, endClose) {
  if (!Number.isFinite(startClose) || !Number.isFinite(endClose) || startClose === 0) return null;
  return endClose / startClose - 1;
}

async function main() {
  console.log("Starting Commodity Bargain Monitor update (Yahoo)...");

  const now = new Date();
  const startISO = `${now.getUTCFullYear() - (LOOKBACK_YEARS + BUFFER_YEARS)}-01-01`;

  // Curated universe (edit freely)
  const UNIVERSE = [
    { label: "Heating Oil", symbol: "HO=F" },
    { label: "WTI Crude", symbol: "CL=F" },
    { label: "Brent Crude", symbol: "BZ=F" },
    { label: "Natural Gas", symbol: "NG=F" },
    { label: "RBOB Gasoline", symbol: "RB=F" },


    { label: "Copper", symbol: "HG=F" },
    { label: "Gold", symbol: "GC=F" },
    { label: "Silver", symbol: "SI=F" },
    { label: "Platinum", symbol: "PL=F" },
    { label: "Palladium", symbol: "PA=F" },

    { label: "Corn", symbol: "ZC=F" },
    { label: "Wheat", symbol: "ZW=F" },
    { label: "Soybeans", symbol: "ZS=F" },
    { label: "Sugar", symbol: "SB=F" },
    { label: "Coffee", symbol: "KC=F" },
    { label: "Cotton", symbol: "CT=F" },
    { label: "Cocoa", symbol: "CC=F" },
    { label: "Orange Juice", symbol: "OJ=F" },
  ];

  const items = [];

  for (const a of UNIVERSE) {
    try {
      console.log(`Fetching Yahoo daily for ${a.label} (${a.symbol})...`);
      const { points } = await fetchDailySeriesYahoo(a.symbol, startISO);

      const window = pickStartEndFor3Y(points, LOOKBACK_YEARS);
      if (!window) throw new Error(`Insufficient history for ${LOOKBACK_YEARS}Y`);

      const ret3y = computeReturn(window.startClose, window.endClose);
      if (ret3y == null) throw new Error("Return calc failed");

      items.push({
        label: `${a.label} (${a.symbol})`, // keep symbol here; your chart strips it if desired
        symbol: a.symbol,
        ret3y,
        fromDate: window.fromDate,
        toDate: window.toDate,
      });
    } catch (e) {
      console.warn(`Failed ${a.symbol}: ${e.message}`);
    }
  }

  // Sort: best (highest return) at top
  items.sort((a, b) => Number(b.ret3y) - Number(a.ret3y));

  const payload = {
    lastUpdated: new Date().toISOString(),
    source: "Yahoo v8 chart (daily)",
    lookbackYears: LOOKBACK_YEARS,
    radarThreshold: RADAR_THRESHOLD,
    items,
  };

  writeJSON(OUT_FILE, payload);
  console.log(`Wrote ${path.join(OUT_DIR, OUT_FILE)} (${items.length} items)`);
  console.log("Commodity Bargain Monitor update complete.");
}

main().catch((err) => {
  console.error("Commodity Bargain Monitor update failed:", err);
  process.exitCode = 1;
});
