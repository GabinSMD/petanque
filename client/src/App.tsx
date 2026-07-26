import type { ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useSession } from './db/hooks';
import { clearSession } from './lib/session';
import { wipeLocalData } from './db/local';
import { SyncBadge } from './components/SyncBadge';
import { ChatBot } from './components/ChatBot';
import { TourHost } from './components/Tour';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ConcoursPage } from './pages/ConcoursPage';
import { DisplayPage } from './pages/DisplayPage';
import { PublicPage } from './pages/PublicPage';

function Layout() {
  const session = useSession();
  const guest = session?.guest === true;

  const logout = async () => {
    const message = guest
      ? 'Quitter le mode invité ? Vos concours ne sont PAS sauvegardés en ligne : ' +
        'ils seront définitivement effacés. Créez plutôt un compte pour les conserver.'
      : 'Se déconnecter ? Les données locales de cet appareil seront effacées ' +
        '(elles restent sauvegardées sur le serveur si elles ont été synchronisées).';
    if (!window.confirm(message)) return;
    await wipeLocalData();
    clearSession();
  };

  return (
    <div className="app">
      <header className="app-header no-print">
        <Link to="/" className="brand">
          <BouleLogo />
          <span>
            Pétanque <strong>Concours</strong>
          </span>
        </Link>
        <div className="header-right">
          <SyncBadge />
          {session && (
            <div className="user-box">
              <span className="org-name" title={session.user.name}>
                {session.org.name}
              </span>
              {guest && (
                <Link className="btn btn-sm btn-header-cta" to="/login">
                  Créer un compte
                </Link>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => void logout()}>
                {guest ? 'Quitter' : 'Déconnexion'}
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <ChatBot />
      <TourHost />
    </div>
  );
}

export function BouleLogo() {
  return (
    <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden>
      <circle cx="16" cy="16" r="14" fill="#d8dde2" stroke="#4a545e" strokeWidth="2" />
      <path d="M4 12 A 14 14 0 0 1 28 12" fill="none" stroke="#4a545e" strokeWidth="1.5" />
      <path d="M4 20 A 14 14 0 0 0 28 20" fill="none" stroke="#4a545e" strokeWidth="1.5" />
      <circle cx="24" cy="25" r="4.5" fill="#d21c34" stroke="#7c1220" strokeWidth="1.5" />
    </svg>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession();
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/p/:token" element={<PublicPage />} />
        <Route
          path="/concours/:id/affichage"
          element={
            <RequireAuth>
              <DisplayPage />
            </RequireAuth>
          }
        />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/concours/:id" element={<ConcoursPage />} />
          <Route path="/concours/:id/:tab" element={<ConcoursPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
