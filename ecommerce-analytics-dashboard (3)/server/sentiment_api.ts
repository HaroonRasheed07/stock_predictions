/**
 * Sentiment Analysis API Server
 * 
 * Provides REST endpoints for fastText sentiment classification
 * - POST /api/sentiment/classify - Classify single review
 * - POST /api/sentiment/batch - Classify multiple reviews
 * - GET /api/sentiment/health - Health check
 * 
 * Uses trained fastText model for ~91.6% accuracy
 * 
 * DEPLOYMENT:
 * 1. Train model: python3 server/train_sentiment_model.py --input train.ft.txt --output models/model_amazon
 * 2. Start server: npm run dev
 * 3. API available at: http://localhost:3000/api/sentiment/...
 */

import express, { Request, Response } from "express";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const router = express.Router();

// Model paths
const MODEL_BIN = path.join(process.cwd(), "models", "model_amazon.bin");
const MODEL_FTZ = path.join(process.cwd(), "models", "model_amazon.ftz");

// Cache for sentiment predictions
const sentimentCache = new Map<string, SentimentPrediction>();

interface SentimentPrediction {
  label: "positive" | "negative" | "neutral";
  confidence: number;
  keywords: string[];
  reasoning: string;
}

interface ClassifyRequest {
  text: string;
}

