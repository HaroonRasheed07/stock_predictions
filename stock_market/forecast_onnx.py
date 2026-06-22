import numpy as np
import pandas as pd
import pickle
import os
import onnxruntime as ort
import logging

def load_forecast_model(model_path="lstm_attention_final.onnx", scalers_path="scalers_multi.pkl"):
    """
    Load the ONNX model and scalers once.
    """
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model not found: {model_path}")
    
    if not os.path.exists(scalers_path):
        raise FileNotFoundError(f"Scalers not found: {scalers_path}")

    # Initialize ONNX Runtime session
    session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
    
    with open(scalers_path, "rb") as f:
        scalers = pickle.load(f)

    return session, scalers

def forecast_stock(df, session, scaler, forecast_days=10, window_size=60):
    """
    df: dataframe containing a 'Close' column and datetime index (used ONLY for fetching data and date handling)
    session: loaded ONNX inference session
    scaler: fitted MinMaxScaler for this ticker
    """
    if "Close" not in df.columns:
        raise ValueError("DataFrame must contain 'Close' column.")

    # ⚠️ 4. REMOVE PANDAS FROM PIPELINE LOGIC (Convert to pure NumPy immediately)
    close_prices = df["Close"].values.reshape(-1, 1).astype(np.float32)

    if len(close_prices) < window_size + 1:
        raise ValueError(f"Not enough data. Need at least {window_size+1} rows.")

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
