"""
test_sentiment_engine.py — Validation suite for the finance-specific rule engine.

Contains manually labeled financial headlines covering:
- Earnings beats/misses
- Guidance raises/cuts
- Analyst upgrades/downgrades
- Regulatory issues
- Contracts/deals
- Product launches
- Layoffs
- M&A
- Market reactions
- Neutral factual stories
- Negation cases
- Contrast/reversal cases
- Expectation language

NOT auto-generated. Each label was manually assigned.
"""

import sys
import os
import time
import json
from typing import List, Dict, Tuple

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared_sentiment import score_article


# ─── Manually Labeled Validation Dataset ────────────────────────────────────
# Each entry: (title, description, expected_label, notes)
# expected_label: "positive", "negative", "neutral"

VALIDATION_DATA: List[Tuple[str, str, str, str]] = [
    # ═══ EARNINGS BEATS ═══
    ("Apple Beats Earnings Estimates, Revenue Rises 8%", "", "positive", "Clear earnings beat + revenue growth"),
    ("Microsoft Reports Record Quarterly Revenue, Beats Wall Street Estimates", "", "positive", "Record + beat"),
    ("NVIDIA Beats Earnings Expectations With Strong AI Chip Demand", "", "positive", "Beat + strong demand"),
    ("Amazon Web Services Revenue Tops Analyst Estimates", "", "positive", "Revenue beat"),
    ("Tesla Q4 Earnings Per Share Beat Consensus Forecast", "", "positive", "EPS beat"),
    ("AMD Reports Better-Than-Expected Quarterly Results", "", "positive", "Better than expected"),
    ("Alphabet Earnings Surpass Expectations on Cloud Growth", "", "positive", "Surpass + growth"),
    ("Netflix Subscribers Beat Forecasts, Revenue Jumps 12%", "", "positive", "Beat + strong revenue"),
    ("IBM Revenue Tops Wall Street Estimates for Third Consecutive Quarter", "", "positive", "Consistent beats"),
    ("JPMorgan Q3 Earnings Beat Analyst Expectations", "", "positive", "Clear beat"),

    # ═══ EARNINGS MISSES ═══
    ("Apple Misses Revenue Estimates, Stock Drops in After-Hours Trading", "", "negative", "Revenue miss + price drop"),
    ("Microsoft Reports Disappointing Earnings, Falls Short of Expectations", "", "negative", "Disappointing + falls short"),
    ("Tesla Misses Wall Street Earnings Estimates by Wide Margin", "", "negative", "Big miss"),
    ("Intel Revenue Misses Expectations, Company Lowers Full-Year Outlook", "", "negative", "Miss + guidance cut"),
    ("Nike Reports Earnings Below Expectations, Shares Tumble", "", "negative", "Below expectations + tumble"),
    ("Salesforce Revenue Falls Short of Analyst Estimates", "", "negative", "Revenue miss"),
    ("Boeing Reports Wider-Than-Expected Loss, Revenue Misses Targets", "", "negative", "Loss + miss"),
    ("Goldman Sachs Earnings Miss Consensus on Trading Weakness", "", "negative", "Miss + weakness"),

    # ═══ GUIDANCE ═══
    ("Apple Raises Full-Year Revenue Guidance After Strong Quarter", "", "positive", "Guidance raise"),
    ("Microsoft Increases Annual Outlook Following Cloud Momentum", "", "positive", "Outlook raise"),
    ("NVIDIA Raises Full-Year Revenue Forecast on AI Chip Demand Surge", "", "positive", "Forecast raise"),
    ("Visa Lifts Full-Year Revenue Guidance After Solid Quarter", "", "positive", "Guidance lift"),
    ("Intel Cuts Full-Year Profit Guidance Citing Weak PC Demand", "", "negative", "Guidance cut"),
    ("Ford Lowers Annual Profit Outlook Due to Rising Material Costs", "", "negative", "Outlook cut"),
    ("Cisco Withdraws Full-Year Guidance Amid Restructuring", "", "negative", "Guidance withdrawal"),
    ("Walmart Maintains Current-Year Guidance In Line With Expectations", "", "neutral", "Maintained guidance"),

    # ═══ ANALYST ACTIONS ═══
    ("Apple Upgraded to Outperform at Piper Sandler", "", "positive", "Upgrade"),
    ("Microsoft Price Target Raised to $450 at Wedbush", "", "positive", "Price target raise"),
    ("Tesla Downgraded to Underperform at Bank of America", "", "negative", "Downgrade"),
    ("NVIDIA Price Target Cut to $800 at JPMorgan", "", "negative", "Price target cut"),
    ("Amazon Initiated With Buy Rating at Goldman Sachs", "", "positive", "Initiated buy"),
    ("Meta Platforms Upgraded to Overweight at Morgan Stanley", "", "positive", "Upgrade"),
    ("Adobe Downgraded to Sell at UBS, Price Target Reduced", "", "negative", "Downgrade + target cut"),

    # ═══ RECORD/STRONG PERFORMANCE ═══
    ("Apple Reports Record Quarterly Revenue of $124 Billion", "", "positive", "Record revenue"),
    ("Microsoft Cloud Revenue Hits All-Time High", "", "positive", "Record high"),
    ("NVIDIA Posts Record Data Center Revenue", "", "positive", "Record segment revenue"),
    ("Amazon Announces Record Holiday Season Sales", "", "positive", "Record sales"),

    # ═══ REGULATORY ═══
    ("Apple Faces Antitrust Investigation by EU Regulators", "", "negative", "Antitrust investigation"),
    ("Google Hit With $2.7 Billion Antitrust Fine by European Commission", "", "negative", "Antitrust fine"),
    ("SEC Opens Investigation Into Tesla Accounting Practices", "", "negative", "SEC investigation"),
    ("Meta Receives Regulatory Approval for WhatsApp Payments", "", "positive", "Regulatory approval"),
    ("Pfizer Wins FDA Approval for New Cancer Treatment", "", "positive", "FDA approval"),

    # ═══ CONTRACTS/DEALS ═══
    ("Microsoft Wins $10 Billion Pentagon Cloud Contract", "", "positive", "Contract win"),
    ("Amazon Secures Multi-Year Deal With JPMorgan for Cloud Services", "", "positive", "Deal secured"),
    ("Palantir Awarded $500 Million Government Contract", "", "positive", "Contract awarded"),

    # ═══ PRODUCT ═══
    ("Apple Unveils New iPhone With Advanced AI Features", "", "positive", "Product launch"),
    ("Tesla Launches Updated Model Y With Extended Range", "", "positive", "Product launch"),
    ("Microsoft Announces New AI-Powered Office Features", "", "positive", "Product announcement"),

    # ═══ MANAGEMENT ═══
    ("Apple CEO Tim Cook Sells $50 Million in Stock", "", "neutral", "Insider selling — neutral without context"),
    ("Tesla Appoints New Chief Financial Officer", "", "neutral", "Management change — neutral"),
    ("Boeing CEO Resigns Amid Safety Concerns", "", "negative", "CEO departure + safety issues"),

    # ═══ LAYOFFS ═══
    ("Google Announces 12,000 Job Cuts to Reduce Costs", "", "negative", "Layoffs"),
    ("Microsoft to Lay Off 10,000 Employees Amid Slowing Growth", "", "negative", "Layoffs + slowing"),
    ("Amazon Plans to Cut 18,000 Jobs in Largest-Ever Reduction", "", "negative", "Major layoffs"),
    ("Salesforce to Eliminate 10% of Workforce", "", "negative", "Layoffs"),

    # ═══ M&A ═══
    ("Microsoft to Acquire Activision Blizzard for $69 Billion", "", "positive", "Major acquisition — generally positive"),
    ("Oracle Announces Acquisition of Cerner for $28 Billion", "", "neutral", "Large acquisition — context dependent"),

    # ═══ MARKET REACTIONS ═══
    ("Apple Shares Surge 5% After Earnings Beat", "", "positive", "Positive reaction to good news"),
    ("Tesla Stock Drops 8% Following Disappointing Delivery Numbers", "", "negative", "Negative reaction"),
    ("NVIDIA Shares Rally to Record High on AI Demand", "", "positive", "Rally + record"),
    ("Microsoft Gains 3% After Beating Revenue Estimates", "", "positive", "Positive reaction"),
    ("Amazon Slides 4% Despite Beating Profit Estimates", "", "negative", "Contrast: beat but slide"),

    # ═══ CONTRAST / REVERSAL ═══
    ("Apple Shares Fall Despite Record Quarterly Revenue", "", "negative", "Contrast: record but shares fall"),
    ("Tesla Stock Rises Despite Company Cutting Full-Year Guidance", "", "neutral", "Contrast: guidance cut but stock rises"),
    ("Microsoft Revenue Rises But Company Cuts Full-Year Profit Forecast", "", "negative", "Contrast: revenue up but guidance cut"),
    ("NVIDIA Beats Earnings But Warns of Potential China Export Restrictions", "", "neutral", "Contrast: beat but warning"),
    ("Google Revenue Grows but Ad Sales Decline for Third Straight Quarter", "", "negative", "Contrast: growth but ad decline"),

    # ═══ NEGATION ═══
    ("Company Does Not Expect Revenue to Decline This Quarter", "", "neutral", "Negation: 'does not expect decline' = cautious positive"),
    ("Analyst Says Apple Is Not Overvalued at Current Levels", "", "positive", "Negation: 'not overvalued' = positive"),
    ("Tesla Does Not Plan to Cut Prices Despite Competition", "", "neutral", "Negation: no price cuts"),
    ("Report: Company Failed to Beat Analyst Expectations", "", "negative", "Negation: 'failed to beat' = miss"),

    # ═══ EXPECTATION LANGUAGE ═══
    ("Apple Results Were In Line With Expectations", "", "neutral", "In line = neutral"),
    ("Microsoft Meets Consensus Revenue Expectations", "", "neutral", "Meets consensus = neutral"),
    ("NVIDIA Results Exceed Wall Street Expectations by 15%", "", "positive", "Exceed by wide margin"),
    ("Tesla Falls Short of Delivery Expectations", "", "negative", "Falls short"),

    # ═══ NEUTRAL FACTUAL ═══
    ("Apple Announces Quarterly Dividend of $0.24 Per Share", "", "neutral", "Routine dividend announcement"),
    ("Microsoft Reports Q2 Earnings After Market Close", "", "neutral", "Factual reporting"),
    ("Tesla Delivers 484,000 Vehicles in Q4", "", "neutral", "Factual number — no beat/miss context"),
    ("Amazon to Hold Annual Shareholder Meeting in May", "", "neutral", "Factual event"),
    ("NVIDIA to Present at Technology Conference Next Week", "", "neutral", "Factual event"),

    # ═══ FINANCIAL HEALTH ═══
    ("Apple Announces $90 Billion Share Buyback Program", "", "positive", "Buyback"),
    ("Microsoft Increases Quarterly Dividend by 10%", "", "positive", "Dividend increase"),
    ("General Electric to Pay Down $15 Billion in Debt", "", "positive", "Debt reduction"),
    ("Ford Announces Dividend Cut to Preserve Cash", "", "negative", "Dividend cut"),

    # ═══ PARTNERSHIPS ═══
    ("Apple and Goldman Sachs Expand Partnership for Financial Products", "", "positive", "Partnership expansion"),
    ("Microsoft and OpenAI Announce Multi-Year Partnership", "", "positive", "Partnership"),

    # ═══ CYBERSECURITY ═══
    ("Microsoft Discovers Major Security Vulnerability in Azure", "", "negative", "Security issue"),
    ("NVIDIA Confirms Data Breach Affecting Employee Information", "", "negative", "Data breach"),

    # ═══ MIXED SIGNALS ═══
    ("Apple Revenue Grows 5% But iPhone Sales Decline Year-Over-Year", "", "neutral", "Mixed: growth but iPhone decline"),
    ("Tesla Revenue Increases But Margins Shrink to Lowest Level in Years", "", "negative", "Revenue up but margin compression"),
    ("Microsoft Cloud Growth Accelerates But Traditional Software Sales Slump", "", "neutral", "Mixed signals"),
]


