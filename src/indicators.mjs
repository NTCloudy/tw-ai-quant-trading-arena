/**
 * Pure, Strictly Causal Technical Indicator Engine (Zero Look-Ahead Bias)
 * Every indicator at index `i` uses ONLY bars `[0 ... i]`.
 */

export function computeSMA(values, period) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) {
      sum -= values[i - period];
    }
    if (i >= period - 1) {
      out[i] = sum / period;
    }
  }
  return out;
}

export function computeEMA(values, period) {
  const out = new Array(values.length).fill(null);
  if (values.length === 0) return out;
  const k = 2 / (period + 1);
  let ema = values[0];
  out[0] = ema;
  for (let i = 1; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

export function computeRSI(closes, period = 14) {
  const out = new Array(closes.length).fill(50);
  if (closes.length <= period) return out;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;

  const calcRsi = (g, l) => (l === 0 ? 100 : 100 - 100 / (1 + g / l));
  out[period] = calcRsi(avgGain, avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = calcRsi(avgGain, avgLoss);
  }
  return out;
}

export function computeMACD(closes, fast = 12, slow = 26, signalPeriod = 9) {
  const emaFast = computeEMA(closes, fast);
  const emaSlow = computeEMA(closes, slow);
  const macdLine = closes.map((_, i) => (emaFast[i] ?? 0) - (emaSlow[i] ?? 0));
  const signalLine = computeEMA(macdLine, signalPeriod);
  const histogram = macdLine.map((m, i) => m - (signalLine[i] ?? 0));
  return { macdLine, signalLine, histogram };
}

export function computeBollingerBands(closes, period = 20, mult = 2.0) {
  const sma = computeSMA(closes, period);
  const upper = new Array(closes.length).fill(null);
  const lower = new Array(closes.length).fill(null);
  const percentB = new Array(closes.length).fill(0.5);
  const zScore = new Array(closes.length).fill(0);

  for (let i = period - 1; i < closes.length; i++) {
    const mean = sma[i];
    let sqDiffSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = closes[j] - mean;
      sqDiffSum += d * d;
    }
    const std = Math.sqrt(sqDiffSum / period);
    upper[i] = mean + mult * std;
    lower[i] = mean - mult * std;
    const width = upper[i] - lower[i];
    percentB[i] = width > 0 ? (closes[i] - lower[i]) / width : 0.5;
    zScore[i] = std > 0 ? (closes[i] - mean) / std : 0;
  }
  return { middle: sma, upper, lower, percentB, zScore };
}

export function computeATR(bars, period = 14) {
  const out = new Array(bars.length).fill(0);
  if (bars.length === 0) return out;
  const tr = new Array(bars.length).fill(0);
  tr[0] = Math.max(bars[0].high - bars[0].low, bars[0].close * 0.015);
  for (let i = 1; i < bars.length; i++) {
    const hl = bars[i].high - bars[i].low;
    const hc = Math.abs(bars[i].high - bars[i - 1].close);
    const lc = Math.abs(bars[i].low - bars[i - 1].close);
    tr[i] = Math.max(hl, hc, lc);
  }
  let atr = tr[0];
  out[0] = atr;
  for (let i = 1; i < bars.length; i++) {
    if (i < period) {
      atr = (atr * i + tr[i]) / (i + 1);
    } else {
      atr = (atr * (period - 1) + tr[i]) / period;
    }
    out[i] = atr;
  }
  return out;
}

/**
 * Enriches an array of raw OHLCV bars with full causal technical indicators.
 */
export function enrichBarsWithIndicators(bars) {
  if (!bars || bars.length === 0) return [];
  const closes = bars.map((b) => b.close);
  const volumes = bars.map((b) => b.volume || 0);

  const sma8 = computeSMA(closes, 8);
  const sma20 = computeSMA(closes, 20);
  const sma50 = computeSMA(closes, 50);
  const ema8 = computeEMA(closes, 8);
  const ema21 = computeEMA(closes, 21);
  const rsi14 = computeRSI(closes, 14);
  const macd = computeMACD(closes, 12, 26, 9);
  const bb = computeBollingerBands(closes, 20, 2.0);
  const atr14 = computeATR(bars, 14);
  const volSma20 = computeSMA(volumes, 20);

  return bars.map((bar, i) => {
    const prevClose = i > 0 ? closes[i - 1] : bar.close;
    const dailyReturnPct = prevClose > 0 ? ((bar.close - prevClose) / prevClose) * 100 : 0;
    const roc5 =
      i >= 5 && closes[i - 5] > 0 ? ((bar.close - closes[i - 5]) / closes[i - 5]) * 100 : 0;
    const roc10 =
      i >= 10 && closes[i - 10] > 0 ? ((bar.close - closes[i - 10]) / closes[i - 10]) * 100 : 0;
    const roc20 =
      i >= 20 && closes[i - 20] > 0 ? ((bar.close - closes[i - 20]) / closes[i - 20]) * 100 : 0;
    const sma50Current = sma50[i] ?? bar.close;
    const sma50Prev5 = i >= 5 ? (sma50[i - 5] ?? sma50Current) : sma50Current;
    const sma50SlopePct = sma50Prev5 > 0 ? ((sma50Current - sma50Prev5) / sma50Prev5) * 100 : 0;
    const volAvg = volSma20[i] || bar.volume || 1;
    const volRatio = volAvg > 0 ? (bar.volume || 0) / volAvg : 1;
    const atr = atr14[i] || bar.close * 0.02;
    const atrPct = bar.close > 0 ? (atr / bar.close) * 100 : 2;

    // 10-day Donchian high/low (excluding current bar for breakout detection)
    let high10 = bar.high;
    let low10 = bar.low;
    if (i >= 1) {
      const start = Math.max(0, i - 10);
      high10 = -Infinity;
      low10 = Infinity;
      for (let j = start; j < i; j++) {
        if (bars[j].high > high10) high10 = bars[j].high;
        if (bars[j].low < low10) low10 = bars[j].low;
      }
    }

    return {
      ...bar,
      dailyReturnPct,
      sma8: sma8[i] ?? bar.close,
      sma20: sma20[i] ?? bar.close,
      sma50: sma50[i] ?? bar.close,
      ema8: ema8[i] ?? bar.close,
      ema21: ema21[i] ?? bar.close,
      rsi14: rsi14[i] ?? 50,
      prevRsi14: i > 0 ? (rsi14[i - 1] ?? 50) : 50,
      macd: macd.macdLine[i] ?? 0,
      macdSignal: macd.signalLine[i] ?? 0,
      macdHist: macd.histogram[i] ?? 0,
      prevMacdHist: i > 0 ? (macd.histogram[i - 1] ?? 0) : 0,
      bbUpper: bb.upper[i] ?? bar.close * 1.04,
      bbMiddle: bb.middle[i] ?? bar.close,
      bbLower: bb.lower[i] ?? bar.close * 0.96,
      bbPercentB: bb.percentB[i] ?? 0.5,
      zScore20: bb.zScore[i] ?? 0,
      atr14: atr,
      atrPct,
      volRatio,
      roc5,
      roc10,
      roc20,
      sma50SlopePct,
      high10,
      low10
    };
  });
}
