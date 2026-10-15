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
      '鎖定站在 50 日生命線之上、20 日相對強度領先大盤且均線多頭排列（EMA8 > EMA21 > SMA50）的領頭羊順勢建倉；波段衝高鎖利、跌破支撐果斷換股。',
    strategySummaryEn:
      'Captures top relative-strength leaders above rising SMA50 when EMA8 > EMA21; cuts losers fast and locks in swing surges.'
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
      '專精「長多格局下的拉回買點」：篩選 50 日均線上揚的強勢資產（含 AI 晶片、DRAM 與科技巨頭），當短線回測布林下軌支撐時逢低承接，反彈創高分批收割。',
    strategySummaryEn:
      'Buys tactical pullbacks in structurally rising assets (rising SMA50) when price dips toward Bollinger support and rebounds to the upper band.'
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
      '結合「季線斜率因子 + 夏普動能比 (ROC20/ATR) + SPY 大盤氣候濾網」，自動剔除空頭弱勢股，核心配置高夏普值科技巨頭、半導體與避險資產。',
    strategySummaryEn:
      'Combines SMA50 slope, risk-adjusted Sharpe momentum (ROC20/ATR), and an SPY regime filter to compound capital in secular winners.'
  }
];

const fmt = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '0.00');

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
function evalAlphaMomentum(bar, position, regime) {
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

  if (position) {
    const pnlPct = ((close - position.entryPrice) / position.entryPrice) * 100;
    const peakPrice = Math.max(position.highestPrice || position.entryPrice, close);
    const peakGainPct = ((peakPrice - position.entryPrice) / position.entryPrice) * 100;

    // 1. Swing Surge Harvest (+28% or +6.8% when RSI >= 67 / Z-Score >= 1.75)
    if (
      pnlPct >= 28.0 ||
      (pnlPct >= 6.8 && (rsi14 >= 67 || zScore20 >= 1.75))
    ) {
      return {
        action: 'SELL',
        conviction: 93,
        tagZh: `波段衝高達標停利 (+${fmt(pnlPct, 1)}%)`,
        tagEn: `Momentum Target Hit (+${fmt(pnlPct, 1)}%)`,
        reasonZh: `累積報酬達 +${fmt(pnlPct)}%（RSI=${fmt(rsi14, 1)}, Z-Score=${fmt(zScore20, 2)}），短線動能衝上高檔超買區，獲利了結鎖住勝果並釋放資金。`,
        reasonEn: `Position gained +${fmt(pnlPct)}% (RSI=${fmt(rsi14, 1)}, Z=${fmt(zScore20, 2)}); locking in momentum run.`
      };
    }

    // 2. Profit Lock Trailing Stop: once position was up >= 10%, lock in at least 58% of peak gain
    if (peakGainPct >= 10.0 && pnlPct <= peakGainPct * 0.58) {
      return {
        action: 'SELL',
        conviction: 89,
        tagZh: `移動保利出場 (+${fmt(pnlPct, 1)}%)`,
        tagEn: `Trailing Profit Lock (+${fmt(pnlPct, 1)}%)`,
        reasonZh: `曾創波段高點 $${fmt(peakPrice)} (+${fmt(peakGainPct, 1)}%)，回檔觸發移動保利防線，鎖住 +${fmt(pnlPct)}% 實質獲利。`,
        reasonEn: `Pulled back from peak $${fmt(peakPrice)} (+${fmt(peakGainPct, 1)}%); locking in +${fmt(pnlPct)}% profit.`
      };
    }

    // 3. Trend Breakdown Exit
    if (position.barsHeld >= 5 && close < sma50 * 0.975 && sma50SlopePct < -0.1 && ema8 < ema21) {
      return {
        action: 'SELL',
        conviction: 86,
        tagZh: `跌破季線結構退場 (${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct, 1)}%)`,
        tagEn: `SMA50 Breakdown Exit (${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct, 1)}%)`,
        reasonZh: `收盤價 ($${fmt(close)}) 跌破 50日生命線 ($${fmt(sma50)}) 且季線翻空，中長線趨勢結束，退場換股。`,
        reasonEn: `Close ($${fmt(close)}) broke below SMA50 ($${fmt(sma50)}) with negative slope; rotating to stronger leaders.`
      };
    }

    // 4. Disciplined Stop-Loss (-4.2%)
    if (pnlPct <= -4.2 || close <= position.stopLoss) {
      return {
        action: 'SELL',
        conviction: 95,
        tagZh: `嚴格風控停損 (${fmt(pnlPct, 1)}%)`,
        tagEn: `Tight Risk Stop (${fmt(pnlPct, 1)}%)`,
        reasonZh: `觸發 -4.2% 嚴格風險停損線 ($${fmt(position.stopLoss)})，「截斷虧損、讓獲利奔跑」保護組合淨值。`,
        reasonEn: `Triggered strict -4.2% stop-loss at $${fmt(close)} to preserve capital.`
      };
    }

    return {
      action: 'HOLD',
      conviction: 84,
      tagZh: `多頭順勢續抱 (${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct, 1)}%)`,
      tagEn: `Riding Trend (${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct, 1)}%)`,
      reasonZh: `穩守 50日生命線 ($${fmt(sma50)}) 之上，季線斜率 +${fmt(sma50SlopePct, 2)}%，浮動損益 ${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct)}%，讓獲利持續奔跑。`,
      reasonEn: `Trend intact above rising SMA50 ($${fmt(sma50)}), current PnL ${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct)}%.`
    };
  }

  // Entry evaluation: prioritize high relative-strength leaders in confirmed uptrends
  let score = 0;
  if (structuralUptrend) score += 35;
  if (emaBullish) score += 18;
  if (macdBullish) score += 12;
  if (roc20 >= 2.0) score += Math.min(22, Math.round(riskAdjMomentum * 6));
  else if (roc10 >= 1.0) score += 10;
  if (zScore20 >= -0.7 && zScore20 <= 1.1) score += 10;
  if (rsi14 >= 46 && rsi14 <= 65 && rsi14 >= prevRsi14 - 1) score += 10;
  if (regime.spyShortTermBull) score += 5;

  if (structuralUptrend && emaBullish && atrPct <= 3.7 && score >= 74 && rsi14 <= 66) {
    const stopLoss = close * 0.958;
    const takeProfit = close * 1.16;
    return {
      action: 'BUY',
      conviction: Math.min(99, score),
      allocationPct: 0.25,
      stopLossPrice: stopLoss,
      takeProfitPrice: takeProfit,
      tagZh: roc5 > 1.2 ? '強勢領頭羊動能買進' : '季線上揚＋均線多頭建倉',
      tagEn: roc5 > 1.2 ? 'Relative Strength Leader Buy' : 'Rising SMA50 + EMA Bull Buy',
      reasonZh: `股價站穩上揚 50日均線 ($${fmt(sma50)}，斜率 +${fmt(sma50SlopePct, 2)}%)，20日動能 +${fmt(roc20, 1)}%、EMA8 > EMA21 且 RSI(14)=${fmt(rsi14, 1)}（綜合動能分 ${score}/100），順勢建倉強勢股（停損 $${fmt(stopLoss)}，目標 $${fmt(takeProfit)}）。`,
      reasonEn: `Rising SMA50 ($${fmt(sma50)}, slope +${fmt(sma50SlopePct, 2)}%), 20D ROC +${fmt(roc20, 1)}%, EMA8 > EMA21, RSI=${fmt(rsi14, 1)}. Score ${score}/100.`
    };
  }

  return {
    action: 'WAIT',
    conviction: Math.min(72, score),
    tagZh: structuralUptrend ? '等待領頭羊訊號' : '空頭結構避開',
    tagEn: structuralUptrend ? 'Awaiting Setup' : 'Below SMA50 Filter',
    reasonZh: structuralUptrend
      ? `目前動能評分 ${score}/100（RSI=${fmt(rsi14, 1)}, 20日漲跌 ${fmt(roc20, 1)}%），距離進場門檻 (74分) 僅差 ${Math.max(1, 74 - score)} 分。`
      : `現價 ($${fmt(close)}) 位於 50日均線 ($${fmt(sma50)}) 下方或季線走平下彎，趨勢濾網自動避開弱勢標的。`,
    reasonEn: structuralUptrend
      ? `Score ${score}/100 (RSI=${fmt(rsi14, 1)}); waiting for stronger momentum setup.`
      : `Price ($${fmt(close)}) is below rising SMA50 ($${fmt(sma50)}); avoiding weak trend.`
  };
}

