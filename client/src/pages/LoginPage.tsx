import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { BouleLogo } from '../App';
import {
  adoptLocalDataForNewOrg,
  getMeta,
  hasLocalConcours,
  setMeta,
  wipeLocalData,
} from '../db/local';
import { postJson } from '../lib/api';
import {
  GUEST_ORG_ID,
  getSession,
  setSession,
  startGuestSession,
  type Session,
} from '../lib/session';
import { versionCourte, versionDetaillee } from '../lib/version';
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
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const wasGuest = getSession()?.guest === true;
      const res =
        mode === 'login'
          ? await postJson<AuthResponse>('/api/auth/login', { email, password })
          : await postJson<AuthResponse>('/api/auth/register', {
              orgName,
              userName,
              email,
              password,
              inviteCode: inviteCode.trim() || undefined,
            });
      if (wasGuest) {
        // Données créées en mode invité : proposer de les rattacher au compte.
        if (
          (await hasLocalConcours()) &&
          window.confirm(
            'Conserver les concours créés en mode invité et les rattacher à ce ' +
              'compte ? Ils seront alors sauvegardés en ligne.',
          )
        ) {
          await adoptLocalDataForNewOrg();
        } else {
          await wipeLocalData();
        }
      } else {
        // Les données locales appartiennent à une organisation : purge si on change.
        const localOrg = await getMeta<string>('orgId');
        if (localOrg && localOrg !== res.org.id) {
          await wipeLocalData();
        }
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
              {!inviteCode.trim() && (
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
              )}
              <label>
                Code d'invitation{' '}
                <span className="label-hint">(facultatif — pour rejoindre un club existant)</span>
                <input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Ex. K7MT2WQD"
                  maxLength={20}
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

        {!existing?.guest && (
          <>
            <div className="login-divider">ou</div>
            <button
              className="btn btn-block"
              type="button"
              onClick={() => void startGuest()}
            >
              🚀 Essayer sans compte (mode invité)
            </button>
            <p className="login-guest-hint">
              Tout fonctionne, mais uniquement sur cet appareil. Créez un compte plus
              tard : vos concours invité pourront y être rattachés et sauvegardés en
              ligne.
            </p>
          </>
        )}

        <p className="login-version" title={versionDetaillee()}>
          {versionCourte()}
        </p>
      </div>
    </div>
  );

  async function startGuest(): Promise<void> {
    const localOrg = await getMeta<string>('orgId');
    if (localOrg && localOrg !== GUEST_ORG_ID) {
      if (
        !window.confirm(
          'Des données d\'un autre compte existent sur cet appareil : elles seront ' +
            'effacées pour démarrer le mode invité. Continuer ?',
        )
      ) {
        return;
      }
      await wipeLocalData();
    }
    await setMeta('orgId', GUEST_ORG_ID);
    startGuestSession();
    void syncNow(); // met immédiatement le badge en « Mode invité »
    navigate('/', { replace: true });
  }
}
