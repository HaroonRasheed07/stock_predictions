'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, ThumbsUp, ThumbsDown, Minus, Send, Sparkles } from 'lucide-react';
import { classifySentiment, type SentimentResult } from '@/lib/ecommerceApi';

const SAMPLE_REVIEWS = [
  { text: "This product is absolutely amazing! Best purchase I've ever made. Works perfectly and arrived super fast.", rating: 5 },
  { text: "Decent quality for the price. Nothing special but gets the job done.", rating: 3 },
  { text: "Terrible product. Broke after one week. Complete waste of money. Don't buy this junk.", rating: 1 },
  { text: "Love the design and the build quality is excellent. Very satisfied with my purchase.", rating: 5 },
  { text: "Not worth the price. Cheap material and doesn't work as advertised. Disappointing.", rating: 2 },
];

export default function EcommerceSentiment() {
  const [reviewText, setReviewText] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [result, setResult] = useState<SentimentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<Array<SentimentResult & { text: string }>>([]);

  const handleClassify = async () => {
    if (!reviewText.trim()) return;
    setLoading(true);
    try {
      const res = await classifySentiment(reviewText, rating ?? undefined);
      setResult(res);
    } catch {
      setResult({ status: 'error', label: 'neutral', confidence: 0.5, keywords: [] });
    } finally {
      setLoading(false);
    }
  };

  const handleSampleBatch = async () => {
    setLoading(true);
    const results: Array<SentimentResult & { text: string }> = [];
    for (const sample of SAMPLE_REVIEWS) {
      try {
        const res = await classifySentiment(sample.text, sample.rating);
        results.push({ ...res, text: sample.text });
      } catch {
        results.push({ status: 'error', label: 'neutral', confidence: 0.5, keywords: [], text: sample.text });
      }
    }
    setBatchResults(results);
    setLoading(false);
  };

  const sentimentColor = (label: string) => {
    if (label === 'positive') return 'text-emerald-500';
    if (label === 'negative') return 'text-red-500';
    return 'text-violet-500';
  };

  const sentimentBg = (label: string) => {
    if (label === 'positive') return 'bg-emerald-500/10 border-emerald-500/30';
    if (label === 'negative') return 'bg-red-500/10 border-red-500/30';
    return 'bg-violet-500/10 border-violet-500/30';
  };

  const SentimentIcon = ({ label }: { label: string }) => {
    if (label === 'positive') return <ThumbsUp size={20} className="text-emerald-500" />;
    if (label === 'negative') return <ThumbsDown size={20} className="text-red-500" />;
    return <Minus size={20} className="text-violet-500" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare size={24} />
          Sentiment Analysis
        </h1>
        <p className="text-sm text-muted-foreground mt-1">AI-powered review sentiment classification</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Classify Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Review Text</label>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Enter a product review to analyze..."
                className="w-full h-32 rounded-lg border bg-background p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Rating (optional)</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRating(rating === r ? null : r)}
                    className={`w-10 h-10 rounded-lg border text-sm font-medium transition ${
                      rating === r
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-background hover:bg-muted'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={handleClassify} disabled={loading || !reviewText.trim()} className="w-full">
              <Send size={16} className="mr-2" />
              {loading ? 'Analyzing...' : 'Analyze Sentiment'}
            </Button>
          </CardContent>
        </Card>

        {/* Result Panel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Analysis Result</CardTitle>
          </CardHeader>
          <CardContent>
            {result ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`rounded-xl border p-6 ${sentimentBg(result.label)}`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <SentimentIcon label={result.label} />
                  <div>
                    <p className={`text-2xl font-bold capitalize ${sentimentColor(result.label)}`}>
                      {result.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Confidence: {(result.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>

                {/* Confidence Bar */}
                <div className="mb-4">
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${result.confidence * 100}%` }}
                      transition={{ duration: 0.5 }}
                      className={`h-full rounded-full ${
                        result.label === 'positive' ? 'bg-emerald-500' :
                        result.label === 'negative' ? 'bg-red-500' : 'bg-violet-500'
                      }`}
                    />
                  </div>
                </div>

                {/* Keywords */}
                {result.keywords.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Detected Keywords</p>
                    <div className="flex flex-wrap gap-2">
                      {result.keywords.map((kw) => (
                        <span
                          key={kw}
                          className="px-2 py-1 rounded-md bg-background/50 text-xs font-medium"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Sparkles size={32} className="mb-3 opacity-30" />
                <p className="text-sm">Enter a review and click Analyze</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Batch Analysis */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Sample Batch Analysis</CardTitle>
            <Button variant="outline" size="sm" onClick={handleSampleBatch} disabled={loading}>
              <Sparkles size={14} className="mr-1" />
              Run Samples
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {batchResults.length > 0 ? (
            <div className="space-y-3">
              {batchResults.map((r, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`rounded-lg border p-4 ${sentimentBg(r.label)}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm flex-1 line-clamp-2">{r.text}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <SentimentIcon label={r.label} />
                      <span className={`text-sm font-semibold capitalize ${sentimentColor(r.label)}`}>
                        {r.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({(r.confidence * 100).toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                  {r.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {r.keywords.map((kw) => (
                        <span key={kw} className="px-1.5 py-0.5 rounded bg-background/50 text-xs">{kw}</span>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Click &quot;Run Samples&quot; to analyze 5 sample reviews
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
