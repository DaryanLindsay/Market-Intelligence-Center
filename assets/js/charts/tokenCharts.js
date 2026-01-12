// assets/js/charts/tokenCharts.js
// Shared renderer for token pages: price / mcap / volume / premium vs spot gold.

async function loadJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function mapPointsToMap(points) {
  const m = new Map();
  for (const p of points || []) {
    if (p?.date && p?.close != null) m.set(p.date, Number(p.close));
  }
  return m;
}

function buildPremiumSeries(tokenPricePoints, goldSpotPoints) {
  const tokenMap = mapPointsToMap(tokenPricePoints);
  const goldMap = mapPointsToMap(goldSpotPoints);

  const dates = [...tokenMap.keys()].filter((d) => goldMap.has(d)).sort();
  return dates
    .map((date) => {
      const token = tokenMap.get(date);
      const gold = goldMap.get(date);
      if (!Number.isFinite(token) || !Number.isFinite(gold) || gold === 0) return null;
      return { date, close: token / gold - 1 };
    })
    .filter(Boolean);
}

function formatNumber(x) {
  if (x == null || !Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatPct(x) {
  if (x == null || !Number.isFinite(x)) return "—";
  return (x * 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) + "%";
}

function parseISODateUTC(iso) {
  // Expect "YYYY-MM-DD"
  const d = new Date(iso + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

function filterPointsByRange(points, rangeKey) {
  if (!Array.isArray(points) || points.length === 0) return [];
  if (!rangeKey || rangeKey === "1y") return points; // "1y" = max in your cache (365d)

  const lastIso = points[points.length - 1]?.date;
  const lastDt = lastIso ? parseISODateUTC(lastIso) : null;
  if (!lastDt) return points;

  const cutoff = new Date(lastDt.getTime());

  if (rangeKey === "1m") cutoff.setUTCMonth(cutoff.getUTCMonth() - 1);
  else if (rangeKey === "3m") cutoff.setUTCMonth(cutoff.getUTCMonth() - 3);
  else if (rangeKey === "6m") cutoff.setUTCMonth(cutoff.getUTCMonth() - 6);
  else return points;

  return points.filter((p) => {
    const dt = p?.date ? parseISODateUTC(p.date) : null;
    return dt && dt >= cutoff;
  });
}

function getXAxisSpec(rangeKey) {
  // More specific labels as you zoom in.
  // Also tweak maxTicksLimit to keep it readable.
  switch (rangeKey) {
    case "1m":
      return {
        maxTicksLimit: 12,
        fmt: (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) // "Jan 5"
      };
    case "3m":
      return {
        maxTicksLimit: 10,
        fmt: (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) // "Jan 5"
      };
    case "6m":
      return {
        maxTicksLimit: 10,
        fmt: (d) => d.toLocaleDateString(undefined, { month: "short" }) // "Jan"
      };
    case "1y":
    default:
      return {
        maxTicksLimit: 8,
        fmt: (d) => d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }) // "Jan 26"
      };
  }
}

let chart;

function renderLineChart(canvas, label, points, rangeKey, isPercent = false) {
  const filtered = filterPointsByRange(points, rangeKey);

  const labels = filtered.map((p) => p.date); // ISO strings like "2026-01-05"
  const data = filtered.map((p) => p.close);

  if (chart) chart.destroy();

  const xSpec = getXAxisSpec(rangeKey);

  const fmtDate = (iso) => {
    const d = parseISODateUTC(iso);
    return !d ? iso : xSpec.fmt(d);
  };

  chart = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label,
          data,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.15
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            title: (items) => {
              const iso = items?.[0]?.label;
              return iso ? fmtDate(iso) : "";
            },
            label: (ctx) => {
              const v = ctx.raw;
              if (isPercent) return `${ctx.dataset.label}: ${formatPct(v)}`;
              return `${ctx.dataset.label}: ${formatNumber(v)}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            autoSkip: true,
            maxTicksLimit: xSpec.maxTicksLimit,
            maxRotation: 0,
            minRotation: 0,
            callback: (value) => {
              // category axis: `value` is index
              const iso = labels[value];
              return iso ? fmtDate(iso) : "";
            }
          }
        },
        y: {
          ticks: {
            callback: (v) => (isPercent ? formatPct(v) : formatNumber(v))
          }
        }
      }
    }
  });
}

export async function initTokenPage({ tokenKey }) {
  const [tokenization, gold] = await Promise.all([
    loadJSON("/data-cache/tokenization.json"),
    loadJSON("/data-cache/gold.json")
  ]);

  const token = tokenization?.tokens?.[tokenKey];
  if (!token) throw new Error(`Token key not found in tokenization.json: ${tokenKey}`);

  // Stat cards (latest values)
  const pricePts = token.series.price.points || [];
  const mcapPts = token.series.marketCap.points || [];
  const volPts = token.series.volume.points || [];

  const latest = (pts) => (pts?.length ? pts[pts.length - 1]?.close ?? null : null);

  const priceLatest = latest(pricePts);
  const mcapLatest = latest(mcapPts);
  const volLatest = latest(volPts);

  // Gold spot points in cache schema: { points: [{date, close}] }
  const goldPts = gold?.points || [];
  const premPts = buildPremiumSeries(pricePts, goldPts);
  const premLatest = latest(premPts);

  // Fill top stats
  document.getElementById("tokenName").textContent = `${token.symbol} — ${token.name}`;
  document.getElementById("statPrice").textContent = `$${formatNumber(priceLatest)}`;
  document.getElementById("statMcap").textContent = `$${formatNumber(mcapLatest)}`;
  document.getElementById("statVol").textContent = `$${formatNumber(volLatest)}`;
  document.getElementById("statPrem").textContent = formatPct(premLatest);

  const circ = token.supply?.circulating;
  document.getElementById("statSupply").textContent = circ == null ? "—" : formatNumber(circ);

  const canvas = document.getElementById("chart");

  // State
  let currentMetric = "price";
  let currentRange = "1y"; // default (max)

  const renderCurrent = () => {
    if (currentMetric === "price")
      renderLineChart(canvas, `${token.symbol} Price (USD)`, pricePts, currentRange, false);
    if (currentMetric === "mcap")
      renderLineChart(canvas, `${token.symbol} Market Cap (USD)`, mcapPts, currentRange, false);
    if (currentMetric === "volume")
      renderLineChart(canvas, `${token.symbol} Volume (USD)`, volPts, currentRange, false);
    if (currentMetric === "premium")
      renderLineChart(canvas, `${token.symbol} Premium vs Spot Gold`, premPts, currentRange, true);
  };

  // Metric buttons
  const bind = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.onclick = fn;
  };


  const setActive = (containerId, activeBtnId) => {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  wrap.querySelectorAll("button").forEach((b) => b.classList.remove("is-active"));
  const active = document.getElementById(activeBtnId);
  if (active) active.classList.add("is-active");
};

  setActive("metricButtons", "btnPrice");
  setActive("rangeButtons", "btn1y");

 bind("btnPrice", () => {
  currentMetric = "price";
  setActive("metricButtons", "btnPrice");
  renderCurrent();
});

  bind("btnMcap", () => {
    currentMetric = "mcap";
    setActive("metricButtons", "btnMcap");
    renderCurrent();
  });

  bind("btnVol", () => {
    currentMetric = "volume";
    setActive("metricButtons", "btnVol");
    renderCurrent();
  });

  bind("btnPrem", () => {
    currentMetric = "premium";
    setActive("metricButtons", "btnPrem");
    renderCurrent();
  });

  bind("btn1m", () => {
    currentRange = "1m";
    setActive("rangeButtons", "btn1m");
    renderCurrent();
  });

  bind("btn3m", () => {
    currentRange = "3m";
    setActive("rangeButtons", "btn3m");
    renderCurrent();
  });

  bind("btn6m", () => {
    currentRange = "6m";
    setActive("rangeButtons", "btn6m");
    renderCurrent();
  });

  bind("btn1y", () => {
    currentRange = "1y";
    setActive("rangeButtons", "btn1y");
    renderCurrent();
  });

  

  renderCurrent();
}
