import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSET_UNIVERSE, DISCOVERY_CANDIDATE_UNIVERSE } from '../src/universe.mjs';
import { enrichBarsWithIndicators } from '../src/indicators.mjs';
import { AI_TRADERS, evaluateTraderSignal } from '../src/traders.mjs';
import { runArenaSimulation, runSingleAssetSimulation } from '../src/simulator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = path.resolve(__dirname, '..', 'data', 'market-snapshot.json');

test('Zero Look-Ahead Bias on Taiwan Stock 2330 (TSMC): modifying future bars never changes historical indicators or AI decisions', async () => {
  const raw = JSON.parse(await fs.readFile(SNAPSHOT_PATH, 'utf8'));
  const tsmcBars = raw.symbols['2330'].bars.slice(0, 120);

  const enrichedFull = enrichBarsWithIndicators(tsmcBars);

  const mutatedBars = tsmcBars.map((b, idx) =>
    idx >= 80
      ? { ...b, open: b.open * 5, high: b.high * 5, low: b.low * 5, close: b.close * 5 }
      : { ...b }
  );
  const enrichedMutated = enrichBarsWithIndicators(mutatedBars);

  for (let i = 0; i < 80; i++) {
    assert.equal(enrichedFull[i].sma20, enrichedMutated[i].sma20);
    assert.equal(enrichedFull[i].sma50, enrichedMutated[i].sma50);
    assert.equal(enrichedFull[i].ema8, enrichedMutated[i].ema8);
    assert.equal(enrichedFull[i].rsi14, enrichedMutated[i].rsi14);
    assert.equal(enrichedFull[i].macdHist, enrichedMutated[i].macdHist);
    assert.equal(enrichedFull[i].zScore20, enrichedMutated[i].zScore20);

    for (const trader of AI_TRADERS) {
      const sigA = evaluateTraderSignal(trader.id, enrichedFull[i], null);
      const sigB = evaluateTraderSignal(trader.id, enrichedMutated[i], null);
      assert.equal(sigA.action, sigB.action);
      assert.equal(sigA.conviction, sigB.conviction);
    }
  }
});

test('Virtual TWD Portfolio Accounting Invariant: cash + investedValue === equity and cash >= 0', async () => {
  const raw = JSON.parse(await fs.readFile(SNAPSHOT_PATH, 'utf8'));
  const sim = runArenaSimulation(raw, {
    periodDays: 63,
    initialCapital: 1000000,
    feeRate: 0.0022,
    marketFilter: 'all'
  });

  assert.equal(sim.traderResults.length, 3);

  for (const tr of sim.traderResults) {
    assert.ok(tr.equityCurve.length > 0, `${tr.trader.id} should have equity curve points`);
    for (const pt of tr.equityCurve) {
      assert.ok(pt.cash >= -1e-6, `Cash balance must never be negative (${pt.cash})`);
      assert.ok(
        Math.abs(pt.cash + pt.investedValue - pt.equity) < 1e-4,
        `Accounting identity cash + invested === equity violated on ${pt.date}`
      );
    }
  }
});

test('14 Core Taiwan Stocks + 10 External Discovery Taiwan Stocks have real .TW OHLCV bars', async () => {
  const raw = JSON.parse(await fs.readFile(SNAPSHOT_PATH, 'utf8'));
  assert.equal(ASSET_UNIVERSE.length, 14);
  assert.equal(DISCOVERY_CANDIDATE_UNIVERSE.length, 10);

  for (const requiredSym of ['2330', '2317', '2454', '2408', '2344', '0050', '3661', '3443', '1519']) {
    assert.ok(raw.symbols[requiredSym], `Snapshot should contain Taiwan stock ${requiredSym}`);
    assert.ok(raw.symbols[requiredSym].bars.length > 200, `${requiredSym} should have >200 bars`);
  }
});

test('Past-Week Operations, Weekly Monday External Top 5 Taiwan Stocks, Next Entry Watchlist, Daily Briefing & Calendar', async () => {
  const raw = JSON.parse(await fs.readFile(SNAPSHOT_PATH, 'utf8'));
  const sim = runArenaSimulation(raw, {
    periodDays: 22,
    initialCapital: 1000000,
    feeRate: 0.0022,
    marketFilter: 'all'
  });

  // 1. Recent week operations have explicit AI trader identity and isWithinPastWeek === true
  assert.ok(Array.isArray(sim.recentWeekOperations));
  for (const op of sim.recentWeekOperations) {
    assert.equal(op.isWithinPastWeek, true);
    assert.ok(op.traderId);
    assert.ok(op.traderNameZh);
    assert.ok(op.type === 'BUY' || op.type === 'SELL');
  }

  // 2. Top 5 Promising Forecast must be 100% external Taiwan stocks NOT in ASSET_UNIVERSE
  const activeWatchlistSet = new Set(ASSET_UNIVERSE.map((a) => a.symbol));
  assert.equal(sim.top5Promising.length, 5);
  for (let i = 0; i < 5; i++) {
    const pick = sim.top5Promising[i];
    assert.equal(pick.rank, i + 1);
    assert.equal(
      activeWatchlistSet.has(pick.symbol),
      false,
      `${pick.symbol} must NOT be in the current 14-stock ASSET_UNIVERSE watchlist`
    );
    assert.equal(pick.isExternalDiscovery, true);
    assert.ok(pick.outlookScore >= 40 && pick.outlookScore <= 99);
  }

  // 3. Next Entry Watchlist
  assert.ok(Array.isArray(sim.nextEntryWatchlist) && sim.nextEntryWatchlist.length > 0);
  for (const w of sim.nextEntryWatchlist) {
    assert.ok(w.triggerPrice > 0);
    assert.ok(w.readinessPct > 0 && w.readinessPct <= 100);
    assert.ok(w.traderNameZh);
  }

  // 4. Daily Briefing & Daily Calendar
  assert.ok(sim.dailyBriefing.marketClimateZh.length > 10);
  assert.ok(sim.dailyBriefing.topForecastZh.length > 10);
  for (const tr of sim.traderResults) {
    assert.ok(Array.isArray(tr.dailyCalendar));
    assert.equal(tr.dailyCalendar.length, sim.config.tradingDaysCount);
  }
});

test('Single-Asset K-Line Simulation produces valid bars and trade markers for 2330, 2317, 2408, 3661', async () => {
  const raw = JSON.parse(await fs.readFile(SNAPSHOT_PATH, 'utf8'));
  for (const sym of ['2330', '2317', '2408', '3661', '0050']) {
    for (const trader of AI_TRADERS) {
      const res = runSingleAssetSimulation(raw, sym, trader.id, 90);
      assert.ok(res, `Result should exist for ${sym} / ${trader.id}`);
      assert.equal(res.bars.length, 90);
      for (const m of res.markers) {
        assert.ok(m.type === 'BUY' || m.type === 'SELL');
        assert.ok(m.price > 0);
        assert.ok(m.reasonZh.length > 5);
      }
    }
  }
});
