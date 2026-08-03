import { defineCustomElements as defineJeepSqlite } from 'jeep-sqlite/loader';
import { Capacitor } from '@capacitor/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

async function registerWebPlatform(): Promise<void> {
  if (Capacitor.getPlatform() !== 'web') {
    return;
  }

  try {
    defineJeepSqlite(window);

    const jeepSqliteElement = document.createElement('jeep-sqlite');
    document.body.appendChild(jeepSqliteElement);
    await customElements.whenDefined('jeep-sqlite');
  } catch (error) {
    console.error('Web platform bootstrap failed:', error);
  }
}

async function startApp(): Promise<void> {
  await registerWebPlatform();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void startApp();
