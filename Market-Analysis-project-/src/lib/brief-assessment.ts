/**
 * Pure Stock Brief evidence assessment.
 *
 * Aggregates three directional evidence sources — the technical setup signal,
 * news sentiment, and the timeframe consensus — into an honest assessment
 * label plus an agreement state. Risk and forecast direction are deliberately
 * NOT votes here: they are separate assessments rendered alongside, never
 * converted into Buy/Sell. Missing sources are excluded from the counts and
 * surfaced as limitations instead of being defaulted to neutral or positive.
 */

export type EvidenceDirection = 'bullish' | 'bearish' | 'neutral';

export type AgreementState = 'aligned' | 'mixed' | 'diverging';

export type AssessmentLabel =
  | 'Bullish'
  | 'Bearish'
  | 'Neutral'
  | 'Mixed Evidence'
  | 'Conflicting Signals'
  | 'Insufficient Data';

export interface BriefEvidenceInput {
  signal?: string | null;
  evidenceState?: string | null;
  hasConflict?: boolean;
  conflictExplanation?: string | null;
  riskWarning?: boolean;
  sentimentStatus?: string | null;
  sentimentLabel?: string | null;
  timeframeConsensus?: string | null;
  riskLevel?: string | null;
  riskScore?: number | null;
}

export interface EvidenceChip {
  name: string;
  /** What the chip shows (raw label such as "Hold", "Mixed", "No data"). */
  display: string;
  /** Whether this source participates in the agreement counts. */
  available: boolean;
  direction: EvidenceDirection;
}

export interface BriefAssessment {
  label: AssessmentLabel;
  colorClass: string;
  agreement: AgreementState;
  chips: EvidenceChip[];
  counts: { bullish: number; bearish: number; neutral: number; total: number };
  timeframeConsensus: string | null;
  hasConflict: boolean;
  conflictExplanation: string | null;
  riskNote: string | null;
  limitations: string[];
}

const COLOR_BY_LABEL: Record<AssessmentLabel, string> = {
  Bullish: 'text-success',
  Bearish: 'text-destructive',
  Neutral: 'text-warning',
  'Mixed Evidence': 'text-warning',
  'Conflicting Signals': 'text-warning',
  'Insufficient Data': 'text-muted-foreground',
};

function directionFromSetupSignal(signal: string | null | undefined): EvidenceDirection | null {
  if (!signal) return null;
  const s = signal.toLowerCase().trim();
  if (s.includes('mixed') || s.includes('conflict')) return 'neutral';
  if (s.includes('strong buy') || s === 'buy') return 'bullish';
  if (s.includes('strong sell') || s === 'sell') return 'bearish';
  return 'neutral';
}

function directionFromSentimentLabel(label: string | null | undefined): EvidenceDirection {
  if (!label) return 'neutral';
  const l = label.toLowerCase();
  if (l.includes('bullish') || l === 'positive') return 'bullish';
  if (l.includes('bearish') || l === 'negative') return 'bearish';
  return 'neutral';
}

function directionFromConsensus(consensus: string | null | undefined): EvidenceDirection | null {
  if (!consensus) return null;
  if (consensus === 'Buy') return 'bullish';
  if (consensus === 'Sell') return 'bearish';
  return 'neutral';
}