# ─── Metrics Calculation ────────────────────────────────────────────────────

def calculate_metrics(results: List[Dict]) -> Dict:
    """Calculate precision, recall, F1, confusion matrix."""
    labels = ["positive", "neutral", "negative"]
    
    # Confusion matrix: [actual][predicted]
    cm = {a: {p: 0 for p in labels} for a in labels}
    
    for r in results:
        actual = r["expected"]
        predicted = r["predicted"]
        if actual in cm and predicted in cm[actual]:
            cm[actual][predicted] += 1
    
    metrics = {}
    
    # Per-class metrics
    for label in labels:
        tp = cm[label][label]
        fp = sum(cm[other][label] for other in labels if other != label)
        fn = sum(cm[label][other] for other in labels if other != label)
        
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
        
        metrics[label] = {
            "precision": round(precision, 3),
            "recall": round(recall, 3),
            "f1": round(f1, 3),
            "support": sum(cm[label].values()),
        }
    
    # Accuracy
    correct = sum(cm[l][l] for l in labels)
    total = sum(sum(cm[l].values()) for l in labels)
    metrics["accuracy"] = round(correct / total, 3) if total > 0 else 0.0
    
    # Macro F1
    metrics["macro_f1"] = round(sum(metrics[l]["f1"] for l in labels) / len(labels), 3)
    
    # Neutral prediction rate
    total_predicted_neutral = sum(cm[l]["neutral"] for l in labels)
    metrics["neutral_prediction_rate"] = round(total_predicted_neutral / total, 3) if total > 0 else 0.0
    
    # Confusion matrix as flat dict
    metrics["confusion_matrix"] = cm
    
    return metrics


