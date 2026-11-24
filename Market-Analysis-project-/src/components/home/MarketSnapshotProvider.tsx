'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  mergeSnapshots,
  validateMarketSnapshot,
  type MarketSnapshot,
} from '@/lib/home-snapshot';

const REFRESH_INTERVAL_MS = 300_000;
const MIN_REFRESH_GAP_MS = 60_000;
const REFRESH_TIMEOUT_MS = 12_000;

interface MarketSnapshotContextValue {
  snapshot: MarketSnapshot;
  refreshing: boolean;
  refresh: (force?: boolean) => Promise<void>;
}

const MarketSnapshotContext = createContext<MarketSnapshotContextValue | null>(null);

export function MarketSnapshotProvider({
  initial,
  children,
}: {
  initial: MarketSnapshot;
  children: ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<MarketSnapshot>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const inFlightRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);
  const lastStartRef = useRef(0);

  const refresh = useCallback(async (force = false) => {
    const now = Date.now();
    if (inFlightRef.current) return;
    if (!force && now - lastStartRef.current < MIN_REFRESH_GAP_MS) return;

    inFlightRef.current = true;
    lastStartRef.current = now;
    const seq = ++requestSeqRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    setRefreshing(true);

    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      timeout = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);
      const response = await fetch('/api/home/market-snapshot', {
        method: 'POST',
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`snapshot refresh failed with ${response.status}`);
      const parsed = validateMarketSnapshot(await response.json());
      if (!parsed) throw new Error('snapshot refresh returned an invalid shape');
      if (seq === requestSeqRef.current) {
        setSnapshot((current) => mergeSnapshots(current, parsed, false));
      }
    } catch {
      if (seq === requestSeqRef.current) {
        setSnapshot((current) => mergeSnapshots(current, null, true));
      }
    } finally {
      if (timeout) clearTimeout(timeout);
      if (controllerRef.current === controller) controllerRef.current = null;
      inFlightRef.current = false;
      if (seq === requestSeqRef.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!snapshot.hasSnapshot) void refresh(true);
  }, [refresh, snapshot.hasSnapshot]);

  useEffect(() => {
    if (!snapshot.hasSnapshot) return;
    const interval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') void refresh();
    }, REFRESH_INTERVAL_MS);
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, snapshot.hasSnapshot]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const value = useMemo(
    () => ({ snapshot, refreshing, refresh }),
    [snapshot, refreshing, refresh]
  );

  return <MarketSnapshotContext.Provider value={value}>{children}</MarketSnapshotContext.Provider>;
}

export function useMarketSnapshot(): MarketSnapshotContextValue {
  const value = useContext(MarketSnapshotContext);
  if (!value) throw new Error('useMarketSnapshot must be used inside MarketSnapshotProvider');
  return value;
}
