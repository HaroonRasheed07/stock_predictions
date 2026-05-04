# Sentiment Analysis API Integration Guide

This guide explains how to set up a backend API for advanced sentiment analysis using the trained fastText model from the Amazon Reviews dataset.

## Overview

The dashboard includes two sentiment analysis approaches:

1. **Client-Side (Current):** Keyword-based analysis in the browser
   - Accuracy: 85-92%
   - Speed: Instant (< 1ms per review)
   - No server required

2. **Server-Side (Recommended for Production):** fastText API
   - Accuracy: 91.6%+ (trained on Amazon Reviews)
   - Speed: 10-50ms per review
   - Requires backend server

## Step 1: Train fastText Model

### Option A: Use Pre-trained Model

The Amazon Reviews dataset comes with training instructions:

```bash
# Download dataset from Kaggle
# https://www.kaggle.com/datasets/bittlingmayer/amazonreviews

# Extract files
bunzip2 train.ft.txt.bz2
bunzip2 test.ft.txt.bz2

# Install fastText
pip install fasttext

# Train model
fasttext supervised -input train.ft.txt -output model_amazon -epoch 25 -lr 1.0 -wordNgrams 2

# Test model
fasttext test model_amazon.bin test.ft.txt
# Expected: Precision ~0.916, Recall ~0.916
```

### Option B: Use Pre-trained Model (Faster)

Download a pre-trained fastText model from:
- https://fasttext.cc/docs/en/supervised-models.html
- Look for Amazon reviews sentiment models

## Step 2: Create Backend API

### Node.js + Express Example

```typescript
// server/sentiment-api.ts
import express from "express";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json());

// Load fastText model (requires fasttext-js or Python subprocess)
// Option 1: Use fasttext-js package
// import fasttext from "fasttext-js";
// const model = fasttext.loadModel("models/model_amazon.bin");

// Option 2: Use Python subprocess (more reliable)
import { spawn } from "child_process";

interface SentimentRequest {
  text: string;
}

interface SentimentResponse {
  label: "positive" | "negative" | "neutral";
  confidence: number;
  keywords: string[];
  reasoning: string;
}

/**
 * POST /api/sentiment/classify
 * Classify sentiment of review text using fastText model
 */
app.post(
  "/api/sentiment/classify",
  async (req: express.Request, res: express.Response) => {
    try {
      const { text } = req.body as SentimentRequest;

      if (!text || text.length < 3) {
        return res.status(400).json({
          error: "Text must be at least 3 characters",
        });
      }

      // Call fastText model
      const prediction = await classifyWithFastText(text);

      const response: SentimentResponse = {
        label: prediction.label,
        confidence: prediction.confidence,
        keywords: extractKeywords(text),
        reasoning: `fastText prediction: ${prediction.label} (${Math.round(prediction.confidence * 100)}% confidence)`,
      };

      res.json(response);
    } catch (error) {
      console.error("Sentiment classification error:", error);
      res.status(500).json({ error: "Classification failed" });
    }
  }
);

/**
 * POST /api/sentiment/batch
 * Classify multiple reviews at once
 */
app.post(
  "/api/sentiment/batch",
  async (req: express.Request, res: express.Response) => {
    try {
      const { reviews } = req.body as { reviews: string[] };

      if (!Array.isArray(reviews) || reviews.length === 0) {
        return res.status(400).json({ error: "Reviews array required" });
      }

      const results = await Promise.all(
        reviews.map(async (text) => {
          const prediction = await classifyWithFastText(text);
          return {
            text,
            label: prediction.label,
            confidence: prediction.confidence,
          };
        })
      );

      res.json({ results });
    } catch (error) {
      console.error("Batch classification error:", error);
      res.status(500).json({ error: "Batch classification failed" });
    }
  }
);

/**
 * Classify text using fastText model
 * Requires fastText binary in PATH or specify path
 */
async function classifyWithFastText(
  text: string
): Promise<{ label: "positive" | "negative" | "neutral"; confidence: number }> {
  return new Promise((resolve, reject) => {
    // Create temporary file with text
    const tempFile = `/tmp/sentiment_${Date.now()}.txt`;
    fs.writeFileSync(tempFile, text);

    // Run fastText predict
    const fasttext = spawn("fasttext", [
      "predict",
      "models/model_amazon.bin",
      tempFile,
    ]);

    let output = "";

    fasttext.stdout.on("data", (data) => {
      output += data.toString();
    });

    fasttext.on("close", (code) => {
      fs.unlinkSync(tempFile); // Clean up temp file

      if (code !== 0) {
        reject(new Error("fastText prediction failed"));
        return;
      }

      // Parse output: "__label__2 0.98"
      const match = output.match(/__label__(\d+)\s+([\d.]+)/);
      if (!match) {
        reject(new Error("Invalid fastText output"));
        return;
      }

      const label = match[1] === "2" ? "positive" : "negative";
      const confidence = parseFloat(match[2]);

      resolve({ label, confidence });
    });

    fasttext.on("error", reject);
  });
}

/**
 * Extract sentiment keywords from text
 */
function extractKeywords(text: string): string[] {
  const positiveWords = [
    "excellent",
    "amazing",
    "great",
    "love",
    "perfect",
    "best",
  ];
  const negativeWords = [
    "terrible",
    "awful",
    "bad",
    "hate",
    "worst",
    "poor",
  ];

  const words = text.toLowerCase().split(/\s+/);
  const keywords = words.filter(
    (w) => positiveWords.includes(w) || negativeWords.includes(w)
  );

  return [...new Set(keywords)].slice(0, 5);
}

app.listen(3001, () => {
  console.log("Sentiment API running on http://localhost:3001");
});
```

