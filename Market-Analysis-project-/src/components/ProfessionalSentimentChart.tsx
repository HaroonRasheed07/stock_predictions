'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface SentimentData {
  sentiment_label: string;
  sentiment_score: number;
  news?: any[];
}

interface ProfessionalSentimentChartProps {
  data: SentimentData;
}

const COLORS: Record<string, string> = {
  Negative: '#ef4444',
  Neutral: '#8b5cf6',
  Positive: '#22c55e',
};

const LABEL: Record<string, string> = {
  Negative: 'Bearish',
  Neutral: 'Neutral',
  Positive: 'Bullish',
};

function SentimentTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-xl border border-border/60 bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
      <p className="text-sm font-semibold text-foreground">{d.name}</p>
      <p className="text-sm text-muted-foreground">{d.value}%</p>
    </div>
  );
}

export default function ProfessionalSentimentChart({ data }: ProfessionalSentimentChartProps) {
  const score = data?.sentiment_score || 0;

  let positivePercent = 0;
  let neutralPercent = 0;
  let negativePercent = 0;

  if (score > 0.3) {
    positivePercent = Math.round((score + 1) / 2 * 100);
    neutralPercent = Math.round((1 - score) / 2 * 50);
    negativePercent = 100 - positivePercent - neutralPercent;
  } else if (score < -0.3) {
    negativePercent = Math.round((1 - score) / 2 * 100);
    neutralPercent = Math.round((1 + score) / 2 * 50);
    positivePercent = 100 - negativePercent - neutralPercent;
  } else {
    neutralPercent = Math.round((1 - Math.abs(score)) * 100);
    positivePercent = Math.round(Math.max(0, score) * 50);
    negativePercent = Math.round(Math.max(0, -score) * 50);
  }

  const total = positivePercent + neutralPercent + negativePercent || 1;
  const adjustment = 100 / total;
  positivePercent = Math.round(positivePercent * adjustment);
  neutralPercent = Math.round(neutralPercent * adjustment);
  negativePercent = 100 - positivePercent - neutralPercent;

  const chartData = [
    { name: 'Negative', value: negativePercent },
    { name: 'Neutral', value: neutralPercent },
    { name: 'Positive', value: positivePercent },
  ].filter((d) => d.value > 0);

  const sentimentColor = COLORS[data?.sentiment_label] || COLORS.Neutral;

  return (
    <div className="flex flex-col items-center justify-center w-full space-y-6 py-4">
      <div className="relative w-full" style={{ maxWidth: 320 }}>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={110}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
              animationBegin={0}
              animationDuration={600}
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={COLORS[entry.name]} />
              ))}
            </Pie>
            <Tooltip content={<SentimentTooltip />} />
            <text
              x="50%"
              y="44%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[10px] font-semibold uppercase tracking-widest"
            >
              Score
            </text>
            <text
              x="50%"
              y="54%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-foreground text-2xl font-bold"
            >
              {score.toFixed(2)}
            </text>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="w-full max-w-sm space-y-3 px-2">
        <div className="grid grid-cols-3 gap-2">
          {[
            { name: 'Negative', value: negativePercent },
            { name: 'Neutral', value: neutralPercent },
            { name: 'Positive', value: positivePercent },
          ].map((item) => (
            <div
              key={item.name}
              className="flex flex-col items-center gap-1 rounded-xl border border-border/40 px-2 py-3 text-center transition-colors"
              style={{ backgroundColor: `${COLORS[item.name]}0d` }}
            >
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                {LABEL[item.name]}
              </span>
              <span
                className="text-2xl font-bold tabular-nums"
                style={{ color: COLORS[item.name] }}
              >
                {item.value}%
              </span>
            </div>
          ))}
        </div>

        <div
          className="flex items-center justify-center gap-3 rounded-xl border border-border/40 px-4 py-3 transition-colors"
          style={{
            backgroundColor: `${sentimentColor}0d`,
            borderColor: `${sentimentColor}33`,
          }}
        >
          <span className="text-xs uppercase font-semibold text-muted-foreground tracking-widest">
            Market Sentiment
          </span>
          <span className="text-sm font-bold" style={{ color: sentimentColor }}>
            {data?.sentiment_label || 'Neutral'}
          </span>
        </div>
      </div>
    </div>
  );
}
