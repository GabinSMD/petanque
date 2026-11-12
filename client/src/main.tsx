import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { FrontiereErreur } from './components/FrontiereErreur';
import { startSyncLoop } from './sync/engine';
import { ensurePersistentStorage } from './lib/storage';
import { demarrerTheme } from './lib/theme';
import '@fontsource-variable/inter';
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import './styles.css';

demarrerTheme();
registerSW({ immediate: true });
startSyncLoop();
void ensurePersistentStorage();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FrontiereErreur portee="application">
      <App />
    </FrontiereErreur>
  </React.StrictMode>,
);
