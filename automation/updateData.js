import fs from "node:fs";
import path from "node:path";

function toUnixSec(dateStr) {
  return Math.floor(new Date(dateStr).getTime() / 1000);
}

async function fetchDailySeries(symbol, start = "2000-01-01") {
  const period1 = toUnixSec(`${start}T00:00:00Z`);
  const period2 = Math.floor(Date.now() / 1000);

  const url =
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=1d&period1=${period1}&period2=${period2}&events=history`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" }
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${symbol}`);

  const json = await res.json();
  const result = json?.chart?.result?.[0];

  const ts = result?.timestamp ?? [];
  const close = result?.indicators?.quote?.[0]?.close ?? [];

  const points = ts
    .map((t, i) => ({
      date: new Date(t * 1000).toISOString().slice(0, 10),
      close: close[i]
    }))
    .filter(p => p.close != null);

  return { symbol, currency: result?.meta?.currency || "USD", points };
}

function writeJSON(outDir, filename, obj) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, filename), JSON.stringify(obj, null, 2));
}

async function main() {
  const outDir = "data-cache";
  const start = "1970-01-01";

  const seriesMap = {
    "sp500.json": "^GSPC",
    "commodities.json": "^SPGSCI"
  };

  for (const [file, ticker] of Object.entries(seriesMap)) {
    const data = await fetchDailySeries(ticker, start);
    writeJSON(outDir, file, {
      lastUpdated: new Date().toISOString(),
      source: "Yahoo v8 chart",
      ...data
    });
    console.log(`${ticker} -> ${file} (${data.points.length} points)`);
  }

  writeJSON(outDir, "lastUpdated.json", { lastUpdated: new Date().toISOString() });
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
