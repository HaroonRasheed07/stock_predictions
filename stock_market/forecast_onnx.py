import numpy as np
import pandas as pd
import pickle
import os
import onnxruntime as ort
import logging
from sklearn.preprocessing import MinMaxScaler


# ── Quality thresholds (documented, conservative) ────────────────────────────
# Day-1 close-to-close gaps beyond this are never a legitimate next-session
# prediction for a liquid equity — they indicate scaling/inverse bugs. Set to
# 6% to catch the observed production defect (AAPL day-1 ~7.3% below close).
MAX_DAY1_GAP = 0.06
# Cumulative gap over the whole horizon beyond this is treated as model drift.
MAX_HORIZON_GAP = 0.25
# A point-forecast span narrower than this fraction of the typical cumulative
# move (ATR14 * sqrt(horizon)) is implausibly narrow to display as a range.
MIN_RANGE_VS_ATR = 0.15


def fit_inference_scaler(closes: np.ndarray) -> MinMaxScaler:
    """Fit a MinMaxScaler on the *inference* window.

    Training-time per-ticker scalers go stale as prices drift (the pkl was
    fitted in Sep 2026; AAPL has since traded well above its fitted max, which
    pushed scaled inputs above 1.0 and inverse-transformed forecasts back into
    the old price band). The model learned dynamics on [0, 1] sequences, so
    renormalizing the current window keeps inference in-distribution and makes
    inverse_transform land at current price levels.
    """
    closes = np.asarray(closes, dtype=np.float32).reshape(-1, 1)
    scaler = MinMaxScaler(feature_range=(0, 1))
    scaler.fit(closes)
    return scaler


def forecast_quality_issues(
    last_close: float,
    forecast_prices,
    atr14: float | None = None,
    forecast_days: int = 10,
) -> list:
    """Sanity guards between last close and the point-forecast path.

    Returns a list of human-readable issues; empty list means the forecast is
    displayable. Pure function — unit-tested.
    """
    issues = []
    fc = np.asarray(forecast_prices, dtype=np.float64).flatten()

    if fc.size == 0:
        issues.append("empty forecast")
        return issues
    if not np.all(np.isfinite(fc)):
        issues.append("non-finite forecast values")
        return issues
    if not np.isfinite(last_close) or last_close <= 0:
        issues.append("invalid last close")
        return issues

    day1_gap = abs(fc[0] - last_close) / last_close
    if day1_gap > MAX_DAY1_GAP:
        issues.append(
            f"day-1 forecast deviates {day1_gap:.1%} from last close (limit {MAX_DAY1_GAP:.0%})"
        )

    horizon_gap = abs(fc[-1] - last_close) / last_close
    if horizon_gap > MAX_HORIZON_GAP:
        issues.append(
            f"horizon endpoint deviates {horizon_gap:.1%} from last close (limit {MAX_HORIZON_GAP:.0%})"
        )

    if atr14 is not None and np.isfinite(atr14) and atr14 > 0:
        width = float(fc.max() - fc.min())
        expected_move = atr14 * np.sqrt(max(forecast_days, 1))
        if width < MIN_RANGE_VS_ATR * expected_move:
            issues.append(
                f"forecast range ${width:.2f} is implausibly narrow vs typical "
                f"${expected_move:.2f} move over {forecast_days} sessions"
            )

    return issues


def validate_forecast_inputs(df, session, scaler, forecast_days=10, window_size=60):
    """
    Pre-flight validation before running forecast.
    Returns list of issues (empty = OK).
    """
    issues = []

    if df is None or (hasattr(df, 'empty') and df.empty):
        issues.append("DataFrame is None or empty")
    elif "Close" not in df.columns:
        issues.append("DataFrame missing 'Close' column")

    if df is not None and hasattr(df, '__len__') and len(df) < window_size + 1:
        issues.append(f"Insufficient data: {len(df)} rows, need {window_size + 1}")

    if session is None:
        issues.append("ONNX session is None")

    if scaler is None:
        issues.append("Scaler is None")

    if not isinstance(forecast_days, int) or forecast_days < 1 or forecast_days > 30:
        issues.append(f"forecast_days={forecast_days} out of reasonable range [1, 30]")

    return issues


