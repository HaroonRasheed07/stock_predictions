# Market Data Pipeline Audit

**Date:** 2026-11-24
**Scope:** price/quote acquisition through frontend display.

## Pipeline map

```
Provider request (Yahooquery / fallback)
  -> yahooquery_adapter._flatten_yq_history()
  -> minimal validation and Close extraction
  -> indicator / volatility / risk / opportunity computation
  -> memory + SQLite SWR cache
  -> FastAPI response
  -> frontend snapshot store
  -> "Snapshot refreshed" label
```

## Files inspected

- `api.py` (root deployment shim), `stock_market/api.py`
- `stock_market/yahooquery_adapter.py`
- `stock_market/cache_manager.py`
- `stock_market/utils.py`
- `stock_market/market_status.py`
- `stock_market/indicators.py`, `volatility.py`, `multi_asset.py`
- Frontend: `src/lib/api.ts`, `src/lib/stock-snapshot.ts`, `src/lib/home-data.ts`, homepage and stock-page components

## Confirmed behavior

- `_flatten_yq_history()` maps `adjclose`/`close` to `Close`, converts missing Volume to `0`, and drops rows with missing Close.
- No deduplication, explicit chronological sort, timezone normalization or corporate-action adjustment metadata is added beyond provider fields.
- Data is cached in memory and SQLite with fresh/stale TTLs; requests can be served from stale cache.
- `Market status` is estimated from UTC time and a static US-holiday list (`market_status.py`); it is not an exchange feed.
- The old `Data updated` label measured snapshot/cache write age, not the exchange observation time.
- Venue-specific microstatus, depth-of-book, quote provenance and timestamp verification are not available.

## Corrections made

- Public copy now says `Snapshot refreshed` and `cached market snapshot`.
- Methodology now documents provider sources, cleaning limitations, cache behavior, snapshot age and coverage boundaries.
- No claim of a paid partnership, real-time exchange feed, verified quote timestamp or data license was introduced.
- `get_volatility_summary()` cache keys now include a snapshot fingerprint, so two different dataframes with the same omitted ticker label cannot share a volatility result.

## Known limitations

- Provider-level accuracy and completeness are not independently audited.
- News providers requiring keys may be unavailable; no agreement is implied by their presence in the router.
- Corporate-action and timezone edge cases remain a provider-data limitation and are disclosed rather than hidden.
- Live provider responses were not re-fetched for this audit; findings are source-derived and based on local code paths.
