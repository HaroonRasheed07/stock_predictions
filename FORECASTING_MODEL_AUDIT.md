# Forecasting Model Audit

**Date:** 2026-11-24
**Scope:** LSTM/ONNX training and inference pipeline, public model claims and output validation.

## Training pipeline (source-derived)

| Stage | Evidence | Behavior |
|---|---|---|
| Source data | `train_lstm_test_multi.py:59-100` | Yahoo Finance daily Close for 20 tickers; default span ~2y in script defaults. Artifact metadata elsewhere describes ~5y with unknown exact dates; this discrepancy is disclosed. |
| Scaling | `:103-130`, `:533`, `:949` | Per-ticker MinMaxScaler dictionary; chronological split fits the first 70%, while default artifact reuse behavior must be assumed unless regenerated. |
| Samples | `:140-147` | X = 60 scaled closes, y = next scaled close. |
| Split | `:153-184` | Chronological 70/15/15 per ticker, then stacked. |
| Architecture | `:33-56` | BiLSTM(64) → Dropout(0.2) → BiLSTM(32) → Dropout(0.2) → SimpleAttention → Dense(32) → Dense(1). |
| Promotion | `:633-740` | RMSE/MAE within +2%, directional accuracy/R² within −0.05 of baseline. |
| Export | `:748-869` | Keras H5 → tf2onnx opset 13 → parity/smoke checks → backup/atomic replacement. |
| Report | `:877-941` | JSON/TXT training report artifacts. |

## Production pipeline

- `POST /api/forecast/onnx` — `stock_market/api.py:2233+`.
- Model and scalers loaded once at app startup; failure leaves the model unavailable.
- `load_data()` supplies Close values; rows are dropped for NaN and at least 61 observations are required.
- Scaler source is now returned in `model_metadata.scaler_source`:
  - `pre_fitted` for tickers present in `scalers_multi.pkl`;
  - `fitted_on_request` for unseen tickers (documented limitation, not a training-backed forecast).
- `forecast_onnx.py` transforms the whole close series for the historical reconstruction, then recursively feeds the last 60 scaled values forward for each step.
- Dates come from `pd.date_range(freq="B")[1:]` — weekdays only; exchange holidays are not modeled.
- Output type is now explicitly `point_estimate` with `confidence_intervals: false`.

## Claim corrections

- Removed “probabilistic projections with confidence ranges” from forecast metadata.
- Relabelled “Historical fit (MAPE-based)” as an in-sample fit proxy.
- Relabelled “Overall Accuracy” as a historical technical signal hit rate in the Research Brief.
- Corrected trading-calendar language to weekday steps with no holiday handling.
- Documented the fallback scaler and absent walk-forward evidence in public methodology and Learn content.

## Integrity fixes

- `forecast_stock()` now rejects non-finite historical reconstruction prices.
- It now rejects non-finite or non-positive forward forecast prices instead of letting them reach the UI.
- The API returns a clear validation message for `ValueError` and a separate generic unavailable message for unexpected exceptions.
- The frontend `fetchForecast()` rejects empty, non-finite or non-positive price arrays before rendering.

## Limitations

- Historical reconstruction is **not** out-of-sample forecast validation.
- No calibrated uncertainty, prediction interval or probability distribution is produced.
- The model sees closing price only; it does not ingest news, volume, fundamentals or macro releases.
- Recursive forecasts can compound error.
- No claim is made that this model outperforms a naive or statistical baseline.
