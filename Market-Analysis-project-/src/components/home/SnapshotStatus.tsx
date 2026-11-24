'use client';

import { RefreshCw } from 'lucide-react';
import { formatUpdated } from '@/components/home/format';
import { snapshotAgeMinutes } from '@/lib/home-snapshot';
import { useMarketSnapshot } from '@/components/home/MarketSnapshotProvider';

export function SnapshotStatus({ compact = false }: { compact?: boolean }) {
  const { snapshot, refreshing, refresh } = useMarketSnapshot();
  const updated = formatUpdated(snapshotAgeMinutes(snapshot.updatedAt));

  if (!snapshot.hasSnapshot) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
        <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-medium">
          Loading first snapshot
        </span>
        <button
          type="button"
          onClick={() => void refresh(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 font-medium disabled:opacity-60"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          Retry
        </button>
      </div>
    );
  }

  const state = snapshot.refreshFailed
    ? { label: 'Refresh failed · last snapshot kept', tone: 'border-warning/30 bg-warning/10 text-warning' }
    : snapshot.isStale
      ? { label: 'Cached snapshot', tone: 'border-warning/30 bg-warning/10 text-warning' }
      : refreshing
        ? { label: 'Refreshing', tone: 'border-border/60 bg-muted/40 text-muted-foreground' }
        : { label: 'Snapshot available', tone: 'border-success/30 bg-success/10 text-success' };

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
      {!compact && updated && <span>{updated}</span>}
      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium flex items-center gap-1 ${state.tone}`}>
        {refreshing && <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />}
        {state.label}
      </span>
      {snapshot.refreshFailed && (
        <button
          type="button"
          onClick={() => void refresh(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 font-medium disabled:opacity-60"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  );
}
