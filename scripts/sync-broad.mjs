// Syncs the broad candidate universe (src/broad.mjs) into a compact data/broad-snapshot.json.
// A symbol is kept only if it has enough history and liquidity measured on data up to LIVE_START (fixed window),
// so the set of tradeable names does not change from day to day and the live record stays reproducible.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BROAD_LIST, BROAD_MIN_TURNOVER } from '../src/broad.mjs';
import { ASSET_UNIVERSE } from '../src/universe.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'broad-snapshot.json');
const LIVE_START = '2026-11-06';
const KEEP_BARS = 300;

async function fetchBars(yahooSymbol, attempt = 0) {
  const host = attempt % 2 === 0 ? 'query1.finance.yahoo.com' : 'query2.finance.yahoo.com';
  const res = await fetch(`https://${host}/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=2y&interval=1d`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (res.status === 429 && attempt < 3) {
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    return fetchBars(yahooSymbol, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const r = (await res.json())?.chart?.result?.[0];
  if (!r?.timestamp) throw new Error('no data');
  const q = r.indicators?.quote?.[0] || {};
  const byDate = new Map();
  r.timestamp.forEach((t, i) => {
    const c = q.close?.[i];
    if (!Number.isFinite(c) || c <= 0) return;
    const o = Number.isFinite(q.open?.[i]) && q.open[i] > 0 ? q.open[i] : c;
    const h = Number.isFinite(q.high?.[i]) && q.high[i] > 0 ? q.high[i] : Math.max(o, c);
    const l = Number.isFinite(q.low?.[i]) && q.low[i] > 0 ? q.low[i] : Math.min(o, c);
    const d = new Date(t * 1000).toISOString().slice(0, 10);
    byDate.set(d, [d, +o.toFixed(4), +h.toFixed(4), +l.toFixed(4), +c.toFixed(4), Math.round(q.volume?.[i] || 0)]);
  });
  return [...byDate.values()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

async function main() {
  const core = new Set(ASSET_UNIVERSE.map((a) => a.symbol));
  let prev = {};
  try { prev = JSON.parse(await fs.readFile(OUT, 'utf8')).symbols || {}; } catch {}
  const symbols = {};
  const dropped = [];
  for (const [symbol, yahoo, nameZh] of BROAD_LIST) {
    if (core.has(symbol)) continue;
    await new Promise((r) => setTimeout(r, 60));
    let bars;
    try {
      bars = await fetchBars(yahoo);
    } catch (err) {
      if (prev[symbol]) symbols[symbol] = prev[symbol];
      else dropped.push(`${symbol}(${err.message})`);
      continue;
    }
    const pre = bars.filter((b) => b[0] < LIVE_START);
    const turnover = median(pre.slice(-60).map((b) => b[4] * b[5]));
    if (pre.length < 220 || turnover < BROAD_MIN_TURNOVER) {
      dropped.push(`${symbol}(${pre.length < 220 ? 'short history' : 'illiquid'})`);
      continue;
    }
    symbols[symbol] = { yahooSymbol: yahoo, nameZh, bars: bars.slice(-KEEP_BARS) };
  }
  await fs.writeFile(OUT, JSON.stringify({ fetchedAt: new Date().toISOString(), liveStart: LIVE_START, symbols }));
  console.log(`broad universe: kept ${Object.keys(symbols).length}, dropped ${dropped.length}: ${dropped.join(' ')}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
