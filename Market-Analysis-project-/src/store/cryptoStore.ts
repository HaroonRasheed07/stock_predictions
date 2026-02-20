import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CryptoStore {
    selectedSymbol: string;
    setSelectedSymbol: (symbol: string) => void;
}

// Create crypto store with persistence (same pattern as stockStore)
const createCryptoStore = () => {
    if (typeof window === 'undefined') {
        return create<CryptoStore>((set) => ({
            selectedSymbol: 'BTC',
            setSelectedSymbol: (symbol: string) => {
                set({ selectedSymbol: symbol.toUpperCase().trim() });
            },
        }));
    }

    return create<CryptoStore>()(
        persist(
            (set) => ({
                selectedSymbol: 'BTC',
                setSelectedSymbol: (symbol: string) => {
                    set({ selectedSymbol: symbol.toUpperCase().trim() });
                },
            }),
            {
                name: 'crypto-store',
                skipHydration: true,
            }
        )
    );
};

export const useCryptoStore = createCryptoStore();
