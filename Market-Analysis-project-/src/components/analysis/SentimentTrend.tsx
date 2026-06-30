import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EnhancedSentiment } from '@/lib/api';
import { TrendingUp, TrendingDown, Minus, BrainCircuit, Smile, Frown, Meh } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SentimentTrendProps {
  data: EnhancedSentiment | null;
  isLoading?: boolean;
}

export function SentimentTrend({ data, isLoading }: SentimentTrendProps) {
  if (isLoading || !data) {
    return (
      <Card className="glass h-full animate-pulse">
        <CardContent className="p-6 h-[300px] flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-4 border-muted border-t-primary animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const { sentiment_trend_7d, news_impact_summary, market_mood, score } = data;

  // Prepare chart data
  const chartData = sentiment_trend_7d?.map((item) => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    score: item.score * 100, // Convert to percentage
  })) || [];

  // Determine market mood icon and color
  let MoodIcon = Meh;
  let moodColor = 'text-muted-foreground';
  let moodBg = 'bg-muted/10';

  if (market_mood === 'Bullish' || score > 0.3) {
    MoodIcon = Smile;
    moodColor = 'text-success';
    moodBg = 'bg-success/10';
  } else if (market_mood === 'Bearish' || score < -0.3) {
    MoodIcon = Frown;
    moodColor = 'text-destructive';
    moodBg = 'bg-destructive/10';
  }

  return (
    <Card className="glass h-full relative overflow-hidden">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${moodBg} via-transparent to-transparent`} />
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-primary" />
              Sentiment Trend
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">7-day sentiment trajectory</p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${moodBg} border border-border/50`}>
            <MoodIcon className={`h-5 w-5 ${moodColor}`} />
            <span className={`font-semibold ${moodColor}`}>{market_mood}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Sentiment Trend Chart */}
          {chartData.length > 0 ? (
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fontSize: 10 }}
                    minTickGap={30}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fontSize: 10 }}
                    domain={[-100, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`${value.toFixed(0)}%`, 'Sentiment']}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  {/* Zero line */}
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    dot={false}
                    data={[{ date: '', score: 0 }]}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-muted-foreground">
              <p className="text-sm">No trend data available</p>
            </div>
          )}

          {/* News Impact Summary */}
          {news_impact_summary && (
            <div className="space-y-3 pt-4 border-t border-border/50">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-primary" />
                News Impact Summary
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {news_impact_summary}
              </p>
            </div>
          )}

          {/* Current Sentiment Indicator */}
          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <div className="flex items-center gap-3">
              {score > 0.1 ? (
                <TrendingUp className="h-5 w-5 text-success" />
              ) : score < -0.1 ? (
                <TrendingDown className="h-5 w-5 text-destructive" />
              ) : (
                <Minus className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="text-xs text-muted-foreground">Current Sentiment</p>
                <p className="text-sm font-semibold">
                  {score > 0.1 ? 'Positive' : score < -0.1 ? 'Negative' : 'Neutral'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{(score * 100).toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">Score</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}