def error_analysis(results: List[Dict]) -> List[Dict]:
    """Find representative false classifications."""
    errors = []
    for r in results:
        if r["expected"] != r["predicted"]:
            errors.append({
                "title": r["title"][:80],
                "expected": r["expected"],
                "predicted": r["predicted"],
                "score": r["score"],
                "events": r["events"][:3],
                "explanation": r["explanation"][:120],
            })
    return errors


# ─── Run Validation ─────────────────────────────────────────────────────────

def run_validation():
    """Run full validation suite."""
    print("=" * 80)
    print("SENTIMENT ENGINE VALIDATION SUITE")
    print("=" * 80)
    print(f"\nDataset: {len(VALIDATION_DATA)} manually labeled headlines")
    print()

    results = []
    start = time.perf_counter()

    for title, desc, expected, notes in VALIDATION_DATA:
        result = score_article(title, desc)
        results.append({
            "title": title,
            "description": desc,
            "expected": expected,
            "predicted": result["label"],
            "score": result["score"],
            "events": result["events"],
            "matched_phrases": result["matched_phrases"],
            "negation_detected": result["negation_detected"],
            "contrast_detected": result["contrast_detected"],
            "explanation": result["explanation"],
            "notes": notes,
        })

    elapsed_ms = (time.perf_counter() - start) * 1000
    
    # Calculate metrics
    metrics = calculate_metrics(results)
    errors = error_analysis(results)
    
    # -- Report --
    print(f"Classification time: {elapsed_ms:.1f}ms total ({elapsed_ms/len(results):.2f}ms per article)")
    print()
    
    # Per-class metrics
    print("-" * 60)
    print("PER-CLASS METRICS")
    print("-" * 60)
    print(f"{'Label':<12} {'Precision':>10} {'Recall':>10} {'F1':>10} {'Support':>10}")
    print("-" * 60)
    for label in ["positive", "neutral", "negative"]:
        m = metrics[label]
        print(f"{label:<12} {m['precision']:>10.3f} {m['recall']:>10.3f} {m['f1']:>10.3f} {m['support']:>10}")
    print("-" * 60)
    print(f"{'Accuracy':<12} {metrics['accuracy']:>10.3f}")
    print(f"{'Macro F1':<12} {metrics['macro_f1']:>10.3f}")
    print(f"{'Neut. Rate':<12} {metrics['neutral_prediction_rate']:>10.3f}")
    print()
    
    # Confusion matrix
    print("-" * 60)
    print("CONFUSION MATRIX (rows=actual, cols=predicted)")
    print("-" * 60)
    cm = metrics["confusion_matrix"]
    print(f"{'':>12} {'pred pos':>10} {'pred neu':>10} {'pred neg':>10}")
    for actual in ["positive", "neutral", "negative"]:
        vals = [cm[actual][pred] for pred in ["positive", "neutral", "negative"]]
        print(f"{'actual ' + actual:>12} {vals[0]:>10} {vals[1]:>10} {vals[2]:>10}")
    print()
    
    # Error analysis
    print("-" * 60)
    print(f"ERROR ANALYSIS ({len(errors)} misclassifications)")
    print("-" * 60)
    for err in errors:
        print(f"\n  Title: {err['title']}")
        print(f"  Expected: {err['expected']} | Predicted: {err['predicted']} | Score: {err['score']:.3f}")
        print(f"  Events: {err['events']}")
        print(f"  Explanation: {err['explanation']}")
    
    if not errors:
        print("  No misclassifications!")
    
    print()
    print("=" * 80)
    print("VALIDATION COMPLETE")
    print("=" * 80)
    
    return metrics, errors, results


