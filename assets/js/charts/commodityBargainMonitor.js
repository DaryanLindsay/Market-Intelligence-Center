// assets/js/charts/commodityBargainMonitor.js
// Renders the Commodity Bargain Monitor horizontal bar chart from:
// ../data-cache/commodityBargainMonitor.json

let _chart = null;

async function loadJSON(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Failed to load ${url} (${r.status})`);
  return r.json();
}

function formatUpdated(iso) {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function fmtPct(x) {
  if (!Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(0)}%`;
}

function fmtDate(d) {
  return d || "—";
}

function colorForReturn(x) {
  return x >= 0 ? "rgba(0, 160, 80, 0.85)" : "rgba(220, 60, 60, 0.85)";
}

function stripParenSymbol(label) {
  // Removes trailing " (XYZ)" like "Silver (XAGUSD)" -> "Silver"
  return String(label).replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function buildDataset(items) {
  const labels = items.map((it) => stripParenSymbol(it.label));
  const data = items.map((it) => Number(it.ret3y));
  const bg = items.map((it) => colorForReturn(Number(it.ret3y)));
  return { labels, data, bg };
}

// Draw value labels at the end of each bar (KR-style)
const valueLabelsPlugin = {
  id: "valueLabels",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const dataset = chart.data.datasets?.[0];
    const meta = chart.getDatasetMeta(0);
    if (!dataset || !meta?.data?.length) return;

    ctx.save();
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#111";
    ctx.textBaseline = "middle";

    meta.data.forEach((bar, i) => {
      const v = Number(dataset.data[i]);
      if (!Number.isFinite(v)) return;

      const label = `${(v * 100).toFixed(0)}%`;
      const xEnd = bar.x;
      const y = bar.y;

      // Place label just outside the bar
      const pad = 8;
      ctx.textAlign = "left";
      ctx.fillText(label, xEnd + pad, y);
    });

    ctx.restore();
  },
};

async function main() {
  // Hi-res canvas rendering (crisper labels/bars)
  Chart.defaults.devicePixelRatio = 2; // try 3 if you want it even sharper

  const el = document.getElementById("cbmChart");
  const metaEl = document.getElementById("cbmMeta");
  const descEl = document.getElementById("cbmDesc");
  const radarEl = document.getElementById("cbmRadar");

  const payload = await loadJSON("../data-cache/commodityBargainMonitor.json");
  const items = Array.isArray(payload.items) ? payload.items : [];

  const { labels, data, bg } = buildDataset(items);

  const radar = Number(payload.radarThreshold ?? -0.5);
  const radarItems = items.filter((it) => Number(it.ret3y) <= radar);

  metaEl.textContent =
    `Last updated: ${formatUpdated(payload.lastUpdated)} · ` +
    `Lookback: ${payload.lookbackYears}Y · ` +
    `Radar: ≤ ${fmtPct(radar)}`;

  if (descEl) {
    descEl.textContent =
      "The Commodity Bargain Monitor displays the 3-year trailing returns of selected commodities. " +
      "When an asset is down more than 50%, it goes on our radar.";
  }

  if (radarItems.length === 0) {
    radarEl.textContent = "On Radar: none";
  } else {
    radarEl.textContent =
      "On Radar: " +
      radarItems
        .map((it) => `${stripParenSymbol(it.label)} (${fmtPct(it.ret3y)})`)
        .join(" · ");
  }

  if (_chart) _chart.destroy();

  _chart = new Chart(el, {
    type: "bar",
    plugins: [valueLabelsPlugin],
    data: {
      labels,
      datasets: [
        {
          label: "3Y trailing return",
          data,
          backgroundColor: bg,
          borderWidth: 0,
          borderRadius: 6,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,

      // Give labels room + reduce clipping
      layout: {
        padding: { left: 32, right: 56, top: 8, bottom: 8 }, // extra right space for % labels
      },

      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (ctx) => (ctx?.[0]?.label ? String(ctx[0].label) : ""),
            label: (ctx) => `3Y: ${fmtPct(ctx.raw)}`,
            afterLabel: (ctx) => {
              const it = items[ctx.dataIndex];
              if (!it) return "";
              return `From ${fmtDate(it.fromDate)} to ${fmtDate(it.toDate)}`;
            },
          },
        },
      },

      scales: {
        x: {
          ticks: {
            callback: (v) => fmtPct(Number(v)),
            color: "#111",
            font: { size: 12 },
          },
          grid: { color: "rgba(0,0,0,0.08)" },
        },
        y: {
          ticks: {
            autoSkip: false,
            color: "#111",
            font: { size: 12 },
          },
          grid: { display: false },
        },
      },
    },
  });
}

main().catch((err) => {
  console.error("Commodity Bargain Monitor chart failed:", err);
});
