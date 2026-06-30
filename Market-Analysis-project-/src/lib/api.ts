import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

// Simulate API delay for realistic UX
export const simulateDelay = (ms: number = 500) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Mock API response wrapper
export const mockApiCall = async <T,>(data: T, delay: number = 500): Promise<T> => {
  await simulateDelay(delay);
  return data;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://stock-predictions-b6yx.onrender.com";

export interface IndicatorsResponse {
  ticker: string;
  data: Record<string, any>[];
  totalMarketCap?: number;
  tradingVolume?: number;
  activeStocks?: number;
  topStocks?: Array<{
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
  }>;
  currentPrice?: number;
  change?: number;
  changePercent?: number;
}

export interface ForecastResponse {
  ticker: string;
  forecast_days: number;
  results: {
    actual_prices: number[];
    predicted_historical_prices: number[];
    forecast_prices: number[];
    forecast_dates: string[];
  };
}

// ─── New Interfaces for Multi-Asset Platform ───────────────────────────────

export interface AssetInfo {
  ticker: string;
  name: string;
  asset_class: string;
  asset_class_label: string;
  has_volume: boolean;
  currency: string;
}

export interface OpportunityScore {
  ticker: string;
  name: string;
  asset_class: string;
  score: number;
  price: number;
  change: number;
  change_percent: number;
  factors: Array<{
    name: string;
    impact: number;
    value: string;
    detail: string;
  }>;
}

export interface VolatilitySummary {
  daily_volatility: number;
  weekly_volatility: number;
  atr: number;
  expected_range: {
    current_price: number;
    atr: number;
    expected_high: number;
    expected_low: number;
    range_percent: number;
  };
  relative_volume: {
    available: boolean;
    current_volume: number;
    avg_volume: number;
    relative_volume: number;
    classification: string;
    recent_volumes?: Array<{
      date: string;
      volume: number;
      is_above_avg: boolean;
    }>;
  };
}

export interface RiskAssessment {
  ticker: string;
  risk_level: 'Low' | 'Medium' | 'High' | 'Unknown';
  risk_score: number;
  message: string;
  factors: Array<{
    name: string;
    value: string;
    level: string;
    impact: string;
    description: string;
  }>;
}

export interface TrendStrength {
  ticker: string;
  trend_score: number;
  trend_label: string;
}

export interface TradeConfirmation {
  ticker: string;
  name: string;
  opportunity_score: number;
  trend: { score: number; label: string };
  technicals: { rsi: number; macd_signal: string };
  risk: { level: string; score: number };
  volatility: { level: string; daily: number };
  sentiment: { score: number; label: string } | null;
  relative_volume: { available: boolean; relative_volume?: number; classification?: string };
}

export interface EnhancedSentiment {
  score: number;
  label: string;
  positive_count: number;
  negative_count: number;
  news: Array<{ title: string; source: string; url: string; published_at: string }>;
  sentiment_trend_7d: Array<{ date: string; score: number }>;
  news_impact_summary: string;
  market_mood: string;
}


// Fetch indicators
export async function fetchIndicators(
  ticker: string,
  period: string = "1y"
): Promise<IndicatorsResponse> {
  const res = await fetch(`${API_BASE}/api/data/indicators`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker, period }),
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      message = data.detail || data.error || JSON.stringify(data);
    } catch {
      const text = await res.text();
      if (text) message = text;
    }
    throw new Error(message);
  }

  return res.json();
}

export async function fetchForecast(
  ticker: string,
  forecastDays: number = 7,
  period: string = "1y"
): Promise<ForecastResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/forecast/onnx`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker,
        forecast_days: forecastDays,
        period,
      }),
    });

    if (!res.ok) {
      console.error(`Forecast API Request failed: ${res.status}`);
      return null;
    }

    const data = await res.json();
    console.log("Raw API Response:", data);

    if (data.detail || data.status === "error" || !data.results) {
      console.warn("Forecast API returned error or missing results:", data);
      return null;
    }

    return data as ForecastResponse;
  } catch (error) {
    console.error("Forecast fetch exception:", error);
    return null;
  }
}

// Fetch sentiment
export async function fetchSentiment(
  ticker: string
): Promise<EnhancedSentiment> {
  const res = await fetch(`${API_BASE}/api/data/sentiment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker }),
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      message = data.detail || data.error || JSON.stringify(data);
    } catch {
      const text = await res.text();
      if (text) message = text;
    }
    throw new Error(message);
  }

  return res.json();
}

// ─── New API Fetch Functions ───────────────────────────────────────────────

export async function fetchAssetSearch(query: string): Promise<AssetInfo[]> {
  const res = await fetch(`${API_BASE}/api/multi-asset/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Failed to search assets");
  return res.json();
}

export async function fetchWatchlistDefaults(category?: string) {
  const url = category ? `${API_BASE}/api/multi-asset/watchlist?category=${category}` : `${API_BASE}/api/multi-asset/watchlist`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch watchlist defaults");
  return res.json();
}

export async function fetchOpportunityScan(tickers: string[], period = "1y"): Promise<{ scan_results: OpportunityScore[] }> {
  const res = await fetch(`${API_BASE}/api/opportunities/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tickers, period }),
  });
  if (!res.ok) throw new Error("Failed to scan opportunities");
  return res.json();
}

export async function fetchVolatilitySummary(ticker: string, period = "1y"): Promise<VolatilitySummary> {
  const res = await fetch(`${API_BASE}/api/volatility/summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker, period }),
  });
  if (!res.ok) throw new Error("Failed to fetch volatility summary");
  return res.json();
}

export async function fetchVolatilityMonitor(tickers: string[], period = "1y"): Promise<{ volatility_monitor: any[] }> {
  const res = await fetch(`${API_BASE}/api/volatility/monitor`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tickers, period }),
  });
  if (!res.ok) throw new Error("Failed to fetch volatility monitor");
  return res.json();
}

export async function fetchRiskAssessment(ticker: string, period = "1y"): Promise<RiskAssessment> {
  const res = await fetch(`${API_BASE}/api/risk/assess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker, period }),
  });
  if (!res.ok) throw new Error("Failed to fetch risk assessment");
  return res.json();
}

export async function fetchTrendStrength(ticker: string, period = "1y"): Promise<TrendStrength> {
  const res = await fetch(`${API_BASE}/api/data/trend-strength`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker, period }),
  });
  if (!res.ok) throw new Error("Failed to fetch trend strength");
  return res.json();
}

export async function fetchRelativeVolume(ticker: string, period = "1y"): Promise<VolatilitySummary['relative_volume']> {
  const res = await fetch(`${API_BASE}/api/data/relative-volume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker, period }),
  });
  if (!res.ok) throw new Error("Failed to fetch relative volume");
  return res.json();
}

export async function fetchExpectedRange(ticker: string, period = "1y"): Promise<VolatilitySummary['expected_range']> {
  const res = await fetch(`${API_BASE}/api/data/expected-range`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker, period }),
  });
  if (!res.ok) throw new Error("Failed to fetch expected range");
  return res.json();
}

export async function fetchTradeConfirmation(ticker: string, period = "1y"): Promise<TradeConfirmation> {
  const res = await fetch(`${API_BASE}/api/data/trade-confirmation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker, period }),
  });
  if (!res.ok) throw new Error("Failed to fetch trade confirmation");
  return res.json();
}

