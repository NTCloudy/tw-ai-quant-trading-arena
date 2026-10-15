import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSET_UNIVERSE, ALL_SYNC_ASSETS } from '../src/universe.mjs';
import { runArenaSimulation } from '../src/simulator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

async function fetchYahooSymbolBars(symbol, yahooSymbol = symbol, range = '2y', interval = '1d', attempt = 0) {
  const encoded = encodeURIComponent(yahooSymbol);
  const host = attempt % 2 === 0 ? 'query1.finance.yahoo.com' : 'query2.finance.yahoo.com';
  const url = `https://${host}/v8/finance/chart/${encoded}?range=${range}&interval=${interval}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  });

  if (res.status === 429 && attempt < 3) {
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    return fetchYahooSymbolBars(symbol, yahooSymbol, range, interval, attempt + 1);
  }

  if (!res.ok) {
    throw new Error(`Yahoo Finance HTTP ${res.status} for ${symbol}`);
  }

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result || !Array.isArray(result.timestamp)) {
    throw new Error(`Invalid chart payload for ${symbol}`);
  }

  const meta = result.meta || {};
  const timestamps = result.timestamp;
  const quote = result.indicators?.quote?.[0] || {};
  const opens = quote.open || [];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const closes = quote.close || [];
  const volumes = quote.volume || [];

  const byDate = new Map();
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (!Number.isFinite(close) || close <= 0) continue;

    const open = Number.isFinite(opens[i]) && opens[i] > 0 ? opens[i] : close;
    const high = Number.isFinite(highs[i]) && highs[i] > 0 ? highs[i] : Math.max(open, close);
    const low = Number.isFinite(lows[i]) && lows[i] > 0 ? lows[i] : Math.min(open, close);
    const volume = Number.isFinite(volumes[i]) && volumes[i] >= 0 ? volumes[i] : 0;

    const dateStr = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
    byDate.set(dateStr, {
      date: dateStr,
      timestamp: timestamps[i],
      open: Number(open.toFixed(4)),
      high: Number(high.toFixed(4)),
      low: Number(low.toFixed(4)),
      close: Number(close.toFixed(4)),
      volume: Math.round(volume)
    });
  }

  const bars = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    symbol,
    currency: meta.currency || 'USD',
    exchangeName: meta.exchangeName || 'US',
    regularMarketPrice: Number((meta.regularMarketPrice || bars.at(-1)?.close || 0).toFixed(4)),
    previousClose: Number((meta.chartPreviousClose || bars.at(-2)?.close || 0).toFixed(4)),
    barsCount: bars.length,
    firstDate: bars[0]?.date || null,
    lastDate: bars.at(-1)?.date || null,
    bars
  };
}

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const snapshotPath = path.join(DATA_DIR, 'market-snapshot.json');
  const syncHistoryPath = path.join(DATA_DIR, 'sync-history.json');

  let existingSnapshot = null;
  try {
    const raw = await fs.readFile(snapshotPath, 'utf8');
    existingSnapshot = JSON.parse(raw);
  } catch {
    existingSnapshot = null;
  }

  const symbolsPayload = {};
  let successCount = 0;

  console.log(`📡 Syncing real-world market data from Yahoo Finance for ${ALL_SYNC_ASSETS.length} assets (${ASSET_UNIVERSE.length} active + ${ALL_SYNC_ASSETS.length - ASSET_UNIVERSE.length} external discovery)...`);

  for (const asset of ALL_SYNC_ASSETS) {
    try {
      await new Promise((r) => setTimeout(r, 80));
      const symbolData = await fetchYahooSymbolBars(
        asset.symbol,
        asset.yahooSymbol || asset.symbol,
        '2y',
        '1d'
      );
      symbolsPayload[asset.symbol] = symbolData;
      successCount += 1;
      console.log(
        `  ✓ ${asset.symbol.padEnd(8)} | Latest: $${symbolData.regularMarketPrice
          .toFixed(2)
          .padStart(9)} | Bars: ${symbolData.barsCount} (${symbolData.firstDate} → ${symbolData.lastDate})`
      );
    } catch (err) {
      console.warn(`  ⚠ Failed to fetch ${asset.symbol}: ${err.message}`);
      if (existingSnapshot?.symbols?.[asset.symbol]) {
        symbolsPayload[asset.symbol] = existingSnapshot.symbols[asset.symbol];
        console.log(`    ↳ Preserved cached bars for ${asset.symbol}`);
      }
    }
  }

  if (Object.keys(symbolsPayload).length === 0) {
    throw new Error('Could not fetch or load market data for any symbol.');
  }

  const marketSnapshot = {
    source: 'Yahoo Finance Real-Time & Historical OHLCV Feed',
    fetchedAt: new Date().toISOString(),
    assetsCount: Object.keys(symbolsPayload).length,
    symbols: symbolsPayload
  };

  await fs.writeFile(snapshotPath, JSON.stringify(marketSnapshot, null, 2), 'utf8');
  console.log(`\n💾 Saved real market snapshot to data/market-snapshot.json (${successCount}/${ALL_SYNC_ASSETS.length} live fetched)`);

  // Run default 1-Month (22 trading days ~ 30 calendar days) arena check
  const sim1M = runArenaSimulation(marketSnapshot, {
    periodDays: 22,
    initialCapital: 1000000,
    feeRate: 0.0022,
    marketFilter: 'all'
  });

  // Update daily sync history log (tracks each automated daily run)
  let syncHistory = [];
  try {
    syncHistory = JSON.parse(await fs.readFile(syncHistoryPath, 'utf8'));
    if (!Array.isArray(syncHistory)) syncHistory = [];
  } catch {
    syncHistory = [];
  }

  const latestMarketDate = sim1M.config.endDate;
  const syncEntry = {
    syncedAt: marketSnapshot.fetchedAt,
    latestTradingDate: latestMarketDate,
    marketDate: latestMarketDate,
    trigger: process.env.GITHUB_EVENT_NAME || 'manual',
    runNumber: process.env.GITHUB_RUN_NUMBER ? Number(process.env.GITHUB_RUN_NUMBER) : syncHistory.length + 1,
    etf0050Close: symbolsPayload['0050']?.regularMarketPrice || 0,
    tsmc2330Close: symbolsPayload['2330']?.regularMarketPrice || 0,
    benchmark1MReturnPct: Number(sim1M.benchmark.finalReturnPct.toFixed(2)),
    champion30d: {
      traderId: sim1M.leaderboard[0].trader.id,
      traderName: sim1M.leaderboard[0].trader.nameZh,
      returnPct: Number(sim1M.leaderboard[0].metrics.totalReturnPct.toFixed(2)),
      equity: Number(sim1M.leaderboard[0].metrics.finalEquity.toFixed(2))
    },
    leader1M: {
      id: sim1M.leaderboard[0].trader.id,
      nameZh: sim1M.leaderboard[0].trader.nameZh,
      returnPct: Number(sim1M.leaderboard[0].metrics.totalReturnPct.toFixed(2)),
      equity: Number(sim1M.leaderboard[0].metrics.finalEquity.toFixed(2))
    },
    traders1M: Object.fromEntries(
      sim1M.traderResults.map((r) => [
        r.trader.id,
        {
          returnPct: Number(r.metrics.totalReturnPct.toFixed(2)),
          equity: Number(r.metrics.finalEquity.toFixed(2)),
          openPositions: r.activePositions.map((p) => p.symbol)
        }
      ])
    )
  };

  // Deduplicate by marketDate if synced multiple times on same day, keeping latest
  syncHistory = [
    syncEntry,
    ...syncHistory.filter((item) => item.marketDate !== latestMarketDate)
  ].slice(0, 90);

  await fs.writeFile(syncHistoryPath, JSON.stringify(syncHistory, null, 2), 'utf8');

  // Save Weekly Monday Top 5 External US Stocks Discovery report
  const weeklyTop5Path = path.join(DATA_DIR, 'weekly-top5-discovery.json');
  const weeklyTop5Payload = {
    updatedAt: marketSnapshot.fetchedAt,
    meta: sim1M.top5WeeklyMeta,
    top5Promising: sim1M.top5Promising
  };
  await fs.writeFile(weeklyTop5Path, JSON.stringify(weeklyTop5Payload, null, 2), 'utf8');

  console.log(`\n🗓️ Weekly Monday Top 5 External US Stocks (${sim1M.top5WeeklyMeta.scheduleLabelZh}):`);
  for (const p of sim1M.top5Promising) {
    console.log(
      `   #${p.rank} ${p.displayTicker.padEnd(14)} | Score: ${p.outlookScore}/100 | Monday Anchor: $${p.mondayAnchorPrice.toFixed(2)} -> Current: $${p.currentPrice.toFixed(2)} (WTD: ${(p.weekToDateReturnPct >= 0 ? '+' : '') + p.weekToDateReturnPct.toFixed(2)}%) | 30D Target: $${p.targetPrice30d.toFixed(2)}`
    );
  }

  console.log(`\n🏆 1-Month (22 Trading Days: ${sim1M.config.startDate} → ${sim1M.config.endDate}) AI Arena Leaderboard:`);
  console.log(`   Benchmark (${sim1M.benchmark.symbol}): ${sim1M.benchmark.finalReturnPct >= 0 ? '+' : ''}${sim1M.benchmark.finalReturnPct.toFixed(2)}% ($${sim1M.benchmark.finalEquity.toFixed(2)})`);
  for (const [idx, item] of sim1M.leaderboard.entries()) {
    const m = item.metrics;
    console.log(
      `   #${idx + 1} ${item.trader.nameZh.padEnd(20)} | Return: ${(m.totalReturnPct >= 0 ? '+' : '') + m.totalReturnPct.toFixed(2)}% | Equity: $${m.finalEquity.toFixed(2)} | Alpha: ${(m.alphaPct >= 0 ? '+' : '') + m.alphaPct.toFixed(2)}% | Trades: ${m.totalTradesCount} (Closed: ${m.closedTradesCount}, Open: ${m.openPositionsCount}) | WinRate: ${m.winRatePct.toFixed(1)}%`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