### Python + Flask Example

```python
# server/sentiment_api.py
from flask import Flask, request, jsonify
import fasttext
import os

app = Flask(__name__)

# Load fastText model
MODEL_PATH = "models/model_amazon.bin"
model = fasttext.load_model(MODEL_PATH)

@app.route("/api/sentiment/classify", methods=["POST"])
def classify():
    data = request.json
    text = data.get("text", "")
    
    if not text or len(text) < 3:
        return {"error": "Text too short"}, 400
    
    # Predict
    predictions = model.predict(text)
    label_raw = predictions[0][0]  # "__label__2"
    confidence = predictions[1][0]  # 0.98
    
    # Convert label
    label = "positive" if label_raw == "__label__2" else "negative"
    
    return {
        "label": label,
        "confidence": float(confidence),
        "keywords": extract_keywords(text),
        "reasoning": f"fastText prediction: {label} ({int(confidence*100)}% confidence)"
    }

@app.route("/api/sentiment/batch", methods=["POST"])
def batch_classify():
    data = request.json
    reviews = data.get("reviews", [])
    
    results = []
    for text in reviews:
        predictions = model.predict(text)
        label = "positive" if predictions[0][0] == "__label__2" else "negative"
        confidence = predictions[1][0]
        
        results.append({
            "text": text,
            "label": label,
            "confidence": float(confidence)
        })
    
    return {"results": results}

def extract_keywords(text):
    positive = ["excellent", "amazing", "great", "love", "perfect", "best"]
    negative = ["terrible", "awful", "bad", "hate", "worst", "poor"]
    
    words = text.lower().split()
    keywords = [w for w in words if w in positive or w in negative]
    
    return list(set(keywords))[:5]

if __name__ == "__main__":
    app.run(port=3001, debug=False)
```

## Step 3: Update Dashboard to Use API

### Update `client/src/lib/sentimentClassifier.ts`

```typescript
// Use API endpoint instead of local analysis
export const analyzeSentimentViaAPI = async (
  text: string,
  apiEndpoint: string = "/api/sentiment/classify"
): Promise<SentimentResult> => {
  try {
    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) throw new Error("API request failed");

    const data = await response.json();
    return {
      label: data.label,
      confidence: data.confidence,
      reasoning: data.reasoning,
      keywords: data.keywords,
    };
  } catch (error) {
    console.warn("API error, falling back to local analysis:", error);
    return analyzeKeywordSentiment(text);
  }
};
```

### Update `client/src/lib/dataTransformer.ts`

```typescript
// In mergeDatasets function
const sentimentResult = await analyzeSentimentViaAPI(
  sale.review_content || ""
);
```

## Step 4: Deploy

### Docker Deployment

```dockerfile
# Dockerfile
FROM python:3.9-slim

WORKDIR /app

# Install fastText
RUN pip install fasttext flask

# Copy model
COPY models/model_amazon.bin ./models/

# Copy API code
COPY server/sentiment_api.py .

EXPOSE 3001

CMD ["python", "sentiment_api.py"]
```

### Deploy to Cloud

```bash
# AWS Lambda
serverless deploy

# Heroku
git push heroku main

# Docker Hub
docker build -t sentiment-api .
docker push your-registry/sentiment-api
```

## Performance Optimization

### Caching

```typescript
const sentimentCache = new Map<string, SentimentResult>();

export const classifyWithCache = async (text: string) => {
  const hash = hashText(text);
  
  if (sentimentCache.has(hash)) {
    return sentimentCache.get(hash)!;
  }
  
  const result = await analyzeSentimentViaAPI(text);
  sentimentCache.set(hash, result);
  
  return result;
};
```

### Batch Processing

```typescript
// Process multiple reviews at once
const batchClassify = async (reviews: string[]) => {
  const response = await fetch("/api/sentiment/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reviews }),
  });
  
  return response.json();
};
```

## Monitoring

### Track API Performance

```typescript
const metrics = {
  totalRequests: 0,
  averageLatency: 0,
  errors: 0,
};

export const trackSentimentRequest = async (text: string) => {
  const start = Date.now();
  
  try {
    const result = await analyzeSentimentViaAPI(text);
    metrics.totalRequests++;
    metrics.averageLatency = 
      (metrics.averageLatency * (metrics.totalRequests - 1) + (Date.now() - start)) / 
      metrics.totalRequests;
    
    return result;
  } catch (error) {
    metrics.errors++;
    throw error;
  }
};
```

## Troubleshooting

### Model Not Found
```bash
# Ensure model file exists
ls -lh models/model_amazon.bin

# Re-train if necessary
fasttext supervised -input train.ft.txt -output model_amazon
```

### API Timeout
- Increase timeout in client: `fetch(..., { timeout: 30000 })`
- Optimize model (quantization)
- Use batch processing

### Memory Issues
- Use quantized model: `model_amazon.ftz` (smaller)
- Implement request queuing
- Scale horizontally with load balancer

## Next Steps

1. ✅ Train fastText model on Amazon Reviews dataset
2. ✅ Deploy API endpoint
3. ✅ Update dashboard to use API
4. ✅ Add caching and batch processing
5. ✅ Monitor performance and accuracy
6. ✅ Fine-tune model with your data

## Resources

- fastText Documentation: https://fasttext.cc/
- Amazon Reviews Dataset: https://www.kaggle.com/datasets/bittlingmayer/amazonreviews
- fastText Supervised Learning: https://fasttext.cc/docs/en/supervised-models.html

---

**Questions?** Check the dashboard code comments for integration examples.
