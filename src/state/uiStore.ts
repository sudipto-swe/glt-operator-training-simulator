/**
 * UI store: active screen, theme, and which station panel is focused.
 * Theme is mirrored to <html class="dark"> by the App effect and persisted
 * under 'glt.theme'.
 */
import { create } from 'zustand';
import { getBackend } from '../lib/storage';

export type Screen =
  | 'overview'
  | 'control'
  | 'learn'
  | 'assess'
  | 'records'
  | 'trainer'
  | 'pack';

const backend = getBackend();

function initialTheme(): 'light' | 'dark' {
  try {
    const stored = backend?.getItem('glt.theme');
    if (stored === 'light' || stored === 'dark') return stored;
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
  } catch {
    /* ignore */
  }
  return 'dark'; // control-room default
}

interface UiStore {
  screen: Screen;
  focusStation: string | null;
  theme: 'light' | 'dark';
  setScreen: (s: Screen) => void;
  setFocusStation: (id: string | null) => void;
  toggleTheme: () => void;
}

export const useUi = create<UiStore>((set, get) => ({
  screen: 'overview',
  focusStation: null,
  theme: initialTheme(),
  setScreen: (screen) => set({ screen }),
  setFocusStation: (focusStation) => set({ focusStation }),
  toggleTheme: () => {
    const theme = get().theme === 'dark' ? 'light' : 'dark';
    set({ theme });
    try {
      backend?.setItem('glt.theme', theme);
    } catch {
      /* ignore */
    }
  }
}));
