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

const API_BASE = '';

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

// Fetch forecast
export async function fetchForecast(
  ticker: string,
  forecastDays: number = 7,
  period: string = "1y"
): Promise<ForecastResponse> {
  const res = await fetch(`${API_BASE}/api/data/forecast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ticker,
      forecast_days: forecastDays,
      period,
    }),
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

// Fetch sentiment
export async function fetchSentiment(
  ticker: string
): Promise<{
  ticker: string;
  sentiment_score: number;
  sentiment_label: string;
  news: Array<{ title: string; source: string; url: string; published_at: string }>;
}> {
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

