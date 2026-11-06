// Prints each AI's P&L for a week or month as JSON (used by the LINE weekly/monthly reports).
// Usage: node scripts/report.mjs week 2026-11-06 | node scripts/report.mjs month 2026-11
import fs from 'node:fs';
import { runArenaSimulation, weekStart } from '../src/simulator.mjs';
const LIVE_START = '2026-11-06';

const [kind = 'week', arg = new Date().toISOString().slice(0, 10)] = process.argv.slice(2);
const raw = JSON.parse(fs.readFileSync(new URL('../data/market-snapshot.json', import.meta.url), 'utf8'));
let broadData = null;
try { broadData = JSON.parse(fs.readFileSync(new URL('../data/broad-snapshot.json', import.meta.url), 'utf8')); } catch {}
const r = runArenaSimulation(raw, { broadData, tradeFromDate: LIVE_START });
const key = kind === 'week' ? weekStart(arg) : arg.slice(0, 7);
const list = kind === 'week' ? 'weekly' : 'monthly';
const rows = r.leaderboard.map((t) => {
  const p = t.periodPnl[list].find((x) => x.period === key);
  const last = t.equityCurve.at(-1);
  return { name: t.trader.nameZh, pnl: p ? p.pnl : 0, pnlPct: p ? p.pnlPct : 0, equity: last.equity,
           totalPnl: last.equity - r.config.initialCapital, holdings: t.activePositions.map((x) => x.symbol) };
});
console.log(JSON.stringify({ market: 'tw', currency: 'TWD', period: key, lastDate: r.config.endDate, rows }));
