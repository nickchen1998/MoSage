import { ThemeProvider } from 'next-themes';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { applyUiScale, readUiScale } from './lib/ui-scale';
import './styles.css';

// Before the first render, so the chrome never paints at the default size first.
applyUiScale(readUiScale());

// biome-ignore lint/style/noNonNullAssertion: #root is guaranteed by index.html
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* next-themes' inline <script> never runs in a client-rendered app, and React 19
        warns about it; a data-block type keeps it inert and quiet. */}
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      scriptProps={{ type: 'application/json' }}
    >
      <App />
    </ThemeProvider>
  </StrictMode>,
);
