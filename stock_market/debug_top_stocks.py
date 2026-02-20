from utils import get_top_performing_stocks
import pandas as pd

print("Testing get_top_performing_stocks...", flush=True)
try:
    print("Calling function...", flush=True)
    results = get_top_performing_stocks(limit=10)
    print("Function returned.", flush=True)
    print(f"Got {len(results)} results:", flush=True)
    for r in results:
        print(r, flush=True)
except Exception as e:
    print(f"Error: {e}", flush=True)
import traceback
traceback.print_exc()
