import sys
import os

print(f"Python Version: {sys.version}")
print(f"Executable: {sys.executable}")
print("--- Path ---")
for p in sys.path:
    print(p)

print("--- Imports ---")
try:
    import numpy
    print(f"✅ numpy {numpy.__version__}")
except Exception as e:
    print(f"❌ numpy: {e}")

try:
    import pandas
    print(f"✅ pandas {pandas.__version__}")
except Exception as e:
    print(f"❌ pandas: {e}")

try:
    import torch
    print(f"✅ torch {torch.__version__}")
except Exception as e:
    print(f"❌ torch: {e}")

try:
    import transformers
    print(f"✅ transformers {transformers.__version__}")
    from transformers import pipeline
    print("✅ transformers.pipeline success")
except Exception as e:
    print(f"❌ transformers: {e}")
    import traceback
    traceback.print_exc()

try:
    import tensorflow as tf
    print(f"✅ tensorflow {tf.__version__}")
except Exception as e:
    print(f"❌ tensorflow: {e}")
