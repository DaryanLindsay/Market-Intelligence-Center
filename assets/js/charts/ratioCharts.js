// assets/js/charts/ratioCharts.js

import { buildRatioSeries } from "../transforms/series.js";
import { computeRatioIndicators } from "../transforms/indicators.js";
import { generateTakeaway } from "../transforms/takeaway.js";

let _chart = null;

async function loadJSON(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Failed to load ${url} (${r.status})`);
  return r.json();
}

function formatUpdated(iso) {
  if (!iso) return "—";
  const dt = new Date(iso);
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}



function fmt(x, digits = 4) {
  return Number.isFinite(x) ? x.toFixed(digits) : "—";
}

function formatPercentile(p) {
  if (p == null || !Number.isFinite(p)) return "—";
  if (p < 1) return "<1st";
  const n = Math.round(p);
  const mod100 = n % 100;

  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;

  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/**
 * Classify indicator into semantic state classes for CSS.
 * Uses the SAME thresholds as generateTakeaway via takeawayProfile.
 */
function classifyIndicator(ind, profile = {}) {
  if (!ind) return "";

  const v = ind.latestValue;
  const med = ind.median;
  const p = ind.percentile;

  const LOW_EXTREME = profile.lowExtreme ?? 15;
  const HIGH_EXTREME = profile.highExtreme ?? 85;

  const isAbove =
    Number.isFinite(v) && Number.isFinite(med) ? v >= med : null;

  // Extreme states based on percentile
  if (p != null && Number.isFinite(p) && p <= LOW_EXTREME) return "is-extreme-low";
  if (p != null && Number.isFinite(p) && p >= HIGH_EXTREME) return "is-extreme-high";

  // Normal regime states based on median
  if (isAbove === true) return "is-above-median";
  if (isAbove === false) return "is-below-median";

  return "";
}

function renderContext(ind, dates) {
  const el = document.getElementById("context");
  if (!el) return;

  el.innerHTML = `
    <div class="context-block">
      <div><strong>Current ratio:</strong> ${fmt(ind.latestValue, 4)} <span class="muted">(${ind.latestDate})</span></div>
      <div><strong>Percentile:</strong> ${formatPercentile(ind.percentile)} <span class="muted">(since ${ind.startYear})</span></div>
      <div><strong>Median:</strong> ${fmt(ind.median, 4)}</div>
      <div><strong>Relative position:</strong> ${ind.latestValue >= ind.median ? "Above median" : "Below median"}</div>
      ${
        ind.historical?.min && ind.historical?.max
          ? `<div><strong>Historical range:</strong>
              <span class="muted">
                min ${fmt(ind.historical.min.value, 4)} (${ind.historical.min.date}) ·
                max ${fmt(ind.historical.max.value, 4)} (${ind.historical.max.date})
              </span>
            </div>`
          : ""
      }
    </div>
  `;
}


function renderTakeaway(ind, takeawayProfile) {
  const el = document.getElementById("takeaway");
  if (!el) return;

  const t = generateTakeaway(ind, takeawayProfile);
  const stateClass = classifyIndicator(ind, takeawayProfile);

  el.innerHTML = `
    <div class="takeaway-box ${stateClass}">
      <div class="headline">${t.headline}</div>
      <div>${t.body}</div>
    </div>
  `;
}


function yearTickIndexes(labels, stepYears = 5) {
  const out = [];
  let lastYear = null;

  for (let i = 0; i < labels.length; i++) {
    const y = Number(labels[i].slice(0, 4));
    if (y !== lastYear) {
      if (y % stepYears === 0) out.push(i);
      lastYear = y;
    }
  }
  return out;
}

/**
 * Format a tick label for the x-axis depending on the timeframe mode.
 * dates are expected as "YYYY-MM-DD"
 */
function formatTickLabel(dateStr, modeKey) {
  const s = String(dateStr || "");
  if (s.length < 10) return s;

  const y = s.slice(0, 4);
  const m = s.slice(5, 7);
  const d = s.slice(8, 10);

  switch (modeKey) {
    case "1M":
      return `${m}/${d}`;     // MM/DD
    case "6M":
    case "1Y":
      return `${y}-${m}`;     // YYYY-MM
    case "10Y":
      return y;               // YYYY
    case "MAX":
    default:
      return y;               // YYYY
  }
}

/**
 * Pick which indices should be used as x-axis ticks for a given mode.
 * This is category-scale logic (index-based), which works well for trading-day series.
 */
function pickTickIndexes(dates, modeKey, yearStep = 5) {
  const out = [];
  let last = null;

  for (let i = 0; i < dates.length; i++) {
    const s = dates[i];
    if (!s) continue;

    const y = s.slice(0, 4);
    const ym = s.slice(0, 7); // YYYY-MM

    if (modeKey === "1M") {
      if (i % 5 === 0) out.push(i);
    } else if (modeKey === "6M" || modeKey === "1Y") {
      if (ym !== last) out.push(i);
      last = ym;
    } else if (modeKey === "10Y") {
      const yy = Number(y);
      if (y !== last && yy % 2 === 0) out.push(i);
      last = y;
    } else {
      return yearTickIndexes(dates, yearStep);
    }
  }

  // If we ended up with too few ticks (very short series), just show all
  if (out.length < 2 && dates.length > 0) return [...Array(dates.length).keys()];

  return out;
}

function renderChart({
  dates,
  ratio,
  datasetLabel,
  yTitle,
  yearStep = 5,
  tooltipDigits = 4,
  modeKey = "MAX"
}) {
  const canvas = document.getElementById("chart");
  if (!canvas) throw new Error("Canvas #chart not found");

  if (_chart) {
    _chart.destroy();
    _chart = null;
  }

  const tickIdx = pickTickIndexes(dates, modeKey, yearStep);

  // eslint-disable-next-line no-undef
  _chart = new Chart(canvas, {
    type: "line",
    data: {
      labels: dates,
      datasets: [
        {
          label: datasetLabel,
          data: ratio,
          borderColor: "#f7a40ace",
          backgroundColor: "transparent",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.15,
          spanGaps: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
      interaction: { mode: "index", intersect: false },
      scales: {
        y: {
          title: { display: true, text: yTitle },
          grace: "10%"   
        },
        x: {
          ticks: {
            autoSkip: true,
            callback: function (value) {
              const label = this.getLabelForValue(value);
              return formatTickLabel(String(label), modeKey);
            }
          },
          afterBuildTicks: (scale) => {
            scale.ticks = tickIdx.map((i) => ({ value: i }));
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => `Ratio: ${ctx.parsed.y.toFixed(tooltipDigits)}`
          }
        },
        legend: { display: true }
      }
    }
  });
}

// timeframe helpers
function parseDateUTC(d) {
  return new Date(d + "T00:00:00Z").getTime();
}

function filterByDays(dates, series, days) {
  if (!days) return { dates, series }; // MAX
  const end = parseDateUTC(dates[dates.length - 1]);
  const start = end - days * 24 * 60 * 60 * 1000;

  const outDates = [];
  const outSeries = [];
  for (let i = 0; i < dates.length; i++) {
    const t = parseDateUTC(dates[i]);
    if (t >= start) {
      outDates.push(dates[i]);
      outSeries.push(series[i]);
    }
  }
  return { dates: outDates, series: outSeries };
}

function renderTimeframeButtons({ onSelect, defaultKey = "MAX" }) {
  const el = document.getElementById("tf");
  if (!el) return;

  const options = [
    { key: "1M", label: "1M", days: 30 },
    { key: "6M", label: "6M", days: 182 },
    { key: "1Y", label: "1Y", days: 365 },
    { key: "10Y", label: "10Y", days: 3650 },
    { key: "MAX", label: "MAX", days: null }
  ];

  el.innerHTML = options.map((o) => `<button data-key="${o.key}">${o.label}</button>`).join("");

  function setActive(key) {
    el.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("active", b.dataset.key === key);
    });
  }

  el.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const opt = options.find((o) => o.key === btn.dataset.key);
    if (!opt) return;
    setActive(opt.key);
    onSelect(opt);
  });

  setActive(defaultKey);
  onSelect(options.find((o) => o.key === defaultKey));
}

export async function renderRatioPage({
  numeratorUrl,
  denominatorUrl,
  title,
  datasetLabel,
  yTitle,
  yearStep = 5,
  enableTimeframes = false,
  defaultTimeframe = "MAX",
  takeawayProfile = null
}) {
  if (title) document.title = title;

  const [numJson, denJson] = await Promise.all([
    loadJSON(numeratorUrl),
    loadJSON(denominatorUrl)
  ]);

  const updated = numJson.lastUpdated || denJson.lastUpdated;
  const lastUpdatedEl = document.getElementById("lastUpdated");
  if (lastUpdatedEl) lastUpdatedEl.textContent = "Last updated: " + formatUpdated(updated);

  const { dates: fullDates, ratio: fullRatio } = buildRatioSeries({ numJson, denJson });
  if (fullDates.length < 2) throw new Error("Not enough overlapping dates to render chart.");

  const ind = computeRatioIndicators(fullDates, fullRatio);
  renderContext(ind, fullDates, takeawayProfile);
  renderTakeaway(ind, takeawayProfile);

  if (!enableTimeframes) {
    renderChart({
      dates: fullDates,
      ratio: fullRatio,
      datasetLabel,
      yTitle,
      yearStep,
      tooltipDigits: 4,
      modeKey: "MAX"
    });
    return;
  }

  renderTimeframeButtons({
    defaultKey: defaultTimeframe,
    onSelect: (opt) => {
      const filtered = filterByDays(fullDates, fullRatio, opt.days);

      const step = opt.key === "MAX" ? yearStep : opt.key === "10Y" ? 2 : 1;

      renderChart({
        dates: filtered.dates,
        ratio: filtered.series,
        datasetLabel,
        yTitle,
        yearStep: step,
        tooltipDigits: 4,
        modeKey: opt.key
      });
    }
  });
}