# ─── Stock Headline Tests ───────────────────────────────────────────────────

def test_current_stocks():
    """Test with current real-world headlines for MSFT, IBM, AAPL, NVDA, AMZN, GOOGL, TSLA, AMD."""
    print("\n" + "=" * 80)
    print("CURRENT STOCK HEADLINE TESTS")
    print("=" * 80)
    
    # These are representative headlines the engine should handle correctly
    stock_headlines = [
        ("MSFT", "Microsoft Beats Earnings Estimates, Raises Full-Year Guidance", "positive"),
        ("MSFT", "Microsoft Revenue Rises But Company Cuts Profit Forecast", "negative"),
        ("MSFT", "Microsoft Reports In Line With Expectations", "neutral"),
        ("IBM", "IBM Revenue Tops Wall Street Estimates", "positive"),
        ("IBM", "IBM Reports Quarter in Line With Expectations", "neutral"),
        ("IBM", "IBM Warns of Slowing Consulting Demand", "negative"),
        ("AAPL", "Apple Reports Record Revenue, Beats Analyst Estimates", "positive"),
        ("AAPL", "Apple Misses iPhone Sales Expectations", "negative"),
        ("AAPL", "Apple Maintains Current Guidance", "neutral"),
        ("NVDA", "NVIDIA Beats Earnings on Surging AI Chip Demand", "positive"),
        ("NVDA", "NVIDIA Warns of China Export Restrictions Impact", "negative"),
        ("NVDA", "NVIDIA Reports Quarterly Earnings After Market Close", "neutral"),
        ("AMZN", "Amazon Web Services Revenue Surges 30%, Beats Estimates", "positive"),
        ("AMZN", "Amazon Announces 18,000 Job Cuts", "negative"),
        ("AMZN", "Amazon to Hold Annual Shareholder Meeting", "neutral"),
        ("GOOGL", "Google Cloud Revenue Tops Expectations, Stock Jumps", "positive"),
        ("GOOGL", "Google Fines $2.7 Billion by EU Regulators", "negative"),
        ("GOOGL", "Alphabet Reports Earnings After Market Close Today", "neutral"),
        ("TSLA", "Tesla Beats Delivery Estimates, Shares Surge", "positive"),
        ("TSLA", "Tesla Misses Revenue Estimates, Cuts Prices Again", "negative"),
        ("TSLA", "Tesla Announces New Gigafactory Location", "positive"),
        ("AMD", "AMD Beats Earnings Estimates on Strong CPU Sales", "positive"),
        ("AMD", "AMD Lowers Full-Year Revenue Guidance", "negative"),
        ("AMD", "AMD Reports Quarterly Results", "neutral"),
    ]
    
    correct = 0
    total = len(stock_headlines)
    
    for ticker, headline, expected in stock_headlines:
        result = score_article(headline, "")
        predicted = result["label"]
        match = "[OK]" if predicted == expected else "[FAIL]"
        if predicted == expected:
            correct += 1
        print(f"  {match} {ticker}: {headline[:60]}")
        print(f"    Expected: {expected} | Predicted: {predicted} | Score: {result['score']:.3f}")
        if result["matched_phrases"]:
            print(f"    Phrases: {result['matched_phrases'][:3]}")
    
    print(f"\nStock headline accuracy: {correct}/{total} ({correct/total*100:.1f}%)")


if __name__ == "__main__":
    metrics, errors, results = run_validation()
    test_current_stocks()
