# # forecast.py
# import numpy as np
# import pandas as pd
# from tensorflow.keras.models import load_model
# from sklearn.preprocessing import MinMaxScaler
# import pickle
# import os

# def load_forecast_model(model_path="lstm_multi_model.h5", scaler_path="scaler_multi.pkl"):
#     if not os.path.exists(model_path) or not os.path.exists(scaler_path):
#         raise FileNotFoundError("Trained multi-stock model not found. Run train_lstm_multi.py first.")
#     model = load_model(model_path)
#     with open(scaler_path, "rb") as f:
#         scaler = pickle.load(f)
#     return model, scaler


# def predict_and_forecast(data, model, scaler, forecast_days=10):
#     # Ensure 'Close' column exists
#     if 'Close' not in data.columns:
#         raise ValueError("Missing 'Close' column in input data.")

#     close_prices = data[['Close']].values
#     scaled_data = scaler.transform(close_prices)

#     # Prepare input sequences
#     X = []
#     for i in range(60, len(scaled_data)):
#         X.append(scaled_data[i - 60:i, 0])
#     X = np.array(X)
#     X = X.reshape((X.shape[0], X.shape[1], 1))

#     predicted_scaled = model.predict(X)
#     predicted_prices = scaler.inverse_transform(predicted_scaled)
#     actual_prices = close_prices[-len(predicted_prices):]

#     # Forecast next n days
#     forecast_input = scaled_data[-60:]
#     forecast = []
#     for _ in range(forecast_days):
#         pred = model.predict(forecast_input.reshape(1, 60, 1))[0, 0]
#         forecast.append(pred)
#         forecast_input = np.append(forecast_input[1:], [[pred]], axis=0)
#     forecast = scaler.inverse_transform(np.array(forecast).reshape(-1, 1))
#     forecast_dates = pd.date_range(start=data.index[-1], periods=forecast_days + 1)[1:]

#     return actual_prices.flatten(), predicted_prices.flatten(), forecast.flatten(), forecast_dates

# # forecast_multi.py
# import numpy as np
# import pandas as pd
# from tensorflow.keras.models import load_model
# import pickle

# def load_forecast_model(model_path="lstm_multi_model.h5", scaler_path="scalers_multi.pkl"):
#     model = load_model(model_path)
#     with open(scaler_path, "rb") as f:
#         scalers = pickle.load(f)
#     return model, scalers

# def forecast_stock(df, model, scaler, forecast_days=10, window_size=60):
#     close_prices = df[["Close"]].values
#     scaled_data = scaler.transform(close_prices)

#     # Create sequences for last known period
#     X = []
#     for i in range(window_size, len(scaled_data)):
#         X.append(scaled_data[i-window_size:i, 0])
#     X = np.array(X).reshape((-1, window_size, 1))

#     predicted_scaled = model.predict(X)
#     predicted_prices = scaler.inverse_transform(predicted_scaled)

#     # Forecast future
#     forecast_input = scaled_data[-window_size:]
#     forecast = []
#     for _ in range(forecast_days):
#         pred = model.predict(forecast_input.reshape(1, window_size, 1))[0, 0]
#         forecast.append(pred)
#         forecast_input = np.append(forecast_input[1:], [[pred]], axis=0)

#     forecast = scaler.inverse_transform(np.array(forecast).reshape(-1, 1))
#     forecast_dates = pd.date_range(start=df.index[-1], periods=forecast_days+1, freq="B")[1:]

#     return predicted_prices.flatten(), forecast.flatten(), forecast_dates




# # forecast_multi.py
# import numpy as np
# import pandas as pd
# from tensorflow.keras.models import load_model
# import pickle
# import os

# def load_forecast_model(model_path="lstm_multi_final.h5", scalers_path="scalers_multi.pkl"):
#     """
#     Returns: model, scalers_dict
#     scalers_dict should be a dict like {'AAPL': MinMaxScaler(), 'TSLA': MinMaxScaler(), ...}
#     """
#     if not os.path.exists(model_path) or not os.path.exists(scalers_path):
#         raise FileNotFoundError("Trained model or scalers not found. Run train_lstm_multi.py first.")
#     model = load_model(model_path)
#     with open(scalers_path, "rb") as f:
#         scalers = pickle.load(f)
#     return model, scalers

# def forecast_stock(df, model, scaler, forecast_days=10, window_size=60):
#     """
#     df: DataFrame with index dates and a 'Close' column
#     model: loaded Keras model
#     scaler: a fitted sklearn MinMaxScaler for this ticker (must implement .transform and .inverse_transform)
#     Returns:
#       actual_prices (1D numpy array)  - actual close values aligned with predicted
#       predicted_prices (1D numpy array)
#       forecast (1D numpy array)       - next `forecast_days` predicted prices (unscaled)
#       forecast_dates (DatetimeIndex)
#     """
#     if 'Close' not in df.columns:
#         raise ValueError("DataFrame must contain 'Close' column.")

#     close_prices = df[['Close']].values
#     if len(close_prices) < window_size + 1:
#         raise ValueError(f"Not enough data (need at least {window_size+1} rows).")

#     # scale
#     scaled_data = scaler.transform(close_prices)

#     # build sequences for historical prediction
#     X = []
#     for i in range(window_size, len(scaled_data)):
#         X.append(scaled_data[i-window_size:i, 0])
#     X = np.array(X).reshape((-1, window_size, 1))

