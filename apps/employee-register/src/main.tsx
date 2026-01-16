import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installTelemetry, TelemetryErrorBoundary, ToastProvider } from '@club-ops/ui';
import App from './App';
import './styles.css';
import './legacy.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

installTelemetry({
  app: 'employee-register',
  endpoint: '/api/v1/telemetry',
  isDev: import.meta.env.DEV,
  captureConsoleWarnInDev: true,
  getLane: () => sessionStorage.getItem('lane') ?? undefined,
});

createRoot(root).render(
  <StrictMode>
    <TelemetryErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </TelemetryErrorBoundary>
  </StrictMode>
);
