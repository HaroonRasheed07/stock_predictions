import sys
import os

# Add the stock_market directory to the path so that inner module imports work.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "stock_market"))

from stock_market.api import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
