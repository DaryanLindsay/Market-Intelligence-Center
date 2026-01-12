// automation/updateTokenData.js
// Fetch 1y daily price, market cap, volume for PAXG & XAUT from CoinGecko.
// Writes to data-cache/tokenization.json in a cache-friendly schema.

import fs from "node:fs";
import path from "node:path";

const CACHE_DIR = "data-cache";
const BASE = "https://api.coingecko.com/api/v3";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function toISODate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function writeJSON(filename, obj) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CACHE_DIR, filename), JSON.stringify(obj, null, 2));
}

async function cgFetch(url) {
  const headers = { accept: "application/json" };

  const key = process.env.COINGECKO_API_KEY;
  if (key) headers["x-cg-demo-api-key"] = key; // ✅ Demo key header

  const res = await fetch(url, { headers });
  const text = await res.text().catch(() => "");

  if (!res.ok) {
    throw new Error(`CoinGecko ${res.status} for ${url} :: ${text.slice(0, 300)}`);
  }

  return JSON.parse(text);
}


async function getMarketChart(coinId, days = 365) {
  const url =
    `${BASE}/coins/${encodeURIComponent(coinId)}/market_chart` +
    `?vs_currency=usd&days=${days}`;

  const data = await cgFetch(url);

  // market_chart returns arrays of [timestamp_ms, value]
  // We map to points schema: { date, close }
  const price = (data.prices || []).map(([t, v]) => ({ date: toISODate(t), close: v }));
  const marketCap = (data.market_caps || []).map(([t, v]) => ({ date: toISODate(t), close: v }));
  const volume = (data.total_volumes || []).map(([t, v]) => ({ date: toISODate(t), close: v }));

  // de-dup dates (CoinGecko sometimes returns multiple points/day)
  const dedup = (pts) => {
    const m = new Map();
    for (const p of pts) m.set(p.date, p.close);
    return [...m.entries()]
      .map(([date, close]) => ({ date, close }))
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  return {
    price: dedup(price),
    marketCap: dedup(marketCap),
    volume: dedup(volume),
  };
}

async function getCoinMeta(coinId) {
  // For current supply info 
  const url =
    `${BASE}/coins/${encodeURIComponent(coinId)}` +
    `?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;

  const data = await cgFetch(url);
  const md = data?.market_data || {};
  return {
    name: data?.name,
    symbol: (data?.symbol || "").toUpperCase(),
    circulatingSupply: md?.circulating_supply ?? null,
    totalSupply: md?.total_supply ?? null,
  };
}

async function main() {
  console.log("Starting token data update (CoinGecko, 1y)...");

  const tokens = [
    { key: "paxg", coinId: "pax-gold", display: "PAXG" },
    { key: "xaut", coinId: "tether-gold", display: "XAUT" },
  ];

  const out = {
    lastUpdated: new Date().toISOString(),
    source: "CoinGecko market_chart (daily)",
    currency: "USD",
    windowDays: 365,
    tokens: {},
  };

  for (const t of tokens) {
    console.log(`Fetching ${t.display}...`);
    // small spacing to reduce 429 risk
    await sleep(350);

    const [chart, meta] = await Promise.all([
      getMarketChart(t.coinId, 365),
      getCoinMeta(t.coinId),
    ]);

    out.tokens[t.key] = {
      coinId: t.coinId,
      symbol: t.display,
      name: meta.name || t.display,
      supply: {
        circulating: meta.circulatingSupply,
        total: meta.totalSupply,
      },
      series: {
        price: {
          symbol: t.display,
          currency: "USD",
          points: chart.price,
        },
        marketCap: {
          symbol: `${t.display}_MCAP`,
          currency: "USD",
          points: chart.marketCap,
        },
        volume: {
          symbol: `${t.display}_VOL`,
          currency: "USD",
          points: chart.volume,
        },
      },
    };
  }

  writeJSON("tokenization.json", out);
  console.log("Wrote data-cache/tokenization.json");
}

main().catch((err) => {
  console.error("Token data update failed:", err);
  process.exitCode = 1;
});
