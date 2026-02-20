import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeStore {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

// Only use persist in browser environment
const createThemeStore = () => {
  if (typeof window === 'undefined') {
    // Server-side - return a simple store without persistence
    return create<ThemeStore>((set) => ({
      theme: 'dark',
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'light' ? 'dark' : 'light',
        })),
      setTheme: (theme) => {
        set({ theme });
      },
    }));
  }

  // Client-side - use persistence
  return create<ThemeStore>()(
    persist(
      (set) => ({
        theme: 'dark',
        toggleTheme: () =>
          set((state) => {
            const newTheme = state.theme === 'light' ? 'dark' : 'light';
            document.documentElement.classList.toggle('dark', newTheme === 'dark');
            return { theme: newTheme };
          }),
        setTheme: (theme) => {
          document.documentElement.classList.toggle('dark', theme === 'dark');
          set({ theme });
        },
      }),
      {
        name: 'insightforge-theme',
        onRehydrateStorage: () => (state) => {
          if (state) {
            document.documentElement.classList.toggle('dark', state.theme === 'dark');
          }
        },
      }
    )
  );
};

export const useThemeStore = createThemeStore();
