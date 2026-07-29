/**
 * Point d'entrée de la page vitrine — document distinct de l'application.
 *
 * Il ne charge que la page de présentation : ni routeur, ni base locale, ni
 * moteur de tournoi, ni service worker. Un visiteur qui lit une page de
 * présentation n'a pas à télécharger toute l'application, et aucune donnée
 * locale n'est créée sur ce nom de domaine.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { LandingPage } from './pages/LandingPage';
import '@fontsource-variable/inter';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LandingPage />
  </React.StrictMode>,
);
