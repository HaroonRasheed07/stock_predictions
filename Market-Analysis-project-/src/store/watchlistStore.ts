import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WatchlistState {
  watchlist: string[];
  addToWatchlist: (ticker: string) => void;
  removeFromWatchlist: (ticker: string) => void;
  isInWatchlist: (ticker: string) => boolean;
  clearWatchlist: () => void;
  setWatchlist: (tickers: string[]) => void;
}

const DEFAULT_WATCHLIST = ['AAPL', 'MSFT', 'NVDA', 'GC=F', 'EURUSD=X'];

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      watchlist: DEFAULT_WATCHLIST,
      addToWatchlist: (ticker: string) => {
        const normalizedTicker = ticker.toUpperCase().trim();
        set((state) => {
          if (!state.watchlist.includes(normalizedTicker)) {
            return { watchlist: [...state.watchlist, normalizedTicker] };
          }
          return state;
        });
      },
      removeFromWatchlist: (ticker: string) => {
        const normalizedTicker = ticker.toUpperCase().trim();
        set((state) => ({
          watchlist: state.watchlist.filter((t) => t !== normalizedTicker),
        }));
      },
      isInWatchlist: (ticker: string) => {
        return get().watchlist.includes(ticker.toUpperCase().trim());
      },
      clearWatchlist: () => set({ watchlist: [] }),
      setWatchlist: (tickers: string[]) => {
        const normalized = tickers.map(t => t.toUpperCase().trim());
        set({ watchlist: Array.from(new Set(normalized)) });
      },
    }),
    {
      name: 'market-watchlist-storage',
    }
  )
);
