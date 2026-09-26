import { create } from 'zustand';

const TOKEN_KEY = 'promptlens_token';
const THEME_KEY = 'promptlens_theme';

function readTheme() {
  const t = localStorage.getItem(THEME_KEY);
  return t === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

applyTheme(readTheme());

export const useStore = create((set) => ({
  user: null,
  token: localStorage.getItem(TOKEN_KEY),
  theme: readTheme(),

  setAuth: (user, token) => {
    localStorage.setItem(TOKEN_KEY, token);
    set({ user, token });
  },

  setUser: (user) => set({ user }),

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ user: null, token: null });
  },

  toggleTheme: () => {
    const next = useStore.getState().theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
    set({ theme: next });
  },
}));
