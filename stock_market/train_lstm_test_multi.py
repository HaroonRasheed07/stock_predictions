import os
import sys
import time
import json
import shutil
import argparse
import pickle
import numpy as np
import pandas as pd
import yfinance as yf
import tensorflow as tf
from tensorflow.keras.layers import Input, LSTM, Dense, Dropout, Bidirectional
from tensorflow.keras.models import Model
from tensorflow.keras.losses import MeanSquaredError
from tensorflow.keras.metrics import MeanAbsoluteError
from sklearn.preprocessing import MinMaxScaler
import onnxruntime as ort

# Import existing ONNX forecast module and ONNX converter module
from convert_to_onnx import export_keras_to_onnx, SimpleAttention
from forecast_onnx import forecast_stock, load_forecast_model

# Default production Tickers
DEFAULT_TICKERS = [
    "AAPL", "MSFT", "TSLA", "AMZN", "NVDA", "META", "GOOGL", "ORCL", "IBM", "NFLX",
    "CVNA", "TGL", "CRH", "ADBE", "FIX", "SOFI", "WBD", "AAL", "INTC", "HBI"
]

DEFAULT_WINDOW_SIZE = 60
DEFAULT_FORECAST_DAYS = 10


def build_base_model(window_size=DEFAULT_WINDOW_SIZE, learning_rate=0.001):
    """
    Build the exact original model architecture.
    """
    inputs = Input(shape=(window_size, 1), name="input_1")

    x = Bidirectional(LSTM(64, return_sequences=True), name="bidi_lstm_1")(inputs)
    x = Dropout(0.2, name="dropout_1")(x)

    x = Bidirectional(LSTM(32, return_sequences=True), name="bidi_lstm_2")(x)
    x = Dropout(0.2, name="dropout_2")(x)

    x = SimpleAttention(name="simple_attention")(x)

    x = Dense(32, activation="relu", name="dense_1")(x)
    outputs = Dense(1, name="output_dense")(x)

    model = Model(inputs, outputs, name="lstm_attention_stock_model")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate),
        loss=MeanSquaredError(),
        metrics=[MeanAbsoluteError()]
    )
    return model


def fetch_historical_data(tickers, data_mode="BALANCED"):
    """
    Fetch market data per ticker offline for training.
    """
    period_map = {
        "RECENT": "6mo",
        "BALANCED": "2y",
        "EXTENDED": "5y",
        "FULL": "10y"
    }
    period = period_map.get(data_mode.upper(), "2y")
    data_dict = {}

    for t in tickers:
        try:
            df = yf.download(t, period=period, interval="1d", progress=False)
            if df.empty:
                print(f"[WARN] No data returned for ticker {t}, skipping.")
                continue
            
            # Extract Close column regardless of multi-index
            if isinstance(df.columns, pd.MultiIndex):
                if ('Close', t) in df.columns:
                    close_series = df[('Close', t)]
                elif 'Close' in df.columns.get_level_values(0):
                    close_series = df['Close'].iloc[:, 0]
                else:
                    continue
            else:
                close_series = df['Close']
            
            df_clean = pd.DataFrame({"Close": close_series}).dropna()
            if len(df_clean) > DEFAULT_WINDOW_SIZE + 10:
                data_dict[t] = df_clean
        except Exception as e:
            print(f"[WARN] Error downloading {t}: {e}")
            continue

    if not data_dict:
        raise ValueError("[ERROR] No stock data could be fetched for any ticker.")
    
    return data_dict


