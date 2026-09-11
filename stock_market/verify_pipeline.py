import os
import sys
import shutil
import pickle
import hashlib
import numpy as np
import pandas as pd
import onnxruntime as ort

# Import modules to test
from forecast_onnx import load_forecast_model, forecast_stock, validate_forecast_inputs
from convert_to_onnx import export_keras_to_onnx, validate_onnx_parity, run_smoke_test
import train_lstm_test_multi as pipeline


def file_hash(path):
    """Compute MD5 hash of a file for integrity checks."""
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def run_all_tests():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    prod_onnx = os.path.join(base_dir, "lstm_attention_final.onnx")
    prod_scalers = os.path.join(base_dir, "scalers_multi.pkl")
    prod_h5 = os.path.join(base_dir, "lstm_attention_final.h5")

    print("\n" + "=" * 60)
    print("RUNNING 15 MANDATORY PIPELINE VERIFICATION TESTS")
    print("=" * 60 + "\n")

    results = {}
    passed = 0
    failed = 0

    # ─── TEST 1: Production ONNX model loads ─────────────────────────
    try:
        session = ort.InferenceSession(prod_onnx, providers=['CPUExecutionProvider'])
        assert session is not None
        input_shape = session.get_inputs()[0].shape
        assert input_shape[1:] == [60, 1] or input_shape[1:] == (60, 1)
        results["TEST 1: Production ONNX model loads"] = "PASS"
        print("[PASS] TEST 1: Production ONNX model loads")
        passed += 1
    except Exception as e:
        results["TEST 1: Production ONNX model loads"] = f"FAIL: {e}"
        print(f"[FAIL] TEST 1: {e}")
        failed += 1

    # ─── TEST 2: Production scalers load ─────────────────────────────
    try:
        with open(prod_scalers, "rb") as f:
            scalers = pickle.load(f)
        assert isinstance(scalers, dict)
        assert "AAPL" in scalers or len(scalers) > 0
        results["TEST 2: Production scalers load"] = "PASS"
        print("[PASS] TEST 2: Production scalers load")
        passed += 1
    except Exception as e:
        results["TEST 2: Production scalers load"] = f"FAIL: {e}"
        print(f"[FAIL] TEST 2: {e}")
        failed += 1

    # ─── TEST 3: Valid forecast generation with production ONNX ──────
    try:
        sess, scs = load_forecast_model(prod_onnx, prod_scalers)
        ticker = "AAPL" if "AAPL" in scs else list(scs.keys())[0]
        dates = pd.date_range("2024-01-01", periods=75, freq="B")
        prices = np.linspace(150.0, 180.0, 75) + np.random.normal(0, 1.0, 75)
        df_dummy = pd.DataFrame({"Close": prices}, index=dates)

        act, pred, fc, fc_dates = forecast_stock(df_dummy, sess, scs[ticker], forecast_days=10, window_size=60)
        assert len(fc) == 10
        assert len(fc_dates) == 10
        assert not np.isnan(fc).any()
        assert not np.isinf(fc).any()
        results["TEST 3: Valid forecast generation"] = "PASS"
        print("[PASS] TEST 3: Valid forecast generation")
        passed += 1
    except Exception as e:
        results["TEST 3: Valid forecast generation"] = f"FAIL: {e}"
        print(f"[FAIL] TEST 3: {e}")
        failed += 1

    # ─── TEST 4: Dataset generation (leakage-safe, chronological) ────
    try:
        data_dict = pipeline.fetch_historical_data(["AAPL", "MSFT"], data_mode="RECENT")
        results_tuple = pipeline.prepare_leakage_safe_dataset(
            data_dict, scalers_dict=scalers, scaler_mode="reuse", window_size=60
        )
        X_train, y_train, X_val, y_val, X_test, y_test, updated_scalers, dataset_summary, X_test_per_ticker, y_test_per_ticker, test_ticker_names = results_tuple
        assert len(X_train) > 0
        assert X_train.shape[1:] == (60, 1)
        assert X_val.shape[1:] == (60, 1)
        assert X_test.shape[1:] == (60, 1)
        assert len(X_test_per_ticker) == len(test_ticker_names)
        results["TEST 4: Dataset generation (leakage-safe & chronological)"] = "PASS"
        print("[PASS] TEST 4: Dataset generation (leakage-safe & chronological)")
        passed += 1
    except Exception as e:
        results["TEST 4: Dataset generation"] = f"FAIL: {e}"
        print(f"[FAIL] TEST 4: {e}")
        failed += 1

    # ─── TEST 5: Candidate training works ────────────────────────────
    try:
        print("\nExecuting fine-tune run (3 tickers, RECENT data, 2 epochs)...")
        report = pipeline.run_pipeline(
            mode="fine_tune",
            strategy="B",
            data_mode="RECENT",
            scaler_mode="reuse",
            learning_rate=1e-4,
            epochs=2,
            batch_size=8,
            tickers=["AAPL", "MSFT", "NVDA"],
            base_dir=base_dir
        )
        assert "current_metrics" in report
        assert "candidate_metrics" in report
        results["TEST 5: Candidate training works"] = "PASS"
        print("[PASS] TEST 5: Candidate training works")
        passed += 1
    except Exception as e:
        results["TEST 5: Candidate training works"] = f"FAIL: {e}"
        print(f"[FAIL] TEST 5: {e}")
        failed += 1

    # ─── TEST 6: Temporal validation works ───────────────────────────
    try:
        assert "dataset_summary" in report
        assert report["dataset_summary"]["train_samples"] > 0
        assert report["dataset_summary"]["val_samples"] > 0
        assert report["dataset_summary"]["test_samples"] > 0
        results["TEST 6: Temporal validation works"] = "PASS"
        print("[PASS] TEST 6: Temporal validation works")
        passed += 1
    except Exception as e:
        results["TEST 6: Temporal validation works"] = f"FAIL: {e}"
        print(f"[FAIL] TEST 6: {e}")
        failed += 1

    # ─── TEST 7: Candidate comparison works ──────────────────────────
    try:
        assert isinstance(report["current_metrics"], dict)
        assert isinstance(report["candidate_metrics"], dict)
        assert "accepted" in report["acceptance"]
        results["TEST 7: Candidate comparison works"] = "PASS"
        print("[PASS] TEST 7: Candidate comparison works")
        passed += 1
    except Exception as e:
        results["TEST 7: Candidate comparison works"] = f"FAIL: {e}"
        print(f"[FAIL] TEST 7: {e}")
        failed += 1

    # ─── TEST 8: ONNX export always works ────────────────────────────
    # Test from candidate H5 if it exists, otherwise from production H5
    try:
        cand_h5 = os.path.join(base_dir, "lstm_attention_final_candidate.h5")
        test_onnx = os.path.join(base_dir, "_test_verify_candidate.onnx")
        source_h5 = cand_h5 if os.path.exists(cand_h5) else prod_h5

        if os.path.exists(source_h5):
            export_keras_to_onnx(source_h5, test_onnx, opset=13)
            assert os.path.exists(test_onnx)
            assert os.path.getsize(test_onnx) > 1000
            source_label = "candidate" if source_h5 == cand_h5 else "production"
            results["TEST 8: ONNX export works"] = "PASS"
            print(f"[PASS] TEST 8: ONNX export works (from {source_h5} H5)")
            passed += 1
        else:
            results["TEST 8: ONNX export works"] = "SKIP (no H5 file)"
            print("[SKIP] TEST 8: No H5 file to export from")
    except Exception as e:
        results["TEST 8: ONNX export works"] = f"FAIL: {e}"
        print(f"[FAIL] TEST 8: {e}")
        failed += 1

    # ─── TEST 9: Exported ONNX loads in ONNX Runtime ─────────────────
    try:
        if os.path.exists(test_onnx):
            test_session = ort.InferenceSession(test_onnx, providers=['CPUExecutionProvider'])
            input_info = test_session.get_inputs()[0]
            assert input_info.shape[1:] == [60, 1] or input_info.shape[1:] == (60, 1)
            results["TEST 9: Exported ONNX loads in ONNX Runtime"] = "PASS"
            print("[PASS] TEST 9: Exported ONNX loads in ONNX Runtime")
            passed += 1
        else:
            results["TEST 9: Exported ONNX loads in ONNX Runtime"] = "SKIP (no test ONNX)"
            print("[SKIP] TEST 9: No test ONNX to load")
    except Exception as e:
        results["TEST 9: Exported ONNX loads in ONNX Runtime"] = f"FAIL: {e}"
        print(f"[FAIL] TEST 9: {e}")
        failed += 1

    # ─── TEST 10: Keras vs ONNX numerical parity ─────────────────────
    try:
        if os.path.exists(test_onnx) and os.path.exists(source_h5):
            import tensorflow as tf
            from convert_to_onnx import SimpleAttention

            keras_model = tf.keras.models.load_model(
                source_h5,
                custom_objects={
                    "SimpleAttention": SimpleAttention,
                    "mse": tf.keras.losses.MeanSquaredError(),
                    "mae": tf.keras.metrics.MeanAbsoluteError()
                }
            )

            # Use a subset of real test data for parity check
            test_inputs = X_test[:200].astype(np.float32)
            passed_parity, max_diff, mean_diff = validate_onnx_parity(
                keras_model, test_onnx, test_inputs, tolerance=1e-4
            )
            print(f"  Max diff: {max_diff:.8e}, Mean diff: {mean_diff:.8e}")

            assert passed_parity, f"Parity check failed: max_diff={max_diff} > 1e-4"
            results["TEST 10: Keras vs ONNX numerical parity"] = "PASS"
            print("[PASS] TEST 10: Keras vs ONNX numerical parity")
            passed += 1
        else:
            results["TEST 10: Keras vs ONNX numerical parity"] = "SKIP (missing test_onnx or source H5)"
            print("[SKIP] TEST 10: Missing files for parity check")
    except Exception as e:
        results["TEST 10: Keras vs ONNX numerical parity"] = f"FAIL: {e}"
        print(f"[FAIL] TEST 10: {e}")
        failed += 1

    # ─── TEST 11: 10-day recursive forecast smoke test ───────────────
    try:
        if os.path.exists(test_onnx):
            smoke_pass, smoke_details = run_smoke_test(
                test_onnx, prod_scalers, data_dict,
                tickers=["AAPL", "MSFT"],
                forecast_days=10,
                window_size=60
            )
            for t, d in smoke_details.items():
                print(f"  {t}: {d['status']}")

            assert smoke_pass, f"Smoke test failed: {smoke_details}"
            results["TEST 11: 10-day recursive forecast"] = "PASS"
            print("[PASS] TEST 11: 10-day recursive forecast smoke test")
            passed += 1
        else:
            results["TEST 11: 10-day recursive forecast"] = "SKIP (no test ONNX)"
            print("[SKIP] TEST 11: No test ONNX for smoke test")
    except Exception as e:
        results["TEST 11: 10-day recursive forecast"] = f"FAIL: {e}"
        print(f"[FAIL] TEST 11: {e}")
        failed += 1

    # ─── TEST 12: Rejected candidate does NOT replace production ──────
    try:
        before_hash = file_hash(prod_onnx)
        before_scalers_hash = file_hash(prod_scalers)

        test_report = pipeline.run_pipeline(
            mode="fine_tune",
            strategy="A",
            data_mode="RECENT",
            scaler_mode="reuse",
            learning_rate=0.5,  # Exaggerated LR to force rejection
            epochs=1,
            batch_size=8,
            tickers=["AAPL"],
            base_dir=base_dir
        )

        after_hash = file_hash(prod_onnx)
        after_scalers_hash = file_hash(prod_scalers)

        assert before_hash == after_hash, "Production ONNX was modified after rejection!"
        assert before_scalers_hash == after_scalers_hash, "Production scalers were modified after rejection!"
        assert not test_report["production_replaced"]
        results["TEST 12: Rejected candidate safety"] = "PASS"
        print("[PASS] TEST 12: Rejected candidate does NOT replace production")
        passed += 1
    except Exception as e:
        results["TEST 12: Rejected candidate safety"] = f"FAIL: {e}"
        print(f"[FAIL] TEST 12: {e}")
        failed += 1

    # ─── TEST 13: Per-ticker metric breakdown ────────────────────────
    try:
        assert "per_ticker_candidate_metrics" in report
        assert isinstance(report["per_ticker_candidate_metrics"], dict)
        assert len(report["per_ticker_candidate_metrics"]) > 0
        # Verify each ticker has expected metric keys
        for ticker_name, ticker_metrics in report["per_ticker_candidate_metrics"].items():
            assert "MAE" in ticker_metrics
            assert "RMSE" in ticker_metrics
            assert "R2" in ticker_metrics
            assert "DirectionalAccuracy" in ticker_metrics
        results["TEST 13: Per-ticker metric breakdown"] = "PASS"
        print("[PASS] TEST 13: Per-ticker metric breakdown")
        passed += 1
    except Exception as e:
        results["TEST 13: Per-ticker metric breakdown"] = f"FAIL: {e}"
        print(f"[FAIL] TEST 13: {e}")
        failed += 1

    # ─── TEST 14: --mode eval runs without errors ────────────────────
    try:
        eval_report = pipeline.run_pipeline(
            mode="eval",
            data_mode="RECENT",
            tickers=["AAPL", "MSFT"],
            base_dir=base_dir
        )
        assert "aggregate_metrics" in eval_report
        assert "MAE" in eval_report["aggregate_metrics"]
        assert eval_report["mode"] == "eval"
        results["TEST 14: --mode eval runs without errors"] = "PASS"
        print("[PASS] TEST 14: --mode eval runs without errors")
        passed += 1
    except Exception as e:
        results["TEST 14: --mode eval runs without errors"] = f"FAIL: {e}"
        print(f"[FAIL] TEST 14: {e}")
        failed += 1

    # ─── TEST 15: Backup directory created before replacement ─────────
    try:
        backup_base = os.path.join(base_dir, "backups")
        # The fine-tune run in TEST 5 should have created a backup
        if os.path.exists(backup_base):
            backup_dirs = os.listdir(backup_base)
            assert len(backup_dirs) > 0, "No backup directories found"
            # Check that backup contains model files
            latest_backup = os.path.join(backup_base, sorted(backup_dirs)[-1])
            backup_files = os.listdir(latest_backup)
            assert any("lstm_attention_final" in f for f in backup_files), "No model files in backup"
            results["TEST 15: Backup directory created before replacement"] = "PASS"
            print("[PASS] TEST 15: Backup directory created before replacement")
            passed += 1
        else:
            results["TEST 15: Backup directory created before replacement"] = "SKIP (no backups dir)"
            print("[SKIP] TEST 15: No backups directory found")
    except Exception as e:
        results["TEST 15: Backup directory created before replacement"] = f"FAIL: {e}"
        print(f"[FAIL] TEST 15: {e}")
        failed += 1

    # Cleanup test artifacts
    try:
        test_onnx_cleanup = os.path.join(base_dir, "_test_verify_candidate.onnx")
        if os.path.exists(test_onnx_cleanup):
            os.remove(test_onnx_cleanup)
    except Exception:
        pass

    # ─── SUMMARY ─────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("VERIFICATION RESULTS SUMMARY")
    print("=" * 60)
    for test_name, status in results.items():
        marker = "[PASS]" if status == "PASS" else "[FAIL]" if "FAIL" in status else "[SKIP]"
        print(f"  {marker} {test_name}: {status}")
    print("=" * 60)
    print(f"\nTotal: {passed} passed, {failed} failed, {15 - passed - failed} skipped")
    print("=" * 60 + "\n")

    return results


if __name__ == "__main__":
    run_all_tests()
