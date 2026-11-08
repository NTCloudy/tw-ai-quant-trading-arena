/**
 * 3 Autonomous AI Quant Traders competing in the Virtual Trading Arena
 * Each trader evaluates real-world OHLCV + Technical Indicators (strictly causal)
 * and outputs concrete BUY / SELL / HOLD / WAIT decisions with full reasoning.
 */

export const AI_TRADERS = [
  {
    id: 'alpha-momentum',
    name: 'Alpha Pulse AI',
    nameZh: 'Alpha 動能突破型 AI',
    titleZh: '強勢領頭羊 ＆ 順勢波段操盤手',
    titleEn: 'Relative-Strength Momentum & Trend Follower',
    badge: '⚡ MOMENTUM',
    color: '#00f0ff',
    secondaryColor: '#0284c7',
    riskLevelZh: '積極進取 (Aggressive)',
    riskLevelEn: 'Aggressive Growth',
    maxPositions: 4,
    baseAllocation: 0.25,
    strategySummaryZh:
      '鎖定站在 50 日生命線之上、20 日相對強度領先大盤且均線多頭排列（EMA8 > EMA21 > SMA50）的台股領頭羊順勢建倉；搭配 ATR 自適應停損與波段衝高鎖利。',
    strategySummaryEn:
      'Captures top relative-strength TWSE leaders above rising SMA50 when EMA8 > EMA21 with adaptive ATR stops and swing profit locks.'
  },
  {
    id: 'sigma-reversion',
    name: 'Sigma Contrarian AI',
    nameZh: 'Sigma 波段抄底型 AI',
    titleZh: '均值回歸 ＆ 布林支撐狙擊手',
    titleEn: 'Mean-Reversion & Pullback Swing Trader',
    badge: '🎯 SWING DIP',
    color: '#a855f7',
    secondaryColor: '#7e22ce',
    riskLevelZh: '波段靈活 (Tactical Swing)',
    riskLevelEn: 'Tactical Mean-Reversion',
    maxPositions: 4,
    baseAllocation: 0.24,
    strategySummaryZh:
      '專精「長多格局下的拉回買點」：雙層 ATR 篩選 50 日均線上揚的強勢台股（含 AI 伺服器、晶圓代工與記憶體），結合 0050 大盤氣候濾網，當短線回測支撐時逢低承接，波段創高收割。',
    strategySummaryEn:
      'Buys tactical pullbacks in structurally rising TWSE leaders (rising SMA50) with 0050 regime defense and wave profit harvesting.'
  },
  {
    id: 'titan-multifactor',
    name: 'Titan Quant AI',
    nameZh: 'Titan 多因子風控型 AI',
    titleZh: '機構級多因子權重 ＆ 長線複利操盤手',
    titleEn: 'Institutional Multi-Factor & Compounding AI',
    badge: '🛡️ MULTI-FACTOR',
    color: '#10b981',
    secondaryColor: '#059669',
    riskLevelZh: '穩健風控 (Risk-Controlled)',
    riskLevelEn: 'Institutional Risk-Parity',
    maxPositions: 4,
    baseAllocation: 0.25,
    strategySummaryZh:
      '結合「季線斜率因子 + 夏普動能比 (ROC20/ATR) + 0050 大盤氣候濾網 + 真・風險平價動態倉位」，自動剔除空頭弱勢股，核心配置高夏普值權值龍頭與高成長半導體。',
    strategySummaryEn:
      'Combines SMA50 slope, risk-adjusted Sharpe momentum (ROC20/ATR), 0050 regime filter, and True Risk-Parity dynamic sizing.'
  }
];

const fmt = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '0.00');
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Evaluates a single asset bar for a given AI Trader.
 */
export function evaluateTraderSignal(traderId, bar, position, regime = { spyBullish: true }) {
  if (traderId === 'alpha-momentum') {
    return evalAlphaMomentum(bar, position, regime);
  }
  if (traderId === 'sigma-reversion') {
    return evalSigmaReversion(bar, position, regime);
  }
  return evalTitanMultiFactor(bar, position, regime);
}

