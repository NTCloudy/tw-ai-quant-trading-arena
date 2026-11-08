import {
  ASSET_UNIVERSE,
  DISCOVERY_CANDIDATE_UNIVERSE,
  BENCHMARK_SYMBOL,
  getAssetMeta,
  registerAssets
} from './universe.mjs';
import { BROAD_CATEGORY } from './broad.mjs';
import { enrichBarsWithIndicators } from './indicators.mjs';
import { AI_TRADERS, evaluateTraderSignal } from './traders.mjs';

/**
 * Unified 0050 benchmark regime builder used across simulation, radar, top5, and single-asset K-line.
 */
export function buildRegime(spyBar) {
  return {
    spyBullish: spyBar
      ? spyBar.close >= spyBar.sma50 * 0.99 && spyBar.sma20 >= spyBar.sma50 * 0.985
      : true,
    spyShortTermBull: spyBar
      ? spyBar.close >= spyBar.sma20 * 0.99 || spyBar.ema8 >= spyBar.ema21
      : true,
    spyStrictBull: spyBar
      ? spyBar.close >= spyBar.sma20 && spyBar.ema8 >= spyBar.ema21 && spyBar.roc5 >= 0
      : true,
    spyRsi: spyBar ? spyBar.rsi14 : 50,
    spyRoc10: spyBar ? spyBar.roc10 : 0,
    spyRoc20: spyBar ? spyBar.roc20 : 0
  };
}

/**
 * Core-Satellite 3+1 eligibility gate for Broad universe stocks.
 * Prevents high-beta mid/small-cap satellites from displacing Core 20 TWSE leaders
 * or triggering contrarian mean-reversion knife-catches.
 */
export function isSatelliteEligible(asset, bar, regime, traderId) {
  if (!asset?.isBroad) return true;
  if (traderId === 'sigma-reversion') return false;
  if (!regime?.spyStrictBull || (regime?.spyRoc10 ?? 0) < 1.2 || (regime?.spyRoc20 ?? 0) < 2.0) {
    return false;
  }
  if (
    bar.atrPct > 3.2 ||
    bar.sma50SlopePct < 0.45 ||
    bar.roc20 < 9.0 ||
    bar.roc10 < 2.0 ||
    bar.close <= bar.sma50 * 1.02
  ) {
    return false;
  }
  return true;
}

/**
 * Quality filter for external Top 5 Promising stock forecast (independent of 0050 short-term regime).
 */
export function isExternalWatchlistEligible(bar) {
  return (
    bar.atrPct <= 3.5 &&
    bar.sma50SlopePct >= 0.35 &&
    bar.roc20 >= 6.0 &&
    bar.close > bar.sma50
  );
}

/**
 * Prepares enriched bar maps and aligned trading timeline across the asset universe.
 */
export function prepareEnrichedUniverse(rawMarketData) {
  const enrichedBySymbol = {};
  const barBySymbolAndDate = {};

  for (const [symbol, symbolData] of Object.entries(rawMarketData.symbols || {})) {
    const bars = enrichBarsWithIndicators(symbolData.bars || []);
    enrichedBySymbol[symbol] = bars;
    const dateMap = new Map();
    for (const b of bars) {
      dateMap.set(b.date, b);
    }
    barBySymbolAndDate[symbol] = dateMap;
  }

  return { enrichedBySymbol, barBySymbolAndDate };
}

/**
 * Runs the 3-AI-Traders Multi-Asset Paper Trading Arena over a specified period.
 *
 * @param {object} rawMarketData Market data snapshot containing `.symbols[ticker].bars`
 * @param {object} options
 * @param {number} [options.periodDays=22] Number of trading days to simulate (22=1M, 44=2M, 63=3M, 126=6M, 251=1Y)
 * @param {number} [options.initialCapital=100000] Starting virtual USD capital per AI trader
 * @param {number} [options.feeRate=0.001] Commission + slippage per trade leg (0.001 = 0.10%)
 * @param {string} [options.marketFilter='all'] 'all' | 'us-stock' | 'crypto'
 * @param {string[]} [options.enabledSymbols] Optional custom subset of tickers enabled by user
 */
const broadCache = new WeakMap();
/** Expands the compact broad snapshot ([date, o, h, l, c, v] rows) into bars + asset metadata (cached). */
function expandBroad(broadData) {
  if (!broadData?.symbols) return null;
  if (broadCache.has(broadData)) return broadCache.get(broadData);
  const symbols = {};
  const assets = [];
  for (const [sym, v] of Object.entries(broadData.symbols)) {
    symbols[sym] = { bars: v.bars.map(([date, open, high, low, close, volume]) => ({ date, open, high, low, close, volume })) };
    const label = v.nameZh && v.nameZh !== sym ? `${sym} ${v.nameZh}` : sym;
    assets.push({ symbol: sym, yahooSymbol: v.yahooSymbol, displayTicker: label, name: label, nameZh: label,
                  category: BROAD_CATEGORY, subSector: 'broad', sector: 'Broad universe', sectorZh: '廣泛選股池',
                  color: '#94a3b8', lotStep: 1, isBroad: true });
  }
  registerAssets(assets);
  const out = { symbols, assets };
  broadCache.set(broadData, out);
  return out;
}

