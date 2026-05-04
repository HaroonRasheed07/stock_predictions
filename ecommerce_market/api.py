"""
E-commerce Analytics API
========================
FastAPI backend for Amazon sales & review analytics.
Port: 8002

Endpoints:
  POST /api/ecommerce/overview      - KPIs, top products, summary
  POST /api/ecommerce/products      - Product list with filters
  POST /api/ecommerce/product/:id   - Single product detail
  POST /api/ecommerce/sentiment     - Sentiment analysis for review text
  POST /api/ecommerce/fake-detect   - Fake review detection
  POST /api/ecommerce/export        - CSV export

Run:  uvicorn api:app --reload --port 8002
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
import pandas as pd
import numpy as np
import math
import time
import traceback
import os
import csv
import io

# ---------------------------------------------------------------------------
# Sentiment classifier (keyword-based, same logic as the TS version)
# ---------------------------------------------------------------------------

POSITIVE_WORDS = {
    "excellent", "amazing", "outstanding", "fantastic", "wonderful",
    "perfect", "love", "great", "awesome", "superb", "brilliant",
    "exceptional", "best", "good", "nice", "fine", "decent",
    "helpful", "useful", "recommend", "worth", "quality", "reliable",
    "durable", "efficient", "effective", "impressed", "satisfied", "happy",
    "works", "fast", "quick", "easy", "simple", "convenient",
    "comfortable", "beautiful", "elegant", "clean", "bright", "smooth", "soft",
}

NEGATIVE_WORDS = {
    "terrible", "awful", "horrible", "disgusting", "useless", "worthless",
    "garbage", "junk", "trash", "waste", "worst", "bad", "poor",
    "disappointing", "mediocre", "inferior", "cheap", "flimsy", "broken",
    "defective", "faulty", "damaged", "ugly", "uncomfortable", "frustrating",
    "annoying", "failed", "stopped", "leaked", "missing", "wrong",
    "incorrect", "late", "slow", "difficult", "complicated", "confusing",
    "expensive", "overpriced", "scam", "fraud", "fake", "counterfeit",
}

NEGATION_WORDS = {
    "not", "no", "never", "neither", "nobody", "nothing", "hardly",
    "barely", "don't", "doesn't", "didn't", "won't", "wouldn't",
    "can't", "couldn't", "shouldn't",
}


def _classify_sentiment(text: str, rating: Optional[float] = None) -> dict:
    """Hybrid sentiment: rating (if given) + keyword analysis."""
    label = "neutral"
    confidence = 0.5
    keywords = []

    if text and len(text) >= 3:
        words = text.lower().split()
        pos_count = 0
        neg_count = 0
        found_kw = []
        for i, w in enumerate(words):
            clean = w.strip(".,!?;:'\"()")
            is_negated = i > 0 and words[i - 1].strip(".,!?;:'\"()") in NEGATION_WORDS
            if clean in POSITIVE_WORDS:
                pos_count += -1 if is_negated else 1
                found_kw.append(clean)
            elif clean in NEGATIVE_WORDS:
                neg_count += -1 if is_negated else 1
                found_kw.append(clean)
        keywords = list(dict.fromkeys(found_kw))[:5]

        if pos_count > neg_count:
            label = "positive"
            confidence = min(pos_count / max(pos_count + neg_count, 1), 0.95)
        elif neg_count > pos_count:
            label = "negative"
            confidence = min(neg_count / max(pos_count + neg_count, 1), 0.95)

    # Rating override / blend
    if rating is not None:
        rating_label = "positive" if rating >= 4 else ("negative" if rating <= 2 else "neutral")
        rating_conf = 0.8 + abs(rating - 3) * 0.05
        if label == rating_label:
            confidence = min(confidence + 0.1, 1.0)
        elif label != "neutral" and rating_label != label:
            confidence = max(confidence - 0.15, 0.5)
        label = rating_label
        confidence = max(confidence, rating_conf * 0.6)

    return {"label": label, "confidence": round(confidence, 2), "keywords": keywords}


def _is_fake_review(review_text: str = "", review_title: str = "") -> bool:
    """Heuristic fake review detection."""
    checks = [
        not review_text or len(review_text) < 10,
        not review_title or len(review_title) < 3,
        bool(review_title and len(review_title) <= 2 and review_title.isalpha()),
        len(review_text) < 5 if review_text else True,
    ]
    return sum(checks) >= 2


# ---------------------------------------------------------------------------
# Data loading & caching
# ---------------------------------------------------------------------------

_DATA_CACHE: dict = {}
_CACHE_TTL = 300  # 5 minutes

def _get_cached(key):
    if key in _DATA_CACHE:
        ts, val = _DATA_CACHE[key]
        if time.time() - ts < _CACHE_TTL:
            return val
    return None

def _set_cached(key, val):
    _DATA_CACHE[key] = (time.time(), val)


def safe_float(val, default=0.0):
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return default
        return f
    except (TypeError, ValueError):
        return default


# ---------------------------------------------------------------------------
# CSV data loading
# ---------------------------------------------------------------------------

SALES_CSV = os.path.join(os.path.dirname(__file__), "data", "amazon_sales.csv")
REVIEWS_CSV = os.path.join(os.path.dirname(__file__), "data", "amazon_reviews.csv")

# Also check the old ecommerce-analytics-dashboard folder for CSVs
_ALT_SALES = os.path.join(os.path.dirname(os.path.dirname(__file__)),
                          "ecommerce-analytics-dashboard (3)", "client", "public", "data", "amazon_sales.csv")
_ALT_REVIEWS = os.path.join(os.path.dirname(os.path.dirname(__file__)),
                            "ecommerce-analytics-dashboard (3)", "client", "public", "data", "amazon_reviews.csv")


def _find_csv(sales_path: str, reviews_path: str):
    """Find CSV files, trying alternate paths."""
    sp = sales_path if os.path.exists(sales_path) else (_ALT_SALES if os.path.exists(_ALT_SALES) else None)
    rp = reviews_path if os.path.exists(reviews_path) else (_ALT_REVIEWS if os.path.exists(_ALT_REVIEWS) else None)
    return sp, rp


def _load_sales_data() -> pd.DataFrame:
    cached = _get_cached("__sales_df__")
    if cached is not None:
        return cached

    sp, _ = _find_csv(SALES_CSV, REVIEWS_CSV)
    if sp is None:
        return pd.DataFrame()

    try:
        df = pd.read_csv(sp, low_memory=True, on_bad_lines="skip")
        _DATA_CACHE["__sales_df__"] = (time.time(), df)
        return df
    except Exception as e:
        print(f"Error loading sales CSV: {e}")
        return pd.DataFrame()


def _load_reviews_data() -> pd.DataFrame:
    cached = _get_cached("__reviews_df__")
    if cached is not None:
        return cached

    _, rp = _find_csv(SALES_CSV, REVIEWS_CSV)
    if rp is None:
        return pd.DataFrame()

    try:
        df = pd.read_csv(rp, low_memory=True, on_bad_lines="skip")
        _DATA_CACHE["__reviews_df__"] = (time.time(), df)
        return df
    except Exception as e:
        print(f"Error loading reviews CSV: {e}")
        return pd.DataFrame()


def _generate_mock_data() -> dict:
    """Generate realistic mock data when CSVs are not available."""
    cached = _get_cached("__mock_data__")
    if cached is not None:
        return cached

    product_names = [
        "Wireless Bluetooth Headphones Pro", "USB-C Fast Charging Cable (3-pack)",
        "Premium Stainless Steel Water Bottle", "Ergonomic Gaming Mouse RGB",
        "Ultra-Slim Laptop Stand", "Portable Power Bank 30000mAh",
        "Bamboo Cutting Board Set", "Smart LED Desk Lamp",
        "Mechanical Keyboard Cherry MX", "Noise-Cancelling Sleep Earbuds",
    ]
    categories = ["Electronics", "Accessories", "Home & Kitchen", "Office Supplies", "Tech Gadgets"]

    np.random.seed(42)
    products = []
    for i, name in enumerate(product_names):
        base_sales = np.random.randint(50000, 200000)
        total_reviews = np.random.randint(500, 5000)
        avg_rating = round(3.5 + np.random.random() * 1.5, 1)
        fake_pct = round(5 + np.random.random() * 15, 1)
        pos = int(total_reviews * (0.6 + np.random.random() * 0.2))
        neu = int(total_reviews * (0.15 + np.random.random() * 0.1))
        neg = total_reviews - pos - neu

        monthly_data = []
        for year in [2023, 2024, 2025]:
            for month in range(1, 13):
                seasonal = [1.2, 1.1, 0.9, 0.8, 0.7, 0.6, 1.3, 1.4, 1.0, 1.1, 1.5, 1.8][month - 1]
                growth = 1.0 if year == 2023 else (1.3 if year == 2024 else 1.7)
                sales = int(base_sales * seasonal * growth / 12 * (0.8 + np.random.random() * 0.4))
                revs = int(total_reviews * seasonal * growth / 12 * (0.5 + np.random.random() * 0.5))
                monthly_data.append({
                    "date": f"{year}-{str(month).zfill(2)}-01",
                    "month": ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][month-1],
                    "sales": sales,
                    "reviews": revs,
                    "avgRating": round(3.5 + np.random.random() * 1.5, 1),
                    "fakeReviewPercentage": round(5 + np.random.random() * 15, 1),
                    "sentimentPositive": int(revs * 0.65),
                    "sentimentNeutral": int(revs * 0.2),
                    "sentimentNegative": revs - int(revs * 0.65) - int(revs * 0.2),
                })

        products.append({
            "id": f"product-{i+1}",
            "name": name,
            "category": categories[i % len(categories)],
            "totalSales": base_sales,
            "totalReviews": total_reviews,
            "avgRating": avg_rating,
            "fakeReviewCount": int(total_reviews * fake_pct / 100),
            "fakeReviewPercentage": fake_pct,
            "sentimentBreakdown": {"positive": pos, "neutral": neu, "negative": neg},
            "monthlyData": monthly_data,
        })

    # Aggregated monthly metrics
    monthly_metrics = []
    for year in [2023, 2024, 2025]:
        for month in range(1, 13):
            seasonal = [1.2, 1.1, 0.9, 0.8, 0.7, 0.6, 1.3, 1.4, 1.0, 1.1, 1.5, 1.8][month - 1]
            growth = 1.0 if year == 2023 else (1.3 if year == 2024 else 1.7)
            total_sales = int(sum(p["totalSales"] for p in products) * seasonal * growth / 36)
            total_revs = int(sum(p["totalReviews"] for p in products) * seasonal * growth / 36)
            monthly_metrics.append({
                "date": f"{year}-{str(month).zfill(2)}-01",
                "month": ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][month-1],
                "sales": total_sales,
                "reviews": total_revs,
                "avgRating": round(3.8 + np.random.random() * 0.8, 1),
                "fakeReviewPercentage": round(8 + np.random.random() * 10, 1),
                "sentimentPositive": int(total_revs * 0.65),
                "sentimentNeutral": int(total_revs * 0.2),
                "sentimentNegative": total_revs - int(total_revs * 0.65) - int(total_revs * 0.2),
            })

    data = {"products": products, "monthlyMetrics": monthly_metrics, "isMockData": True}
    _set_cached("__mock_data__", data)
    return data


def _get_data() -> dict:
    """Load data from CSVs if available, otherwise use mock data."""
    cached = _get_cached("__processed_data__")
    if cached is not None:
        return cached

    sales_df = _load_sales_data()
    reviews_df = _load_reviews_data()

    if len(sales_df) == 0 and len(reviews_df) == 0:
        data = _generate_mock_data()
        _set_cached("__processed_data__", data)
        return data

    # Process real CSV data
    products = []
    if len(sales_df) > 0:
        # Group by product
        for pid, group in sales_df.groupby(sales_df.columns[0]):  # first column is product_id
            try:
                row0 = group.iloc[0]
                name = str(row0.get("product_name", pid))
                category = str(row0.get("category", "General"))
                total_sales = safe_float(row0.get("discounted_price", 0)) * len(group)
                total_reviews = len(group)
                avg_rating = safe_float(row0.get("rating", 0))
                fake_count = 0
                pos, neu, neg = 0, 0, 0

                for _, r in group.iterrows():
                    rev_text = str(r.get("review_content", ""))
                    rev_title = str(r.get("review_title", ""))
                    rating_val = safe_float(r.get("rating", None), None)

                    if _is_fake_review(rev_text, rev_title):
                        fake_count += 1

                    sent = _classify_sentiment(rev_text, rating_val if rating_val else None)
                    if sent["label"] == "positive": pos += 1
                    elif sent["label"] == "neutral": neu += 1
                    else: neg += 1

                products.append({
                    "id": str(pid),
                    "name": name,
                    "category": category,
                    "totalSales": round(safe_float(total_sales), 2),
                    "totalReviews": total_reviews,
                    "avgRating": round(safe_float(avg_rating), 1),
                    "fakeReviewCount": fake_count,
                    "fakeReviewPercentage": round(fake_count / max(total_reviews, 1) * 100, 1),
                    "sentimentBreakdown": {"positive": pos, "neutral": neu, "negative": neg},
                    "monthlyData": [],
                })
            except Exception:
                continue

    data = {"products": products, "monthlyMetrics": [], "isMockData": False}
    _set_cached("__processed_data__", data)
    return data


# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------

app = FastAPI(title="E-commerce Analytics API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Schemas ---

class YearFilter(BaseModel):
    year: int = 2024

class ProductFilter(BaseModel):
    year: int = 2024
    category: Optional[str] = None
    sort_by: str = Field("sales", pattern="^(sales|reviews|rating)$")
    limit: int = Field(10, ge=1, le=50)

class ProductDetailRequest(BaseModel):
    product_id: str

class SentimentRequest(BaseModel):
    text: str
    rating: Optional[float] = None

class BatchSentimentRequest(BaseModel):
    reviews: List[dict]  # [{text, rating?}]

class FakeDetectRequest(BaseModel):
    review_text: str = ""
    review_title: str = ""

class ExportRequest(BaseModel):
    year: int = 2024
    product_id: Optional[str] = None


# --- Endpoints ---

@app.post("/api/ecommerce/overview")
def get_overview(request: YearFilter):
    """KPIs, top products, sentiment distribution, monthly metrics."""
    try:
        data = _get_data()
        products = data["products"]
        metrics = data["monthlyMetrics"]

        # Filter metrics by year
        year_metrics = [m for m in metrics if m["date"].startswith(str(request.year))]

        # KPIs
        total_sales = sum(m["sales"] for m in year_metrics) if year_metrics else sum(p["totalSales"] for p in products)
        total_reviews = sum(m["reviews"] for m in year_metrics) if year_metrics else sum(p["totalReviews"] for p in products)
        avg_rating = (sum(m["avgRating"] for m in year_metrics) / len(year_metrics)) if year_metrics else (sum(p["avgRating"] for p in products) / max(len(products), 1))
        fake_pct = (sum(m["fakeReviewPercentage"] for m in year_metrics) / len(year_metrics)) if year_metrics else (sum(p["fakeReviewPercentage"] for p in products) / max(len(products), 1))

        total_pos = sum(m["sentimentPositive"] for m in year_metrics) if year_metrics else sum(p["sentimentBreakdown"]["positive"] for p in products)
        total_neu = sum(m["sentimentNeutral"] for m in year_metrics) if year_metrics else sum(p["sentimentBreakdown"]["neutral"] for p in products)
        total_neg = sum(m["sentimentNegative"] for m in year_metrics) if year_metrics else sum(p["sentimentBreakdown"]["negative"] for p in products)
        total_sent = max(total_pos + total_neu + total_neg, 1)

        # Top 5 by sales
        top_by_sales = sorted(products, key=lambda p: p["totalSales"], reverse=True)[:5]
        # Top 5 by reviews
        top_by_reviews = sorted(products, key=lambda p: p["totalReviews"], reverse=True)[:5]

        return {
            "status": "success",
            "isMockData": data["isMockData"],
            "kpis": {
                "totalSales": safe_float(total_sales),
                "totalReviews": int(total_reviews),
                "avgRating": round(safe_float(avg_rating), 1),
                "fakeReviewPercentage": round(safe_float(fake_pct), 1),
                "sentimentPositivePercentage": round(total_pos / total_sent * 100, 1),
                "sentimentNeutralPercentage": round(total_neu / total_sent * 100, 1),
                "sentimentNegativePercentage": round(total_neg / total_sent * 100, 1),
            },
            "monthlyMetrics": year_metrics if year_metrics else metrics,
            "topProductsBySales": top_by_sales,
            "topProductsByReviews": top_by_reviews,
            "products": products,
            "categories": list(dict.fromkeys(p["category"] for p in products)),
            "yearsAvailable": [2023, 2024, 2025],
        }
    except Exception as e:
        print(f"Overview Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ecommerce/products")
def get_products(request: ProductFilter):
    """Filtered product list."""
    try:
        data = _get_data()
        products = data["products"]

        if request.category:
            products = [p for p in products if p["category"] == request.category]

        if request.sort_by == "sales":
            products.sort(key=lambda p: p["totalSales"], reverse=True)
        elif request.sort_by == "reviews":
            products.sort(key=lambda p: p["totalReviews"], reverse=True)
        else:
            products.sort(key=lambda p: p["avgRating"], reverse=True)

        return {
            "status": "success",
            "products": products[:request.limit],
            "total": len(products),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ecommerce/product")
def get_product_detail(request: ProductDetailRequest):
    """Single product detail with monthly data."""
    try:
        data = _get_data()
        product = next((p for p in data["products"] if p["id"] == request.product_id), None)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        return {"status": "success", "product": product}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ecommerce/sentiment")
def classify_sentiment(request: SentimentRequest):
    """Classify sentiment of review text."""
    try:
        result = _classify_sentiment(request.text, request.rating)
        return {"status": "success", **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ecommerce/sentiment/batch")
def batch_sentiment(request: BatchSentimentRequest):
    """Batch sentiment classification."""
    try:
        results = []
        for item in request.reviews[:100]:
            text = item.get("text", "")
            rating = item.get("rating")
            result = _classify_sentiment(text, rating)
            results.append({"text": text[:50], **result})
        return {"status": "success", "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ecommerce/fake-detect")
def detect_fake(request: FakeDetectRequest):
    """Detect if a review is potentially fake."""
    try:
        is_fake = _is_fake_review(request.review_text, request.review_title)
        return {
            "status": "success",
            "isFake": is_fake,
            "confidence": 0.7 if is_fake else 0.3,
            "indicators": _fake_indicators(request.review_text, request.review_title),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _fake_indicators(text: str, title: str) -> List[str]:
    indicators = []
    if not text or len(text) < 10:
        indicators.append("Review text too short")
    if not title or len(title) < 3:
        indicators.append("Review title too short")
    if title and len(title) <= 2 and title.isalpha():
        indicators.append("Suspicious title pattern")
    if text and len(text) < 5:
        indicators.append("Review content too brief")
    return indicators


@app.post("/api/ecommerce/export")
def export_csv(request: ExportRequest):
    """Export analytics data as CSV."""
    try:
        data = _get_data()
        metrics = data["monthlyMetrics"]
        year_metrics = [m for m in metrics if m["date"].startswith(str(request.year))]

        if request.product_id:
            product = next((p for p in data["products"] if p["id"] == request.product_id), None)
            if product and product["monthlyData"]:
                year_metrics = [m for m in product["monthlyData"] if m["date"].startswith(str(request.year))]

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Date", "Month", "Sales", "Reviews", "Avg Rating",
                         "Fake Reviews %", "Sentiment Positive", "Sentiment Neutral", "Sentiment Negative"])
        for m in year_metrics:
            writer.writerow([
                m["date"], m["month"], m["sales"], m["reviews"],
                m["avgRating"], m["fakeReviewPercentage"],
                m["sentimentPositive"], m["sentimentNeutral"], m["sentimentNegative"],
            ])

        return {"status": "success", "csv": output.getvalue(), "rows": len(year_metrics)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ecommerce/health")
def health_check():
    """Health check endpoint."""
    sp, rp = _find_csv(SALES_CSV, REVIEWS_CSV)
    return {
        "status": "ok",
        "dataSource": "csv" if (sp or rp) else "mock",
        "salesCsvExists": sp is not None,
        "reviewsCsvExists": rp is not None,
    }
