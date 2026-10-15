/**
 * Real-World Taiwan Stock Exchange (TWSE) Universe (台股權值龍頭、AI 伺服器、IC 設計、DRAM 記憶體、金融航運與國民 ETF)
 * All symbols map to Yahoo Finance .TW tickers for real daily OHLCV market data in TWD (NT$).
 */
export const ASSET_UNIVERSE = [
  {
    symbol: '2330',
    yahooSymbol: '2330.TW',
    displayTicker: '2330 台積電',
    name: 'TSMC (2330.TW)',
    nameZh: '台積電 (護國神山)',
    category: 'tw-semi',
    subSector: 'semi',
    sector: 'Foundry & CoWoS Leader',
    sectorZh: '全球晶圓代工與 CoWoS 獨佔龍頭',
    color: '#ef4444',
    lotStep: 1
  },
  {
    symbol: '2317',
    yahooSymbol: '2317.TW',
    displayTicker: '2317 鴻海',
    name: 'Hon Hai Precision (2317.TW)',
    nameZh: '鴻海 (AI 伺服器機櫃霸主)',
    category: 'tw-ai',
    subSector: 'ai-server',
    sector: 'AI Server & EV EMS Leader',
    sectorZh: 'GB200 AI 伺服器機櫃與組裝龍頭',
    color: '#3b82f6',
    lotStep: 1
  },
  {
    symbol: '2454',
    yahooSymbol: '2454.TW',
    displayTicker: '2454 聯發科',
    name: 'MediaTek Inc. (2454.TW)',
    nameZh: '聯發科 (IC 設計龍頭)',
    category: 'tw-semi',
    subSector: 'semi',
    sector: 'Edge AI & Mobile SoC',
    sectorZh: '邊緣 AI 晶片與旗艦天璣 SoC 霸主',
    color: '#f59e0b',
    lotStep: 1
  },
  {
    symbol: '2382',
    yahooSymbol: '2382.TW',
    displayTicker: '2382 廣達',
    name: 'Quanta Computer (2382.TW)',
    nameZh: '廣達 (雲端 AI 伺服器龍頭)',
    category: 'tw-ai',
    subSector: 'ai-server',
    sector: 'Cloud AI Server ODM',
    sectorZh: '四大雲端 CSP 廠 AI 伺服器代工首選',
    color: '#10b981',
    lotStep: 1
  },
  {
    symbol: '2308',
    yahooSymbol: '2308.TW',
    displayTicker: '2308 台達電',
    name: 'Delta Electronics (2308.TW)',
    nameZh: '台達電 (AI 電源與散熱霸主)',
    category: 'tw-ai',
    subSector: 'ai-server',
    sector: 'AI Power & Liquid Cooling',
    sectorZh: 'AI 資料中心高壓電源與液冷散熱龍頭',
    color: '#06b6d4',
    lotStep: 1
  },
  {
    symbol: '3017',
    yahooSymbol: '3017.TW',
    displayTicker: '3017 奇鋐',
    name: 'Asia Vital Components (3017.TW)',
    nameZh: '奇鋐 (AI 水冷散熱龍頭)',
    category: 'tw-ai',
    subSector: 'ai-server',
    sector: 'Liquid Cooling & 3D VC',
    sectorZh: 'AI 伺服器水冷板與風扇散熱模組霸主',
    color: '#ec4899',
    lotStep: 1
  },
  {
    symbol: '3231',
    yahooSymbol: '3231.TW',
    displayTicker: '3231 緯創',
    name: 'Wistron Corp. (3231.TW)',
    nameZh: '緯創 (AI GPU 基板主力)',
    category: 'tw-ai',
    subSector: 'ai-server',
    sector: 'AI GPU Baseboard ODM',
    sectorZh: '輝達 AI GPU 基板與伺服器代工大廠',
    color: '#8b5cf6',
    lotStep: 1
  },
  {
    symbol: '2408',
    yahooSymbol: '2408.TW',
    displayTicker: '2408 南亞科(DRAM)',
    name: 'Nanya Technology (2408.TW)',
    nameZh: '南亞科 (台灣 DRAM 製造龍頭)',
    category: 'tw-semi',
    subSector: 'dram',
    sector: 'DRAM Memory Manufacturer',
    sectorZh: 'DDR5 與高階 DRAM 記憶體顆粒大廠',
    color: '#00b4d8',
    lotStep: 1
  },
  {
    symbol: '2344',
    yahooSymbol: '2344.TW',
    displayTicker: '2344 華邦電(DRAM)',
    name: 'Winbond Electronics (2344.TW)',
    nameZh: '華邦電 (利基型 DRAM/Flash)',
    category: 'tw-semi',
    subSector: 'dram',
    sector: 'Specialty DRAM & CUBE AI Memory',
    sectorZh: 'CUBE 客製化邊緣 AI 記憶體與 NOR Flash',
    color: '#38bdf8',
    lotStep: 1
  },
  {
    symbol: '3008',
    yahooSymbol: '3008.TW',
    displayTicker: '3008 大立光',
    name: 'Largan Precision (3008.TW)',
    nameZh: '大立光 (光學鏡頭股王)',
    category: 'tw-semi',
    subSector: 'semi',
    sector: 'Precision Optical Lenses',
    sectorZh: '蘋果潛望式鏡頭與機器人視覺光學霸主',
    color: '#a855f7',
    lotStep: 1
  },
  {
    symbol: '2603',
    yahooSymbol: '2603.TW',
    displayTicker: '2603 長榮',
    name: 'Evergreen Marine (2603.TW)',
    nameZh: '長榮海運 (貨櫃航運王)',
    category: 'tw-value',
    subSector: 'value',
    sector: 'Global Container Shipping',
    sectorZh: '全球貨櫃航運高現金流高殖利率龍頭',
    color: '#22c55e',
    lotStep: 1
  },
  {
    symbol: '2881',
    yahooSymbol: '2881.TW',
    displayTicker: '2881 富邦金',
    name: 'Fubon Financial (2881.TW)',
    nameZh: '富邦金控 (金控獲利王)',
    category: 'tw-value',
    subSector: 'value',
    sector: 'Premier Financial Holding',
    sectorZh: '台灣壽險與證券銀行金控獲利龍頭',
    color: '#0ea5e9',
    lotStep: 1
  },
  {
    symbol: '0050',
    yahooSymbol: '0050.TW',
    displayTicker: '0050 元大台灣50',
    name: 'Yuanta Taiwan Top 50 ETF (0050.TW)',
    nameZh: '元大台灣50 ETF (台股大盤基準)',
    category: 'tw-etf',
    subSector: 'etf',
    sector: 'TWSE Top 50 Benchmark ETF',
    sectorZh: '台灣市值前 50 大權值股大盤基準 ETF',
    color: '#f59e0b',
    lotStep: 1,
    isBenchmark: true
  },
  {
    symbol: '0056',
    yahooSymbol: '0056.TW',
    displayTicker: '0056 元大高股息',
    name: 'Yuanta High Dividend ETF (0056.TW)',
    nameZh: '元大高股息 ETF (國民高股息)',
    category: 'tw-etf',
    subSector: 'etf',
    sector: 'High Dividend ETF',
    sectorZh: '台灣高殖利率價值股代表 ETF',
    color: '#eab308',
    lotStep: 1
  }
];