interface BatchClassifyRequest {
  reviews: string[];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Hash text for caching
 */
const hashText = (text: string): string => {
  return require("crypto").createHash("md5").update(text).digest("hex");
};

/**
 * Extract sentiment keywords from text
 */
const extractKeywords = (text: string): string[] => {
  const positiveWords = [
    "excellent",
    "amazing",
    "great",
    "love",
    "perfect",
    "best",
    "awesome",
    "wonderful",
    "fantastic",
    "good",
  ];
  const negativeWords = [
    "terrible",
    "awful",
    "bad",
    "hate",
    "worst",
    "poor",
    "disappointing",
    "broken",
    "useless",
    "waste",
  ];

  const words = text.toLowerCase().split(/\s+/);
  const keywords = words.filter(
    (w) => positiveWords.includes(w) || negativeWords.includes(w)
  );

  return [...new Set(keywords)].slice(0, 5);
};

/**
 * Classify text using fastText model
 * Falls back to keyword analysis if model unavailable
 */
const classifyWithFastText = (text: string): Promise<SentimentPrediction> => {
  return new Promise((resolve, reject) => {
    // Check cache first
    const hash = hashText(text);
    if (sentimentCache.has(hash)) {
      resolve(sentimentCache.get(hash)!);
      return;
    }

    // Create temporary file
    const tempFile = path.join(os.tmpdir(), `sentiment_${Date.now()}.txt`);
    fs.writeFileSync(tempFile, text);

    // Use quantized model if available (smaller, faster)
    const modelPath = fs.existsSync(MODEL_FTZ) ? MODEL_FTZ : MODEL_BIN;

    if (!fs.existsSync(modelPath)) {
      console.warn(
        "⚠️  fastText model not found, using fallback keyword analysis"
      );
      fs.unlinkSync(tempFile);
      resolve(fallbackKeywordAnalysis(text));
      return;
    }

    // Run fastText predict
    const fasttext = spawn("fasttext", ["predict", modelPath, tempFile]);

    let output = "";
    let error = "";

    fasttext.stdout.on("data", (data) => {
      output += data.toString();
    });

    fasttext.stderr.on("data", (data) => {
      error += data.toString();
    });

    fasttext.on("close", (code) => {
      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {
        // Ignore
      }

      if (code !== 0) {
        console.error("fastText error:", error);
        resolve(fallbackKeywordAnalysis(text));
        return;
      }

      // Parse output: "__label__2 0.98"
      const match = output.match(/__label__(\d+)\s+([\d.]+)/);
      if (!match) {
        resolve(fallbackKeywordAnalysis(text));
        return;
      }

      const label = match[1] === "2" ? "positive" : "negative";
      const confidence = parseFloat(match[2]);
      const keywords = extractKeywords(text);

      const prediction: SentimentPrediction = {
        label,
        confidence,
        keywords,
        reasoning: `fastText model: ${label} (${Math.round(confidence * 100)}% confidence)`,
      };

      // Cache result
      sentimentCache.set(hash, prediction);

      resolve(prediction);
    });

    fasttext.on("error", (err) => {
      console.error("fastText spawn error:", err);
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {
        // Ignore
      }
      resolve(fallbackKeywordAnalysis(text));
    });
  });
};

/**
 * Fallback keyword-based sentiment analysis
 */
const fallbackKeywordAnalysis = (text: string): SentimentPrediction => {
  const positiveWords = [
    "excellent",
    "amazing",
    "great",
    "love",
    "perfect",
    "best",
    "awesome",
    "wonderful",
    "fantastic",
    "good",
    "nice",
    "awesome",
  ];
  const negativeWords = [
    "terrible",
    "awful",
    "bad",
    "hate",
    "worst",
    "poor",
    "disappointing",
    "broken",
    "useless",
    "waste",
    "horrible",
    "disgusting",
  ];

  const lowerText = text.toLowerCase();
  const positiveCount = positiveWords.filter((w) => lowerText.includes(w))
    .length;
  const negativeCount = negativeWords.filter((w) => lowerText.includes(w))
    .length;

  let label: "positive" | "negative" | "neutral" = "neutral";
  let confidence = 0.5;

  if (positiveCount > negativeCount) {
    label = "positive";
    confidence = Math.min(0.5 + positiveCount * 0.1, 0.95);
  } else if (negativeCount > positiveCount) {
    label = "negative";
    confidence = Math.min(0.5 + negativeCount * 0.1, 0.95);
  }

  return {
    label,
    confidence,
    keywords: extractKeywords(text),
    reasoning: "Keyword-based analysis (fastText model unavailable)",
  };
};

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * POST /api/sentiment/classify
 * Classify sentiment of a single review
 */
router.post("/classify", async (req: Request, res: Response) => {
  try {
    const { text } = req.body as ClassifyRequest;

    if (!text || text.length < 3) {
      return res.status(400).json({
        error: "Text must be at least 3 characters",
      });
    }

    const prediction = await classifyWithFastText(text);

    res.json(prediction);
  } catch (error) {
    console.error("Classification error:", error);
    res.status(500).json({ error: "Classification failed" });
  }
});

/**
 * POST /api/sentiment/batch
 * Classify sentiment of multiple reviews
 */
router.post("/batch", async (req: Request, res: Response) => {
  try {
    const { reviews } = req.body as BatchClassifyRequest;

    if (!Array.isArray(reviews) || reviews.length === 0) {
      return res.status(400).json({ error: "Reviews array required" });
    }

    // Limit batch size to prevent overload
    if (reviews.length > 100) {
      return res.status(400).json({
        error: "Maximum 100 reviews per batch",
      });
    }

    const results = await Promise.all(
      reviews.map(async (text) => {
        const prediction = await classifyWithFastText(text);
        return {
          text,
          ...prediction,
        };
      })
    );

    res.json({ results });
  } catch (error) {
    console.error("Batch classification error:", error);
    res.status(500).json({ error: "Batch classification failed" });
  }
});

/**
 * GET /api/sentiment/health
 * Health check endpoint
 */
router.get("/health", (req: Request, res: Response) => {
  const modelExists = fs.existsSync(MODEL_BIN) || fs.existsSync(MODEL_FTZ);

  res.json({
    status: "ok",
    model: {
      available: modelExists,
      binary: fs.existsSync(MODEL_BIN),
      quantized: fs.existsSync(MODEL_FTZ),
    },
    cache: {
      size: sentimentCache.size,
    },
  });
});

/**
 * POST /api/sentiment/clear-cache
 * Clear sentiment prediction cache
 */
router.post("/clear-cache", (req: Request, res: Response) => {
  sentimentCache.clear();
  res.json({ message: "Cache cleared", size: 0 });
});

export default router;
