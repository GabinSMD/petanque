import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { BouleLogo } from '../App';
import { getMeta, wipeLocalData } from '../db/local';
import { postJson } from '../lib/api';
import { getSession, setSession, type Session } from '../lib/session';
import { syncNow } from '../sync/engine';

type Mode = 'login' | 'register';

interface AuthResponse {
  token: string;
  user: Session['user'];
  org: Session['org'];
}

export function LoginPage() {
  const navigate = useNavigate();
  const existing = getSession();
  const [mode, setMode] = useState<Mode>('login');
  const [orgName, setOrgName] = useState('');
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res =
        mode === 'login'
          ? await postJson<AuthResponse>('/api/auth/login', { email, password })
          : await postJson<AuthResponse>('/api/auth/register', {
              orgName,
              userName,
              email,
              password,
            });
      // Les données locales appartiennent à une organisation : purge si on change.
      const localOrg = await getMeta<string>('orgId');
      if (localOrg && localOrg !== res.org.id) {
        await wipeLocalData();
      }
      setSession({ token: res.token, user: res.user, org: res.org });
      void syncNow();
      navigate('/', { replace: true });
    } catch (err) {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine;
      setError(
        offline
          ? 'Impossible de joindre le serveur (hors ligne).'
          : err instanceof Error
            ? err.message
            : 'Erreur inattendue',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <BouleLogo />
          <h1>
            Pétanque <strong>Concours</strong>
          </h1>
        </div>
        <p className="login-tagline">
          Gestion de concours en ligne — poules, tableaux, consolante.
          <br />
          Fonctionne aussi <strong>sans connexion</strong> au boulodrome.
        </p>

        <div className="login-tabs">
          <button
            className={mode === 'login' ? 'active' : ''}
            onClick={() => setMode('login')}
            type="button"
          >
            Connexion
          </button>
          <button
            className={mode === 'register' ? 'active' : ''}
            onClick={() => setMode('register')}
            type="button"
          >
            Créer un compte club
          </button>
        </div>

        <form onSubmit={(e) => void submit(e)}>
          {mode === 'register' && (
            <>
              <label>
                Nom du club / de l'organisation
                <input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="La Boule Joyeuse"
                  required
                  minLength={2}
                />
              </label>
              <label>
                Votre nom
                <input
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Prénom Nom"
                  required
                  minLength={2}
                />
              </label>
            </>
          )}
          <label>
            E-mail
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="club@example.fr"
              required
            />
          </label>
          <label>
            Mot de passe
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="8 caractères minimum"
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? '…' : mode === 'login' ? 'Se connecter' : 'Créer le compte'}
          </button>
        </form>

        {existing && (
          <button
            className="btn btn-ghost btn-block"
            onClick={() => navigate('/', { replace: true })}
            type="button"
          >
            Continuer hors ligne — {existing.org.name}
          </button>
        )}
      </div>
    </div>
  );
}