def prepare_leakage_safe_dataset(data_dict, scalers_dict=None, scaler_mode="reuse", window_size=DEFAULT_WINDOW_SIZE):
    """
    Generate sequences ticker-by-ticker with chronological train/val/test splitting.
    Does NOT cross ticker boundaries.
    Does NOT use random shuffle.
    """
    train_X_list, train_y_list = [], []
    val_X_list, val_y_list = [], []
    test_X_list, test_y_list = [], []

    updated_scalers = {} if scaler_mode == "refit" else (scalers_dict or {})
    ticker_stats = []

    out_of_bounds_count = 0
    total_scaled_values = 0

    for ticker, df in data_dict.items():
        prices = df['Close'].values.reshape(-1, 1).astype(np.float32)
        dates = df.index

        if scaler_mode == "refit" or ticker not in updated_scalers:
            scaler = MinMaxScaler(feature_range=(0, 1))
            # Fit scaler only on chronological train portion (first 70%) to avoid data leakage
            train_cutoff_idx = int(len(prices) * 0.70)
            scaler.fit(prices[:train_cutoff_idx])
            updated_scalers[ticker] = scaler
        else:
            scaler = updated_scalers[ticker]

        scaled_prices = scaler.transform(prices).astype(np.float32)

        # Check for out-of-bounds prices
        oob_low = np.sum(scaled_prices < 0.0)
        oob_high = np.sum(scaled_prices > 1.0)
        out_of_bounds_count += int(oob_low + oob_high)
        total_scaled_values += len(scaled_prices)

        # Build chronological sequences per ticker
        X_ticker, y_ticker = [], []
        for i in range(window_size, len(scaled_prices)):
            X_ticker.append(scaled_prices[i - window_size:i, 0])
            y_ticker.append(scaled_prices[i, 0])

        X_ticker = np.array(X_ticker, dtype=np.float32).reshape(-1, window_size, 1)
        y_ticker = np.array(y_ticker, dtype=np.float32)

        num_seq = len(X_ticker)
        if num_seq < 10:
            continue

        # Chronological split: 70% Train, 15% Val, 15% Test
        train_end = int(num_seq * 0.70)
        val_end = int(num_seq * 0.85)

        train_X_list.append(X_ticker[:train_end])
        train_y_list.append(y_ticker[:train_end])

        val_X_list.append(X_ticker[train_end:val_end])
        val_y_list.append(y_ticker[train_end:val_end])

        test_X_list.append(X_ticker[val_end:])
        test_y_list.append(y_ticker[val_end:])

        ticker_stats.append({
            "ticker": ticker,
            "raw_rows": len(df),
            "sequences": num_seq,
            "date_range": f"{dates[0].strftime('%Y-%m-%d')} to {dates[-1].strftime('%Y-%m-%d')}"
        })

    total_sequences = sum(s["sequences"] for s in ticker_stats)
    for s in ticker_stats:
        s["pct_contribution"] = round((s["sequences"] / total_sequences) * 100, 2) if total_sequences > 0 else 0.0

    X_train = np.vstack(train_X_list)
    y_train = np.concatenate(train_y_list)

    X_val = np.vstack(val_X_list)
    y_val = np.concatenate(val_y_list)

    X_test = np.vstack(test_X_list)
    y_test = np.concatenate(test_y_list)

    dataset_summary = {
        "ticker_stats": ticker_stats,
        "out_of_bounds_count": out_of_bounds_count,
        "total_scaled_values": total_scaled_values,
        "train_samples": len(X_train),
        "val_samples": len(X_val),
        "test_samples": len(X_test)
    }

    # Per-ticker test splits for per-ticker evaluation
    X_test_per_ticker = test_X_list  # list of arrays, one per ticker
    y_test_per_ticker = test_y_list  # list of arrays, one per ticker
    test_ticker_names = list(data_dict.keys())

    return X_train, y_train, X_val, y_val, X_test, y_test, updated_scalers, dataset_summary, X_test_per_ticker, y_test_per_ticker, test_ticker_names


def compute_metrics(y_true, y_pred):
    """
    Calculate MAE, RMSE, MSE, R², Directional Accuracy, Directional Bias.
    y_true and y_pred are 1D numpy arrays.
    """
    y_true = np.asarray(y_true, dtype=np.float64).flatten()
    y_pred = np.asarray(y_pred, dtype=np.float64).flatten()

    mae = float(np.mean(np.abs(y_true - y_pred)))
    mse = float(np.mean((y_true - y_pred) ** 2))
    rmse = float(np.sqrt(mse))

    ss_res = np.sum((y_true - y_pred) ** 2)
    ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
    r2 = float(1.0 - (ss_res / ss_tot)) if ss_tot > 0 else 0.0

    # Directional Accuracy: compare sign of (pred[t] - true[t-1]) vs (true[t] - true[t-1])
    if len(y_true) > 1:
        diff_true = y_true[1:] - y_true[:-1]
        diff_pred = y_pred[1:] - y_true[:-1]
        same_direction = (np.sign(diff_true) == np.sign(diff_pred))
        directional_accuracy = float(np.mean(same_direction))
    else:
        directional_accuracy = 0.0

    directional_bias = float(np.mean(y_pred - y_true))

    return {
        "MAE": round(mae, 6),
        "RMSE": round(rmse, 6),
        "MSE": round(mse, 6),
        "R2": round(r2, 6),
        "DirectionalAccuracy": round(directional_accuracy, 6),
        "DirectionalBias": round(directional_bias, 6)
    }


def compute_per_ticker_metrics(model_or_session, X_test_per_ticker, y_test_per_ticker, ticker_names, is_onnx=False):
    """
    Evaluate model per-ticker on separate test subsets.
    Returns: (per_ticker_dict, aggregated_metrics)
    """
    per_ticker = {}
    all_preds, all_true = [], []

    for i, ticker in enumerate(ticker_names):
        X_t = X_test_per_ticker[i]
        y_t = y_test_per_ticker[i]
        if len(X_t) == 0:
            continue

        if is_onnx:
            input_name = model_or_session.get_inputs()[0].name
            preds = model_or_session.run(None, {input_name: X_t.astype(np.float32)})[0].flatten()
        else:
            preds = model_or_session.predict(X_t, verbose=0).flatten()

        per_ticker[ticker] = compute_metrics(y_t, preds)
        all_preds.append(preds)
        all_true.append(y_t)

    if all_preds:
        aggregated = compute_metrics(np.concatenate(all_true), np.concatenate(all_preds))
    else:
        aggregated = {}

    return per_ticker, aggregated