#     # predicted on historical sequences
#     predicted_scaled = model.predict(X)
#     predicted_prices = scaler.inverse_transform(predicted_scaled).flatten()

#     # actual values aligned with predictions
#     actual_prices = close_prices[-len(predicted_prices):].flatten()

#     # forecast next days (autoregressive on scaled space)
#     forecast_input = scaled_data[-window_size:].copy()
#     fut = []
#     for _ in range(forecast_days):
#         pred_scaled = model.predict(forecast_input.reshape(1, window_size, 1))[0, 0]
#         fut.append(pred_scaled)
#         forecast_input = np.append(forecast_input[1:], [[pred_scaled]], axis=0)

#     forecast = scaler.inverse_transform(np.array(fut).reshape(-1, 1)).flatten()
#     forecast_dates = pd.date_range(start=df.index[-1], periods=forecast_days + 1, freq="B")[1:]

#     return actual_prices, predicted_prices, forecast, forecast_dates


# forecast_multi.py
import numpy as np
import pandas as pd
import pickle
import os

# Moved heavy imports to local scope to save RAM
# import tensorflow as tf
# from tensorflow.keras.models import load_model

# =====================================================================
# 1. Custom Attention Layer (Fully Keras Compatible)
# =====================================================================
# Custom Attention Layer (Imported locally in functions)
def _get_attention_layer():
    import tensorflow as tf
    @tf.keras.utils.register_keras_serializable()
    class SimpleAttention(tf.keras.layers.Layer):
        def __init__(self, **kwargs):
            super(SimpleAttention, self).__init__(**kwargs)

        def call(self, inputs):
            score = tf.nn.softmax(inputs, axis=1)
            context = score * inputs
            return tf.reduce_sum(context, axis=1)

        def get_config(self):
            config = super(SimpleAttention, self).get_config()
            return config
    return SimpleAttention

# =====================================================================
# 2. Load Model + Scalers
# =====================================================================
def load_forecast_model(model_path="lstm_attention_final.h5",
                        scalers_path="scalers_multi.pkl"):

    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model not found: {model_path}")

    if not os.path.exists(scalers_path):
        raise FileNotFoundError(f"Scalers not found: {scalers_path}")

    import tensorflow as tf
    from tensorflow.keras.models import load_model
    from tensorflow.keras.losses import MeanSquaredError
    from tensorflow.keras.metrics import MeanAbsoluteError

    # Load model with proper custom objects
    model = load_model(
        model_path,
        custom_objects={
            "SimpleAttention": _get_attention_layer(),
            "mse": MeanSquaredError(),
            "mae": MeanAbsoluteError()
        }
    )

    with open(scalers_path, "rb") as f:
        scalers = pickle.load(f)

    return model, scalers

# =====================================================================
# 3. Forecast Function
# =====================================================================
def forecast_stock(df, model, scaler,
                   forecast_days=10, window_size=60):
    """
    df: dataframe containing a 'Close' column and datetime index
    model: loaded trained model
    scaler: fitted MinMaxScaler for this ticker
    """

    if "Close" not in df.columns:
        raise ValueError("DataFrame must contain 'Close' column.")

    close_prices = df["Close"].values.reshape(-1, 1)

    if len(close_prices) < window_size + 1:
        raise ValueError(
            f"Not enough data. Need at least {window_size+1} rows."
        )

    scaled_data = scaler.transform(close_prices)

    # =====================
    # Historical Prediction
    # =====================
    X_hist = []
    for i in range(window_size, len(scaled_data)):
        X_hist.append(scaled_data[i-window_size:i, 0])

    X_hist = np.array(X_hist).reshape((-1, window_size, 1))
    predicted_scaled = model.predict(X_hist, verbose=0)
    predicted_prices = scaler.inverse_transform(predicted_scaled).flatten()

    actual_prices = close_prices[-len(predicted_prices):].flatten()

    # =====================
    # Forward Forecast
    # =====================
    forecast_input = scaled_data[-window_size:].copy()
    future_scaled = []

    for _ in range(forecast_days):
        pred = model.predict(forecast_input.reshape(1, window_size, 1), verbose=0)[0, 0]
        future_scaled.append(pred)
        forecast_input = np.append(forecast_input[1:], [[pred]], axis=0)

    forecast = scaler.inverse_transform(np.array(future_scaled).reshape(-1, 1)).flatten()

    # Generate forecast dates (next business days)
    forecast_dates = pd.date_range(
        start=df.index[-1],
        periods=forecast_days + 1,
        freq="B"
    )[1:]

    return actual_prices, predicted_prices, forecast, forecast_dates

# =====================================================================
# 4. Example Usage
# =====================================================================
if __name__ == "__main__":
    # Example: load model + scalers
    model, scalers = load_forecast_model()

    # Example: load stock data
    import yfinance as yf
    df = yf.download("AAPL", period="1y", interval="1d")[["Close"]].dropna()

    # Forecast
    actual, predicted, forecast, dates = forecast_stock(
        df, model, scalers["AAPL"], forecast_days=10
    )

    print("Actual:", actual[-5:])
    print("Predicted:", predicted[-5:])
    print("Forecast:", forecast)
    print("Forecast dates:", dates)
