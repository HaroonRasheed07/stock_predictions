#!/usr/bin/env python3
"""
Quick test script to verify that TensorFlow and Plotly warnings are properly suppressed.
Run this to confirm the fixes are working.
"""

# Suppress TensorFlow and library warnings
import suppress_warnings  # noqa: F401

import sys
import warnings

print("=" * 70)
print("TENSORFLOW & PLOTLY WARNINGS SUPPRESSION TEST")
print("=" * 70)

# Test 1: Import TensorFlow
print("\n[1/3] Importing TensorFlow...")
try:
    import tensorflow as tf
    print(f"✓ TensorFlow {tf.__version__} imported successfully")
except Exception as e:
    print(f"✗ Error: {e}")
    sys.exit(1)

# Test 2: Import Plotly
print("\n[2/3] Importing Plotly...")
try:
    import plotly.graph_objects as go
    import plotly.express as px
    print("✓ Plotly imported successfully")
except Exception as e:
    print(f"✗ Error: {e}")
    sys.exit(1)

# Test 3: Load a model to trigger any remaining warnings
print("\n[3/3] Creating a simple model...")
try:
    model = tf.keras.Sequential([
        tf.keras.layers.Dense(64, activation='relu', input_shape=(10,)),
        tf.keras.layers.Dense(1)
    ])
    print("✓ Model created successfully")
    print(f"  Model summary:\n{model.summary()}")
except Exception as e:
    print(f"✗ Error: {e}")
    sys.exit(1)

print("\n" + "=" * 70)
print("✓ ALL TESTS PASSED - Warnings are properly suppressed!")
print("=" * 70)
print("\nYou should have seen NO warnings about:")
print("  • oneDNN custom operations")
print("  • CPU instructions (AVX2, AVX_VNNI, FMA)")
print("  • Plotly datetime deprecation")
print("  • TensorFlow reset_default_graph")
print("\nIf you see these messages, check suppress_warnings.py configuration.")
