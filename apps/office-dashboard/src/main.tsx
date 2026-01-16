import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { installTelemetry, TelemetryErrorBoundary, ToastProvider } from '@club-ops/ui';
import App from './App';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

installTelemetry({
  app: 'office-dashboard',
  endpoint: '/api/v1/telemetry',
  isDev: import.meta.env.DEV,
  captureConsoleWarnInDev: true,
});

createRoot(root).render(
  <StrictMode>
    <TelemetryErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ToastProvider>
    </TelemetryErrorBoundary>
  </StrictMode>
);