/**
 * Trader 1: Alpha Pulse AI (Relative-Strength Momentum & Trend Follower)
 */
function evalAlphaMomentum(bar, position, regime = { spyBullish: true }) {
  const {
    close,
    ema8,
    ema21,
    sma20,
    sma50,
    sma50SlopePct,
    rsi14,
    prevRsi14,
    macdHist,
    prevMacdHist,
    zScore20,
    roc5,
    roc10,
    roc20,
    atrPct
  } = bar;

  const structuralUptrend = close > sma50 && sma20 >= sma50 * 0.99 && sma50SlopePct >= 0.15;
  const emaBullish = ema8 >= ema21 * 0.998;
  const macdBullish = macdHist > prevMacdHist || macdHist > 0;
  const riskAdjMomentum = atrPct > 0 ? roc20 / atrPct : 0;
  const adaptiveStopPct = clamp(2.2 * atrPct, 4.5, 9.5);
  const stopPct = -adaptiveStopPct;
  const tpPct = 28.0;
  const trailStart = 24.0;
  const trailKeep = 0.6;

  if (position) {
    const pnlPct = ((close - position.entryPrice) / position.entryPrice) * 100;
    const peakPrice = Math.max(position.highestPrice || position.entryPrice, close);
    const peakGainPct = ((peakPrice - position.entryPrice) / position.entryPrice) * 100;

    // 1. Swing Surge Harvest (+45% or +28% when RSI >= 76 / Z-Score >= 2.2)
    if (pnlPct >= 45.0 || (pnlPct >= tpPct && (rsi14 >= 76 || zScore20 >= 2.2))) {
      return {
        action: 'SELL',
        conviction: 93,
        tagZh: `波段衝高達標停利 (+${fmt(pnlPct, 1)}%)`,
        tagEn: `Momentum Target Hit (+${fmt(pnlPct, 1)}%)`,
        reasonZh: `累積報酬達 +${fmt(pnlPct)}%（RSI=${fmt(rsi14, 1)}, Z-Score=${fmt(zScore20, 2)}），短線動能衝上高檔超買區，獲利了結鎖住勝果並釋放資金。`,
        reasonEn: `Position gained +${fmt(pnlPct)}% (RSI=${fmt(rsi14, 1)}, Z=${fmt(zScore20, 2)}); locking in momentum run.`
      };
    }

    // 2. Profit Lock Trailing Stop: once position was up >= 24%, lock in at least 60% of peak gain
    if (peakGainPct >= trailStart && pnlPct <= peakGainPct * trailKeep) {
      return {
        action: 'SELL',
        conviction: 89,
        tagZh: `移動保利出場 (+${fmt(pnlPct, 1)}%)`,
        tagEn: `Trailing Profit Lock (+${fmt(pnlPct, 1)}%)`,
        reasonZh: `曾創波段高點 NT$${fmt(peakPrice)} (+${fmt(peakGainPct, 1)}%)，回檔觸發移動保利防線，鎖住 +${fmt(pnlPct)}% 實質獲利。`,
        reasonEn: `Pulled back from peak NT$${fmt(peakPrice)} (+${fmt(peakGainPct, 1)}%); locking in +${fmt(pnlPct)}% profit.`
      };
    }

    // 3. Trend Breakdown Exit
    if (position.barsHeld >= 3 && close < sma20 * 0.97 && ema8 < ema21) {
      return {
        action: 'SELL',
        conviction: 86,
        tagZh: `跌破月線動能退場 (${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct, 1)}%)`,
        tagEn: `SMA20 Breakdown Exit (${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct, 1)}%)`,
        reasonZh: `收盤價 (NT$${fmt(close)}) 跌破月線 (NT$${fmt(sma20)}) 且 EMA8 下穿 EMA21，短中線動能結束，退場換股。`,
        reasonEn: `Close (NT$${fmt(close)}) broke below SMA20 (NT$${fmt(sma20)}) with EMA8 < EMA21; rotating to stronger leaders.`
      };
    }

    // 4. Adaptive Stop-Loss
    if (pnlPct <= stopPct || close <= position.stopLoss) {
      return {
        action: 'SELL',
        conviction: 95,
        tagZh: `嚴格風控停損 (${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct, 1)}%)`,
        tagEn: `Tight Risk Stop (${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct, 1)}%)`,
        reasonZh: `觸發 -${fmt(adaptiveStopPct, 1)}% 自適應 ATR 風險停損線 (NT$${fmt(position.stopLoss)})，「截斷虧損、讓獲利奔跑」保護組合淨值。`,
        reasonEn: `Triggered strict -${fmt(adaptiveStopPct, 1)}% stop-loss at NT$${fmt(close)} to preserve capital.`
      };
    }

    return {
      action: 'HOLD',
      conviction: 84,
      tagZh: `多頭順勢續抱 (${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct, 1)}%)`,
      tagEn: `Riding Trend (${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct, 1)}%)`,
      reasonZh: `穩守 50日生命線 (NT$${fmt(sma50)}) 之上，季線斜率 +${fmt(sma50SlopePct, 2)}%，浮動損益 ${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct)}%，讓獲利持續奔跑。`,
      reasonEn: `Trend intact above rising SMA50 (NT$${fmt(sma50)}), current PnL ${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct)}%.`
    };
  }

  // Entry evaluation: prioritize high relative-strength leaders in confirmed uptrends
  let score = 0;
  if (structuralUptrend) score += 35;
  if (emaBullish) score += 18;
  if (macdBullish) score += 12;
  if (roc20 >= 6.0) score += Math.min(22, Math.round(riskAdjMomentum * 6));
  else if (roc10 >= 1.0) score += 10;
  if (zScore20 >= -0.7 && zScore20 <= 1.5) score += 10;
  if (rsi14 >= 48 && rsi14 <= 70 && rsi14 >= prevRsi14 - 1) score += 10;
  if (regime?.spyShortTermBull !== false) score += 5;

  if (
    structuralUptrend &&
    emaBullish &&
    macdBullish &&
    roc20 >= 6.0 &&
    atrPct <= 8.5 &&
    zScore20 <= 1.5 &&
    rsi14 >= 48 &&
    rsi14 <= 70 &&
    score >= 74
  ) {
    const stopLoss = close * (1 + stopPct / 100);
    const takeProfit = close * 1.28;
    return {
      action: 'BUY',
      conviction: Math.min(99, score + Math.round(riskAdjMomentum * 3)),
      allocationPct: 0.25,
      stopLossPrice: stopLoss,
      takeProfitPrice: takeProfit,
      tagZh: roc5 > 1.2 ? '強勢領頭羊動能買進' : '季線上揚＋均線多頭建倉',
      tagEn: roc5 > 1.2 ? 'Relative Strength Leader Buy' : 'Rising SMA50 + EMA Bull Buy',
      reasonZh: `股價站穩上揚 50日均線 (NT$${fmt(sma50)}，斜率 +${fmt(sma50SlopePct, 2)}%)，20日動能 +${fmt(roc20, 1)}%、EMA8 > EMA21 且 RSI(14)=${fmt(rsi14, 1)}（綜合動能分 ${score}/100），順勢建倉強勢股（停損 NT$${fmt(stopLoss)}，目標 NT$${fmt(takeProfit)}）。`,
      reasonEn: `Rising SMA50 (NT$${fmt(sma50)}, slope +${fmt(sma50SlopePct, 2)}%), 20D ROC +${fmt(roc20, 1)}%, EMA8 > EMA21, RSI=${fmt(rsi14, 1)}. Score ${score}/100.`
    };
  }

  return {
    action: 'WAIT',
    conviction: Math.min(72, score),
    tagZh: structuralUptrend ? '等待領頭羊訊號' : '空頭結構避開',
    tagEn: structuralUptrend ? 'Awaiting Setup' : 'Below SMA50 Filter',
    reasonZh: structuralUptrend
      ? `目前動能評分 ${score}/100（RSI=${fmt(rsi14, 1)}, 20日漲跌 ${fmt(roc20, 1)}%），距離進場門檻 (74分) 僅差 ${Math.max(1, 74 - score)} 分。`
      : `現價 (NT$${fmt(close)}) 位於 50日均線 (NT$${fmt(sma50)}) 下方或季線走平下彎，趨勢濾網自動避開弱勢標的。`,
    reasonEn: structuralUptrend
      ? `Score ${score}/100 (RSI=${fmt(rsi14, 1)}); waiting for stronger momentum setup.`
      : `Price (NT$${fmt(close)}) is below rising SMA50 (NT$${fmt(sma50)}); avoiding weak trend.`
  };
}

