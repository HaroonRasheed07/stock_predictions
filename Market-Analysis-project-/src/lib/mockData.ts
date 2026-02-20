// Mock data for InsightForge

export interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: string;
  high52Week: number;
  low52Week: number;
}

export interface CryptoData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  marketCap: string;
  rank: number;
}

export interface CandlestickData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SentimentData {
  date: string;
  positive: number;
  neutral: number;
  negative: number;
  score: number;
}

export interface ForecastData {
  date: string;
  actual?: number;
  predicted: number;
  lower: number;
  upper: number;
}

// Simulate API delay for realistic UX
export const simulateDelay = (ms: number = 500) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Mock API response wrapper
export const mockApiCall = async <T,>(data: T, delay: number = 500): Promise<T> => {
  await simulateDelay(delay);
  return data;
};

export const mockStocks: StockData[] = [
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 178.52,
    change: 2.34,
    changePercent: 1.33,
    volume: 54230000,
    marketCap: '2.8T',
    high52Week: 199.62,
    low52Week: 124.17,
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    price: 384.79,
    change: -1.21,
    changePercent: -0.31,
    volume: 23450000,
    marketCap: '2.9T',
    high52Week: 420.82,
    low52Week: 213.43,
  },
  {
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    price: 142.68,
    change: 0.87,
    changePercent: 0.61,
    volume: 18920000,
    marketCap: '1.8T',
    high52Week: 155.27,
    low52Week: 83.45,
  },
  {
    symbol: 'AMZN',
    name: 'Amazon.com Inc.',
    price: 178.35,
    change: 3.12,
    changePercent: 1.78,
    volume: 42360000,
    marketCap: '1.9T',
    high52Week: 191.70,
    low52Week: 88.12,
  },
  {
    symbol: 'TSLA',
    name: 'Tesla Inc.',
    price: 248.42,
    change: -5.23,
    changePercent: -2.06,
    volume: 98740000,
    marketCap: '788B',
    high52Week: 299.29,
    low52Week: 152.37,
  },
];

export const mockCrypto: CryptoData[] = [
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    price: 67842.32,
    change24h: 1234.56,
    changePercent24h: 1.85,
    volume24h: 28500000000,
    marketCap: '1.3T',
    rank: 1,
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    price: 3542.18,
    change24h: -42.31,
    changePercent24h: -1.18,
    volume24h: 15600000000,
    marketCap: '425B',
    rank: 2,
  },
  {
    symbol: 'BNB',
    name: 'Binance Coin',
    price: 612.45,
    change24h: 8.23,
    changePercent24h: 1.36,
    volume24h: 2100000000,
    marketCap: '89B',
    rank: 3,
  },
];

// Generate realistic candlestick data
export const generateCandlestickData = (days: number = 90, basePrice: number = 180): CandlestickData[] => {
  const data: CandlestickData[] = [];
  let price = basePrice;
  const today = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    const volatility = 0.02;
    const change = (Math.random() - 0.5) * price * volatility;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    const volume = Math.floor(Math.random() * 50000000) + 10000000;

    data.push({
      date: date.toISOString().split('T')[0],
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume,
    });

    price = close;
  }

  return data;
};

// Generate sentiment data
export const generateSentimentData = (days: number = 30): SentimentData[] => {
  const data: SentimentData[] = [];
  const today = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    const positive = Math.random() * 60 + 20;
    const negative = Math.random() * 30 + 10;
    const neutral = 100 - positive - negative;
    const score = (positive - negative) / 100;

    data.push({
      date: date.toISOString().split('T')[0],
      positive: parseFloat(positive.toFixed(1)),
      neutral: parseFloat(neutral.toFixed(1)),
      negative: parseFloat(negative.toFixed(1)),
      score: parseFloat(score.toFixed(2)),
    });
  }

  return data;
};

// Generate forecast data
export const generateForecastData = (days: number = 60, historicalDays: number = 30, basePrice: number = 180): ForecastData[] => {
  const data: ForecastData[] = [];
  const today = new Date();
  let price = basePrice;

  // Historical data with actual prices
  for (let i = historicalDays; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    const change = (Math.random() - 0.5) * price * 0.02;
    price += change;

    data.push({
      date: date.toISOString().split('T')[0],
      actual: parseFloat(price.toFixed(2)),
      predicted: parseFloat(price.toFixed(2)),
      lower: parseFloat((price * 0.98).toFixed(2)),
      upper: parseFloat((price * 1.02).toFixed(2)),
    });
  }

  // Future predictions
  for (let i = 1; i <= days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    
    const trend = 0.001; // Slight upward trend
    const volatility = 0.015;
    const change = (trend + (Math.random() - 0.5) * volatility) * price;
    price += change;

    const confidenceWidth = (i / days) * price * 0.1;

    data.push({
      date: date.toISOString().split('T')[0],
      predicted: parseFloat(price.toFixed(2)),
      lower: parseFloat((price - confidenceWidth).toFixed(2)),
      upper: parseFloat((price + confidenceWidth).toFixed(2)),
    });
  }

  return data;
};
