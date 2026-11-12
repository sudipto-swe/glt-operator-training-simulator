import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';

/* Apply the persisted theme before first paint to avoid a flash. */
try {
  const stored = localStorage.getItem('glt.theme');
  const light =
    stored === 'light' ||
    (stored == null && window.matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.classList.toggle('dark', !light);
} catch {
  document.documentElement.classList.add('dark');
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element missing in index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