def evaluate_onnx_model(onnx_path, X_test, y_test):
    """
    Evaluate ONNX model on test set.
    """
    session = ort.InferenceSession(onnx_path, providers=['CPUExecutionProvider'])
    input_name = session.get_inputs()[0].name
    preds = session.run(None, {input_name: X_test.astype(np.float32)})[0].flatten()
    return compute_metrics(y_test, preds)


def apply_fine_tuning_strategy(model, strategy="B", learning_rate=1e-4):
    """
    Configure layer trainability according to chosen strategy.
    Strategy A: Full fine-tuning (all layers trainable).
    Strategy B: Conservative (freeze first Bidirectional LSTM layer).
    Strategy C: Light adaptation (freeze both Bidirectional LSTM layers).
    """
    strategy = strategy.upper()

    # Find Bidirectional wrapper layers by type (precise matching)
    bidi_layers = [l for l in model.layers if isinstance(l, tf.keras.layers.Bidirectional)]

    if strategy == "B":
        # Freeze first Bidirectional layer only
        if len(bidi_layers) >= 1:
            bidi_layers[0].trainable = False
            print(f"  Frozen: {bidi_layers[0].name}")
    elif strategy == "C":
        # Freeze both Bidirectional layers
        for layer in bidi_layers:
            layer.trainable = False
            print(f"  Frozen: {layer.name}")
    # Strategy A: all layers remain trainable (no changes)

    trainable_count = sum(1 for l in model.layers if l.trainable)
    frozen_count = len(model.layers) - trainable_count
    print(f"  Strategy {strategy}: {trainable_count} trainable, {frozen_count} frozen layers")

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate),
        loss=MeanSquaredError(),
        metrics=[MeanAbsoluteError()]
    )
    return model


def _run_eval_only(tickers, base_dir, data_mode):
    """
    Evaluate existing production model on unseen data. No training.
    """
    start_time = time.time()
    prod_onnx_path = os.path.join(base_dir, "lstm_attention_final.onnx")
    prod_scalers_path = os.path.join(base_dir, "scalers_multi.pkl")

    print("\n==================================================")
    print("EVAL MODE — Production Model Evaluation Only")
    print("==================================================")

    if not os.path.exists(prod_onnx_path):
        print(f"[ERROR] Production ONNX model not found: {prod_onnx_path}")
        return {"error": "Production model not found"}
    if not os.path.exists(prod_scalers_path):
        print(f"[ERROR] Production scalers not found: {prod_scalers_path}")
        return {"error": "Production scalers not found"}

    # Load scalers
    with open(prod_scalers_path, "rb") as f:
        existing_scalers = pickle.load(f)

    # Fetch data
    print(f"\nFetching data for {len(tickers)} tickers ({data_mode} mode)...")
    data_dict = fetch_historical_data(tickers, data_mode=data_mode)

    # Prepare dataset
    X_train, y_train, X_val, y_val, X_test, y_test, updated_scalers, dataset_summary, X_test_per_ticker, y_test_per_ticker, test_ticker_names = prepare_leakage_safe_dataset(
        data_dict, scalers_dict=existing_scalers, scaler_mode="reuse", window_size=DEFAULT_WINDOW_SIZE
    )

    print(f"\nDataset: {dataset_summary['train_samples']} train / {dataset_summary['val_samples']} val / {dataset_summary['test_samples']} test")

    # Evaluate on aggregate test set
    print("\nEvaluating production ONNX model on unseen test data...")
    agg_metrics = evaluate_onnx_model(prod_onnx_path, X_test, y_test)
    print("\nAGGREGATE METRICS:")
    for k, v in agg_metrics.items():
        print(f"  {k:<24}: {v}")

    # Per-ticker evaluation
    prod_session = ort.InferenceSession(prod_onnx_path, providers=['CPUExecutionProvider'])
    per_ticker, _ = compute_per_ticker_metrics(
        prod_session, X_test_per_ticker, y_test_per_ticker, test_ticker_names, is_onnx=True
    )
    print("\nPER-TICKER METRICS:")
    print(f"{'Ticker':<8} {'MAE':<12} {'RMSE':<12} {'R2':<12} {'Dir.Acc':<12}")
    print("-" * 56)
    for ticker, m in per_ticker.items():
        print(f"{ticker:<8} {m['MAE']:<12.6f} {m['RMSE']:<12.6f} {m['R2']:<12.6f} {m['DirectionalAccuracy']:<12.6f}")

    # Generate smoke test report
    from convert_to_onnx import run_smoke_test
    smoke_pass, smoke_details = run_smoke_test(
        prod_onnx_path, prod_scalers_path, data_dict,
        tickers=["AAPL", "MSFT", "NVDA", "TSLA"]
    )
    print(f"\nSmoke test: {'PASS' if smoke_pass else 'FAIL'}")
    for t, d in smoke_details.items():
        print(f"  {t}: {d['status']}")

    elapsed = round(time.time() - start_time, 2)
    report = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "mode": "eval",
        "aggregate_metrics": agg_metrics,
        "per_ticker_metrics": per_ticker,
        "smoke_test": {"pass": smoke_pass, "details": smoke_details},
        "dataset_summary": {
            "train_samples": dataset_summary["train_samples"],
            "val_samples": dataset_summary["val_samples"],
            "test_samples": dataset_summary["test_samples"],
        },
        "elapsed_seconds": elapsed,
    }

    # Save report
    report_path = os.path.join(base_dir, "forecast_model_training_report.json")
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nReport saved to: {report_path}")
    print(f"Total eval time: {elapsed}s")

    return report


