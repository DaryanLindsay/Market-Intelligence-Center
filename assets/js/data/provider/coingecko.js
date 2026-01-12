// assets/js/data/provider/coingecko.js
// CoinGecko provider with 429 retry + backoff

const BASE = 'https://api.coingecko.com/api/v3';

function cgHeaders() {
  const key = process.env.COINGECKO_API_KEY;
  return {
    accept: 'application/json',
    ...(key ? { 'x-cg-pro-api-key': key } : {})
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseRetryAfterSeconds(res) {
  const ra = res.headers?.get?.('retry-after');
  if (!ra) return null;
  const s = Number(ra);
  return Number.isFinite(s) ? s : null;
}

async function cgFetch(path, params = {}, { retries = 5, minDelayMs = 900 } = {}) {
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url.toString(), { headers: cgHeaders() });

    if (res.ok) return res.json();

    // Retry on rate limit
    if (res.status === 429 && attempt < retries) {
      const retryAfterSec = parseRetryAfterSeconds(res);

      const baseDelay = retryAfterSec != null
        ? retryAfterSec * 1000
        : minDelayMs * Math.pow(2, attempt);

      const jitter = Math.floor(Math.random() * 250);
      await sleep(baseDelay + jitter);
      continue;
    }

    const text = await res.text().catch(() => '');
    throw new Error(
      `CoinGecko ${res.status} ${res.statusText} for ${url} :: ${text.slice(0, 200)}`
    );
  }
}

/**
 * Returns series shape: [{ t: "YYYY-MM-DD", v: number }, ...]
 * Uses /market_chart prices
 */
export async function getMarketChartSeries({ coinId, vsCurrency = 'usd', days = 365 }) {
  const data = await cgFetch(`/coins/${coinId}/market_chart`, {
    vs_currency: vsCurrency,
    days
  });

  return (data.prices || []).map(([ms, price]) => ({
    t: new Date(ms).toISOString().slice(0, 10),
    v: Number(price)
  }));
}

/**
 * Returns market cap series: [{ t: "YYYY-MM-DD", v: number }, ...]
 * Uses /market_chart market_caps
 */
export async function getMarketCapSeries({ coinId, vsCurrency = 'usd', days = 365 }) {
  const data = await cgFetch(`/coins/${coinId}/market_chart`, {
    vs_currency: vsCurrency,
    days
  });

  return (data.market_caps || []).map(([ms, cap]) => ({
    t: new Date(ms).toISOString().slice(0, 10),
    v: Number(cap)
  }));
}