/**
 * External Taiwan Stock Discovery Pool (清單外潛力台股探索池)
 * Strictly separate from ASSET_UNIVERSE so the AI scans real TWSE stocks NOT in the active 14-stock watchlist
 * and updates the Top 5 Most Promising External Taiwan Stocks every Monday.
 */
export const DISCOVERY_CANDIDATE_UNIVERSE = [
  {
    symbol: '3661',
    yahooSymbol: '3661.TW',
    displayTicker: '3661 世芯-KY',
    name: 'Alchip Technologies (3661.TW)',
    nameZh: '世芯-KY (AI ASIC 晶片股王)',
    category: 'tw-semi',
    subSector: 'discovery',
    sector: 'Custom AI ASIC Design Leader',
    sectorZh: '北美雲端大廠客製化 AI ASIC 設計龍頭',
    thesisZh: 'AWS 與北美 CSP 雲端巨頭自研 AI 訓練／推論晶片量產核心夥伴，先進製程 NRE 與量產營收高速成長',
    color: '#38bdf8',
    lotStep: 1,
    isExternalDiscovery: true
  },
  {
    symbol: '6669',
    yahooSymbol: '6669.TW',
    displayTicker: '6669 緯穎',
    name: 'Wiwynn Corp. (6669.TW)',
    nameZh: '緯穎 (純雲端 AI 伺服器霸主)',
    category: 'tw-ai',
    subSector: 'discovery',
    sector: 'Hyperscale Data Center Servers',
    sectorZh: 'Meta、微軟與 AWS 純雲端資料中心伺服器高價股',
    thesisZh: '100% 專注超大型雲端資料中心，AI ASIC 伺服器與液冷整機櫃出貨比重居同業之冠',
    color: '#10b981',
    lotStep: 1,
    isExternalDiscovery: true
  },
  {
    symbol: '3443',
    yahooSymbol: '3443.TW',
    displayTicker: '3443 創意',
    name: 'Global Unichip Corp. (3443.TW)',
    nameZh: '創意電子 (台積電轉投資矽智財)',
    category: 'tw-semi',
    subSector: 'discovery',
    sector: 'TSMC Ecosystem ASIC & HBM IP',
    sectorZh: '台積電先進封裝 CoWoS 與 HBM 基底裸晶設計龍頭',
    thesisZh: '背靠台積電先進製程生態系，HBM4 控制器 IP 與大型 AI 客戶 Turnkey 專案持續放量',
    color: '#f43f5e',
    lotStep: 1,
    isExternalDiscovery: true
  },
  {
    symbol: '1519',
    yahooSymbol: '1519.TW',
    displayTicker: '1519 華城(重電)',
    name: 'Fortune Electric (1519.TW)',
    nameZh: '華城電機 (AI 電力變壓器龍頭)',
    category: 'tw-ai',
    subSector: 'discovery',
    sector: 'Heavy Power Grid & AI Transformers',
    sectorZh: '台電強韌電網與美國 AI 資料中心超高壓變壓器霸主',
    thesisZh: '美國 AI 算力中心與電網汰舊換新帶動大電力變壓器嚴重供不應求，外銷高毛利在手訂單看到 3 年後',
    color: '#22c55e',
    lotStep: 1,
    isExternalDiscovery: true
  },
  {
    symbol: '2345',
    yahooSymbol: '2345.TW',
    displayTicker: '2345 智邦',
    name: 'Accton Technology (2345.TW)',
    nameZh: '智邦科技 (800G AI 交換器霸主)',
    category: 'tw-ai',
    subSector: 'discovery',
    sector: '800G AI Data Center Switches',
    sectorZh: '全球 AI 資料中心 400G/800G 白牌高速網路交換器龍頭',
    thesisZh: 'AI 叢集算力擴張帶動 800G 高速乙太網交換器與 AI 加速卡模組出貨爆發，全球市佔率第一',
    color: '#06b6d4',
    lotStep: 1,
    isExternalDiscovery: true
  },
  {
    symbol: '2379',
    yahooSymbol: '2379.TW',
    displayTicker: '2379 瑞昱',
    name: 'Realtek Semiconductor (2379.TW)',
    nameZh: '瑞昱半導體 (Wi-Fi 7 與車用網通)',
    category: 'tw-semi',
    subSector: 'discovery',
    sector: 'Wi-Fi 7 & Automotive Ethernet IC',
    sectorZh: '全球 Wi-Fi 7 無線通訊與車用乙太網路晶片設計大廠',
    thesisZh: 'AI PC 換機潮推升 Wi-Fi 7 與高階音訊晶片滲透率，車用乙太網晶片長線成長動能明確',
    color: '#f59e0b',
    lotStep: 1,
    isExternalDiscovery: true
  },
  {
    symbol: '2357',
    yahooSymbol: '2357.TW',
    displayTicker: '2357 華碩',
    name: 'ASUSTeK Computer (2357.TW)',
    nameZh: '華碩 (AI PC 與電競伺服器品牌王)',
    category: 'tw-ai',
    subSector: 'discovery',
    sector: 'AI PC & Enterprise AI Servers',
    sectorZh: '全球電競主機板、Copilot+ AI PC 與企業級 AI 伺服器大廠',
    thesisZh: 'AI 伺服器營收倍數成長並切入歐美 Tier-2 CSP 客戶，搭配高殖利率與 AI PC 品牌溢價',
    color: '#8b5cf6',
    lotStep: 1,
    isExternalDiscovery: true
  },
  {
    symbol: '3037',
    yahooSymbol: '3037.TW',
    displayTicker: '3037 欣興',
    name: 'Unimicron Technology (3037.TW)',
    nameZh: '欣興電子 (AI ABF 載板龍頭)',
    category: 'tw-semi',
    subSector: 'discovery',
    sector: 'AI GPU ABF Substrate & HDI',
    sectorZh: '全球高階 ABF 封裝載板與 AI OAM 加速卡 HDI 板龍頭',
    thesisZh: '次世代 AI GPU 封裝面積倍增，高層數大尺寸 ABF 載板良率與稼動率顯著回升',
    color: '#ec4899',
    lotStep: 1,
    isExternalDiscovery: true
  },
  {
    symbol: '2303',
    yahooSymbol: '2303.TW',
    displayTicker: '2303 聯電',
    name: 'United Microelectronics (2303.TW)',
    nameZh: '聯華電子 (成熟製程與中介層晶圓代工)',
    category: 'tw-semi',
    subSector: 'discovery',
    sector: 'Specialty Foundry & Silicon Interposer',
    sectorZh: '22/28奈米特殊製程、矽中介層與高殖利率權值股',
    thesisZh: '攜手英特爾開發 12 奈米製程並擴充 CoWoS 矽中介層產能，具備穩健現金流與高殖利率防禦價值',
    color: '#0ea5e9',
    lotStep: 1,
    isExternalDiscovery: true
  },
  {
    symbol: '2618',
    yahooSymbol: '2618.TW',
    displayTicker: '2618 長榮航',
    name: 'EVA Airways (2618.TW)',
    nameZh: '長榮航空 (AI 航空貨運與客運龍頭)',
    category: 'tw-value',
    subSector: 'discovery',
    sector: 'Air Cargo for AI Servers & Aviation',
    sectorZh: '北美航線客運與 AI 伺服器高運價航空貨運雙受惠',
    thesisZh: 'AI 伺服器機櫃與晶片跨太平洋空運急單需求強勁，航空燃油成本受控推升獲利創高',
    color: '#14b8a6',
    lotStep: 1,
    isExternalDiscovery: true
  }
];

export const ALL_SYNC_ASSETS = [...ASSET_UNIVERSE, ...DISCOVERY_CANDIDATE_UNIVERSE];

export const BENCHMARK_SYMBOL = '0050';

export function getAssetMeta(symbol) {
  return (
    ASSET_UNIVERSE.find((a) => a.symbol === symbol) ||
    DISCOVERY_CANDIDATE_UNIVERSE.find((a) => a.symbol === symbol) || {
      symbol,
      yahooSymbol: `${symbol}.TW`,
      displayTicker: symbol,
      name: symbol,
      nameZh: symbol,
      category: 'tw-semi',
      subSector: 'other',
      sector: 'TWSE Equity',
      sectorZh: '台股標的',
      color: '#38bdf8',
      lotStep: 1
    }
  );
}