def _run_backtest(tickers, base_dir, data_mode):
    """
    Walk-forward backtest: split data into 3 chronological folds,
    evaluate production model on each fold's test period.
    """
    start_time = time.time()
    prod_onnx_path = os.path.join(base_dir, "lstm_attention_final.onnx")
    prod_scalers_path = os.path.join(base_dir, "scalers_multi.pkl")

    print("\n==================================================")
    print("BACKTEST MODE — Walk-Forward Evaluation")
    print("==================================================")

    if not os.path.exists(prod_onnx_path):
        print(f"[ERROR] Production ONNX model not found: {prod_onnx_path}")
        return {"error": "Production model not found"}

    with open(prod_scalers_path, "rb") as f:
        existing_scalers = pickle.load(f)

    # Fetch extended data for backtesting
    print(f"\nFetching extended data for {len(tickers)} tickers...")
    data_dict = fetch_historical_data(tickers, data_mode="EXTENDED" if data_mode in ("BALANCED", "RECENT") else data_mode)

    # Walk-forward: 3 folds with increasing training window
    fold_ratios = [(0.50, 0.70, 0.30), (0.60, 0.75, 0.25), (0.70, 0.85, 0.15)]
    fold_results = []

    for fold_idx, (train_pct, val_pct, test_pct) in enumerate(fold_ratios):
        print(f"\n--- Fold {fold_idx + 1}: Train={train_pct:.0%}, Val={val_pct:.0%}, Test={test_pct:.0%} ---")

        fold_X_train, fold_y_train = [], []
        fold_X_val, fold_y_val = [], []
        fold_X_test, fold_y_test = [], []

        for ticker, df in data_dict.items():
            prices = df['Close'].values.reshape(-1, 1).astype(np.float32)
            if ticker not in existing_scalers:
                continue
            scaler = existing_scalers[ticker]
            scaled = scaler.transform(prices).astype(np.float32)

            # Build sequences
            X_all, y_all = [], []
            for i in range(DEFAULT_WINDOW_SIZE, len(scaled)):
                X_all.append(scaled[i - DEFAULT_WINDOW_SIZE:i, 0])
                y_all.append(scaled[i, 0])

            X_all = np.array(X_all, dtype=np.float32).reshape(-1, DEFAULT_WINDOW_SIZE, 1)
            y_all = np.array(y_all, dtype=np.float32)
            n = len(X_all)

            # Chronological split based on fold ratios
            train_end = int(n * train_pct)
            val_end = int(n * (train_pct + val_pct))

            fold_X_train.append(X_all[:train_end])
            fold_y_train.append(y_all[:train_end])
            fold_X_val.append(X_all[train_end:val_end])
            fold_y_val.append(y_all[train_end:val_end])
            fold_X_test.append(X_all[val_end:])
            fold_y_test.append(y_all[val_end:])

        if not fold_X_train:
            continue

        X_train = np.vstack(fold_X_train)
        y_train = np.concatenate(fold_y_train)
        X_val = np.vstack(fold_X_val)
        y_val = np.concatenate(fold_y_val)
        X_test = np.vstack(fold_X_test)
        y_test = np.concatenate(fold_y_test)

        print(f"  Samples: train={len(X_train)}, val={len(X_val)}, test={len(X_test)}")

        # Evaluate production model on this fold's test set
        fold_metrics = evaluate_onnx_model(prod_onnx_path, X_test, y_test)
        print(f"  Test MAE: {fold_metrics['MAE']:.6f}, RMSE: {fold_metrics['RMSE']:.6f}, R2: {fold_metrics['R2']:.6f}")
        fold_results.append({
            "fold": fold_idx + 1,
            "train_ratio": train_pct,
            "test_ratio": test_pct,
            "test_samples": len(X_test),
            "metrics": fold_metrics,
        })

    # Aggregate across all folds
    if fold_results:
        all_fold_preds = []
        all_fold_true = []
        for fr in fold_results:
            # Re-run to get predictions for aggregation (simplified)
            pass

        avg_metrics = {}
        for metric_key in ["MAE", "RMSE", "MSE", "R2", "DirectionalAccuracy"]:
            values = [fr["metrics"][metric_key] for fr in fold_results]
            avg_metrics[f"avg_{metric_key}"] = round(float(np.mean(values)), 6)
            avg_metrics[f"std_{metric_key}"] = round(float(np.std(values)), 6)

        print("\n--- BACKTEST SUMMARY ---")
        for k, v in avg_metrics.items():
            print(f"  {k:<30}: {v}")
    else:
        avg_metrics = {}

    elapsed = round(time.time() - start_time, 2)
    report = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "mode": "backtest",
        "fold_results": fold_results,
        "aggregate_metrics": avg_metrics,
        "elapsed_seconds": elapsed,
    }

    report_path = os.path.join(base_dir, "forecast_model_training_report.json")
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nReport saved to: {report_path}")
    print(f"Total backtest time: {elapsed}s")

    return report