export function assessBriefEvidence(input: BriefEvidenceInput): BriefAssessment {
  const signal = (input.signal || '').trim() || null;
  const consensus = input.timeframeConsensus || null;
  const sentimentAvailable = input.sentimentStatus === 'sufficient';

  const technicalDirection = directionFromSetupSignal(signal);
  const sentimentDirection = directionFromSentimentLabel(input.sentimentLabel);
  const consensusDirection = directionFromConsensus(consensus);
  const consensusAvailable = !!consensus && consensus !== 'Mixed';

  const chips: EvidenceChip[] = [
    {
      name: 'Technical',
      display: signal || 'No data',
      available: technicalDirection !== null,
      direction: technicalDirection ?? 'neutral',
    },
    {
      name: 'Sentiment',
      display: sentimentAvailable ? input.sentimentLabel || 'Neutral' : 'No data',
      available: sentimentAvailable,
      direction: sentimentDirection,
    },
    {
      name: 'Timeframe',
      display: consensus || 'No data',
      available: consensusAvailable,
      direction: consensusDirection ?? 'neutral',
    },
  ];

  const available = chips.filter((c) => c.available);
  const bullish = available.filter((c) => c.direction === 'bullish').length;
  const bearish = available.filter((c) => c.direction === 'bearish').length;
  const neutral = available.filter((c) => c.direction === 'neutral').length;
  const total = available.length;

  // Backend nuance: conflict_details.has_conflict is also set for high-risk
  // stocks with fully aligned evidence, so agreement is only forced to mixed
  // by the evidence state, a mixed/conflicting signal, or opposing votes.
  const backendConflict =
    input.evidenceState === 'conflicting' ||
    input.evidenceState === 'high_risk_divergence' ||
    (!!signal && (signal.toLowerCase().includes('mixed') || signal.toLowerCase().includes('conflict'))) ||
    (bullish > 0 && bearish > 0);

  let agreement: AgreementState = 'aligned';
  if (backendConflict || (bullish > 0 && bearish > 0)) {
    agreement = 'mixed';
  } else if (total >= 2 && neutral > 0 && (bullish > 0 || bearish > 0)) {
    agreement = 'diverging';
  }

  let label: AssessmentLabel;
  if (agreement === 'mixed') {
    label = signal && signal.toLowerCase().includes('conflict') ? 'Conflicting Signals' : 'Mixed Evidence';
  } else if (!signal) {
    label = 'Insufficient Data';
  } else if (directionFromSetupSignal(signal) === 'bullish') {
    label = 'Bullish';
  } else if (directionFromSetupSignal(signal) === 'bearish') {
    label = 'Bearish';
  } else {
    label = 'Neutral';
  }

  const names = (dir: EvidenceDirection) =>
    available
      .filter((c) => c.direction === dir)
      .map((c) => c.name)
      .join(', ');

  let conflictExplanation: string | null = input.conflictExplanation || null;
  if (!conflictExplanation && agreement === 'mixed') {
    const bullNames = names('bullish');
    const bearNames = names('bearish');
    if (bullNames && bearNames) {
      conflictExplanation = `${bullNames} read bullish while ${bearNames} read bearish. The sources use different data over different horizons, so this is conflicting evidence rather than a unanimous conclusion.`;
    }
  }
  if (!conflictExplanation && agreement === 'diverging') {
    const dirNames = [...available.filter((c) => c.direction === 'bullish'), ...available.filter((c) => c.direction === 'bearish')]
      .map((c) => c.name)
      .join(', ');
    const neutralNames = names('neutral');
    const dirLabel = bullish > 0 ? 'bullish' : 'bearish';
    conflictExplanation = `${dirNames} point ${dirLabel} while ${neutralNames} read neutral. This is partial agreement only — the assessment above is not unanimous.`;
  }

  const riskScoreText = input.riskScore === null || input.riskScore === undefined ? '' : `score ${Math.round(input.riskScore)}/100, `;
  let riskNote: string | null = null;
  if (input.riskLevel === 'High') {
    const leansPositive = label === 'Bullish' || (sentimentAvailable && sentimentDirection === 'bullish');
    riskNote = leansPositive
      ? `Risk is High (${riskScoreText}High starts at 65) while the evidence leans positive. Risk is a separate assessment: High risk does not by itself mean Sell, and positive evidence does not cancel risk.`
      : `Risk is assessed independently of the evidence above (${riskScoreText}thresholds: Low <35, Medium 35–65, High ≥65).`;
  } else if (input.riskWarning && agreement === 'mixed') {
    riskNote = 'This conflict carries a risk warning — conflicting evidence alongside elevated risk. Review the risk factors below before drawing conclusions.';
  }

  const limitations: string[] = [];
  if (!signal) {
    limitations.push('The overall setup signal was not provided in this data response; only component evidence is shown.');
  }
  if (!sentimentAvailable) {
    limitations.push(
      input.sentimentStatus === 'error'
        ? 'News sentiment is temporarily unavailable and is excluded from the assessment.'
        : 'News sentiment is excluded from the assessment: no sufficient recent news coverage for this ticker.'
    );
  }
  if (!consensus) {
    limitations.push('Timeframe consensus is unavailable and is excluded from the assessment.');
  } else if (consensus === 'Mixed') {
    limitations.push('Timeframe consensus is Mixed — the individual horizons disagree — so it is not counted as a directional vote.');
  }

  return {
    label,
    colorClass: COLOR_BY_LABEL[label],
    agreement,
    chips,
    counts: { bullish, bearish, neutral, total },
    timeframeConsensus: consensus,
    hasConflict: backendConflict,
    conflictExplanation,
    riskNote,
    limitations,
  };
}