export function runArenaSimulation(rawMarketData, options = {}) {
  // Broad mode: the AIs may also pick any liquid name from the broad candidate universe (mid/small caps).
  const broad = expandBroad(options.broadData);
  if (broad) {
    const merged = { ...broad.symbols, ...(rawMarketData.symbols || {}) };
    rawMarketData = { ...rawMarketData, symbols: merged };
  }
  const periodDays = Number(options.periodDays || 22);
  const initialCapital = Number(options.initialCapital || 1000000);
  const feeRate = Number(options.feeRate ?? 0.0022);
  const marketFilter = options.marketFilter || 'all';
  const enabledSet =
    Array.isArray(options.enabledSymbols) && options.enabledSymbols.length > 0
      ? new Set(options.enabledSymbols)
      : null;
  const isCustomSubset = enabledSet && ASSET_UNIVERSE.some((a) => !enabledSet.has(a.symbol));

  const { enrichedBySymbol, barBySymbolAndDate } = prepareEnrichedUniverse(rawMarketData);

  // Determine eligible tradeable symbols
  let eligibleAssets = ASSET_UNIVERSE.filter((asset) => {
    if (!enrichedBySymbol[asset.symbol] || enrichedBySymbol[asset.symbol].length === 0) {
      return false;
    }
    if (enabledSet && !enabledSet.has(asset.symbol)) {
      return false;
    }
    if (marketFilter === 'tw-semi') {
      return asset.category === 'tw-semi' || asset.symbol === '0050';
    }
    if (marketFilter === 'tw-ai') {
      return asset.category === 'tw-ai' || asset.symbol === '2330' || asset.symbol === '0050';
    }
    if (marketFilter === 'tw-value') {
      return asset.category === 'tw-value' || asset.category === 'tw-etf';
    }
    return true;
  });

  if (broad && !isCustomSubset && (marketFilter === 'all' || !marketFilter)) {
    for (const a of broad.assets) {
      if (!eligibleAssets.some((x) => x.symbol === a.symbol)) eligibleAssets.push(a);
    }
  }

  if (eligibleAssets.length === 0) {
    eligibleAssets = ASSET_UNIVERSE.filter(
      (asset) => enrichedBySymbol[asset.symbol] && enrichedBySymbol[asset.symbol].length > 0
    );
  }

  // Build master trading date timeline from 0050 (TWSE benchmark)
  const timelineSymbol = enrichedBySymbol[BENCHMARK_SYMBOL]?.length
    ? BENCHMARK_SYMBOL
    : eligibleAssets[0]?.symbol || Object.keys(enrichedBySymbol)[0];

  const fullTimeline = (enrichedBySymbol[timelineSymbol] || []).map((b) => b.date);
  // Live forward mode: `tradeFromDate` (YYYY-MM-DD) starts a fresh account on that day. The last bar before it
  // is a baseline day (equity = capital, benchmark anchor) and no orders are allowed before the start date, so
  // nothing bought earlier counts. Indicators still warm up on the full history (no look-ahead).
  const tradeFromDate = options.tradeFromDate || null;
  let startIdx = Math.max(0, fullTimeline.length - periodDays);
  if (tradeFromDate) {
    const firstLive = fullTimeline.findIndex((d) => d >= tradeFromDate);
    startIdx = firstLive === -1 ? Math.max(0, fullTimeline.length - 1) : Math.max(0, firstLive - 1);
  }
  const timelineDates = fullTimeline.slice(startIdx);

  // Last 5 trading days (~7 calendar days = Past 1 Week)
  const recentWeekDates = new Set(timelineDates.slice(-5));

  // Benchmark series (Buy & Hold 0050 元大台灣50)
  const benchmarkTicker = BENCHMARK_SYMBOL;
  const benchmarkBars = enrichedBySymbol[benchmarkTicker] || [];
  const benchmarkDateMap = barBySymbolAndDate[benchmarkTicker] || new Map();
  let firstBenchmarkPrice = null;
  const benchmarkCurve = [];

  for (const date of timelineDates) {
    const b =
      benchmarkDateMap.get(date) ||
      benchmarkBars.find((x) => x.date >= date) ||
      benchmarkBars.at(-1);
    const price = b ? b.close : 100;
    if (firstBenchmarkPrice === null) firstBenchmarkPrice = price;
    const equity = initialCapital * (price / firstBenchmarkPrice);
    const returnPct = ((equity - initialCapital) / initialCapital) * 100;
    benchmarkCurve.push({
      date,
      price,
      equity,
      returnPct
    });
  }

  const benchmarkFinalReturnPct =
    benchmarkCurve.length > 0 ? benchmarkCurve.at(-1).returnPct : 0;

  // Simulate each of the 3 AI Traders
  const traderResults = AI_TRADERS.map((trader) => {
    let cash = initialCapital;
    const openPositions = new Map(); // symbol -> position object
    const cooldownUntilDayIdx = new Map(); // symbol -> dayIdx cooldown after selling
    const closedTrades = [];
    const orderEvents = [];
    const equityCurve = [];
    let peakEquity = initialCapital;
    let maxDrawdownPct = 0;

    // Track last close price for each asset in case a crypto/stock holiday differs
    const lastKnownClose = {};
    for (const asset of eligibleAssets) {
      const barsBefore = (enrichedBySymbol[asset.symbol] || []).filter(
        (b) => b.date <= timelineDates[0]
      );
      if (barsBefore.length > 0) {
        lastKnownClose[asset.symbol] = barsBefore.at(-1).close;
      }
    }

    let lastSpyBar =
      (enrichedBySymbol[BENCHMARK_SYMBOL] || [])
        .filter((b) => b.date <= timelineDates[0])
        .at(-1) || null;

    for (let dayIdx = 0; dayIdx < timelineDates.length; dayIdx++) {
      const date = timelineDates[dayIdx];
      const spyBarToday = barBySymbolAndDate[BENCHMARK_SYMBOL]?.get(date);
      if (spyBarToday) lastSpyBar = spyBarToday;
      const regime = buildRegime(spyBarToday || lastSpyBar);

      const tradingOpen = !tradeFromDate || date >= tradeFromDate;

      // Update last known prices & increment holding days only when trading is active
      for (const asset of eligibleAssets) {
        const bar = barBySymbolAndDate[asset.symbol]?.get(date);
        if (bar) {
          lastKnownClose[asset.symbol] = bar.close;
        }
        const pos = openPositions.get(asset.symbol);
        if (pos && bar) {
          if (tradingOpen) pos.barsHeld += 1;
          pos.currentPrice = bar.close;
          if (!tradingOpen) {
            pos.highestPrice = Math.max(pos.highestPrice, bar.high || bar.close);
          }
        } else if (pos && lastKnownClose[asset.symbol]) {
          pos.currentPrice = lastKnownClose[asset.symbol];
        }
      }

      // STEP 1: Evaluate EXITS on currently held positions (strictly before updating highestPrice with today's bar.high)
      for (const [symbol, pos] of tradingOpen ? Array.from(openPositions.entries()) : []) {
        const bar = barBySymbolAndDate[symbol]?.get(date);
        if (!bar) continue;

        const decision = evaluateTraderSignal(trader.id, bar, pos, regime);
        if (decision.action === 'SELL') {
          const grossProceeds = pos.shares * bar.close;
          const exitFee = grossProceeds * feeRate;
          const netProceeds = grossProceeds - exitFee;
          const totalFees = pos.entryFee + exitFee;
          const netPnl = netProceeds - pos.costBasis;
          const netPnlPct = (netPnl / pos.costBasis) * 100;

          cash += netProceeds;
          openPositions.delete(symbol);
          // Prevent same-day or next-day whipsaw re-entry on the same ticker
          cooldownUntilDayIdx.set(symbol, (bar.barIndex ?? dayIdx) + 2);

          const meta = getAssetMeta(symbol);
          const tradeRecord = {
            id: `${trader.id}-${symbol}-${pos.entryDate}-${date}`,
            traderId: trader.id,
            traderName: trader.name,
            traderNameZh: trader.nameZh,
            traderBadge: trader.badge,
            traderColor: trader.color,
            symbol,
            displayTicker: meta.displayTicker || symbol,
            assetNameZh: meta.nameZh,
            category: meta.category,
            status: 'CLOSED',
            entryDate: pos.entryDate,
            exitDate: date,
            barsHeld: pos.barsHeld,
            shares: pos.shares,
            entryPrice: pos.entryPrice,
            exitPrice: bar.close,
            stopLoss: pos.stopLoss,
            takeProfit: pos.takeProfit,
            costBasis: pos.costBasis,
            netProceeds,
            feesPaid: totalFees,
            netPnl,
            netPnlPct,
            entryTagZh: pos.entryTagZh,
            entryTagEn: pos.entryTagEn,
            entryReasonZh: pos.entryReasonZh,
            entryReasonEn: pos.entryReasonEn,
            exitTagZh: decision.tagZh,
            exitTagEn: decision.tagEn,
            exitReasonZh: decision.reasonZh,
            exitReasonEn: decision.reasonEn
          };

          closedTrades.push(tradeRecord);
          orderEvents.push({
            id: `SELL-${trader.id}-${symbol}-${date}`,
            traderId: trader.id,
            traderName: trader.name,
            traderNameZh: trader.nameZh,
            traderBadge: trader.badge,
            traderColor: trader.color,
            date,
            isWithinPastWeek: recentWeekDates.has(date),
            entryDate: pos.entryDate,
            exitDate: date,
            barsHeld: pos.barsHeld,
            type: 'SELL',
            status: 'CLOSED',
            symbol,
            displayTicker: meta.displayTicker || symbol,
            assetName: meta.name,
            assetNameZh: meta.nameZh,
            assetColor: meta.color,
            price: bar.close,
            entryPrice: pos.entryPrice,
            exitPrice: bar.close,
            currentPrice: bar.close,
            stopLoss: pos.stopLoss,
            takeProfit: pos.takeProfit,
            shares: pos.shares,
            amount: netProceeds,
            fee: exitFee,
            pnl: netPnl,
            pnlPct: netPnlPct,
            tagZh: decision.tagZh,
            tagEn: decision.tagEn,
            reasonZh: decision.reasonZh,
            reasonEn: decision.reasonEn
          });
        } else {
          pos.highestPrice = Math.max(pos.highestPrice, bar.high || bar.close);
        }
      }

      // STEP 2: Evaluate ENTRIES across eligible assets not currently in portfolio
      if (tradingOpen && openPositions.size < trader.maxPositions) {
        let openBroadCount = 0;
        for (const p of openPositions.values()) {
          if (p.isBroad) openBroadCount += 1;
        }

        const candidates = [];
        for (const asset of eligibleAssets) {
          if (openPositions.has(asset.symbol)) continue;
          if (asset.isBroad && openBroadCount >= 1) continue;

          const bar = barBySymbolAndDate[asset.symbol]?.get(date);
          if (!bar) continue;

          const cd = cooldownUntilDayIdx.get(asset.symbol);
          if (cd !== undefined && (bar.barIndex ?? dayIdx) < cd) continue;
          if (!isSatelliteEligible(asset, bar, regime, trader.id)) continue;

          const decision = evaluateTraderSignal(trader.id, bar, null, regime);
          if (decision.action === 'BUY') {
            const adjConviction = asset.isBroad ? decision.conviction - 20 : decision.conviction;
            candidates.push({
              asset,
              bar,
              decision: { ...decision, conviction: adjConviction }
            });
          }
        }

        // Rank by highest conviction
        candidates.sort((a, b) => b.decision.conviction - a.decision.conviction);

        let currentInvested = 0;
        for (const pos of openPositions.values()) {
          currentInvested += pos.shares * pos.currentPrice;
        }
        const currentTotalEquity = cash + currentInvested;

        for (const cand of candidates) {
          if (openPositions.size >= trader.maxPositions) break;
          if (cand.asset.isBroad && openBroadCount >= 1) continue;

          let allocPct = cand.decision.allocationPct || trader.baseAllocation;
          if (cand.asset.isBroad) allocPct = Math.min(allocPct, 0.18);
          const targetDollar = Math.min(cash * 0.96, currentTotalEquity * allocPct);
          if (targetDollar < currentTotalEquity * 0.06 || targetDollar < 500) continue;

          const entryPrice = cand.bar.close;
          const step = cand.asset.lotStep || 1;
          const rawShares = targetDollar / (entryPrice * (1 + feeRate));
          const shares =
            step >= 1
              ? Math.floor(rawShares)
              : Math.round(Math.floor(rawShares / step) * step * 1e6) / 1e6;

          const grossCost = shares * entryPrice;
          const entryFee = grossCost * feeRate;
          const totalCost = grossCost + entryFee;

          if (shares <= 0 || totalCost > cash) continue;

          cash -= totalCost;
          if (cand.asset.isBroad) openBroadCount += 1;
          openPositions.set(cand.asset.symbol, {
            symbol: cand.asset.symbol,
            isBroad: !!cand.asset.isBroad,
            displayTicker: cand.asset.displayTicker || cand.asset.symbol,
            assetNameZh: cand.asset.nameZh,
            category: cand.asset.category,
            entryDate: date,
            entryPrice,
            currentPrice: entryPrice,
            highestPrice: entryPrice,
            shares,
            costBasis: totalCost,
            entryFee,
            barsHeld: 0,
            stopLoss: cand.decision.stopLossPrice || entryPrice * 0.958,
            takeProfit: cand.decision.takeProfitPrice || entryPrice * 1.15,
            entryTagZh: cand.decision.tagZh,
            entryTagEn: cand.decision.tagEn,
            entryReasonZh: cand.decision.reasonZh,
            entryReasonEn: cand.decision.reasonEn
          });

          orderEvents.push({
            id: `BUY-${trader.id}-${cand.asset.symbol}-${date}`,
            traderId: trader.id,
            traderName: trader.name,
            traderNameZh: trader.nameZh,
            traderBadge: trader.badge,
            traderColor: trader.color,
            date,
            isWithinPastWeek: recentWeekDates.has(date),
            entryDate: date,
            type: 'BUY',
            status: 'OPEN',
            symbol: cand.asset.symbol,
            displayTicker: cand.asset.displayTicker || cand.asset.symbol,
            assetName: cand.asset.name,
            assetNameZh: cand.asset.nameZh,
            assetColor: cand.asset.color,
            price: entryPrice,
            entryPrice,
            currentPrice: entryPrice,
            shares,
            amount: totalCost,
            fee: entryFee,
            stopLoss: cand.decision.stopLossPrice || entryPrice * 0.958,
            takeProfit: cand.decision.takeProfitPrice || entryPrice * 1.15,
            tagZh: cand.decision.tagZh,
            tagEn: cand.decision.tagEn,
            reasonZh: cand.decision.reasonZh,
            reasonEn: cand.decision.reasonEn
          });
        }
      }

      // STEP 3: Mark-to-Market end-of-day portfolio valuation
      let investedValue = 0;
      for (const pos of openPositions.values()) {
        investedValue += pos.shares * pos.currentPrice;
      }
      const totalEquity = cash + investedValue;
      if (totalEquity > peakEquity) peakEquity = totalEquity;
      const drawdownPct = peakEquity > 0 ? ((totalEquity - peakEquity) / peakEquity) * 100 : 0;
      if (drawdownPct < maxDrawdownPct) maxDrawdownPct = drawdownPct;

      const returnPct = ((totalEquity - initialCapital) / initialCapital) * 100;
      const prevEquity = equityCurve.length > 0 ? equityCurve.at(-1).equity : initialCapital;
      const dailyPnlDollar = totalEquity - prevEquity;
      const dailyReturn = prevEquity > 0 ? dailyPnlDollar / prevEquity : 0;

      equityCurve.push({
        date,
        equity: totalEquity,
        cash,
        investedValue,
        returnPct,
        drawdownPct,
        dailyReturn,
        dailyReturnPct: dailyReturn * 100,
        dailyPnlDollar,
        openPositionsCount: openPositions.size
      });
    }

    // Build active open positions array with unrealized PnL
    const activePositions = Array.from(openPositions.values()).map((pos) => {
      const marketValue = pos.shares * pos.currentPrice;
      const unrealizedPnl = marketValue - pos.costBasis;
      const unrealizedPnlPct = (unrealizedPnl / pos.costBasis) * 100;
      const rangeSpan = Math.max(0.0001, pos.takeProfit - pos.stopLoss);
      const rangeProgressPct = Math.max(
        0,
        Math.min(100, ((pos.currentPrice - pos.stopLoss) / rangeSpan) * 100)
      );
      const entryRangePct = Math.max(
        0,
        Math.min(100, ((pos.entryPrice - pos.stopLoss) / rangeSpan) * 100)
      );
      const distToTpPct =
        pos.currentPrice > 0 ? ((pos.takeProfit - pos.currentPrice) / pos.currentPrice) * 100 : 0;
      const distToSlPct =
        pos.currentPrice > 0 ? ((pos.currentPrice - pos.stopLoss) / pos.currentPrice) * 100 : 0;
      return {
        ...pos,
        traderId: trader.id,
        traderName: trader.name,
        traderNameZh: trader.nameZh,
        traderBadge: trader.badge,
        traderColor: trader.color,
        assetColor: getAssetMeta(pos.symbol).color,
        status: 'OPEN',
        marketValue,
        unrealizedPnl,
        unrealizedPnlPct,
        rangeProgressPct,
        entryRangePct,
        distToTpPct,
        distToSlPct
      };
    });

    // Enrich BUY order events with current live mark-to-market status or closed status
    const activeMap = new Map(activePositions.map((p) => [`${p.symbol}-${p.entryDate}`, p]));
    const closedMap = new Map(closedTrades.map((c) => [`${c.symbol}-${c.entryDate}`, c]));
    for (const ev of orderEvents) {
      if (ev.type === 'BUY') {
        const key = `${ev.symbol}-${ev.entryDate}`;
        const activePos = activeMap.get(key);
        const closedTr = closedMap.get(key);
        if (activePos) {
          ev.status = 'OPEN';
          ev.currentPrice = activePos.currentPrice;
          ev.barsHeld = activePos.barsHeld;
          ev.pnl = activePos.unrealizedPnl;
          ev.pnlPct = activePos.unrealizedPnlPct;
          ev.rangeProgressPct = activePos.rangeProgressPct;
          ev.entryRangePct = activePos.entryRangePct;
          ev.distToTpPct = activePos.distToTpPct;
          ev.distToSlPct = activePos.distToSlPct;
        } else if (closedTr) {
          ev.status = 'CLOSED';
          ev.exitDate = closedTr.exitDate;
          ev.exitPrice = closedTr.exitPrice;
          ev.currentPrice = closedTr.exitPrice;
          ev.barsHeld = closedTr.barsHeld;
          ev.pnl = closedTr.netPnl;
          ev.pnlPct = closedTr.netPnlPct;
        }
      } else if (ev.type === 'SELL') {
        const rangeSpan = Math.max(
          0.0001,
          (ev.takeProfit || ev.price * 1.1) - (ev.stopLoss || ev.price * 0.95)
        );
        ev.rangeProgressPct = Math.max(
          0,
          Math.min(100, ((ev.exitPrice - ev.stopLoss) / rangeSpan) * 100)
        );
        ev.entryRangePct = Math.max(
          0,
          Math.min(100, ((ev.entryPrice - ev.stopLoss) / rangeSpan) * 100)
        );
      }
    }

    // Build Daily PnL Calendar Heatmap array for this AI Trader
    const eventsByDate = new Map();
    for (const ev of orderEvents) {
      if (!eventsByDate.has(ev.date)) eventsByDate.set(ev.date, []);
      eventsByDate.get(ev.date).push(ev);
    }
    const periodPnl = buildPeriodPnl(equityCurve);
    const dailyCalendar = equityCurve.map((pt) => ({
      date: pt.date,
      equity: pt.equity,
      returnPct: pt.returnPct,
      dailyReturnPct: pt.dailyReturnPct,
      dailyPnlDollar: pt.dailyPnlDollar,
      trades: eventsByDate.get(pt.date) || []
    }));

    // Compute summary metrics
    const finalPoint = equityCurve.at(-1) || {
      equity: initialCapital,
      cash: initialCapital,
      investedValue: 0,
      returnPct: 0
    };

    const allEvaluatedTrades = [
      ...closedTrades.map((t) => ({ pnl: t.netPnl, pnlPct: t.netPnlPct })),
      ...activePositions.map((p) => ({ pnl: p.unrealizedPnl, pnlPct: p.unrealizedPnlPct }))
    ];

    const winningCount = allEvaluatedTrades.filter((t) => t.pnl > 0).length;
    const losingCount = allEvaluatedTrades.filter((t) => t.pnl <= 0).length;
    const winRatePct =
      allEvaluatedTrades.length > 0 ? (winningCount / allEvaluatedTrades.length) * 100 : 0;

    const grossProfit = allEvaluatedTrades
      .filter((t) => t.pnl > 0)
      .reduce((acc, t) => acc + t.pnl, 0);
    const grossLoss = Math.abs(
      allEvaluatedTrades.filter((t) => t.pnl < 0).reduce((acc, t) => acc + t.pnl, 0)
    );
    const profitFactor =
      grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 9.99 : 1.0;

    // Annualized Sharpe Ratio from daily returns
    const dailyReturns = equityCurve.map((pt) => pt.dailyReturn);
    const meanDaily =
      dailyReturns.length > 0
        ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
        : 0;
    const varianceDaily =
      dailyReturns.length > 1
        ? dailyReturns.reduce((acc, r) => acc + (r - meanDaily) ** 2, 0) /
          (dailyReturns.length - 1)
        : 0;
    const stdDaily = Math.sqrt(varianceDaily);
    const sharpeRatio = stdDaily > 0.0001 ? (meanDaily / stdDaily) * Math.sqrt(252) : 0;

    const totalFeesPaid = orderEvents.reduce((acc, e) => acc + (e.fee || 0), 0);

    return {
      trader,
      metrics: {
        initialCapital,
        finalEquity: finalPoint.equity,
        netProfit: finalPoint.equity - initialCapital,
        totalReturnPct: finalPoint.returnPct,
        alphaPct: finalPoint.returnPct - benchmarkFinalReturnPct,
        cashBalance: finalPoint.cash,
        investedValue: finalPoint.investedValue,
        exposurePct:
          finalPoint.equity > 0 ? (finalPoint.investedValue / finalPoint.equity) * 100 : 0,
        winRatePct,
        totalTradesCount: allEvaluatedTrades.length,
        closedTradesCount: closedTrades.length,
        openPositionsCount: activePositions.length,
        winningCount,
        losingCount,
        profitFactor,
        maxDrawdownPct,
        sharpeRatio,
        totalFeesPaid
      },
      equityCurve,
      dailyCalendar,
      periodPnl,
      activePositions,
      closedTrades: closedTrades.slice().reverse(),
      orderEvents: orderEvents.slice().reverse()
    };
  });

  // Sort leaderboard by totalReturnPct descending
  const leaderboard = [...traderResults].sort(
    (a, b) => b.metrics.totalReturnPct - a.metrics.totalReturnPct
  );

  // Build "Today's Live AI Radar" for the latest market bar across all eligible assets
  const latestRadar = eligibleAssets
    .map((asset) => {
      const bars = enrichedBySymbol[asset.symbol] || [];
      const latestBar = bars.at(-1);
      if (!latestBar) return null;

      const spyLatest = enrichedBySymbol[BENCHMARK_SYMBOL]?.at(-1);
      const regime = buildRegime(spyLatest);

      const signalsByTrader = {};
      for (const trResult of traderResults) {
        const openPos = trResult.activePositions.find((p) => p.symbol === asset.symbol) || null;
        let sig = evaluateTraderSignal(
          trResult.trader.id,
          latestBar,
          openPos,
          regime
        );
        if (!openPos && asset.isBroad) {
          if (!isSatelliteEligible(asset, latestBar, regime, trResult.trader.id)) {
            sig = {
              ...sig,
              action: 'WAIT',
              conviction: Math.min(55, sig.conviction || 45)
            };
          } else if (sig.action === 'BUY') {
            sig = { ...sig, conviction: Math.max(50, sig.conviction - 20) };
          }
        }
        signalsByTrader[trResult.trader.id] = sig;
      }

      return {
        symbol: asset.symbol,
        isBroad: !!asset.isBroad,
        displayTicker: asset.displayTicker || asset.symbol,
        name: asset.name,
        nameZh: asset.nameZh,
        category: asset.category,
        sectorZh: asset.sectorZh,
        color: asset.color,
        date: latestBar.date,
        close: latestBar.close,
        dailyReturnPct: latestBar.dailyReturnPct,
        roc5: latestBar.roc5,
        roc10: latestBar.roc10,
        roc20: latestBar.roc20,
        rsi14: latestBar.rsi14,
        macdHist: latestBar.macdHist,
        bbUpper: latestBar.bbUpper,
        bbLower: latestBar.bbLower,
        bbPercentB: latestBar.bbPercentB,
        zScore20: latestBar.zScore20,
        atr14: latestBar.atr14,
        atrPct: latestBar.atrPct,
        ema8: latestBar.ema8,
        ema21: latestBar.ema21,
        sma20: latestBar.sma20,
        sma50: latestBar.sma50,
        sma50SlopePct: latestBar.sma50SlopePct,
        signalsByTrader
      };
    })
    .filter(Boolean);

  // Build unified cross-AI recent operations feed sorted newest date first
  const recentOperations = traderResults
    .flatMap((tr) => tr.orderEvents)
    .sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return (b.pnlPct || 0) - (a.pnlPct || 0);
    });

  const recentWeekOperations = recentOperations.filter((op) => op.isWithinPastWeek);

  // Build "Top 5 Most Promising External US Stocks Forecast" (每週一自動更新清單外前五名潛力美股)
  const top5Mode = options.top5Mode || 'monday';
  const { top5Promising, top5WeeklyMeta } = computeTop5PromisingAssets(
    enrichedBySymbol,
    eligibleAssets,
    traderResults,
    timelineDates.at(-1) || '',
    top5Mode
  );

  // Build "Next Entry Watchlist & Estimated Trigger Prices" (下一檔最接近買點的準進場清單)
  const nextEntryWatchlist = computeNextEntryWatchlist(latestRadar, traderResults);

  // Build "AI Daily Portfolio Briefing" (AI 每日盤後投顧總結快報)
  const dailyBriefing = computeDailyBriefing({
    endDate: timelineDates.at(-1) || '',
    leaderboard,
    benchmarkTicker,
    benchmarkFinalReturnPct,
    recentWeekOperations,
    top5Promising,
    top5WeeklyMeta,
    nextEntryWatchlist,
    latestRadar
  });

  return {
    generatedAt: new Date().toISOString(),
    marketUpdatedAt: rawMarketData.fetchedAt || new Date().toISOString(),
    config: {
      periodDays,
      initialCapital,
      feeRate,
      marketFilter,
      top5Mode,
      enabledSymbols: eligibleAssets.map((a) => a.symbol),
      startDate: tradeFromDate || timelineDates[0] || '',
      tradeFromDate,
      liveDaysCount: tradeFromDate ? timelineDates.filter((d) => d >= tradeFromDate).length : null,
      endDate: timelineDates.at(-1) || '',
      tradingDaysCount: timelineDates.length
    },
    benchmark: {
      symbol: benchmarkTicker,
      nameZh: getAssetMeta(benchmarkTicker).nameZh,
      finalReturnPct: benchmarkFinalReturnPct,
      finalEquity: benchmarkCurve.at(-1)?.equity || initialCapital,
      curve: benchmarkCurve
    },
    traderResults,
    leaderboard,
    recentOperations,
    recentWeekOperations,
    top5Promising,
    top5WeeklyMeta,
    nextEntryWatchlist,
    dailyBriefing,
    latestRadar
  };
}

