// index.js — single-chart viewer

const SECTIONS = [
  {
    title: "Macro & Ratios",
    items: [
      { id: "commodities-vs-sp500", title: "S&P Commodity Index / S&P 500 Ratio", src: "./charts/commodities-vs-sp500.html" },
      { id: "gold-silver-ratio", title: "Gold / Silver Ratio", src: "./charts/gold-silver-ratio.html" },
      { id: "gold-vs-sp500", title: "Gold / S&P 500 Ratio", src: "./charts/gold-vs-sp500.html" },
    ],
  },
  {
    title: "Gold Tokens",
    items: [
      { id: "xaut", title: "Tether Gold (XAUT)", src: "./charts/xaut.html" },
      { id: "paxg", title: "PAX Gold (PAXG)", src: "./charts/paxg.html" },
    ],
  },
  {
    title: "Commodity Bargain Monitor",
    items: [
      { id: "commodity-bargain-monitor", title: "Commodity Bargain Monitor", src: "./charts/commodity-bargain-monitor.html" },
    ],
  },
];

function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node;
}

function setActiveLink(nav, id) {
  nav.querySelectorAll("a[data-id]").forEach(a => {
    a.classList.toggle("active", a.dataset.id === id);
  });
}

function selectChartById(id) {
  for (const s of SECTIONS) {
    const found = s.items.find(x => x.id === id);
    if (found) return found;
  }
  return null;
}

function renderNav() {
  const nav = el("nav");
  nav.innerHTML = "";

  for (const section of SECTIONS) {
    const title = document.createElement("div");
    title.className = "sectionTitle";
    title.textContent = section.title;
    nav.appendChild(title);

    for (const c of section.items) {
      const a = document.createElement("a");
      a.href = `#${c.id}`;
      a.textContent = c.title;
      a.dataset.id = c.id;
      nav.appendChild(a);
    }
  }
}

function main() {
  const nav = el("nav");
  const frame = el("frame");

  renderNav();

  function loadFromHash() {
    const id = (location.hash || "").replace("#", "") || SECTIONS[0].items[0].id;
    const chart = selectChartById(id) || SECTIONS[0].items[0];

    frame.src = chart.src;
    setActiveLink(nav, chart.id);
  }

  window.addEventListener("hashchange", loadFromHash);
  nav.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-id]");
    if (!a) return;
    // let hashchange handler do the load
  });

  loadFromHash();
}

main();
