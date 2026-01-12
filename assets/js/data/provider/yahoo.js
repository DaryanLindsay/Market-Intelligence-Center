// assets/js/data/provider/yahoo.js
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

function isoUTC(d) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function fetchSeries(ticker, start = "1970-01-01", end = null) {
  const endISO = end ?? isoUTC(new Date());

  const rows = await yahooFinance.historical(ticker, {
    period1: start,
    period2: endISO,
    interval: "1d",
  });

  const points = (rows || [])
    .filter((r) => r?.date && r.close != null)
    .map((r) => ({
      date: isoUTC(new Date(r.date)),
      close: Number(r.close),
    }))
    .filter((p) => p.date && Number.isFinite(p.close));

  // enforce chronological order
  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}