/**
 * Trader 2: Sigma Contrarian AI (Mean-Reversion & Pullback in Secular Uptrend)
 */
function evalSigmaReversion(bar, position) {
  const {
    close,
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
    close >= sma50 * 0.98 && sma20 >= sma50 * 0.995 && sma50SlopePct >= 0.15 && atrPct <= 4.1;

  if (position) {
    const pnlPct = ((close - position.entryPrice) / position.entryPrice) * 100;

    // 1. Reversion to Upper Band / Swing Profit Harvest
    if (
      (pnlPct >= 5.5 && (bbPercentB >= 0.85 || rsi14 >= 66)) ||
      pnlPct >= 14.0 ||
      (position.barsHeld >= 5 && close >= bbUpper * 1.002 && pnlPct >= 3.8)
    ) {
      return {
        action: 'SELL',
        conviction: 91,
        tagZh: `波段反彈達標停利 (+${fmt(pnlPct, 1)}%)`,
        tagEn: `Mean-Reversion Profit (+${fmt(pnlPct, 1)}%)`,
        reasonZh: `股價自回檔支撐強勢反彈至布林通道上軌區（%B=${fmt(bbPercentB * 100, 0)}%, RSI=${fmt(rsi14, 1)}），波段獲利 +${fmt(pnlPct)}% 落袋為安。`,
        reasonEn: `Price reverted to upper Bollinger zone (%B=${fmt(bbPercentB * 100, 0)}%, RSI=${fmt(rsi14, 1)}); locking in +${fmt(pnlPct)}% swing gain.`
      };
    }

    // 2. Disciplined Stop-Loss (-3.8% or trend breakdown below SMA50 * 0.96)
    if (pnlPct <= -3.8 || close <= position.stopLoss || close < sma50 * 0.96) {
      return {
        action: 'SELL',
        conviction: 94,
        tagZh: `破線保護停損 (${fmt(pnlPct, 1)}%)`,
        tagEn: `Swing Stop-Loss (${fmt(pnlPct, 1)}%)`,
        reasonZh: `跌破 -3.8% 波段支撐防線 ($${fmt(position.stopLoss)}) 或季線失守，果斷執行紀律停損。`,
        reasonEn: `Pullback violated -3.8% support ($${fmt(position.stopLoss)}); cutting loss cleanly.`
      };
    }

    return {
      action: 'HOLD',
      conviction: 78,
      tagZh: `波段反彈續抱 (${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct, 1)}%)`,
      tagEn: `Awaiting Reversion (${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct, 1)}%)`,
      reasonZh: `目前布林位置 %B=${fmt(bbPercentB * 100, 0)}%，持倉浮動損益 ${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct)}%，續抱等待挑戰布林上軌 ($${fmt(bbUpper)})。`,
      reasonEn: `Holding for mean reversion toward upper Bollinger band ($${fmt(bbUpper)}).`
    };
  }

  // Dip Entry conditions inside healthy uptrend
  let score = 0;
  if (healthyUptrend) score += 36;
  if (roc20 >= 0) score += 10;

  if (zScore20 <= -0.6 || bbPercentB <= 0.34) score += 28;
  else if (zScore20 <= 0.05 || bbPercentB <= 0.5) score += 18;

  if (rsi14 <= 48) score += 18;
  else if (rsi14 <= 55 && (rsi14 >= prevRsi14 - 0.5 || dailyReturnPct >= 0)) score += 12;

  if (roc5 <= 0.4) score += 10;

  if (healthyUptrend && score >= 70) {
    const stopLoss = close * 0.962;
    const takeProfit = Math.max(bbUpper * 1.02, close * 1.095);
    return {
      action: 'BUY',
      conviction: Math.min(97, score + Math.round(sma50SlopePct * 4)),
      allocationPct: 0.25,
      stopLossPrice: stopLoss,
      takeProfitPrice: takeProfit,
      tagZh: `多頭回測支撐逢低買進`,
      tagEn: `Uptrend Pullback Buy (Z=${fmt(zScore20, 2)})`,
      reasonZh: `長線 50日均強勢上揚（SMA50 $${fmt(sma50)}，斜率 +${fmt(sma50SlopePct, 2)}%），短線回測支撐區（Z-Score=${fmt(zScore20, 2)}, %B=${fmt(bbPercentB * 100, 0)}%, RSI=${fmt(rsi14, 1)}），逢低進場承接（目標 $${fmt(takeProfit)}，停損 $${fmt(stopLoss)}）。`,
      reasonEn: `Healthy pullback inside rising SMA50 uptrend (Z=${fmt(zScore20, 2)}, RSI=${fmt(rsi14, 1)}). Buying dip targeting $${fmt(takeProfit)}.`
    };
  }

  return {
    action: 'WAIT',
    conviction: Math.min(68, score),
    tagZh: healthyUptrend ? '等待拉回買點' : '弱勢結構不接刀',
    tagEn: healthyUptrend ? 'Waiting for Dip' : 'Downtrend Avoided',
    reasonZh: healthyUptrend
      ? `目前 Z-Score=${fmt(zScore20, 2)}、RSI(14)=${fmt(rsi14, 1)}（抄底準備度 ${score}/70），等待小幅拉回支撐即可觸發買點。`
      : `中長線均線下彎或波動過劇（現價 $${fmt(close)} vs SMA50 $${fmt(sma50)}），嚴守「不接下跌刀」原則空手觀望。`,
    reasonEn: healthyUptrend
      ? `Z-Score=${fmt(zScore20, 2)}, RSI=${fmt(rsi14, 1)}; waiting for a pullback entry.`
      : `Below rising SMA50 ($${fmt(sma50)}); avoiding falling knife.`
  };
}

/**
 * Trader 3: Titan Quant AI (Institutional Multi-Factor & Compounding Leader)
 */
function evalTitanMultiFactor(bar, position, regime) {
  const {
    close,
    ema8,
    ema21,
    sma20,
    sma50,
    sma50SlopePct,
    rsi14,
    zScore20,
    roc20,
    atrPct
  } = bar;

  // Institutional Composite Factor Score (0 - 100)
  // Factor 1: Secular Trend & SMA50 Slope (0 - 45)
  let trendScore = 0;
  if (close > sma50) trendScore += 15;
  if (sma20 >= sma50) trendScore += 15;
  if (sma50SlopePct >= 0.25) trendScore += 15;
  else if (sma50SlopePct >= 0.05) trendScore += 8;

  // Factor 2: Risk-Adjusted Relative Strength (Sharpe Momentum = ROC20 / ATR%) (0 - 35)
  const sharpeMom = atrPct > 0 ? roc20 / atrPct : 0;
  let momScore = 0;
  if (sharpeMom >= 1.5) momScore += 22;
  else if (sharpeMom >= 0.5) momScore += 14;
  else if (sharpeMom >= 0) momScore += 8;
  if (ema8 >= ema21 * 0.995) momScore += 13;

  // Factor 3: Low-Volatility Quality (0 - 20)
  let riskScore = 0;
  if (atrPct <= 2.6) riskScore += 14;
  else if (atrPct <= 3.8) riskScore += 9;
  if (rsi14 >= 45 && rsi14 <= 68) riskScore += 6;

  const compositeScore = trendScore + momScore + riskScore + (regime.spyBullish ? 4 : -4);

  if (position) {
    const pnlPct = ((close - position.entryPrice) / position.entryPrice) * 100;
    const peakPrice = Math.max(position.highestPrice || position.entryPrice, close);
    const peakGainPct = ((peakPrice - position.entryPrice) / position.entryPrice) * 100;

    // 1. Harvest institutional compound gain (+32% or +7.2% when Z-Score >= 1.85 / RSI >= 70, or trailing profit lock)
    if (
      pnlPct >= 32.0 ||
      (pnlPct >= 7.2 && (zScore20 >= 1.85 || rsi14 >= 70)) ||
      (peakGainPct >= 12.0 && pnlPct <= peakGainPct * 0.62)
    ) {
      return {
        action: 'SELL',
        conviction: 91,
        tagZh: `機構複利達標出場 (+${fmt(pnlPct, 1)}%)`,
        tagEn: `Compound Target Lock (+${fmt(pnlPct, 1)}%)`,
        reasonZh: `持倉累積報酬達 +${fmt(pnlPct)}%（波段最高 +${fmt(peakGainPct, 1)}%, Z-Score=${fmt(zScore20, 2)}），觸發機構保利機制，鎖定實質複利戰果。`,
        reasonEn: `Position gained +${fmt(pnlPct)}% (peak +${fmt(peakGainPct, 1)}%); harvesting institutional gain.`
      };
    }

    // 2. Exit when structural trend breaks (close < sma50 * 0.975 and sma20 < sma50) or tight risk stop (-4.0%)
    if (
      (position.barsHeld >= 5 && close < sma50 * 0.975 && sma20 < sma50) ||
      pnlPct <= -4.0 ||
      close <= position.stopLoss
    ) {
      const isStop = pnlPct <= -4.0 || close <= position.stopLoss;
      return {
        action: 'SELL',
        conviction: 89,
        tagZh: isStop
          ? `風控模型停損 (${fmt(pnlPct, 1)}%)`
          : `趨勢因子轉弱換股 (${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct, 1)}%)`,
        tagEn: isStop
          ? `Risk-Parity Stop (${fmt(pnlPct, 1)}%)`
          : `Factor Rotation Exit (${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct, 1)}%)`,
        reasonZh: isStop
          ? `觸發 -4.0% 機構風控停損線 ($${fmt(position.stopLoss)})，嚴格控制最大回撤。`
          : `跌破 50日均線且中線結構轉弱（多因子評分 ${compositeScore}/100），結算部位（${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct)}%）轉往強勢因子標的。`,
        reasonEn: `Trend factor weakened below SMA50 or hit -4.0% stop; rotating capital at ${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct)}%.`
      };
    }

    return {
      action: 'HOLD',
      conviction: Math.max(75, compositeScore),
      tagZh: `核心因子續抱 (${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct, 1)}%)`,
      tagEn: `Core Factor Hold (${pnlPct >= 0 ? '+' : ''}${fmt(pnlPct, 1)}%)`,
      reasonZh: `多因子綜合得分 ${compositeScore}/100（趨勢 ${trendScore}/45、夏普動能 ${momScore}/35、低波品質 ${riskScore}/20），穩守上升趨勢長線複利續抱。`,
      reasonEn: `Composite score ${compositeScore}/100 above rising SMA50; compounding core position.`
    };
  }

  // Entry evaluation: require rising structural trend + high Sharpe momentum + low/moderate ATR
  if (close > sma50 && sma50SlopePct >= 0.1 && atrPct <= 3.8 && compositeScore >= 72 && zScore20 <= 1.1) {
    const stopLoss = close * 0.96;
    const takeProfit = close * 1.18;

    return {
      action: 'BUY',
      conviction: Math.min(99, compositeScore + Math.round(sharpeMom * 3)),
      allocationPct: 0.25,
      stopLossPrice: stopLoss,
      takeProfitPrice: takeProfit,
      tagZh: `多因子核心建倉 (${compositeScore}分)`,
      tagEn: `Multi-Factor Core Buy (${compositeScore}/100)`,
      reasonZh: `多因子評分達 ${compositeScore}/100（趨勢 ${trendScore}/45、夏普動能 ${momScore}/35、低波品質 ${riskScore}/20），季線斜率 +${fmt(sma50SlopePct, 2)}% 且 ATR 波動率 ${fmt(atrPct, 1)}%，建倉 25% 核心部位（停損 $${fmt(stopLoss)}，目標 $${fmt(takeProfit)}）。`,
      reasonEn: `Composite factor score ${compositeScore}/100 (Trend ${trendScore}, Mom ${momScore}, Risk ${riskScore}); entering 25% core position.`
    };
  }

  return {
    action: 'WAIT',
    conviction: Math.max(20, compositeScore),
    tagZh: `因子觀望 (${compositeScore}分)`,
    tagEn: `Factor Neutral (${compositeScore}/100)`,
    reasonZh: `多因子綜合評分 ${compositeScore}/100（建倉門檻 72 分），維持現金部位等待高勝率共振。`,
    reasonEn: `Composite score ${compositeScore}/100 below 72 threshold; preserving cash.`
  };
}
