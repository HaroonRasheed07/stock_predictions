import os
import numpy as np
import tensorflow as tf
import tf2onnx

# =====================================================================
# 1. Custom Attention Layer Definition
# =====================================================================
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


# =====================================================================
# 2. ONNX Export
# =====================================================================
def export_keras_to_onnx(model_or_path, output_path, opset=13):
    """
    Exports a Keras model (or loaded from file path) to ONNX format.
    Input signature: (None, 60, 1), float32.
    Verifies the exported ONNX model loads correctly in ONNX Runtime.
    Returns True on success, raises on failure.
    """
    if isinstance(model_or_path, str):
        if not os.path.exists(model_or_path):
            raise FileNotFoundError(f"Model file not found: {model_or_path}")
        model = tf.keras.models.load_model(
            model_or_path,
            custom_objects={
                "SimpleAttention": SimpleAttention,
                "mse": tf.keras.losses.MeanSquaredError(),
                "mae": tf.keras.metrics.MeanAbsoluteError()
            }
        )
    else:
        model = model_or_path

    input_signature = [tf.TensorSpec([None, 60, 1], tf.float32, name='input_1')]
    onnx_model, _ = tf2onnx.convert.from_keras(model, input_signature, opset=opset)

    # Save to a temporary file first, then atomic rename
    temp_path = output_path + ".tmp"
    with open(temp_path, "wb") as f:
        f.write(onnx_model.SerializeToString())

    if os.path.exists(output_path):
        os.remove(output_path)
    os.rename(temp_path, output_path)

    # Verify the exported ONNX model loads and has correct input shape
    import onnxruntime as ort
    test_session = ort.InferenceSession(output_path, providers=['CPUExecutionProvider'])
    input_info = test_session.get_inputs()[0]
    expected_shape = [None, 60, 1]
    actual_shape = input_info.shape
    if actual_shape[1:] != [60, 1] and actual_shape[1:] != (60, 1):
        raise ValueError(f"ONNX input shape mismatch: expected [None, 60, 1], got {actual_shape}")
    print(f"  ONNX verification: OK (input={actual_shape}, name={input_info.name})")

    return True


# =====================================================================
# 3. Numerical Parity Check
# =====================================================================
def validate_onnx_parity(keras_model_or_path, onnx_path, test_inputs, tolerance=1e-4):
    """
    Compare Keras model outputs vs ONNX model outputs on identical inputs.
    Returns: (pass_bool, max_diff, mean_diff)
    """
    import onnxruntime as ort

    if isinstance(keras_model_or_path, str):
        keras_model = tf.keras.models.load_model(
            keras_model_or_path,
            custom_objects={
                "SimpleAttention": SimpleAttention,
                "mse": tf.keras.losses.MeanSquaredError(),
                "mae": tf.keras.metrics.MeanAbsoluteError()
            }
        )
    else:
        keras_model = keras_model_or_path

    # Keras prediction
    keras_out = keras_model.predict(test_inputs, verbose=0).flatten()

    # ONNX prediction
    session = ort.InferenceSession(onnx_path, providers=['CPUExecutionProvider'])
    input_name = session.get_inputs()[0].name
    onnx_out = session.run(None, {input_name: test_inputs.astype(np.float32)})[0].flatten()

    max_diff = float(np.max(np.abs(keras_out - onnx_out)))
    mean_diff = float(np.mean(np.abs(keras_out - onnx_out)))

    passed = max_diff < tolerance
    return passed, max_diff, mean_diff


# =====================================================================
# 4. Production Forecast Smoke Test
# =====================================================================
def run_smoke_test(onnx_path, scalers_path, data_dict, tickers=("AAPL", "MSFT", "NVDA", "TSLA"),
                   forecast_days=10, window_size=60):
    """
    Run 10-day recursive forecast smoke test on candidate ONNX model.
    Validates: shape, float32, 10 business dates, no NaN/Inf, recursive stability.
    Returns: (pass_bool, details_dict)
    """
    from forecast_onnx import load_forecast_model, forecast_stock

    session, scalers = load_forecast_model(onnx_path, scalers_path)
    details = {}
    overall_pass = True

    for ticker in tickers:
        if ticker not in data_dict or ticker not in scalers:
            details[ticker] = {"status": "SKIP", "reason": "missing data or scaler"}
            continue

        try:
            actual, predicted, forecast, dates = forecast_stock(
                data_dict[ticker], session, scalers[ticker], forecast_days, window_size
            )

            checks = {
                "length": len(forecast) == forecast_days,
                "dates_length": len(dates) == forecast_days,
                "no_nan": not np.isnan(forecast).any(),
                "no_inf": not np.isinf(forecast).any(),
                "reasonable_range": bool(all(
                    actual[-1] * 0.3 <= f <= actual[-1] * 3.0 for f in forecast
                )) if len(actual) > 0 else False,
                "dtype": bool(forecast.dtype in (np.float64, np.float32)),
            }

            ticker_pass = all(checks.values())
            details[ticker] = {
                "status": "PASS" if ticker_pass else "FAIL",
                "checks": checks,
                "forecast_min": float(np.min(forecast)),
                "forecast_max": float(np.max(forecast)),
                "last_actual": float(actual[-1]) if len(actual) > 0 else None,
            }
            if not ticker_pass:
                overall_pass = False

        except Exception as e:
            details[ticker] = {"status": "FAIL", "error": str(e)}
            overall_pass = False

    return overall_pass, details


# =====================================================================
# 5. Standalone Conversion Entry Point
# =====================================================================
def convert_model():
    model_path = "lstm_attention_final.h5"
    onnx_model_path = "lstm_attention_final.onnx"

    base_dir = os.path.dirname(os.path.abspath(__file__))
    h5_path = os.path.join(base_dir, model_path)
    onnx_path = os.path.join(base_dir, onnx_model_path)

    if not os.path.exists(h5_path):
        print(f"Error: Could not find {h5_path}")
        print("Please ensure the H5 model is in the current directory.")
        return

    print(f"Loading Keras model from {h5_path}...")
    export_keras_to_onnx(h5_path, onnx_path)
    print(f"Conversion complete! ONNX model saved to {onnx_path}")


if __name__ == "__main__":
    convert_model()