/**
 * Helper to compute the Monday of the week for a given YYYY-MM-DD date string
 * and the upcoming Monday auto-update date.
 */
function getWeeklyMondaySchedule(endDateStr) {
  const baseDate = endDateStr ? new Date(`${endDateStr}T00:00:00Z`) : new Date();
  const dayOfWeek = baseDate.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const mondayDateObj = new Date(baseDate);
  mondayDateObj.setUTCDate(baseDate.getUTCDate() + diffToMonday);
  const weekMondayDate = mondayDateObj.toISOString().slice(0, 10);

  const nextMondayObj = new Date(mondayDateObj);
  nextMondayObj.setUTCDate(mondayDateObj.getUTCDate() + 7);
  const nextMondayDate = nextMondayObj.toISOString().slice(0, 10);

  return { weekMondayDate, nextMondayDate };
}

/**
 * Computes the Top 5 Most Promising External US Stocks for the Next 30 Days
 * strictly from DISCOVERY_CANDIDATE_UNIVERSE (US stocks NOT currently in the active trading list).
 * When top5Mode === 'monday' (default), the ranking is anchored to this week's Monday bar
 * and tracks week-to-date (WTD) performance from Monday's anchor price.
 */
function computeTop5PromisingAssets(
  enrichedBySymbol,
  eligibleAssets,
  traderResults,
  endDateStr = '',
  top5Mode = 'monday'
) {
  const activeSymbolsSet = new Set([
    ...ASSET_UNIVERSE.map((a) => a.symbol),
    ...eligibleAssets.filter((a) => !a.isBroad).map((a) => a.symbol)
  ]);

  const { weekMondayDate, nextMondayDate } = getWeeklyMondaySchedule(endDateStr);

  // Strictly filter to external discovery TW stocks NOT in the current core watchlist
  const baseDiscovery = DISCOVERY_CANDIDATE_UNIVERSE.filter(
    (c) => !activeSymbolsSet.has(c.symbol) && (enrichedBySymbol[c.symbol] || []).length > 0
  );
  const discoverySymbols = new Set(baseDiscovery.map((c) => c.symbol));
  const broadDiscovery = eligibleAssets.filter((a) => {
    if (!a.isBroad || activeSymbolsSet.has(a.symbol) || discoverySymbols.has(a.symbol)) return false;
    const latest = (enrichedBySymbol[a.symbol] || []).at(-1);
    return latest && isExternalWatchlistEligible(latest);
  });
  const externalCandidates = [...baseDiscovery, ...broadDiscovery];

  let anchorTradingDate = weekMondayDate;

  const scored = externalCandidates.map((cand) => {
    const bars = enrichedBySymbol[cand.symbol] || [];
    const latestBar = bars.at(-1);

    // Find this week's Monday trading bar (first bar >= weekMondayDate, or latest bar <= weekMondayDate)
    let mondayBar =
      bars.find((b) => b.date >= weekMondayDate) ||
      bars.slice().reverse().find((b) => b.date <= weekMondayDate) ||
      latestBar;

    // Evaluation bar: Monday bar when in 'monday' weekly lock mode, or latestBar when in 'live' preview mode
    const r = top5Mode === 'monday' ? mondayBar : latestBar;
    anchorTradingDate = mondayBar.date;

    const spyBars = enrichedBySymbol[BENCHMARK_SYMBOL] || [];
    const spyRefBar =
      spyBars.find((b) => b.date === r.date) || spyBars.at(-1);
    const regime = buildRegime(spyRefBar);

    // Evaluate all 3 AI Traders on this external stock's evaluation bar
    const signalsByTrader = {};
    for (const tr of traderResults) {
      signalsByTrader[tr.trader.id] = evaluateTraderSignal(tr.trader.id, r, null, regime);
    }

    // 1. Trend Structure & SMA50 Slope (0 - 34)
    let trendPts = 0;
    if (r.close > r.sma50) trendPts += 14;
    if (r.sma20 >= r.sma50 * 0.995) trendPts += 10;
    if (r.sma50SlopePct >= 0.3) trendPts += 10;
    else if (r.sma50SlopePct > 0) trendPts += 6;

    // 2. Relative Strength & Sharpe Momentum (0 - 26)
    const sharpeMom = r.atrPct > 0 ? r.roc20 / r.atrPct : 0;
    let momPts = 0;
    if (sharpeMom >= 1.2) momPts += 16;
    else if (sharpeMom >= 0.3) momPts += 11;
    else if (r.roc10 > 0) momPts += 6;
    if (r.ema8 >= r.ema21 * 0.995) momPts += 10;

    // 3. Valuation / Pullback Upside Room (0 - 22)
    let roomPts = 0;
    if (r.rsi14 >= 40 && r.rsi14 <= 63) roomPts += 12;
    else if (r.rsi14 < 40 && r.close >= r.sma50 * 0.95) roomPts += 14;
    else if (r.rsi14 <= 68) roomPts += 7;

    if (r.zScore20 >= -1.6 && r.zScore20 <= 0.8) roomPts += 10;
    else if (r.zScore20 <= 1.4) roomPts += 5;

    // 4. 3-AI Consensus on this External Stock (0 - 18)
    let aiConsensusPts = 0;
    const bullishTraders = [];
    for (const tr of traderResults) {
      const sig = signalsByTrader[tr.trader.id];
      if (sig?.action === 'BUY' || (sig?.conviction || 0) >= 62) {
        aiConsensusPts += 6;
        bullishTraders.push(tr.trader.nameZh.split(' ')[0]);
      } else if ((sig?.conviction || 0) >= 52) {
        aiConsensusPts += 3;
      }
    }

    const rawScore =
      trendPts + momPts + roomPts + aiConsensusPts + Math.max(-3, Math.min(5, sharpeMom * 1.4));
    const outlookScore = Math.min(98, Math.max(45, Math.round(rawScore)));

    // Calculate concrete Buy Zone, 30-Day Target Price, and Stop-Loss Defense Price
    const buyZoneLow = Math.min(r.close * 0.985, r.sma20 * 0.99);
    const buyZoneHigh = r.close * 1.005;
    const projectedUpsidePct = Math.max(
      9.0,
      Math.min(24.0, r.atrPct * 3.9 + Math.max(0, -r.zScore20 * 2.5))
    );
    const targetPrice30d = r.close * (1 + projectedUpsidePct / 100);
    const stopLossPrice = Math.min(r.close * 0.958, r.close - 2.2 * r.atr14);
    const downsideRiskPct = Math.max(2.5, ((r.close - stopLossPrice) / r.close) * 100);
    const rewardRiskRatio = projectedUpsidePct / downsideRiskPct;

    const mondayAnchorPrice = mondayBar.close;
    const currentPrice = latestBar.close;
    const weekToDateReturnPct =
      mondayAnchorPrice > 0
        ? ((currentPrice - mondayAnchorPrice) / mondayAnchorPrice) * 100
        : 0;

    // Build specific catalyst bullet points (Fundamental Theme + Technical Structure + AI View)
    const catalystsZh = [];
    if (cand.thesisZh) {
      catalystsZh.push(`產業護城河：${cand.thesisZh}`);
    }
    if (r.close > r.sma50 && r.sma50SlopePct > 0) {
      catalystsZh.push(
        `中長線多頭排列：股價 (NT$${r.close.toFixed(2)}) 站穩上揚 50日生命線 (NT$${r.sma50.toFixed(2)}，斜率 +${r.sma50SlopePct.toFixed(2)}%)，近 20 日動能 ${r.roc20 >= 0 ? '+' : ''}${r.roc20.toFixed(1)}%`
      );
    } else if (r.zScore20 <= -0.8) {
      catalystsZh.push(
        `回檔黃金買點浮現：Z-Score=${r.zScore20.toFixed(2)}、RSI(14)=${r.rsi14.toFixed(1)}，回測支撐下檔風險有限、盈虧比達 ${rewardRiskRatio.toFixed(1)} : 1`
      );
    } else {
      catalystsZh.push(
        `技術位階穩健：RSI(14)=${r.rsi14.toFixed(1)}、布林 %B=${(r.bbPercentB * 100).toFixed(0)}%，蓄勢挑戰前波壓力區`
      );
    }
    if (bullishTraders.length > 0) {
      catalystsZh.push(
        `AI 週一選股共識：獲 ${bullishTraders.join('、')} AI 點名列為清單外高勝率潛力台股`
      );
    } else {
      catalystsZh.push(
        `突破觸發預警：站上 EMA8 (NT$${r.ema8.toFixed(2)}) 將同步點燃動能與多因子買進訊號`
      );
    }

    const consensusLabelZh =
      bullishTraders.length === 3
        ? '🔥 三大 AI 聯合推薦清單外首選'
        : bullishTraders.length === 2
          ? `⚡ ${bullishTraders.join(' + ')} 雙 AI 聯合看多`
          : bullishTraders.length === 1
            ? `🎯 ${bullishTraders[0]} AI 點名看多`
            : '🔭 清單外高賠率波段潛力股';

    return {
      symbol: cand.symbol,
      displayTicker: cand.displayTicker || cand.symbol,
      name: cand.name,
      nameZh: cand.nameZh,
      sectorZh: cand.sectorZh,
      category: cand.category,
      color: cand.color,
      isExternalDiscovery: true,
      mondayAnchorDate: mondayBar.date,
      mondayAnchorPrice,
      currentPrice,
      weekToDateReturnPct,
      dailyReturnPct: latestBar.dailyReturnPct,
      roc20: latestBar.roc20,
      rsi14: latestBar.rsi14,
      zScore20: latestBar.zScore20,
      sma50: latestBar.sma50,
      outlookScore,
      consensusLabelZh,
      bullishTradersCount: bullishTraders.length,
      buyZoneLow,
      buyZoneHigh,
      targetPrice30d,
      projectedUpsidePct,
      stopLossPrice,
      downsideRiskPct,
      rewardRiskRatio,
      catalystsZh
    };
  });

  scored.sort((a, b) => b.outlookScore - a.outlookScore || b.roc20 - a.roc20);

  const top5Promising = scored.slice(0, 5).map((item, idx) => ({
    ...item,
    rank: idx + 1
  }));

  const top5WeeklyMeta = {
    mode: top5Mode,
    weekMondayDate,
    anchorTradingDate,
    latestTradingDate: endDateStr,
    nextMondayDate,
    scheduleLabelZh: `每週一自動更新（本週定錨日：${anchorTradingDate} · 下週一更新日：${nextMondayDate}）`
  };

  return { top5Promising, top5WeeklyMeta };
}