/**
 * Trader 2: Sigma Contrarian AI (Mean-Reversion & Pullback in Secular Uptrend)
 */
function evalSigmaReversion(bar, position, regime = { spyBullish: true }) {
  const {
    close,
    ema8,
    sma20,
    sma50,
    sma50SlopePct,
    rsi14,
    prevRsi14,
    bbUpper,
    bbPercentB,
    zScore20,
    roc5,
    roc20,
    atrPct,
    dailyReturnPct
  } = bar;

  const healthyUptrend =
    close >= sma50 * 0.99 &&
    sma20 >= sma50 * 0.995 &&
    sma50SlopePct >= 0.3 &&
    roc20 >= 4.5 &&
    atrPct <= 8.5;

  const stopPct = -clamp(2.2 * atrPct, 4.2, 9.0);
  const tpTarget = Math.max(28.0, 7.0 * atrPct);

  if (position) {
    const pnlPct = ((close - position.entryPrice) / position.entryPrice) * 100;
    const peakPrice = Math.max(position.highestPrice || position.entryPrice, close);
    const peakGainPct = ((peakPrice - position.entryPrice) / position.entryPrice) * 100;

    // 1. Wave / Reversion Profit Harvest
    if (pnlPct >= tpTarget || (peakGainPct >= 24.0 && pnlPct <= peakGainPct * 0.62)) {
      return {
        action: 'SELL',
        conviction: 91,
        tagZh: `波段反彈達標停利 (+${fmt(pnlPct, 1)}%)`,
        tagEn: `Mean-Reversion Profit (+${fmt(pnlPct, 1)}%)`,
        reasonZh: `股價自回檔支撐強勢反彈創波段高點 NT$${fmt(peakPrice)}（%B=${fmt(bbPercentB * 100, 0)}%, RSI=${fmt(rsi14, 1)}），波段獲利 +${fmt(pnlPct)}% 落袋為安。`,
        reasonEn: `Price rallied from pullback support (%B=${fmt(bbPercentB * 100, 0)}%, RSI=${fmt(rsi14, 1)}); locking in +${fmt(pnlPct)}% swing gain.`
      };
    }

    // 2. Disciplined Stop-Loss or Confirmed Trend Breakdown below SMA50 * 0.96
    const isStop = pnlPct <= stopPct || close <= position.stopLoss;
    const isBreakdown =
      position.barsHeld >= 2 && close < sma50 * 0.96 && dailyReturnPct < 0 && close < ema8;
    if (isStop || isBreakdown) {
      const signedPct = `${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct, 1)}%`;
      return {
        action: 'SELL',
        conviction: 94,
        tagZh: isStop ? `破線保護停損 (${signedPct})` : `跌破季線保護出場 (${signedPct})`,
        tagEn: isStop ? `Swing Stop-Loss (${signedPct})` : `SMA50 Breakdown Exit (${signedPct})`,
        reasonZh: isStop
          ? `跌破 ${fmt(stopPct, 1)}% 波段支撐防線 (NT$${fmt(position.stopLoss)})，果斷執行紀律停損。`
          : `收盤價 (NT$${fmt(close)}) 帶陰跌破 50日均線防線 (NT$${fmt(sma50 * 0.96)})，保護結算部位（${signedPct}）。`,
        reasonEn: isStop
          ? `Pullback violated ${fmt(stopPct, 1)}% support (NT$${fmt(position.stopLoss)}); cutting loss cleanly.`
          : `Confirmed breakdown below SMA50 support; exiting at ${signedPct}.`
      };
    }

    return {
      action: 'HOLD',
      conviction: 78,
      tagZh: `波段反彈續抱 (${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct, 1)}%)`,
      tagEn: `Awaiting Reversion (${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct, 1)}%)`,
      reasonZh: `目前布林位置 %B=${fmt(bbPercentB * 100, 0)}%，持倉浮動損益 ${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct)}%，續抱等待波段創高目標 (NT$${fmt(position.takeProfit)})。`,
      reasonEn: `Holding for wave appreciation toward target (NT$${fmt(position.takeProfit)}).`
    };
  }

  // 0050 Regime Defense Filter
  if (
    regime?.spyBullish === false &&
    regime?.spyShortTermBull === false &&
    sma50SlopePct < 0.6
  ) {
    return {
      action: 'WAIT',
      conviction: 40,
      tagZh: '0050 大盤弱勢防守觀望',
      tagEn: '0050 Regime Defense Filter',
      reasonZh: `目前 0050 大盤氣候處於短中線整理且個股季線斜率 (+${fmt(sma50SlopePct, 2)}%) 未達抗跌門檻，嚴格保護資金不逆勢抄底。`,
      reasonEn: `0050 benchmark regime is weak and SMA50 slope (+${fmt(sma50SlopePct, 2)}%) is below defense threshold.`
    };
  }

  // Dip Entry conditions inside healthy uptrend
  let score = 0;
  if (healthyUptrend) score += 36;
  if (roc20 >= 0) score += 10;

  if (zScore20 <= -0.6 || bbPercentB <= 0.34) score += 28;
  else if (zScore20 <= 0.95 || bbPercentB <= 0.65) score += 18;

  if (rsi14 <= 48) score += 18;
  else if (rsi14 <= 64 && (rsi14 >= prevRsi14 - 0.5 || dailyReturnPct >= 0)) score += 12;

  if (roc5 <= 0.8) score += 10;

  if (healthyUptrend && score >= 70 && zScore20 <= 0.95 && rsi14 >= 42 && rsi14 <= 64) {
    const alloc =
      regime?.spyBullish === false && regime?.spyShortTermBull === false ? 0.16 : 0.24;
    const stopLoss = close * (1 + stopPct / 100);
    const takeProfit = Math.max(bbUpper * 1.05, close * (1 + tpTarget / 100));
    return {
      action: 'BUY',
      conviction: Math.min(97, score + Math.round(sma50SlopePct * 4)),
      allocationPct: alloc,
      stopLossPrice: stopLoss,
      takeProfitPrice: takeProfit,
      tagZh: `多頭回測支撐逢低買進`,
      tagEn: `Uptrend Pullback Buy (Z=${fmt(zScore20, 2)})`,
      reasonZh: `長線 50日均強勢上揚（SMA50 NT$${fmt(sma50)}，斜率 +${fmt(sma50SlopePct, 2)}%），短線回測支撐區（Z-Score=${fmt(zScore20, 2)}, %B=${fmt(bbPercentB * 100, 0)}%, RSI=${fmt(rsi14, 1)}），逢低進場承接（目標 NT$${fmt(takeProfit)}，停損 NT$${fmt(stopLoss)}）。`,
      reasonEn: `Healthy pullback inside rising SMA50 uptrend (Z=${fmt(zScore20, 2)}, RSI=${fmt(rsi14, 1)}). Buying dip targeting NT$${fmt(takeProfit)}.`
    };
  }

  return {
    action: 'WAIT',
    conviction: Math.min(68, score),
    tagZh: healthyUptrend ? '等待拉回買點' : '弱勢結構不接刀',
    tagEn: healthyUptrend ? 'Waiting for Dip' : 'Downtrend Avoided',
    reasonZh: healthyUptrend
      ? `目前 Z-Score=${fmt(zScore20, 2)}、RSI(14)=${fmt(rsi14, 1)}（抄底準備度 ${score}/70），等待小幅拉回支撐即可觸發買點。`
      : `中長線均線下彎或波動過劇（現價 NT$${fmt(close)} vs SMA50 NT$${fmt(sma50)}），嚴守「不接下跌刀」原則空手觀望。`,
    reasonEn: healthyUptrend
      ? `Z-Score=${fmt(zScore20, 2)}, RSI=${fmt(rsi14, 1)}; waiting for a pullback entry.`
      : `Below rising SMA50 (NT$${fmt(sma50)}); avoiding falling knife.`
  };
}

