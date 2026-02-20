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
