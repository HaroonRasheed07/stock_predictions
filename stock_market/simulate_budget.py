"""
Daily provider-budget simulation for StockVantex news engine.

Deterministic model (no live calls). Estimates snapshot-cache misses and
resulting provider calls per day at 100 / 1,000 / 5,000 sentiment visitors,
then compares against per-provider daily budgets.

Run:  python simulate_budget.py
"""
from __future__ import annotations

import math

# ── Traffic assumptions ─────────────────────────────────────────────────────
VISITORS_PER_DAY = [100, 1_000, 5_000]
SENTIMENT_VIEWS_PER_VISITOR = 1.5          # avg sentiment page loads per visitor
TOP10_SHARE = 0.50                          # top-10 tickers = 50% of all views
NEXT40_SHARE = 0.40                         # next-40 = 40%; long tail = 10%
TOTAL_TICKERS = 52                          # SEO allowlist size

# ── Cache assumptions ───────────────────────────────────────────────────────
TTL_POPULAR_S = 1800                        # top-10 tickers: 0.5 h
TTL_BASE_S = 3600                           # everyone else: 1 h
TTL_NEGATIVE_S = 600                        # broken/empty snapshots: 10 min
DAY_S = 86_400

# ── Provider call costs per snapshot MISS ───────────────────────────────────
# Each miss runs the waterfall; free providers are called, scarce ones gated.
PER_MISS = {
    "rss": 1.0,             # batch, itself 5-min cached per feed
    "yahoo_rss": 1.0,       # per-ticker 5-min cache
    "gdelt": 1.0,           # free, 6 s spacing (global cap applies)
    "currents": 1.0,        # called only on starved misses (see below)
    "marketaux": 0.35,      # gated: skipped when target reached / cooldowns
}
# Fraction of misses where FREE providers (rss/yahoo/gdelt) fail to reach the
# 8-article target inside the window - only those call scarce providers.
# Calibrated from live runs: rss+yahoo reached target for DELL/IBM; sparse
# tickers in quiet 24h windows are the starved tail.
STARVED_FRACTION = 0.15
FEEDS = 8
FEED_CACHE_S = 300
GDELT_MIN_INTERVAL_S = 6
YAHOO_CACHE_S = 300

# ── Daily budgets (from provider_budget.DEFAULT_LIMITS, reserve-adjusted) ───
BUDGETS = {
    "rss": 10_000,
    "yahoo_rss": 10_000,
    "gdelt": math.floor(DAY_S / GDELT_MIN_INTERVAL_S),   # spacing cap ~14,400
    "currents": int(250 * 0.85),                          # keep 15% reserve
    "marketaux": int(80 * 0.85),
    "newsdata": 0,        # flag-disabled (licensing)
    "alphavantage": 0,    # flag-disabled (licensing, key empty)
    "google_news_rss": 0,  # flag-disabled (ToS)
}
BUDGET_LABEL = {
    "rss": "10,000",
    "yahoo_rss": "10,000",
    "gdelt": "spacing 6s (~14,400)",
    "currents": "250 (212 usable)",
    "marketaux": "80 (68 usable)",
}


def views_for_tickers(total_views: float):
    """Distribute views over tickers by popularity band."""
    per_ticker = {}
    top10 = TOTAL_TICKERS - 40 - 2          # 10 leaders (52-40-2 guard)
    next40 = 40
    tail = TOTAL_TICKERS - top10 - next40   # 2 tail tickers in 52-symbol set

    def spread(share_views, n):
        return share_views / n

    for i in range(top10):
        per_ticker[f"top{i}"] = spread(total_views * TOP10_SHARE, top10)
    for i in range(next40):
        per_ticker[f"mid{i}"] = spread(total_views * NEXT40_SHARE, next40)
    for i in range(max(tail, 1)):
        per_ticker[f"tail{i}"] = spread(total_views * (1 - TOP10_SHARE - NEXT40_SHARE), max(tail, 1))
    return per_ticker


