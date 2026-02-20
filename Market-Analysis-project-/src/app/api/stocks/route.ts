

// import { NextResponse } from "next/server";
// import YahooFinance from "yahoo-finance2";

// export async function GET() {
//   const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
//   const symbols = ["AAPL", "GOOG", "AMZN", "TSLA", "NVDA"];

//   try {
//     // Fetch quotes (without unsupported options)
//     const results = await yf.quote(symbols);

//     // Normalize result to array
//     const stocks = Array.isArray(results) ? results : Object.values(results);

//     const formatted = stocks.map((item: any) => ({
//       symbol: item.symbol,
//       price: item.regularMarketPrice ?? 0,
//       change: item.regularMarketChange ?? 0,
//     }));

//     return NextResponse.json(formatted);
//   } catch (err: any) {
//     console.error('stocks API error:', err);

//     // Fallback mock data
//     const fallbackStocks = [
//       { symbol: "AAPL", price: 174.55, change: 0.8 },
//       { symbol: "GOOG", price: 135.32, change: -1.2 },
//       { symbol: "AMZN", price: 123.45, change: 0.5 },
//       { symbol: "TSLA", price: 298.75, change: 2.1 },
//       { symbol: "NVDA", price: 400.12, change: -0.7 },
//     ];

//     return NextResponse.json(fallbackStocks);
//   }
// }



// src/app/api/stocks/route.ts
import { NextResponse } from "next/server";

// Load API key from environment variable for security
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || "d5blpr9r01qnaiduedhgd5blpr9r01qnaiduedi0";

const symbols = ["AAPL", "GOOG", "AMZN", "TSLA", "NVDA"]; // Add more symbols if needed

export async function GET() {
  try {
    const results: any[] = [];

    for (const symbol of symbols) {
      try {
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`
        );
        const data = await res.json();

        results.push({
          symbol,
          price: data.c ?? 0,   // Current price
          change: data.d ?? 0,  // Price change
        });

        // Optional: small delay to avoid hitting limits
        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        console.warn(`Failed to fetch ${symbol}, using fallback`);
        results.push({ symbol, price: 0, change: 0 });
      }
    }

    return NextResponse.json(results);
  } catch (err) {
    console.error("stocks API error:", err);

    // Fallback mock data
    const fallbackStocks = [
      { symbol: "AAPL", price: 174.55, change: 0.8 },
      { symbol: "GOOG", price: 135.32, change: -1.2 },
      { symbol: "AMZN", price: 123.45, change: 0.5 },
      { symbol: "TSLA", price: 298.75, change: 2.1 },
      { symbol: "NVDA", price: 400.12, change: -0.7 },
    ];

    return NextResponse.json(fallbackStocks);
  }
}
