'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { fetchAssetSearch, AssetInfo } from '@/lib/api';

/**
 * Shared debounced asset search hook with AbortController.
 * Aborts in-flight requests when a new search fires, preventing stale results.
 */
export function useAssetSearch(options?: { debounceMs?: number; maxResults?: number }) {
  const debounceMs = options?.debounceMs ?? 300;
  const maxResults = options?.maxResults ?? 8;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AssetInfo[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback((q: string) => {
    setQuery(q);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (q.trim().length < 1) {
      setResults([]);
      setShowResults(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setShowResults(true);

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const data = await fetchAssetSearch(q.trim(), true, controller.signal);
        setResults(data.slice(0, maxResults));
      } catch (err: any) {
        if (err?.name !== 'AbortError') setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, debounceMs);
  }, [debounceMs, maxResults]);

  const close = useCallback(() => {
    setShowResults(false);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return { query, results, showResults, isSearching, search, close, setQuery, setShowResults };
}