def simulate(visitors: int) -> dict:
    views = visitors * SENTIMENT_VIEWS_PER_VISITOR
    per_ticker = views_for_tickers(views)

    misses = 0.0
    hits = 0.0
    for i, (name, v) in enumerate(per_ticker.items()):
        ttl = TTL_POPULAR_S if name.startswith("top") else TTL_BASE_S
        max_refreshes = DAY_S / ttl          # steady-state refresh capacity
        ticker_misses = min(v, max_refreshes)
        # requests beyond TTL capacity are cache hits
        hits += max(0.0, v - ticker_misses)
        misses += ticker_misses

    calls = {p: misses * c for p, c in PER_MISS.items()}
    # Scarce providers only run on starved misses (free providers < target)
    starved = misses * STARVED_FRACTION
    calls["currents"] = starved * PER_MISS["currents"]
    calls["marketaux"] = starved * PER_MISS["marketaux"]

    # rss: 8 feeds x (86400/300) = 2,304 feed fetches/day max, demand-driven
    calls["rss"] = min(calls["rss"] * FEEDS, FEEDS * (DAY_S / FEED_CACHE_S))
    # yahoo: per-ticker 5-min cache caps per ticker at 173/day
    yahoo_cap = len(per_ticker) * (DAY_S / YAHOO_CACHE_S)
    calls["yahoo_rss"] = min(calls["yahoo_rss"], yahoo_cap)
    # marketaux: per-ticker 4h cooldown caps ~6/ticker/day and 80 total
    calls["marketaux"] = min(calls["marketaux"], len(per_ticker) * 6)

    return {
        "visitors": visitors,
        "views": views,
        "misses": misses,
        "hits": hits,
        "hit_rate": hits / views if views else 0,
        "calls": calls,
    }


def main():
    results = [simulate(v) for v in VISITORS_PER_DAY]
    providers = ["rss", "yahoo_rss", "gdelt", "currents", "marketaux"]

    header = ["metric"] + [f"{r['visitors']:,} visitors" for r in results] + ["worst-case headroom"]
    lines = ["| " + " | ".join(header) + " |",
             "|" + "---|" * len(header)]
    lines.append("| " + " | ".join(
        ["sentiment page views/day"] + [f"{r['views']:,.0f}" for r in results] + ["-"]) + " |")
    lines.append("| " + " | ".join(
        ["snapshot cache misses/day"] + [f"{r['misses']:,.0f}" for r in results] + ["-"]) + " |")
    lines.append("| " + " | ".join(
        ["cache hit rate"] + [f"{r['hit_rate']:.1%}" for r in results] + ["-"]) + " |")

    for p in providers:
        vals = [r["calls"][p] for r in results]
        limit = BUDGETS[p]
        worst = max(vals)
        headroom = f"{(1 - worst / limit):.0%}" if limit else "n/a"
        lines.append("| " + " | ".join(
            [f"{p} (limit {BUDGET_LABEL[p]})"] + [f"{v:,.0f}" for v in vals] + [headroom]
        ) + " |")

    lines.append("")
    lines.append("Verdict per tier (simulated demand vs quota):")
    for r in results:
        over = [p for p in providers
                if BUDGETS[p] and r["calls"][p] > BUDGETS[p]]
        status = "OK - all providers within budget" if not over else \
            f"DEMAND EXCEEDS QUOTA: {', '.join(over)} (budget_manager.can_call hard-caps the"
        if over:
            status += " provider anyway - result is article-coverage degradation, never quota overrun)"
        lines.append(f"  {r['visitors']:,} visitors/day: {status}")

    lines.append("")
    lines.append("Notes:")
    lines.append(f"- Starved fraction {STARVED_FRACTION:.0%} of misses call currents/marketaux;")
    lines.append("  the rest stop at the free providers (rss + yahoo_rss + gdelt reach 8-article target).")
    lines.append("- budget_manager enforces hard caps: can_call() refuses once the daily limit is")
    lines.append("  reached, so overrun is structurally impossible - the model shows demand only.")
    lines.append("- Marketaux also has per-ticker 4h cooldowns (max 6/ticker/day) and conserve mode.")
    lines.append("- Disabled-by-default providers consume 0: newsdata (licensing),")
    lines.append("  alphavantage (licensing/key empty), google_news_rss (ToS).")
    lines.append("- SEC EDGAR is endpoint-only (/api/news/filings): ~1 request per ticker per hour,")
    lines.append("  cached 1h, far below SEC's 10 req/s guidance.")

    print("\n".join(lines))


if __name__ == "__main__":
    main()
