# StockVantex Homepage Market Snapshot Bug Report

Date: 2026-11-24
Repository: `E:\fyp_web`
Checkout: `main` at `a511195`
Deployment: none performed

## 1. Symptoms investigated

Affected homepage areas:

- `Today's market read` — `Syncing snapshot...`, `The breadth scan is refreshing for this snapshot...`, `Updating snapshot...`
- `Scan the universe` — `The market scan is syncing for this snapshot.`, `Syncing`
- `Daily move heatmap` — `The heatmap updates with each scan.`, `Updating`

The same served page also showed `Snapshot refreshed just now`, so the page appeared to be simultaneously fresh and stuck loading.

## 2. Evidence collected

### 2.1 Live production probes

| Probe | Result |
|---|---|
| `GET /api/market/indices` | HTTP 200, 0.32s, 4 index rows, `_cache_meta.status=HIT`, `updated_at=1795510993.197056` |
| `GET /api/market/status` | HTTP 200, 0.18s, valid status/label/timezone payload |
| `GET /api/home/brief` | HTTP 200, 0.20s, 1 selected stock, `status=HIT`, `updated_at=1795511479.7043574` |
| `POST /api/discover/scan` | HTTP 200, 0.20s, 10 stocks, `status=HIT`, `updated_at=1795511521.4922628` |
| `POST /api/opportunities/scan` | HTTP 200, 0.27s, 20 opportunity rows, `status=HIT`, `updated_at=1795511523.0945828` |
| `GET https://stockvantex.com/` | HTTP 200, 0.50s, 199,941 bytes, `syncing=5`, `available=0`, `justnow=7` |

Live HTML extraction confirmed all three affected sections rendered their loading copy while `Snapshot refreshed just now` appeared seven times.

This ruled out a currently-down backend and showed that the served HTML was an ISR page generated during an earlier partial/failed upstream response.

### 2.2 Code-path evidence

- `src/app/page.tsx:19-20` keeps the homepage on ISR with `revalidate = 600`.
- `src/app/page.tsx:58-59` calls `getHomeData()`.
- `src/app/page.tsx:104-120` passed one server-built snapshot into `MarketRead`, `ScanTabs` and `Heatmap`.
- `src/lib/home-data.ts` previously used `Promise.all` around chunked scan wrappers. A single failed chunk could discard the whole discover/opportunity result.
- `fetchDiscoverScanAll()` and `fetchOpportunityScanAll()` previously used `Promise.all`; one rejected chunk rejected all chunks.
- MISS cache metadata uses `updated_at: 0.0` in `stock_market/cache_manager.py`, which the frontend rejects. The fresh hero-brief cache timestamp could still be chosen, producing `Snapshot refreshed just now` beside missing universe data.
- The three sections had no shared client refresh, no last-good snapshot state, no overlap guard and no stale-response guard. Their loading labels were open-ended and remained visible until the next ISR regeneration.

## 3. Root cause

The homepage treated the universe scan as all-or-nothing. When one chunked upstream scan failed or returned an unusable SWR MISS, the server aggregation discarded otherwise usable data, derived breadth/scan/heatmap as empty, and passed open-ended “syncing/updating” states to all three sections. A separate fresh timestamp from `/api/home/brief` was still selected, so the stale/partial page claimed it had just been refreshed. Because the page is ISR with a 10-minute window, the bad generated HTML could keep being served after upstream endpoints recovered. There was no client-side refresh path to recover before the next regeneration.

Contributing factors:

1. Chunked scan wrappers used `Promise.all`, so one failed chunk destroyed all chunk results.
2. `getHomeData()` chose the newest available timestamp across independent cache sources instead of the timestamp of the data actually rendered.
3. The three sections rendered open-ended loading copy whenever derived data was null, with no distinction between “first load”, “partial refresh”, “stale” and “failed refresh”.
4. No last-good cache, no background client refresh, no in-flight guard and no request-sequence guard existed.

## 4. Fix implemented

### 4.1 Backend

- Added `POST /api/home/market-snapshot` in `stock_market/api.py`.
- The endpoint fetches discover chunks of 10 and opportunity chunks of 20 in parallel, keeps successful chunks when others fail, and returns `stocks`, `opportunities`, `source_updated_at`, `degraded` and `errors`.
- The endpoint uses SWR with `fresh_ttl_seconds=120` and `stale_ttl_seconds=86400`.
- On total upstream failure it restores the last good cached payload instead of replacing it with an empty snapshot.
- Added `schedule_on_miss=False` to `stock_market/cache_manager.py:get_swr()` so a cold miss computes synchronously once instead of scheduling a duplicate background refresh.