/**
 * Computes the Next Entry Watchlist & Estimated Buy Trigger Prices for assets currently on standby.
 */
function computeNextEntryWatchlist(latestRadar, traderResults) {
  const watchlist = [];

  for (const r of latestRadar) {
    // Evaluate each trader that is NOT currently holding this asset
    for (const tr of traderResults) {
      if (r.isBroad && tr.trader.id === 'sigma-reversion') continue;
      const isHeld = tr.activePositions.some((p) => p.symbol === r.symbol);
      if (isHeld) continue;

      const sig = r.signalsByTrader[tr.trader.id];
      if (!sig) continue;

      const threshold = tr.trader.id === 'alpha-momentum' ? 74 : tr.trader.id === 'sigma-reversion' ? 70 : 72;
      const readinessPct =
        sig.action === 'BUY'
          ? 100
          : Math.min(97, Math.round(((sig.conviction || 40) / threshold) * 100));

      // Compute concrete trigger price for this AI strategy
      let triggerPrice = r.close;
      let triggerTypeZh = '';
      let triggerConditionZh = '';

      if (tr.trader.id === 'sigma-reversion') {
        // Sigma buys pullbacks toward lower/mid Bollinger band
        const std20 = (r.bbUpper - r.sma20) / 2 || r.close * 0.02;
        const targetDipPrice = Math.min(r.close * 0.992, Math.max(r.sma50 * 1.002, r.sma20 - 0.6 * std20));
        triggerPrice = sig.action === 'BUY' ? r.close : targetDipPrice;
        const diffPct = ((triggerPrice - r.close) / r.close) * 100;
        triggerTypeZh = sig.action === 'BUY' ? '🟢 已達抄底買點' : '🎯 回測支撐低接價';
        triggerConditionZh =
          sig.action === 'BUY'
            ? `現價 NT$${r.close.toFixed(2)} 已進入布林支撐超賣區（Z=${r.zScore20.toFixed(2)}），符合逢低買進條件`
            : `若股價回測至 NT$${triggerPrice.toFixed(2)}（距現價 ${diffPct.toFixed(1)}%）且守穩 SMA50 (NT$${r.sma50.toFixed(2)}) 即觸發買進`;
      } else if (tr.trader.id === 'alpha-momentum') {
        // Alpha buys momentum breakout above EMA8 / EMA21
        const targetBreakout = Math.max(r.close * 1.006, r.ema8 * 1.002, r.ema21 * 1.005);
        triggerPrice = sig.action === 'BUY' ? r.close : targetBreakout;
        const diffPct = ((triggerPrice - r.close) / r.close) * 100;
        triggerTypeZh = sig.action === 'BUY' ? '🟢 已達突破買點' : '⚡ 帶量突破追價點';
        triggerConditionZh =
          sig.action === 'BUY'
            ? `現價 NT$${r.close.toFixed(2)} 已站上均線多頭排列且動能達標，立即可順勢建倉`
            : `若股價帶量突破 NT$${triggerPrice.toFixed(2)}（+${Math.abs(diffPct).toFixed(1)}%）站穩 EMA8/21 與 SMA50 即觸發追價買點`;
      } else {
        // Titan buys risk-parity multi-factor setup
        const targetEntry = r.close >= r.sma50 ? r.close * 0.995 : r.sma50 * 1.005;
        triggerPrice = sig.action === 'BUY' ? r.close : targetEntry;
        const diffPct = ((triggerPrice - r.close) / r.close) * 100;
        triggerTypeZh = sig.action === 'BUY' ? '🟢 已達建倉門檻' : '🛡️ 因子共振建倉價';
        triggerConditionZh =
          sig.action === 'BUY'
            ? `多因子評分已跨越 72 分門檻，符合機構核心倉位建倉條件`
            : `站穩 NT$${triggerPrice.toFixed(2)}（距現價 ${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(1)}%）且季線斜率轉強時觸發核心建倉`;
      }

      watchlist.push({
        symbol: r.symbol,
        displayTicker: r.displayTicker,
        nameZh: r.nameZh,
        color: r.color,
        currentPrice: r.close,
        dailyReturnPct: r.dailyReturnPct,
        rsi14: r.rsi14,
        zScore20: r.zScore20,
        sma50: r.sma50,
        traderId: tr.trader.id,
        traderNameZh: tr.trader.nameZh,
        traderBadge: tr.trader.badge,
        traderColor: tr.trader.color,
        action: sig.action,
        conviction: sig.conviction,
        threshold,
        readinessPct,
        triggerPrice,
        triggerDiffPct: ((triggerPrice - r.close) / r.close) * 100,
        triggerTypeZh,
        triggerConditionZh,
        plannedStopLoss: triggerPrice * 0.96,
        plannedTakeProfit: triggerPrice * 1.14
      });
    }
  }

  // Sort by highest readinessPct, deduplicating so each symbol shows its best AI match first
  watchlist.sort((a, b) => b.readinessPct - a.readinessPct || b.conviction - a.conviction);

  const seenSymbols = new Set();
  const topUnique = [];
  for (const item of watchlist) {
    if (seenSymbols.has(item.symbol)) continue;
    seenSymbols.add(item.symbol);
    topUnique.push(item);
    if (topUnique.length >= 6) break;
  }

  return topUnique;
}