/**
 * Trader 3: Titan Quant AI (Institutional Multi-Factor & Compounding Leader)
 */
function evalTitanMultiFactor(bar, position, regime = { spyBullish: true }) {
  const {
    close,
    ema8,
    ema21,
    sma20,
    sma50,
    sma50SlopePct,
    rsi14,
    prevRsi14,
    macdHist,
    prevMacdHist,
    bbUpper,
    bbPercentB,
    zScore20,
    roc10,
    roc20,
    atrPct
  } = bar;

  const structuralUptrend = close > sma50 && sma20 >= sma50 * 0.995 && sma50SlopePct >= 0.22;
  const sharpeMomentum = atrPct > 0 ? roc20 / atrPct : 0;
  const stopPct = clamp(2.2 * atrPct, 4.2, 9.5);
  const tp1 = Math.max(24.0, 2.8 * stopPct);

  const trendScore = structuralUptrend ? 30 + (ema8 >= ema21 * 0.995 ? 10 : 0) : 0;
  const momScore =
    sharpeMomentum >= 1.2 ? Math.min(25, Math.round(sharpeMomentum * 8)) : roc10 >= 0.5 ? 12 : 0;
  const valueEntryScore =
    zScore20 <= -0.35 ? 25 : zScore20 <= 0.35 ? 18 : zScore20 <= 1.4 ? 8 : 0;
  const oscillatorScore =
    rsi14 >= 42 && rsi14 <= 66 && (macdHist >= prevMacdHist || rsi14 >= prevRsi14 - 1) ? 15 : 0;
  const riskScore = atrPct <= 3.2 ? 14 : atrPct <= 8.5 && sharpeMomentum >= 1.1 ? 11 : 0;
  const regimeBonus = regime?.spyBullish !== false ? 5 : 0;
  const compositeScore =
    trendScore + momScore + valueEntryScore + oscillatorScore + riskScore + regimeBonus;

  if (position) {
    const pnlPct = ((close - position.entryPrice) / position.entryPrice) * 100;
    const peakPrice = Math.max(position.highestPrice || position.entryPrice, close);
    const peakGainPct = ((peakPrice - position.entryPrice) / position.entryPrice) * 100;

    // 1. Harvest institutional compound gain
    if (
      (pnlPct >= tp1 && (zScore20 >= 1.5 || rsi14 >= 72 || bbPercentB >= 0.92)) ||
      pnlPct >= 40.0 ||
      (peakGainPct >= 24.0 && pnlPct <= peakGainPct * 0.6)
    ) {
      return {
        action: 'SELL',
        conviction: 92,
        tagZh: `機構複利達標出場 (+${fmt(pnlPct, 1)}%)`,
        tagEn: `Compound Target Lock (+${fmt(pnlPct, 1)}%)`,
        reasonZh: `持倉累積報酬達 +${fmt(pnlPct)}%（波段最高 +${fmt(peakGainPct, 1)}%, Z-Score=${fmt(zScore20, 2)}），觸發機構對稱風報比保利機制，鎖定實質複利戰果。`,
        reasonEn: `Position gained +${fmt(pnlPct)}% (peak +${fmt(peakGainPct, 1)}%); harvesting institutional gain.`
      };
    }

    // 2. Exit when structural trend breaks or adaptive ATR stop-loss
    const isStop = pnlPct <= -stopPct || close <= position.stopLoss;
    const isTrendBreak = position.barsHeld >= 4 && close < sma50 * 0.97 && sma50SlopePct < 0;
    if (isStop || isTrendBreak) {
      const signedPct = `${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct, 1)}%`;
      return {
        action: 'SELL',
        conviction: 95,
        tagZh: isStop ? `風控模型停損 (${signedPct})` : `趨勢因子轉弱換股 (${signedPct})`,
        tagEn: isStop ? `Risk-Parity Stop (${signedPct})` : `Factor Rotation Exit (${signedPct})`,
        reasonZh: isStop
          ? `觸發 -${fmt(stopPct, 1)}% 機構 ATR 風控停損線 (NT$${fmt(position.stopLoss)})，嚴格控制最大回撤。`
          : `跌破 50日均線且季線翻空（多因子評分 ${compositeScore}/100），結算部位（${signedPct}）轉往強勢因子標的。`,
        reasonEn: `Trend factor weakened below SMA50 or hit -${fmt(stopPct, 1)}% stop; rotating capital at ${signedPct}.`
      };
    }

    return {
      action: 'HOLD',
      conviction: Math.max(75, Math.min(95, compositeScore)),
      tagZh: `核心因子續抱 (${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct, 1)}%)`,
      tagEn: `Core Factor Hold (${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct, 1)}%)`,
      reasonZh: `多因子綜合得分 ${compositeScore}/100（趨勢 ${trendScore}、動能 ${momScore}、價值 ${valueEntryScore}、低波 ${riskScore}），穩守上升趨勢長線複利續抱。`,
      reasonEn: `Composite score ${compositeScore}/100 above rising SMA50; compounding core position.`
    };
  }

  // Entry evaluation: require rising structural trend + high Sharpe momentum + True Risk-Parity sizing
  if (
    structuralUptrend &&
    roc20 >= 4.6 &&
    atrPct <= 8.5 &&
    compositeScore >= 72 &&
    zScore20 <= 1.4
  ) {
    const alloc = clamp(0.015 / (stopPct / 100), 0.14, 0.25);
    const stopLoss = close * (1 - stopPct / 100);
    const takeProfit = Math.max(bbUpper * 1.05, close * (1 + tp1 / 100));

    return {
      action: 'BUY',
      conviction: Math.min(99, compositeScore + Math.round(sharpeMomentum * 2)),
      allocationPct: alloc,
      stopLossPrice: stopLoss,
      takeProfitPrice: takeProfit,
      tagZh: `多因子核心建倉 (${compositeScore}分)`,
      tagEn: `Multi-Factor Core Buy (${compositeScore}/100)`,
      reasonZh: `多因子評分達 ${compositeScore}/100（夏普動能比 ${fmt(sharpeMomentum, 2)}、季線斜率 +${fmt(sma50SlopePct, 2)}%、ATR ${fmt(atrPct, 1)}%），以真・風險平價動態配置 ${fmt(alloc * 100, 0)}% 核心部位（停損 NT$${fmt(stopLoss)}，目標 NT$${fmt(takeProfit)}）。`,
      reasonEn: `Composite factor score ${compositeScore}/100 (SharpeMom ${fmt(sharpeMomentum, 2)}); entering ${fmt(alloc * 100, 0)}% risk-parity position.`
    };
  }

  return {
    action: 'WAIT',
    conviction: Math.min(72, compositeScore),
    tagZh: `因子觀望 (${compositeScore}分)`,
    tagEn: `Factor Neutral (${compositeScore}/100)`,
    reasonZh: `多因子綜合評分 ${compositeScore}/100（建倉門檻 72 分），維持現金部位等待高勝率共振。`,
    reasonEn: `Composite score ${compositeScore}/100 below 72 threshold; preserving cash.`
  };
}
