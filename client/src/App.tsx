import type { ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useSession } from './db/hooks';
import { clearSession } from './lib/session';
import { wipeLocalData } from './db/local';
import { SyncBadge } from './components/SyncBadge';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ConcoursPage } from './pages/ConcoursPage';
import { DisplayPage } from './pages/DisplayPage';

function Layout() {
  const session = useSession();

  const logout = async () => {
    if (
      !window.confirm(
        'Se déconnecter ? Les données locales de cet appareil seront effacées ' +
          '(elles restent sauvegardées sur le serveur si elles ont été synchronisées).',
      )
    ) {
      return;
    }
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
              <button className="btn btn-ghost btn-sm" onClick={() => void logout()}>
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

export function BouleLogo() {
  return (
    <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden>
      <circle cx="16" cy="16" r="14" fill="#d8dde2" stroke="#4a545e" strokeWidth="2" />
      <path d="M4 12 A 14 14 0 0 1 28 12" fill="none" stroke="#4a545e" strokeWidth="1.5" />
      <path d="M4 20 A 14 14 0 0 0 28 20" fill="none" stroke="#4a545e" strokeWidth="1.5" />
      <circle cx="24" cy="25" r="4.5" fill="#e0862c" stroke="#8a4d12" strokeWidth="1.5" />
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