/**
 * Generates the Executive AI Daily Portfolio Briefing.
 */
function computeDailyBriefing({
  endDate,
  leaderboard,
  benchmarkTicker,
  benchmarkFinalReturnPct,
  recentWeekOperations,
  top5Promising,
  nextEntryWatchlist,
  latestRadar
}) {
  const champ = leaderboard[0];
  const etfItem = latestRadar.find((r) => r.symbol === '0050') || latestRadar[0];
  const tsmcItem = latestRadar.find((r) => r.symbol === '2330');

  const buyOpsWeek = recentWeekOperations.filter((o) => o.type === 'BUY');
  const sellOpsWeek = recentWeekOperations.filter((o) => o.type === 'SELL');

  const weekSummaryText =
    recentWeekOperations.length > 0
      ? `近一週內 3 位 AI 共執行 ${recentWeekOperations.length} 筆台股操作（${buyOpsWeek.length} 筆買進、${sellOpsWeek.length} 筆賣出）：最新動作包括 ${recentWeekOperations
          .slice(0, 3)
          .map(
            (o) =>
              `【${o.traderNameZh.split(' ')[0]} AI】${o.type === 'BUY' ? '買進' : '賣出'} ${o.displayTicker || o.symbol} (NT$${o.price.toFixed(1)})`
          )
          .join('、')}。`
      : `近一週台股處於高檔震盪，3 位 AI 嚴格執行風控續抱核心部位。`;

  const topPick = top5Promising[0];
  const nextTrigger = nextEntryWatchlist[0];

  return {
    date: endDate,
    marketClimateZh: etfItem
      ? `台股大盤基準 0050 元大台灣50 最新收在 NT$${etfItem.close.toFixed(2)}（區間報酬 ${benchmarkFinalReturnPct >= 0 ? '+' : ''}${benchmarkFinalReturnPct.toFixed(2)}%${tsmcItem ? `，護國神山 2330 台積電收在 NT$${tsmcItem.close.toFixed(0)}` : ''}）。目前領先冠軍為【${champ.trader.nameZh}】，累積報酬率達 ${champ.metrics.totalReturnPct >= 0 ? '+' : ''}${champ.metrics.totalReturnPct.toFixed(2)}%（期末資產 NT$${champ.metrics.finalEquity.toLocaleString('en-US', { maximumFractionDigits: 0 })}）。`
      : '',
    weeklyActionSummaryZh: weekSummaryText,
    topForecastZh: topPick
      ? `每週一自動更新之清單外頭號看多潛力台股為【${topPick.displayTicker}】（AI 綜合看多指數 ${topPick.outlookScore}/100，30日目標價 NT$${topPick.targetPrice30d.toFixed(1)}，潛在空間 +${topPick.projectedUpsidePct.toFixed(1)}%）。`
      : '',
    nextTriggerZh: nextTrigger
      ? `下一檔最接近買點的準進場台股為【${nextTrigger.displayTicker}】（由 ${nextTrigger.traderNameZh} 監控，準備度 ${nextTrigger.readinessPct}%，預計觸發買進價 NT$${nextTrigger.triggerPrice.toFixed(1)}）。`
      : ''
  };
}

