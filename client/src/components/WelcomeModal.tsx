import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createDemoConcours } from '../db/actions';
import { startTour } from '../help/tourState';
import { dashboardTour } from '../help/tours';
import { BouleLogo } from './BouleLogo';

const WELCOME_KEY = 'petanque.welcomeDone';

export function isWelcomeDone(): boolean {
  return localStorage.getItem(WELCOME_KEY) === '1';
}

function markDone(): void {
  localStorage.setItem(WELCOME_KEY, '1');
}

/** Écran de bienvenue à la première utilisation. */
export function WelcomeModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const close = () => {
    markDone();
    onClose();
  };

  const visit = () => {
    markDone();
    onClose();
    startTour(dashboardTour);
  };

  const demo = async () => {
    setBusy(true);
    markDone();
    const id = await createDemoConcours();
    onClose();
    navigate(`/concours/${id}`);
  };

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal welcome-modal" onClick={(e) => e.stopPropagation()}>
        <div className="welcome-brand">
          <BouleLogo />
          <h2>Bienvenue sur Pétanque Concours !</h2>
        </div>
        <p>Organisez vos concours de bout en bout, même sans connexion :</p>
        <ul className="welcome-list">
          <li>🎲 <strong>Poules à la FFPJP</strong> — tirage, barrage, qualifications automatiques.</li>
          <li>🏆 <strong>Tableaux</strong> — cadrage, consolante, correction en cascade.</li>
          <li>📡 <strong>Hors ligne</strong> — tout fonctionne au boulodrome, la synchronisation reprend au retour du réseau.</li>
        </ul>
        <div className="welcome-actions">
          <button className="btn btn-primary" onClick={visit}>
            🎓 Commencer la visite guidée
          </button>
          <button className="btn" onClick={() => void demo()} disabled={busy}>
            {busy ? 'Création…' : '🎯 Créer un concours d\'exemple'}
          </button>
          <button className="btn btn-ghost" onClick={close}>
            Plus tard
          </button>
        </div>
        <p className="welcome-hint">
          Vous retrouverez la visite guidée et tous les guides pas à pas dans
          l'assistant 💬 (en bas à droite).
        </p>
      </div>
    </div>
  );
}
