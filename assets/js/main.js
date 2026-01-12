async function loadLastUpdated() {
  try {
    const res = await fetch("./data-cache/lastUpdated.json", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const el = document.getElementById("lastUpdated");
    if (el && data?.iso) el.textContent = data.iso;
  } catch {
    
  }
}

loadLastUpdated();