def run_pipeline(
    mode="fine_tune",
    strategy="B",
    data_mode="BALANCED",
    scaler_mode="reuse",
    learning_rate=1e-4,
    epochs=5,
    batch_size=8,
    tickers=None,
    base_dir=None
):
    start_time = time.time()
    if base_dir is None:
        base_dir = os.path.dirname(os.path.abspath(__file__))

    if tickers is None:
        tickers = DEFAULT_TICKERS

    # Mode dispatch
    if mode == "eval":
        return _run_eval_only(tickers, base_dir, data_mode)
    elif mode == "backtest":
        return _run_backtest(tickers, base_dir, data_mode)

    prod_onnx_path = os.path.join(base_dir, "lstm_attention_final.onnx")
    prod_scalers_path = os.path.join(base_dir, "scalers_multi.pkl")
    prod_h5_path = os.path.join(base_dir, "lstm_attention_final.h5")

    cand_h5_path = os.path.join(base_dir, "lstm_attention_final_candidate.h5")
    cand_onnx_path = os.path.join(base_dir, "lstm_attention_final_candidate.onnx")
    cand_scalers_path = os.path.join(base_dir, "scalers_multi_candidate.pkl")

    report_json_path = os.path.join(base_dir, "forecast_model_training_report.json")
    report_txt_path = os.path.join(base_dir, "forecast_model_training_report.txt")

    print("\n==================================================")
    print("MODEL TRAINING PIPELINE")
    print("==================================================")
    print(f"Mode:             {mode}")
    print(f"Strategy:         Strategy {strategy}")
    print(f"Data Mode:        {data_mode}")
    print(f"Learning rate:    {learning_rate}")
    print(f"Epochs:           {epochs}")
    print(f"Batch size:       {batch_size}")
    print(f"Scaler mode:      {scaler_mode}")
    print(f"Tickers count:    {len(tickers)}")

    # 1. Load Scalers
    existing_scalers = None
    if os.path.exists(prod_scalers_path):
        try:
            with open(prod_scalers_path, "rb") as f:
                existing_scalers = pickle.load(f)
            print("Existing scalers: detected")
        except Exception as e:
            print(f"⚠️ Warning loading scalers: {e}")

    # 2. Fetch Historical Data
    print("\n[Step 1/8] Fetching market data...")
    data_dict = fetch_historical_data(tickers, data_mode=data_mode)

    # 3. Prepare Leakage-Safe Dataset
    print("\n[Step 2/8] Preparing chronological data sequences...")
    X_train, y_train, X_val, y_val, X_test, y_test, updated_scalers, dataset_summary, X_test_per_ticker, y_test_per_ticker, test_ticker_names = prepare_leakage_safe_dataset(
        data_dict,
        scalers_dict=existing_scalers,
        scaler_mode=scaler_mode,
        window_size=DEFAULT_WINDOW_SIZE
    )

    print("\n==================================================")
    print("DATASET SUMMARY")
    print("==================================================")
    print(f"Train samples:      {dataset_summary['train_samples']}")
    print(f"Validation samples: {dataset_summary['val_samples']}")
    print(f"Test samples:       {dataset_summary['test_samples']}")
    print(f"Out of bounds count: {dataset_summary['out_of_bounds_count']} / {dataset_summary['total_scaled_values']}")
    for s in dataset_summary['ticker_stats']:
        print(f"  - {s['ticker']:<6}: {s['sequences']:>5} seqs ({s['pct_contribution']:>5.2f}%), Range: {s['date_range']}")

    # Save candidate scalers
    with open(cand_scalers_path, "wb") as f:
        pickle.dump(updated_scalers, f)

    # 4. Load or Build Base Model
    print("\n[Step 3/8] Preparing model for training/fine-tuning...")
    if mode == "fine_tune" and os.path.exists(prod_h5_path):
        print(f"Loading existing Keras model from {prod_h5_path}...")
        model = tf.keras.models.load_model(
            prod_h5_path,
            custom_objects={
                "SimpleAttention": SimpleAttention,
                "mse": MeanSquaredError(),
                "mae": MeanAbsoluteError()
            }
        )
        model = apply_fine_tuning_strategy(model, strategy=strategy, learning_rate=learning_rate)
    else:
        if mode == "fine_tune":
            print(f"[WARN] Keras model {prod_h5_path} not found. Falling back to initial model architecture build.")
        else:
            print("Building initial model architecture from scratch...")
        model = build_base_model(window_size=DEFAULT_WINDOW_SIZE, learning_rate=learning_rate)

    # 5. Evaluate Current Model Baseline on Test Data
    print("\n[Step 4/8] Evaluating current production baseline on unseen test set...")
    current_metrics = None
    if os.path.exists(prod_onnx_path):
        try:
            current_metrics = evaluate_onnx_model(prod_onnx_path, X_test, y_test)
            print("Current Production ONNX Model Metrics:")
            for k, v in current_metrics.items():
                print(f"  {k:<20}: {v}")
        except Exception as e:
            print(f"[WARN] Failed evaluating production ONNX model: {e}")

    if current_metrics is None:
        # Fallback to initial model evaluation as baseline
        baseline_preds = model.predict(X_test, verbose=0).flatten()
        current_metrics = compute_metrics(y_test, baseline_preds)
        print("Baseline Model Metrics:")
        for k, v in current_metrics.items():
            print(f"  {k:<20}: {v}")

    # 6. Train Candidate Model
    print("\n[Step 5/8] Training candidate model...")
    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=3,
            restore_best_weights=True
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=2,
            min_lr=1e-6
        )
    ]

    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=epochs,
        batch_size=batch_size,
        callbacks=callbacks,
        verbose=1
    )

    # Save candidate Keras model
    model.save(cand_h5_path)
    print(f"Candidate Keras model saved temporarily to {cand_h5_path}")

    # 7. Evaluate Candidate Model on Unseen Test Data
    cand_preds = model.predict(X_test, verbose=0).flatten()
    cand_metrics = compute_metrics(y_test, cand_preds)

    print("\n==================================================")
    print("VALIDATION COMPARISON (UNSEEN TEST DATASET)")
    print("==================================================")
    print(f"{'Metric':<24} {'Current':<15} {'Candidate':<15}")
    print("-" * 54)
    for m in ["MAE", "RMSE", "MSE", "R2", "DirectionalAccuracy", "DirectionalBias"]:
        print(f"{m:<24} {current_metrics.get(m, 0.0):<15.6f} {cand_metrics.get(m, 0.0):<15.6f}")

    # 7b. Per-Ticker Metric Breakdown
    print("\n==================================================")
    print("PER-TICKER METRIC BREAKDOWN (CANDIDATE)")
    print("==================================================")
    per_ticker_cand, _ = compute_per_ticker_metrics(
        model, X_test_per_ticker, y_test_per_ticker, test_ticker_names, is_onnx=False
    )
    print(f"{'Ticker':<8} {'MAE':<12} {'RMSE':<12} {'R2':<12} {'Dir.Acc':<12}")
    print("-" * 56)
    for ticker, m in per_ticker_cand.items():
        print(f"{ticker:<8} {m['MAE']:<12.6f} {m['RMSE']:<12.6f} {m['R2']:<12.6f} {m['DirectionalAccuracy']:<12.6f}")

    # Per-ticker baseline (current production model) if available
    per_ticker_current = {}
    if os.path.exists(prod_onnx_path):
        try:
            prod_session = ort.InferenceSession(prod_onnx_path, providers=['CPUExecutionProvider'])
            per_ticker_current, _ = compute_per_ticker_metrics(
                prod_session, X_test_per_ticker, y_test_per_ticker, test_ticker_names, is_onnx=True
            )
            print("\n{'Ticker':<8} {'MAE':<12} {'RMSE':<12} {'R2':<12} {'Dir.Acc':<12}")
            print("-" * 56)
            print("CURRENT PRODUCTION MODEL:")
            for ticker, m in per_ticker_current.items():
                print(f"{ticker:<8} {m['MAE']:<12.6f} {m['RMSE']:<12.6f} {m['R2']:<12.6f} {m['DirectionalAccuracy']:<12.6f}")
        except Exception:
            pass

    # 8. Evaluate Acceptance Criteria
    rmse_accepted = cand_metrics["RMSE"] <= current_metrics["RMSE"] * 1.02
    mae_accepted = cand_metrics["MAE"] <= current_metrics["MAE"] * 1.02
    dir_acc_accepted = cand_metrics["DirectionalAccuracy"] >= current_metrics["DirectionalAccuracy"] - 0.05
    r2_accepted = cand_metrics["R2"] >= current_metrics["R2"] - 0.05

    accepted = rmse_accepted and mae_accepted and dir_acc_accepted and r2_accepted
    acceptance_reason = []
    if not rmse_accepted:
        acceptance_reason.append(f"RMSE degraded: Candidate ({cand_metrics['RMSE']:.6f}) > Current threshold ({current_metrics['RMSE']*1.02:.6f})")
    if not mae_accepted:
        acceptance_reason.append(f"MAE degraded: Candidate ({cand_metrics['MAE']:.6f}) > Current threshold ({current_metrics['MAE']*1.02:.6f})")
    if not dir_acc_accepted:
        acceptance_reason.append(f"Directional Accuracy dropped: Candidate ({cand_metrics['DirectionalAccuracy']:.6f}) < Current threshold ({current_metrics['DirectionalAccuracy']-0.05:.6f})")
    if not r2_accepted:
        acceptance_reason.append(f"R2 dropped: Candidate ({cand_metrics['R2']:.6f}) < Current threshold ({current_metrics['R2']-0.05:.6f})")

    decision_str = "ACCEPTED" if accepted else "REJECTED"
    reason_str = "All multi-metric out-of-sample criteria passed." if accepted else " ; ".join(acceptance_reason)

    print("\n==================================================")
    print("DECISION")
    print("==================================================")
    print(f"Candidate: {decision_str}")
    print(f"Reason:    {reason_str}")

    onnx_export_success = False
    onnx_parity_pass = False
    smoke_test_pass = False
    replaced = False

    # 9. ONNX Export & Verification (If Accepted)
    if accepted:
        print("\n[Step 6/8] Exporting candidate model to ONNX...")
        try:
            export_keras_to_onnx(model, cand_onnx_path, opset=13)
            onnx_export_success = True
            print(f"Candidate ONNX exported to {cand_onnx_path}")
        except Exception as e:
            print(f"[FAIL] ONNX export failed: {e}")

        if onnx_export_success:
            print("\n[Step 7/8] Running ONNX Numerical Parity Check...")
            try:
                cand_session = ort.InferenceSession(cand_onnx_path, providers=['CPUExecutionProvider'])
                input_name = cand_session.get_inputs()[0].name
                
                # Compare Keras vs ONNX on X_test sample
                keras_out = model.predict(X_test[:500], verbose=0).flatten()
                onnx_out = cand_session.run(None, {input_name: X_test[:500].astype(np.float32)})[0].flatten()

                max_diff = float(np.max(np.abs(keras_out - onnx_out)))
                mean_diff = float(np.mean(np.abs(keras_out - onnx_out)))

                print(f"  Max Absolute Difference:  {max_diff:.8e}")
                print(f"  Mean Absolute Difference: {mean_diff:.8e}")

                if max_diff < 1e-4:
                    onnx_parity_pass = True
                    print("  Numerical Parity Check: PASS")
                else:
                    print(f"[FAIL] Numerical Parity Check: FAIL (Max diff {max_diff} > 1e-4)")
            except Exception as e:
                print(f"[FAIL] ONNX Parity verification failed: {e}")

        # 10. Production Forecast Smoke Test
        if onnx_parity_pass:
            print("\n[Step 8/8] Running Production Forecast Smoke Test...")
            try:
                smoke_test_tickers = ["AAPL", "MSFT", "NVDA", "TSLA"]
                smoke_test_pass = True
                cand_session, cand_scalers = load_forecast_model(
                    model_path=cand_onnx_path,
                    scalers_path=cand_scalers_path
                )

                for stk in smoke_test_tickers:
                    if stk not in data_dict or stk not in cand_scalers:
                        continue
                    df_stk = data_dict[stk]
                    scaler = cand_scalers[stk]

                    actual_prices, predicted_prices, forecast, forecast_dates = forecast_stock(
                        df=df_stk,
                        session=cand_session,
                        scaler=scaler,
                        forecast_days=DEFAULT_FORECAST_DAYS,
                        window_size=DEFAULT_WINDOW_SIZE
                    )

                    # Verify outputs
                    if len(forecast) != DEFAULT_FORECAST_DAYS or len(forecast_dates) != DEFAULT_FORECAST_DAYS:
                        smoke_test_pass = False
                        print(f"[FAIL] Smoke test failed for {stk}: output length mismatch.")
                        break

                    if np.isnan(forecast).any() or np.isinf(forecast).any():
                        smoke_test_pass = False
                        print(f"[FAIL] Smoke test failed for {stk}: NaN or Inf detected.")
                        break

                    # Sanity check: forecast prices within reasonable ratio of last actual price
                    last_price = actual_prices[-1]
                    if any(f < last_price * 0.3 or f > last_price * 3.0 for f in forecast):
                        smoke_test_pass = False
                        print(f"[FAIL] Smoke test failed for {stk}: extreme unphysical forecast values detected.")
                        break

                if smoke_test_pass:
                    print("  Production Forecast Smoke Test: PASS")
            except Exception as e:
                smoke_test_pass = False
                print(f"[FAIL] Production Forecast Smoke Test Exception: {e}")

        # 11. Safe Replacement
        if accepted and onnx_export_success and onnx_parity_pass and smoke_test_pass:
            print("\n==================================================")
            print("ATOMIC PRODUCTION REPLACEMENT")
            print("==================================================")
            try:
                # Backup current production files before replacement
                backup_dir = os.path.join(base_dir, "backups", time.strftime("%Y%m%d_%H%M%S"))
                os.makedirs(backup_dir, exist_ok=True)
                for src in [prod_onnx_path, prod_scalers_path, prod_h5_path]:
                    if os.path.exists(src):
                        shutil.copy2(src, backup_dir)
                print(f"Production backup saved to: {backup_dir}")

                # Replace ONNX model
                if os.path.exists(prod_onnx_path):
                    os.remove(prod_onnx_path)
                shutil.move(cand_onnx_path, prod_onnx_path)

                # Replace Scalers
                if os.path.exists(prod_scalers_path):
                    os.remove(prod_scalers_path)
                shutil.move(cand_scalers_path, prod_scalers_path)

                # Replace H5 model for future fine-tuning
                if os.path.exists(prod_h5_path):
                    os.remove(prod_h5_path)
                shutil.move(cand_h5_path, prod_h5_path)

                replaced = True
                print("[OK] Production files successfully replaced:")
                print(f"   - {prod_onnx_path}")
                print(f"   - {prod_scalers_path}")
                print(f"   - {prod_h5_path}")
            except Exception as e:
                print(f"[FAIL] Error during production replacement: {e}")
        else:
            print("\n[WARN] Candidate did NOT pass all gates. Keeping existing production artifacts untouched.")
    else:
        print("\n[WARN] Candidate REJECTED. Keeping existing production artifacts untouched.")

    # 12. Save Report Files
    report_data = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "mode": mode,
        "strategy": strategy,
        "data_mode": data_mode,
        "scaler_mode": scaler_mode,
        "learning_rate": learning_rate,
        "epochs": epochs,
        "batch_size": batch_size,
        "tickers": tickers,
        "dataset_summary": {
            "train_samples": dataset_summary["train_samples"],
            "val_samples": dataset_summary["val_samples"],
            "test_samples": dataset_summary["test_samples"],
            "out_of_bounds_count": dataset_summary["out_of_bounds_count"],
            "total_scaled_values": dataset_summary["total_scaled_values"]
        },
        "current_metrics": current_metrics,
        "candidate_metrics": cand_metrics,
        "per_ticker_candidate_metrics": per_ticker_cand,
        "per_ticker_current_metrics": per_ticker_current,
        "acceptance": {
            "accepted": accepted,
            "reason": reason_str
        },
        "onnx_export_success": onnx_export_success,
        "onnx_parity_pass": onnx_parity_pass,
        "smoke_test_pass": smoke_test_pass,
        "production_replaced": replaced,
        "elapsed_seconds": round(time.time() - start_time, 2)
    }

    with open(report_json_path, "w") as f:
        json.dump(report_data, f, indent=2)

    with open(report_txt_path, "w") as f:
        f.write(f"MODEL TRAINING REPORT - {report_data['timestamp']}\n")
        f.write("=" * 60 + "\n")
        f.write(f"Mode: {mode} | Strategy: Strategy {strategy} | Scaler: {scaler_mode}\n")
        f.write(f"LR: {learning_rate} | Epochs: {epochs} | Batch: {batch_size}\n\n")
        f.write("CURRENT METRICS:\n")
        for k, v in current_metrics.items():
            f.write(f"  {k:<20}: {v}\n")
        f.write("\nCANDIDATE METRICS:\n")
        for k, v in cand_metrics.items():
            f.write(f"  {k:<20}: {v}\n")
        f.write("\nDECISION:\n")
        f.write(f"  Candidate: {decision_str}\n")
        f.write(f"  Reason:    {reason_str}\n\n")
        f.write("ONNX & PRODUCTION VERIFICATION:\n")
        f.write(f"  ONNX Export Success: {onnx_export_success}\n")
        f.write(f"  ONNX Parity Pass:    {onnx_parity_pass}\n")
        f.write(f"  Smoke Test Pass:     {smoke_test_pass}\n")
        f.write(f"  Production Replaced: {replaced}\n")

    print("\n==================================================")
    print("FINAL SUMMARY")
    print("==================================================")
    print(f"Report saved to:           {report_json_path}")
    print(f"Text summary saved to:     {report_txt_path}")
    print(f"Production model replaced: {'YES' if replaced else 'NO'}")
    print(f"Total pipeline runtime:    {report_data['elapsed_seconds']} seconds")

    return report_data


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Production-Safe Fine-Tuning & Validation Pipeline for Stock Forecasting")
    parser.add_argument("--mode", type=str, default="fine_tune", choices=["fine_tune", "initial", "eval", "backtest"], help="Pipeline execution mode")
    parser.add_argument("--strategy", type=str, default="B", choices=["A", "B", "C"], help="Fine-tuning strategy (A=Full, B=Conservative, C=Light)")
    parser.add_argument("--data_mode", type=str, default="BALANCED", choices=["RECENT", "BALANCED", "EXTENDED", "FULL"], help="Data period mode")
    parser.add_argument("--scaler_mode", type=str, default="reuse", choices=["reuse", "refit"], help="Scaler handling mode")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate for fine-tuning")
    parser.add_argument("--epochs", type=int, default=5, help="Number of training epochs")
    parser.add_argument("--batch_size", type=int, default=8, help="Batch size")

    args = parser.parse_args()

    run_pipeline(
        mode=args.mode,
        strategy=args.strategy,
        data_mode=args.data_mode,
        scaler_mode=args.scaler_mode,
        learning_rate=args.lr,
        epochs=args.epochs,
        batch_size=args.batch_size
    )
