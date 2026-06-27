import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import { AuthProvider } from './auth.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        {/* Centered phone frame — the design is mobile-first (375px). */}
        <div className="relative mx-auto min-h-screen max-w-[375px] overflow-x-hidden bg-canvas">
          <App />
        </div>
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
);