def load_forecast_model(model_path="lstm_attention_final.onnx", scalers_path="scalers_multi.pkl"):
    """
    Load the ONNX model and scalers once.
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    model_full_path = model_path if os.path.isabs(model_path) else os.path.join(base_dir, model_path)
    scalers_full_path = scalers_path if os.path.isabs(scalers_path) else os.path.join(base_dir, scalers_path)

    if not os.path.exists(model_full_path):
        raise FileNotFoundError(f"Model not found: {model_full_path}")
    
    if not os.path.exists(scalers_full_path):
        raise FileNotFoundError(f"Scalers not found: {scalers_full_path}")

    # Initialize ONNX Runtime session
    session = ort.InferenceSession(model_full_path, providers=['CPUExecutionProvider'])
    
    with open(scalers_full_path, "rb") as f:
        scalers = pickle.load(f)

    return session, scalers

def forecast_stock(df, session, scaler=None, forecast_days=10, window_size=60):
    """
    df: dataframe containing a 'Close' column and datetime index (used ONLY for fetching data and date handling)
    session: loaded ONNX inference session
    scaler: optional pre-fitted MinMaxScaler. When None (production default)
            a scaler is fitted on this request's own price window so stale
            training-time scalers can never mis-scale drifted prices.
    """
    if "Close" not in df.columns:
        raise ValueError("DataFrame must contain 'Close' column.")

    # ⚠️ 4. REMOVE PANDAS FROM PIPELINE LOGIC (Convert to pure NumPy immediately)
    close_prices = df["Close"].values.reshape(-1, 1).astype(np.float32)

    if len(close_prices) < window_size + 1:
        raise ValueError(f"Not enough data. Need at least {window_size+1} rows.")

    if scaler is None:
        scaler = fit_inference_scaler(close_prices)

    scaled_data = scaler.transform(close_prices).astype(np.float32)
    input_name = session.get_inputs()[0].name

    # =====================
    # Historical Prediction
    # =====================
    X_hist = []
    for i in range(window_size, len(scaled_data)):
        X_hist.append(scaled_data[i-window_size:i, 0])

    X_hist = np.array(X_hist, dtype=np.float32).reshape((-1, window_size, 1))
    
    # ⚠️ 3. STRICT ONNX INPUT VALIDATION
    if X_hist.shape[1:] != (window_size, 1):
        raise ValueError(f"Input shape mismatch. Expected (N, {window_size}, 1), got {X_hist.shape}")
    if X_hist.dtype != np.float32:
        raise ValueError(f"Input dtype mismatch. Expected float32, got {X_hist.dtype}")

    predicted_scaled = session.run(None, {input_name: X_hist})[0]
    
    # ⚠️ 3. STRICT ONNX OUTPUT VALIDATION
    if len(predicted_scaled.shape) > 2 or (len(predicted_scaled.shape) == 2 and predicted_scaled.shape[1] != 1):
        logging.warning(f"Unexpected output shape from historical ONNX prediction: {predicted_scaled.shape}")

    predicted_prices = scaler.inverse_transform(predicted_scaled).flatten()
    actual_prices = close_prices[-len(predicted_prices):].flatten()

    # =====================
    # Forward Forecast
    # =====================
    forecast_input = scaled_data[-window_size:].copy()
    future_scaled = []

    for _ in range(forecast_days):
        input_tensor = forecast_input.reshape(1, window_size, 1).astype(np.float32)
        
        # ⚠️ 3. STRICT ONNX INPUT VALIDATION
        if input_tensor.shape != (1, window_size, 1):
            raise ValueError(f"Forecast Input shape mismatch. Expected (1, {window_size}, 1), got {input_tensor.shape}")
            
        pred = session.run(None, {input_name: input_tensor})[0]
        
        # ⚠️ 3. STRICT ONNX OUTPUT VALIDATION
        if len(pred.shape) > 2 or (len(pred.shape) == 2 and pred.shape[1] != 1):
            logging.warning(f"Unexpected output shape from forward ONNX prediction: {pred.shape}")
            
        pred_val = pred[0, 0]
        future_scaled.append(pred_val)
        forecast_input = np.append(forecast_input[1:], [[pred_val]], axis=0).astype(np.float32)

    forecast = scaler.inverse_transform(np.array(future_scaled).reshape(-1, 1)).flatten()

    # ⚠️ 4. Use Pandas ONLY for date handling
    forecast_dates = pd.date_range(
        start=df.index[-1],
        periods=forecast_days + 1,
        freq="B"
    )[1:]

    return actual_prices, predicted_prices, forecast, forecast_dates
