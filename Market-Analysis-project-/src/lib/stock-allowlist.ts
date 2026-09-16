export interface StockAllowlistEntry {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  relatedSymbols: string[];
}

const ALLOWLIST: Record<string, StockAllowlistEntry> = {
  aapl: { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', industry: 'Consumer Electronics', relatedSymbols: ['msft', 'googl', 'meta', 'amzn'] },
  msft: { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', industry: 'Software—Infrastructure', relatedSymbols: ['aapl', 'googl', 'amzn', 'crm'] },
  googl: { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', industry: 'Internet Content & Information', relatedSymbols: ['meta', 'msft', 'aapl', 'amzn'] },
  amzn: { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Cyclical', industry: 'Internet Retail', relatedSymbols: ['aapl', 'msft', 'googl', 'meta'] },
  nvda: { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', industry: 'Semiconductors', relatedSymbols: ['amd', 'intc', 'tsm', 'qcom'] },
  tsla: { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', relatedSymbols: ['f', 'gm', 'rivn', 'lcid'] },
  meta: { symbol: 'META', name: 'Meta Platforms Inc.', sector: 'Technology', industry: 'Social Media', relatedSymbols: ['googl', 'snap', 'pinterest', 'aapl'] },
  jpm: { symbol: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financial Services', industry: 'Banks—Diversified', relatedSymbols: ['gs', 'ms', 'bac', 'wfc'] },
  v: { symbol: 'V', name: 'Visa Inc.', sector: 'Financial Services', industry: 'Credit Services', relatedSymbols: ['ma', 'pypl', 'amex'] },
  jnj: { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', industry: 'Drug Manufacturers', relatedSymbols: ['pfe', 'unh', 'abbv', 'mrk'] },
  wmt: { symbol: 'WMT', name: 'Walmart Inc.', sector: 'Consumer Defensive', industry: 'Retail—Big Box', relatedSymbols: ['cost', 'tgt', 'hd', 'low'] },
  pg: { symbol: 'PG', name: 'Procter & Gamble', sector: 'Consumer Defensive', industry: 'Household & Personal Products', relatedSymbols: ['cl', 'ko', 'pep', 'mdlz'] },
  unh: { symbol: 'UNH', name: 'UnitedHealth Group', sector: 'Healthcare', industry: 'Healthcare Plans', relatedSymbols: ['anth', 'cvs', 'hum', 'ci'] },
  hd: { symbol: 'HD', name: 'Home Depot Inc.', sector: 'Consumer Cyclical', industry: 'Home Improvement', relatedSymbols: ['low', 'wmt', 'cost', 'target'] },
  bac: { symbol: 'BAC', name: 'Bank of America Corp.', sector: 'Financial Services', industry: 'Banks—Diversified', relatedSymbols: ['jpm', 'gs', 'ms', 'wfc'] },
  xom: { symbol: 'XOM', name: 'Exxon Mobil Corporation', sector: 'Energy', industry: 'Oil & Gas Integrated', relatedSymbols: ['cvx', 'cop', 'slb', 'oxy'] },
  pfe: { symbol: 'PFE', name: 'Pfizer Inc.', sector: 'Healthcare', industry: 'Drug Manufacturers', relatedSymbols: ['jnj', 'abbv', 'mrk', 'lly'] },
  ba: { symbol: 'BA', name: 'Boeing Company', sector: 'Industrials', industry: 'Aerospace & Defense', relatedSymbols: ['hon', 'rtx', 'noc', 'ldos'] },
  ko: { symbol: 'KO', name: 'Coca-Cola Company', sector: 'Consumer Defensive', industry: 'Beverages—Non-Alcoholic', relatedSymbols: ['pep', 'mNST', 'stz', 'dmnd'] },
  dis: { symbol: 'DIS', name: 'Walt Disney Company', sector: 'Communication Services', industry: 'Entertainment', relatedSymbols: ['nflx', 'wbd', 'para', 'cmcsa'] },
  nflx: { symbol: 'NFLX', name: 'Netflix Inc.', sector: 'Communication Services', industry: 'Entertainment', relatedSymbols: ['dis', 'wbd', 'para', 'cmcsa'] },
  adbe: { symbol: 'ADBE', name: 'Adobe Inc.', sector: 'Technology', industry: 'Software—Application', relatedSymbols: ['crm', 'now', 'intu', 'msft'] },
  crm: { symbol: 'CRM', name: 'Salesforce Inc.', sector: 'Technology', industry: 'Software—Application', relatedSymbols: ['adbe', 'now', 'intu', 'msft'] },
  amd: { symbol: 'AMD', name: 'Advanced Micro Devices', sector: 'Technology', industry: 'Semiconductors', relatedSymbols: ['nvda', 'intc', 'tsm', 'qcom'] },
  intc: { symbol: 'INTC', name: 'Intel Corporation', sector: 'Technology', industry: 'Semiconductors', relatedSymbols: ['amd', 'nvda', 'tsm', 'qcom'] },
  csco: { symbol: 'CSCO', name: 'Cisco Systems Inc.', sector: 'Technology', industry: 'Communication Equipment', relatedSymbols: ['anet', 'cdns', 'snps', 'msft'] },
  vz: { symbol: 'VZ', name: 'Verizon Communications', sector: 'Communication Services', industry: 'Telecom Services', relatedSymbols: ['t', 'tmus', 'cmcsa', 'dis'] },
  t: { symbol: 'T', name: 'AT&T Inc.', sector: 'Communication Services', industry: 'Telecom Services', relatedSymbols: ['vz', 'tmus', 'cmcsa', 'dis'] },
  gs: { symbol: 'GS', name: 'Goldman Sachs Group', sector: 'Financial Services', industry: 'Capital Markets', relatedSymbols: ['ms', 'jpm', 'bac', 'c'] },
  ms: { symbol: 'MS', name: 'Morgan Stanley', sector: 'Financial Services', industry: 'Capital Markets', relatedSymbols: ['gs', 'jpm', 'bac', 'c'] },
  abbv: { symbol: 'ABBV', name: 'AbbVie Inc.', sector: 'Healthcare', industry: 'Drug Manufacturers', relatedSymbols: ['jnj', 'pfe', 'mrk', 'lly'] },
  mrk: { symbol: 'MRK', name: 'Merck & Co. Inc.', sector: 'Healthcare', industry: 'Drug Manufacturers', relatedSymbols: ['pfe', 'abbv', 'jnj', 'lly'] },
  lly: { symbol: 'LLY', name: 'Eli Lilly and Company', sector: 'Healthcare', industry: 'Drug Manufacturers', relatedSymbols: ['pfe', 'abbv', 'mrk', 'jnj'] },
  cost: { symbol: 'COST', name: 'Costco Wholesale', sector: 'Consumer Defensive', industry: 'Retail—Warehouse', relatedSymbols: ['wmt', 'tgt', 'hd', 'low'] },
  orcl: { symbol: 'ORCL', name: 'Oracle Corporation', sector: 'Technology', industry: 'Software—Infrastructure', relatedSymbols: ['msft', 'sap', 'crm', 'adbe'] },
  nke: { symbol: 'NKE', name: 'Nike Inc.', sector: 'Consumer Cyclical', industry: 'Footwear & Accessories', relatedSymbols: ['adbe', 'ua', 'lululemon', 'foot'] },
  pypl: { symbol: 'PYPL', name: 'PayPal Holdings', sector: 'Financial Services', industry: 'Credit Services', relatedSymbols: ['v', 'ma', 'sq', 'adyen'] },
  sq: { symbol: 'SQ', name: 'Block Inc.', sector: 'Financial Services', industry: 'Software—Application', relatedSymbols: ['pypl', 'v', 'ma', 'adyen'] },
  shop: { symbol: 'SHOP', name: 'Shopify Inc.', sector: 'Technology', industry: 'Software—Application', relatedSymbols: ['amzn', 'bigc', 'wix', 'etsy'] },
  abnb: { symbol: 'ABNB', name: 'Airbnb Inc.', sector: 'Consumer Cyclical', industry: 'Lodging', relatedSymbols: ['bkng', 'expe', 'mar', 'hg'] },
  uber: { symbol: 'UBER', name: 'Uber Technologies', sector: 'Technology', industry: 'Software—Application', relatedSymbols: ['lyft', 'dash', 'grub', 'snap'] },
  coin: { symbol: 'COIN', name: 'Coinbase Global', sector: 'Financial Services', industry: 'Financial Data & Stock Exchanges', relatedSymbols: ['mstr', 'clsk', 'riot', 'hut'] },
  rivn: { symbol: 'RIVN', name: 'Rivian Automotive', sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', relatedSymbols: ['tsla', 'lcid', 'f', 'gm'] },
  pltr: { symbol: 'PLTR', name: 'Palantir Technologies', sector: 'Technology', industry: 'Software—Application', relatedSymbols: ['crwd', 'panw', 'zscaler', 'ftnt'] },
  snow: { symbol: 'SNOW', name: 'Snowflake Inc.', sector: 'Technology', industry: 'Software—Application', relatedSymbols: ['databricks', 'crwd', 'panw', 'zscaler'] },
  tsm: { symbol: 'TSM', name: 'Taiwan Semiconductor', sector: 'Technology', industry: 'Semiconductors', relatedSymbols: ['nvda', 'amd', 'intc', 'qcom'] },
  qcom: { symbol: 'QCOM', name: 'Qualcomm Inc.', sector: 'Technology', industry: 'Semiconductors', relatedSymbols: ['nvda', 'amd', 'intc', 'tsm'] },
  wfc: { symbol: 'WFC', name: 'Wells Fargo & Co.', sector: 'Financial Services', industry: 'Banks—Diversified', relatedSymbols: ['jpm', 'bac', 'gs', 'c'] },
  c: { symbol: 'C', name: 'Citigroup Inc.', sector: 'Financial Services', industry: 'Banks—Diversified', relatedSymbols: ['jpm', 'bac', 'gs', 'ms'] },
  cat: { symbol: 'CAT', name: 'Caterpillar Inc.', sector: 'Industrials', industry: 'Farm & Heavy Construction Machinery', relatedSymbols: ['de', 'emr', 'etn', 'ph'] },
  low: { symbol: 'LOW', name: "Lowe's Companies", sector: 'Consumer Cyclical', industry: 'Home Improvement', relatedSymbols: ['hd', 'wmt', 'cost', 'target'] },
  cvx: { symbol: 'CVX', name: 'Chevron Corporation', sector: 'Energy', industry: 'Oil & Gas Integrated', relatedSymbols: ['xom', 'cop', 'slb', 'oxy'] },
  ma: { symbol: 'MA', name: 'Mastercard Inc.', sector: 'Financial Services', industry: 'Credit Services', relatedSymbols: ['v', 'pypl', 'amex', 'cb'] },
};

export function isValidTicker(symbol: string): boolean {
  return symbol.toLowerCase() in ALLOWLIST;
}

export function getStockInfo(symbol: string): StockAllowlistEntry | null {
  return ALLOWLIST[symbol.toLowerCase()] || null;
}

export function getRelatedStocks(symbol: string): StockAllowlistEntry[] {
  const entry = ALLOWLIST[symbol.toLowerCase()];
  if (!entry) return [];
  return entry.relatedSymbols
    .map((s) => ALLOWLIST[s])
    .filter(Boolean)
    .slice(0, 4);
}

export function getAllAllowlistedSymbols(): string[] {
  const seen = new Set<string>();
  return Object.values(ALLOWLIST)
    .filter((entry) => {
      if (seen.has(entry.symbol)) return false;
      seen.add(entry.symbol);
      return true;
    })
    .map((e) => e.symbol);
}
