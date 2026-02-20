/**
 * Crypto Market API Client
 * Talks to the FastAPI backend on port 8001 (proxied via /api/crypto/*)
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

async function fetchJson<T>(
    url: string,
    options: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
    const { timeoutMs = 60000, ...init } = options;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(url, {
            ...init,
            signal: controller.signal,
        });

        const contentType = res.headers.get("content-type") || "";
        const isJson = contentType.includes("application/json");
        const payloadText = await res.text();
        const payload: any = isJson && payloadText ? safeJsonParse(payloadText) : payloadText;

        if (!res.ok) {
            const detail =
                (payload && typeof payload === "object" && (payload.detail || payload.error)) ||
                (typeof payload === "string" && payload) ||
                `HTTP ${res.status}`;
            throw new Error(detail);
        }

        return (isJson ? (payload as T) : (safeJsonParse(payloadText) as T)) as T;
    } catch (e: any) {
        if (e?.name === "AbortError") {
            throw new Error("Request timed out. Please ensure the crypto backend is running.");
        }
        throw e;
    } finally {
        clearTimeout(timeoutId);
    }
}

function safeJsonParse(text: string) {
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

// --- Interfaces ---

export interface CryptoOverviewResponse {
    symbol: string;
    livePrice: number | null;
    change24h: number;
    predictedReturn: number;
    predictedPrice: number | null;
    sigma: number | null;
    fearGreed: { value: number; classification: string };
    signal: {
        signal: string;
        score: number;
        color: string;
        reasons: string[];
        confidence: number;
    };
    risk: {
        score: number;
        level: string;
        color: string;
        factors: string[];
    };
    topCoins: Array<{ symbol: string; price: number; change: number }>;
    chartData: Array<{
        Date: string;
        Close: number;
        Open: number;
        High: number;
        Low: number;
        Volume: number;
    }>;
    supportedSymbols: string[];
}

export interface CryptoTechnicalResponse {
    symbol: string;
    data: Array<{
        Date: string;
        Open: number;
        High: number;
        Low: number;
        Close: number;
        Volume: number;
        sma20?: number | null;
        ema20?: number | null;
        bb_mid?: number | null;
        bb_up?: number | null;
        bb_dn?: number | null;
        rsi14?: number | null;
        macd?: number | null;
        macd_signal?: number | null;
        macd_hist?: number | null;
    }>;
    latestRSI: number | null;
    latestMACD: number | null;
    latestSignal: string;
}

export interface CryptoSentimentResponse {
    symbol: string;
    sentiment_score: number;
    sentiment_label: string;
    positive_count: number;
    negative_count: number;
    news: Array<{
        title: string;
        url: string;
        source: string;
        published_at: string;
        sentiment: number;
    }>;
}

export interface CryptoForecastResponse {
    symbol: string;
    horizonHours: number;
    timestamps: string[];
    predictedReturns: number[];
    actualReturns: number[];
    sigma: number[];
    directionProb: number[];
    accuracy: number;
    latestPredReturn: number;
    latestPrice: number;
    predictedPrice: number;
    latestSigma: number | null;
    dataPoints: number;
    seqLen: number;
    nFeatures: number;
}

// --- API Functions ---

export async function fetchCryptoOverview(
    symbol: string = "BTC"
): Promise<CryptoOverviewResponse> {
    return fetchJson<CryptoOverviewResponse>(`${API_BASE}/api/crypto/overview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
        timeoutMs: 60000,
    });
}

export async function fetchCryptoTechnical(
    symbol: string = "BTC",
    days: number = 365
): Promise<CryptoTechnicalResponse> {
    return fetchJson<CryptoTechnicalResponse>(`${API_BASE}/api/crypto/technical`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, days }),
        timeoutMs: 60000,
    });
}

export async function fetchCryptoSentiment(
    symbol: string = "BTC"
): Promise<CryptoSentimentResponse> {
    return fetchJson<CryptoSentimentResponse>(`${API_BASE}/api/crypto/sentiment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
        timeoutMs: 60000,
    });
}

export async function fetchCryptoForecast(
    symbol: string = "BTC",
    lookbackDays: number = 30
): Promise<CryptoForecastResponse> {
    return fetchJson<CryptoForecastResponse>(`${API_BASE}/api/crypto/forecast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, lookback_days: lookbackDays }),
        timeoutMs: 90000,
    });
}
