// automation/updateMetalData.js
// Writes Stooq spot data
import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchStooqDaily } from '../assets/js/data/provider/stooq.js';

const CACHE_DIR = path.resolve('data-cache');

async function writeJSON(outPath, obj) {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(obj, null, 2), 'utf8');
}

function nowISO() {
  return new Date().toISOString();
}

async function updateOne({ stooqSymbol, outFile, displaySymbol, minYear = 1970 }) {
  console.log(`Fetching Stooq daily for ${displaySymbol} (${stooqSymbol})...`);
  const points = await fetchStooqDaily({ symbol: stooqSymbol, minYear });

  await writeJSON(path.join(CACHE_DIR, outFile), {
    lastUpdated: nowISO(),
    source: 'Stooq CSV (daily)',
    symbol: displaySymbol,
    currency: 'USD',
    points
  });

  console.log(`Wrote data-cache/${outFile} (${points.length} points)`);
}

async function main() {
  console.log('Starting Stooq metals update...');

  // Gold spot (USD per oz)
  await updateOne({
    stooqSymbol: 'xauusd',
    outFile: 'gold.json',
    displaySymbol: 'XAUUSD'
  });

  // Silver spot (USD per oz)
  await updateOne({
    stooqSymbol: 'xagusd',
    outFile: 'silver.json',
    displaySymbol: 'XAGUSD',
    minYear: 2000,
  });

  console.log('Stooq metals update complete.');
}

main().catch((err) => {
  console.error('Stooq metals update failed:', err);
  process.exitCode = 1;
});
