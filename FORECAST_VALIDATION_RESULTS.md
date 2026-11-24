# Forecast Validation Results

**Date:** 2026-11-24
**Status:** `UNVERIFIED PREDICTIVE SKILL — NO NEW ACCURACY CLAIM`

## Evidence reviewed

- Training source: `stock_market/train_lstm_test_multi.py`.
- Training artifacts: `lstm_attention_final.onnx`, `scalers_multi.pkl`, and JSON/TXT report outputs where present.
- Inference code: `stock_market/forecast_onnx.py`, `stock_market/api.py`.
- Public copy: forecast page, methodology, Learn forecasting articles.

## What exists

- A chronological holdout step is present in the training script.
- A small holdout report exists for AAPL and MSFT only.
- Promotion thresholds compare candidate metrics with a baseline during training.
- ONNX export includes parity/smoke checks before artifact replacement.
- The forecast page displays an in-sample MAPE-derived reconstruction score.

## What does not exist in reviewable form

- No walk-forward fold results across symbols and time periods.
- No out-of-sample MAE, RMSE, MAPE or sMAPE table for the deployed ONNX artifact.
- No directional accuracy table by horizon (day +1 through day +10).
- No naive baseline comparison (for example last-close, random walk or moving average).
- No calibrated interval coverage test.
- No reproducible script in the repository that regenerates all reported metrics from the deployed artifact.
- No basis for claiming superior forecast accuracy.

## Interpretation of the displayed percentage

The forecast page percentage is derived from `actual_prices` versus `predicted_historical_prices`. These predictions are produced by running ONNX inference over historical 60-close windows used in reconstruction. This measures how closely the saved model reproduces seen history. It is not a forecast track record, not backtested trading performance and not a probability.

## Integrity tests run in this task

- Non-finite historical reconstruction output is rejected.
- Non-finite forward output is rejected.
- Non-positive forward prices are rejected.
- Frontend rejects invalid forecast arrays.
- Full backend suite: **66 passed**.

These tests validate pipeline safety only. They do **not** validate predictive skill.

## Required for a future PASS

1. Freeze the deployed model + scaler artifact hash.
2. Define tickers, date range, train/validation/test splits and no-lookahead rules.
3. Generate walk-forward out-of-sample forecasts for each horizon.
4. Report MAE, RMSE, MAPE/sMAPE, directional accuracy and naive-baseline deltas in a versioned file.
5. Publish the generator script and artifact hash in the report.
6. Only then update public claims; keep point-estimate and no-interval wording unless calibrated intervals are separately validated.

## Verdict

Predictive accuracy remains **unverified**. Public wording now reflects that limitation and no accuracy superiority is claimed.