### 4.2 Frontend

- Added `src/lib/home-snapshot.ts`, a dependency-free pure module for validation, normalization, breadth/scan calculations, timestamp selection and last-good merging.
- Added `src/app/api/home/market-snapshot/route.ts` as the browser-safe refresh endpoint.
- `src/lib/api.ts`
  - Added the composite snapshot service.
  - Changed discover/opportunity chunk aggregation from `Promise.all` to `Promise.allSettled`, preserving successful chunks and reporting errors.
- `src/lib/home-data.ts`
  - Uses the composite snapshot as the single source for `discover`, `breadth`, `scan`, `highRiskCount` and the displayed timestamp.
  - Falls back to the legacy chunked path if the composite endpoint is unavailable.
  - Keeps a module-level last-good snapshot across failed refreshes.
- Added `src/components/home/MarketSnapshotProvider.tsx`
  - Shares one snapshot across all three sections.
  - Refreshes on a 5-minute interval and on tab visibility/focus, with a 60-second minimum gap.
  - Aborts on unmount and uses a 12-second timeout.
  - Uses `inFlightRef` to prevent overlap and `requestSeqRef` to prevent stale responses overwriting newer ones.
  - Never clears valid data when refresh fails.
- Added `src/components/home/SnapshotStatus.tsx`
  - Shows `Snapshot available`, `Refreshing`, `Cached snapshot` or `Refresh failed · last snapshot kept`.
  - Shows `Loading first snapshot` only when no usable snapshot exists; retry is available.
- Updated `MarketRead`, `ScanTabs` and `Heatmap` to consume the provider.
  - Data is retained during refresh and failure.
  - Skeleton/waiting copy appears only when there is no snapshot.
  - Empty results resolve to explicit empty-state copy.
  - All three sections derive from one snapshot and therefore share one timestamp.

## 5. Local reproduction and verification

The mock backend was extended with `MOCK_HOME_SNAPSHOT_MODE` for deterministic local states.

### Total upstream failure

Built with `MOCK_HOME_SNAPSHOT_MODE=error` and a cleared Next fetch cache:

- `Waiting for the first complete snapshot=3`
- `Loading first snapshot=3`
- `Snapshot available=0`
- legacy loading strings `Syncing snapshot`, `Updating snapshot`, `syncing for this snapshot`, `The heatmap updates with each scan`: all `0`

This reproduced the original class of failure only as a first-load skeleton; the failed state now resolves to explicit loading/retry copy instead of indefinite syncing.

### Partial upstream failure

Built with `MOCK_HOME_SNAPSHOT_MODE=partial`:

- `Cached snapshot=3`
- `Bullish stocks=1`
- `Waiting for the first complete snapshot=0`
- `Snapshot available=0`

Valid partial data stayed visible with an accurate stale badge.

### Healthy upstream

Built with `MOCK_HOME_SNAPSHOT_MODE=healthy`:

- `Snapshot available=3`
- `Cached snapshot=0`
- waiting/loading/old syncing strings all `0`
- `Bullish stocks=1`

## 6. Tests and checks

| Command | Result |
|---|---|
| `npm run home:snapshot:checks` | PASSED — 10/10 |
| `npx tsc --noEmit --incremental false` | PASSED |
| `npm run lint` | PASSED with one pre-existing warning in `src/app/markets/discover/page.tsx:150` |
| `python -m pytest tests -q` | PASSED — 72 tests |
| `npm run build` (mock backend) | PASSED — 124 pages, homepage remains ISR (`10m`) |
| `npm run seo:checks` | PASSED — 59 assertions |
| `npm run routing:checks` | PASSED — 72 gates |
| `npm run sitemap:checks` | PASSED — 64 gates |
| `npm run ga:checks` | PASSED — 56 gates |
| `npm run signal:checks` | PASSED — 102 checks |
| `npm run seo:regression` | PASSED — 39 gates |

New frontend checks cover successful snapshots, background merges, failed refresh retention, empty responses, invalid rows, cold failure, timestamp calculation, overlap/timeout/stale-response guards, shared-provider wiring and removal of the old loading copy.

New backend tests cover successful composite responses, partial chunk failure, empty upstream responses, invalid row filtering, last-good restoration on total failure and repeated requests for the same key.

## 7. Deployment note

No deploy was performed. Production behavior has not been re-verified after the fix. The generated `ROUTE_AND_INDEXABILITY_INVENTORY.csv` and `stock_market/market_cache.db` were restored after running the full test suite.

Root cause: CONFIRMED
Fix: PASSED locally (not deployed)
Frontend tests: PASSED
Backend tests: PASSED
Production build: PASSED
