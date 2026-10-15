import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runArenaSimulation } from '../src/simulator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = path.resolve(__dirname, '..', 'data', 'market-snapshot.json');

async function main() {
  const raw = JSON.parse(await fs.readFile(SNAPSHOT_PATH, 'utf8'));
  const periodDays = Number(process.env.PERIOD_DAYS || 22);
  const initialCapital = Number(process.env.INITIAL_CAPITAL || 1000000);

  const result = runArenaSimulation(raw, {
    periodDays,
    initialCapital,
    feeRate: 0.0022,
    marketFilter: 'all'
  });

  console.log(`\n========================================================================`);
  console.log(`🇹🇼 台股 AI 量化模擬操盤競技場 — ${result.config.startDate} → ${result.config.endDate} (${result.config.tradingDaysCount} 交易日)`);
  console.log(`   Starting Virtual Capital: NT$${initialCapital.toLocaleString('en-US')}`);
  console.log(`   0050 元大台灣50 基準報酬: ${result.benchmark.finalReturnPct >= 0 ? '+' : ''}${result.benchmark.finalReturnPct.toFixed(2)}% (NT$${Math.round(result.benchmark.finalEquity).toLocaleString('en-US')})`);
  console.log(`========================================================================`);

  for (const [idx, item] of result.leaderboard.entries()) {
    const m = item.metrics;
    console.log(
      `#${idx + 1} ${item.trader.nameZh.padEnd(20)} | ROI: ${(m.totalReturnPct >= 0 ? '+' : '') + m.totalReturnPct.toFixed(2)}% | Equity: NT$${Math.round(m.finalEquity).toLocaleString('en-US')} | Alpha: ${(m.alphaPct >= 0 ? '+' : '') + m.alphaPct.toFixed(2)}% | Sharpe: ${m.sharpeRatio.toFixed(2)} | MaxDD: ${m.maxDrawdownPct.toFixed(2)}%`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