/**
 * Runs a focused Single-Asset K-Line Simulation for a selected ticker & AI trader
 * so the user can inspect every exact BUY/SELL arrow on the candlestick chart.
 */
export function runSingleAssetSimulation(
  rawMarketData,
  symbol,
  traderId,
  periodDays = 60,
  options = {}
) {
  const broad = expandBroad(options.broadData);
  const symbolsMap = broad
    ? { ...broad.symbols, ...(rawMarketData.symbols || {}) }
    : rawMarketData.symbols || {};
  const symbolData = symbolsMap[symbol];
  if (!symbolData || !symbolData.bars || !symbolData.bars.length) {
    return null;
  }

  const feeRate = Number(options.feeRate ?? 0.0022);
  const allBars = enrichBarsWithIndicators(symbolData.bars);
  const startIdx = Math.max(0, allBars.length - periodDays);
  const windowBars = allBars.slice(startIdx);

  const spyBars = enrichBarsWithIndicators(symbolsMap[BENCHMARK_SYMBOL]?.bars || []);
  const spyMap = new Map(spyBars.map((b) => [b.date, b]));
  let lastSpyBar = spyBars.filter((b) => b.date <= (windowBars[0]?.date || '')).at(-1) || null;

  let position = null;
  let cooldownUntil = -1;
  const markers = [];
  const roundTrips = [];

  for (let i = 0; i < windowBars.length; i++) {
    const bar = windowBars[i];
    const spyBarToday = spyMap.get(bar.date);
    if (spyBarToday) lastSpyBar = spyBarToday;
    const regime = buildRegime(spyBarToday || lastSpyBar);

    if (position) {
      position.barsHeld += 1;
    }

    const decision = evaluateTraderSignal(traderId, bar, position, regime);

    if (!position && i >= cooldownUntil && decision.action === 'BUY') {
      position = {
        entryIndex: i,
        entryDate: bar.date,
        entryPrice: bar.close,
        highestPrice: bar.close,
        barsHeld: 0,
        stopLoss: decision.stopLossPrice || bar.close * 0.958,
        takeProfit: decision.takeProfitPrice || bar.close * 1.15,
        entryTagZh: decision.tagZh,
        entryTagEn: decision.tagEn,
        entryReasonZh: decision.reasonZh,
        entryReasonEn: decision.reasonEn
      };
      markers.push({
        index: i,
        date: bar.date,
        type: 'BUY',
        price: bar.close,
        stopLoss: position.stopLoss,
        takeProfit: position.takeProfit,
        tagZh: decision.tagZh,
        tagEn: decision.tagEn,
        reasonZh: decision.reasonZh,
        reasonEn: decision.reasonEn
      });
    } else if (position && decision.action === 'SELL') {
      const netExit = bar.close * (1 - feeRate);
      const netEntry = position.entryPrice * (1 + feeRate);
      const pnlPct = ((netExit - netEntry) / netEntry) * 100;
      markers.push({
        index: i,
        date: bar.date,
        type: 'SELL',
        price: bar.close,
        pnlPct,
        barsHeld: position.barsHeld,
        tagZh: decision.tagZh,
        tagEn: decision.tagEn,
        reasonZh: decision.reasonZh,
        reasonEn: decision.reasonEn
      });
      roundTrips.push({
        symbol,
        status: 'CLOSED',
        entryDate: position.entryDate,
        exitDate: bar.date,
        barsHeld: position.barsHeld,
        entryPrice: position.entryPrice,
        exitPrice: bar.close,
        pnlPct,
        entryTagZh: position.entryTagZh,
        entryReasonZh: position.entryReasonZh,
        exitTagZh: decision.tagZh,
        exitReasonZh: decision.reasonZh
      });
      position = null;
      cooldownUntil = i + 2;
    } else if (position) {
      position.highestPrice = Math.max(position.highestPrice, bar.high || bar.close);
    }
  }

  let openPositionSummary = null;
  if (position && windowBars.length > 0) {
    const lastBar = windowBars.at(-1);
    const pnlPct = ((lastBar.close - position.entryPrice) / position.entryPrice) * 100;
    openPositionSummary = {
      ...position,
      status: 'OPEN',
      currentDate: lastBar.date,
      currentPrice: lastBar.close,
      pnlPct
    };
  }

  const assetBuyHoldPct =
    windowBars.length > 1
      ? ((windowBars.at(-1).close - windowBars[0].close) / windowBars[0].close) * 100
      : 0;

  return {
    symbol,
    meta: getAssetMeta(symbol),
    traderId,
    bars: windowBars,
    markers,
    roundTrips: roundTrips.slice().reverse(),
    openPositionSummary,
    assetBuyHoldPct
  };
}


/** Monday (YYYY-MM-DD) of the week containing `date`. */
export function weekStart(date) {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/**
 * Weekly and monthly P&L from an equity curve: each period's P&L = its last equity minus the last equity of the
 * previous period (the first period is measured from the first point, i.e. the baseline day).
 */
export function buildPeriodPnl(curve) {
  const group = (keyFn) => {
    const out = [];
    let prevEnd = curve.length ? curve[0].equity : 0;
    for (const pt of curve) {
      const key = keyFn(pt.date);
      let row = out.at(-1);
      if (!row || row.period !== key) {
        if (row) prevEnd = row.endEquity;
        row = { period: key, startEquity: prevEnd, endEquity: pt.equity, pnl: 0, from: pt.date, to: pt.date };
        out.push(row);
      }
      row.endEquity = pt.equity;
      row.to = pt.date;
      row.pnl = row.endEquity - row.startEquity;
      row.pnlPct = row.startEquity ? (row.pnl / row.startEquity) * 100 : 0;
    }
    return out;
  };
  return { weekly: group(weekStart), monthly: group((d) => d.slice(0, 7)) };
}
