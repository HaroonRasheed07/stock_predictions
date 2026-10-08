import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface StockStore {
  selectedTicker: string;
  setSelectedTicker: (ticker: string) => void;
}

// Create stock store with persistence
const createStockStore = () => {
  if (typeof window === 'undefined') {
    // Server-side - return a simple store without persistence
    return create<StockStore>((set) => ({
      selectedTicker: 'AAPL',
      setSelectedTicker: (ticker: string) => {
        set({ selectedTicker: ticker.toUpperCase().trim() });
      },
    }));
  }

  // Client-side - use persistence
  return create<StockStore>()(
    persist(
      (set) => ({
        selectedTicker: 'AAPL',
        setSelectedTicker: (ticker: string) => {
          set({ selectedTicker: ticker.toUpperCase().trim() });
        },
      }),
      {
        name: 'stock-store',
        skipHydration: true,
      }
    )
  );
};

export const useStockStore = createStockStore();

/**
 * Rehydrates the persisted ticker after mount (the store is created with
 * `skipHydration` so SSR markup stays stable). Safe no-ops on the server.
 */
export function rehydrateStockStore(): void {
  const store = useStockStore as typeof useStockStore & {
    persist?: { rehydrate: () => Promise<void> | void };
  };
  try {
    void store.persist?.rehydrate();
  } catch {
    // localStorage unavailable — fallback simply stays at the default ticker.
  }
}
