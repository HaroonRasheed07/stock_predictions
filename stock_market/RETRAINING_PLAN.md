# Forecast model retraining plan (PROPOSAL — do not run without approval)

Status: **proposed, not started.** No training job has been run for this plan.
Owner decision required before Phase 0 executes.

## Why retrain

- `scalers_multi.pkl` (fitted 2026-09-11) is stale; Phase 1 mitigates at inference
  time by refitting a window scaler per request, but the model itself was trained
  on an older price regime.
- Training report shows mean-reversion bias: AAPL smoke test forecast sat below
  the live close, DirectionalAccuracy ≈ 0.50–0.57 with negative directional bias,
  AAPL R² = −1.69. Several tickers now trip the Phase-1 quality guard and are
  refused (see `forecast_refusals.log` — daily refusal rate).
- Retraining with modern normalization keeps new price highs in-distribution
  structurally, instead of relying only on the guard.

## Goals / acceptance gates (must ALL pass before deploy)

1. Holdout (last 20% chronological) MAPE per ticker ≤ the current model's on the
   same split, reported in a training report.
2. Day-1 |gap| ≤ 6% and horizon |gap| ≤ 25% vs last close on 100% of the tracked
   universe at evaluation time (i.e. the quality guard rarely refuses).
3. Directional accuracy on holdout > 50% per ticker median (report per ticker;
   honest disclosure of weak tickers — drop or flag them).
4. Forecast bias (mean signed error) within ±1% of last close.
5. Existing pytest suite passes; new model artifacts smoke-tested through
   `/api/forecast/onnx` before deployment.

## Phase 0 — data refresh

- Reload OHLCV for the full tracked universe through the latest completed
  session (existing `load_data`, no new data sources).
- Keep chronological order; train/val/test = 70/15/15 (no shuffling across time).
- Minimum history: 3 years daily (configurable); tickers with insufficient data
  are excluded and reported.

## Phase 1 — normalization (choose ONE; recommendation first)

**A (recommended): log-returns sequences.** Train inputs/outputs on
`log(C_t / C_{t-1})` over the 60-day window. Log-returns are stationary and
scale-free: a stock at a new all-time high produces ordinary values, so the
sequence is always in-distribution. Forecast output = cumulative sum of predicted
returns, converted back with the last close.

**B: last-close-relative prices.** Normalize each window as `P_t / P_last - 1`.
Simpler, keeps price-shape readable, but bounded less tightly than log-returns
during gaps.

**C: rolling-window MinMax (current behavior).** Refit MinMax per window —
already used at inference post-Phase 1; least preferred as the *training*
normalization because the model still sees only [0,1]-shaped data fitted to a
window whose range varies.

Whichever is chosen: `scaler_method` string (e.g. `log_returns_v2`) is written
into the training report and stored with every forecast.

## Phase 2 — training

- Base on the existing `train_lstm_test_multi.py` pipeline (window 60,
  LSTM+attention, per-ticker or shared weights — keep current shared model for
  comparability; evaluate per-ticker heads only if shared fails gates).
- Hyperparameters: keep current architecture first; only tune (lookback,
  units, dropout, epochs) if gates fail, and record every experiment in the
  training report JSON.
- Fixed seeds for reproducibility; `model_version` =
  `YYYY.MM.<run>` (e.g. `2026.11.1`).

## Phase 3 — versioning with every stored forecast

Every cached/returned forecast payload gains (server-side):

- `model_version` — from the training report of the loaded artifact.
- `scaler_method` — e.g. `log_returns_v2`.
- `trained_at` — UTC timestamp from the training report.

These are appended to the forecast response metadata and written into
`forecast_model_training_report_<version>.json`. Clients can show them
transparenly later; nothing about them is user-facing yet.

## Phase 4 — monthly scheduled retrain (approval required to create)

Proposal (GitHub Actions, no paid services):

- `workflow_dispatch` + `schedule` (monthly, e.g. 1st of month 03:00 UTC).
- Steps: refresh data → train → run ALL acceptance gates → on failure: job fails,
  artifacts untouched; on success: upload new `lstm_attention_final.onnx` +
  `scalers_multi.pkl` + training report as artifacts and open a PR / commit to a
  release branch — **never auto-deploy to Render**.
- Deploy stays manual: merge → Render picks up `main` → smoke-test
  `/api/forecast/onnx` → monitor `forecast_refusals.log` daily for the first week.
- Rollback: revert the artifact commit (previous model files are in git history).

## Phase 5 — monitoring

- Daily count of refusal records in `forecast_refusals.log`
  (`grep -c '"date":"YYYY-MM-DD"'` or count distinct tickers per day).
- Target: refusal rate < 5% of tracked-universe forecast requests per day;
  investigate any ticker refused 3 days in a row (retrain data issue or ticker
  should be flagged as "model unsuitable" and withheld).

## What is NOT included

- No change to sentiment/news systems (off limits).
- No new paid APIs or data sources.
- No automatic deployment of new model artifacts.
- Running any of the above requires explicit approval.
