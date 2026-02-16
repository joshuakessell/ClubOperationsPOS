import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@club-ops/ui/tailadmin';
import App from './App';
import '@club-ops/ui/tailadmin/theme.css';
import './styles.css';

// Set dark mode class on <html> before render
document.documentElement.classList.add('dark');

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
);
