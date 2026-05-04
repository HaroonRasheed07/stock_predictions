/**
 * Sentiment Analysis Detail Component
 * 
 * Displays detailed sentiment analysis results including:
 * - Sentiment classification (positive/negative/neutral)
 * - Confidence score with visual indicator
 * - Key sentiment words found
 * - Reasoning behind classification
 * 
 * Uses advanced sentiment classifier trained on Amazon Reviews dataset
 */

import React from "react";
import { SentimentResult } from "@/lib/sentimentClassifier";
import { TrendingUp, AlertCircle, MessageCircle } from "lucide-react";

interface SentimentAnalysisDetailProps {
  sentiment: SentimentResult;
  className?: string;
}

export default function SentimentAnalysisDetail({
  sentiment,
  className = "",
}: SentimentAnalysisDetailProps) {
  const { label, confidence, reasoning, keywords } = sentiment;

  // Color coding based on sentiment
  const sentimentColors = {
    positive: {
      bg: "bg-green-50",
      border: "border-green-200",
      text: "text-green-700",
      badge: "bg-green-100 text-green-800",
      bar: "bg-green-500",
    },
    negative: {
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-700",
      badge: "bg-red-100 text-red-800",
      bar: "bg-red-500",
    },
    neutral: {
      bg: "bg-gray-50",
      border: "border-gray-200",
      text: "text-gray-700",
      badge: "bg-gray-100 text-gray-800",
      bar: "bg-gray-500",
    },
  };

  const colors = sentimentColors[label];
  const confidencePercent = Math.round(confidence * 100);

  return (
    <div
      className={`${colors.bg} border ${colors.border} rounded-lg p-4 ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageCircle size={18} className={colors.text} />
          <h3 className="font-semibold text-sm text-gray-900">
            Sentiment Analysis
          </h3>
        </div>
        <span
          className={`${colors.badge} text-xs font-medium px-2.5 py-1 rounded-full capitalize`}
        >
          {label}
        </span>
      </div>

      {/* Confidence Score */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-gray-600">
            Confidence Score
          </span>
          <span className={`${colors.text} font-semibold text-sm`}>
            {confidencePercent}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className={`${colors.bar} h-full transition-all duration-300`}
            style={{ width: `${confidencePercent}%` }}
          />
        </div>
      </div>

      {/* Reasoning */}
      <div className="mb-3">
        <p className="text-xs text-gray-600 leading-relaxed">{reasoning}</p>
      </div>

      {/* Keywords */}
      {keywords.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">
            Sentiment Keywords:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {keywords.map((keyword, idx) => (
              <span
                key={idx}
                className={`text-xs px-2 py-1 rounded-md ${colors.badge} font-medium`}
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Confidence Interpretation */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex items-start gap-2">
          <AlertCircle size={14} className="text-gray-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-gray-600">
            {confidencePercent >= 80
              ? "High confidence classification"
              : confidencePercent >= 60
              ? "Moderate confidence - mixed signals detected"
              : "Low confidence - unclear sentiment"}
          </p>
        </div>
      </div>
    </div>
  );
}
